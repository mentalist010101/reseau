import type { CancellationToken, Disposable } from 'vscode';
import { CancellationTokenSource, env, Uri, window } from 'vscode';
import { executeGitCommand, GitActions } from '../../commands/gitCommands.actions';
import { configuration } from '../../configuration';
import { Commands } from '../../constants';
import type { Container } from '../../container';
import type { GitCommit } from '../../git/models/commit';
import type { GitFileChange } from '../../git/models/file';
import { GitFile } from '../../git/models/file';
import type { IssueOrPullRequest } from '../../git/models/issue';
import type { PullRequest } from '../../git/models/pullRequest';
import { executeCommand } from '../../system/command';
import { debug } from '../../system/decorators/log';
import type { Deferrable } from '../../system/function';
import { debounce } from '../../system/function';
import { getSettledValue } from '../../system/promise';
import type { Serialized } from '../../system/serialize';
import { serialize } from '../../system/serialize';
import type { LinesChangeEvent } from '../../trackers/lineTracker';
import type { IpcMessage } from '../protocol';
import { onIpc } from '../protocol';
import { WebviewViewBase } from '../webviewViewBase';
import type { CommitDetails, FileActionParams, State } from './protocol';
import {
	AutolinkSettingsCommandType,
	CommitActionsCommandType,
	DidChangeStateNotificationType,
	FileActionsCommandType,
	OpenFileCommandType,
	OpenFileComparePreviousCommandType,
	OpenFileCompareWorkingCommandType,
	OpenFileOnRemoteCommandType,
	PickCommitCommandType,
	PinCommitCommandType,
	SearchCommitCommandType,
} from './protocol';

interface Context {
	pinned: boolean;
	commit: GitCommit | undefined;

	richStateLoaded: boolean;
	formattedMessage: string | undefined;
	autolinkedIssues: IssueOrPullRequest[] | undefined;
	pullRequest: PullRequest | undefined;

	// commits: GitCommit[] | undefined;
}

export class CommitDetailsWebviewView extends WebviewViewBase<State, Serialized<State>> {
	private _bootstraping = true;
	/** The context the webview has */
	private _context: Context;
	/** The context the webview should have */
	private _pendingContext: Partial<Context> | undefined;

	private _pinned = false;

	constructor(container: Container) {
		super(container, 'gitlens.views.commitDetails', 'commitDetails.html', 'Commit Details');

		this._context = {
			pinned: false,
			commit: undefined,
			richStateLoaded: false,
			formattedMessage: undefined,
			autolinkedIssues: undefined,
			pullRequest: undefined,
		};
	}

	override async show(options?: { commit?: GitCommit; preserveFocus?: boolean | undefined }): Promise<void> {
		if (options != null) {
			let commit;
			// eslint-disable-next-line prefer-const
			({ commit, ...options } = options);
			if (commit != null) {
				this.updateCommit(commit);
				// void this.refresh();
			}
		}

		return super.show(options);
	}

	// protected override onInitializing(): Disposable[] | undefined {
	// 	return [
	// 		this.container.lineTracker.subscribe(
	// 			this,
	// 			this.container.lineTracker.onDidChangeActiveLines(this.onActiveLinesChanged, this),
	// 		),
	// 	];
	// }

	protected override async includeBootstrap(): Promise<Serialized<State>> {
		this._bootstraping = true;

		this._context = { ...this._context, ...this._pendingContext };
		this._pendingContext = undefined;

		return this.getState(this._context);
	}

	private _visibilityDisposable: Disposable | undefined;
	protected override onVisibilityChanged(visible: boolean) {
		this._visibilityDisposable?.dispose();
		this._visibilityDisposable = undefined;

		if (!visible) return;

		if (!this._pinned) {
			const { lineTracker } = this.container;

			this._visibilityDisposable = lineTracker.subscribe(
				this,
				lineTracker.onDidChangeActiveLines(this.onActiveLinesChanged, this),
			);

			let commit;
			const line = lineTracker.selections?.[0].active;
			if (line != null) {
				commit = lineTracker.getState(line)?.commit;
			}

			// keep the last selected commit if the lineTracker can't find a commit
			if (commit == null && this._context.commit != null) return;
			this.updateCommit(commit);
		}

		// Since this gets called even the first time the webview is shown, avoid sending an update, because the bootstrap has the data
		if (this._bootstraping) {
			this._bootstraping = false;

			// If the commit changed since bootstrap still send the update
			if (this._pendingContext == null || !('commit' in this._pendingContext)) {
				return;
			}
		}

		// Should be immediate, but it causes the bubbles to go missing on the chart, since the update happens while it still rendering
		this.updateState();
	}

	protected override onMessageReceived(e: IpcMessage) {
		switch (e.method) {
			case OpenFileOnRemoteCommandType.method:
				onIpc(OpenFileOnRemoteCommandType, e, params => void this.openFileOnRemote(params));
				break;
			case OpenFileCommandType.method:
				onIpc(OpenFileCommandType, e, params => void this.openFile(params));
				break;
			case OpenFileCompareWorkingCommandType.method:
				onIpc(OpenFileCompareWorkingCommandType, e, params => void this.openFileComparisonWithWorking(params));
				break;
			case OpenFileComparePreviousCommandType.method:
				onIpc(
					OpenFileComparePreviousCommandType,
					e,
					params => void this.openFileComparisonWithPrevious(params),
				);
				break;
			case FileActionsCommandType.method:
				onIpc(FileActionsCommandType, e, params => void this.showFileActions(params));
				break;
			case CommitActionsCommandType.method:
				onIpc(CommitActionsCommandType, e, params => {
					switch (params.action) {
						case 'more':
							this.showCommitActions();
							break;
						case 'sha':
							if (params.alt) {
								this.showCommitPicker();
							} else if (this._context.commit != null) {
								void env.clipboard.writeText(this._context.commit.sha);
							}
							break;
					}
				});
				break;
			case PickCommitCommandType.method:
				onIpc(PickCommitCommandType, e, _params => this.showCommitPicker());
				break;
			case SearchCommitCommandType.method:
				onIpc(SearchCommitCommandType, e, _params => this.showCommitSearch());
				break;
			case AutolinkSettingsCommandType.method:
				onIpc(AutolinkSettingsCommandType, e, _params => this.showAutolinkSettings());
				break;
			case PinCommitCommandType.method:
				onIpc(PinCommitCommandType, e, params => this.updatePinned(params.pin ?? false));
				break;
		}
	}

	private onActiveLinesChanged(e: LinesChangeEvent) {
		if (!e.pending && e.selections !== undefined) {
			const commit = this.container.lineTracker.getState(e.selections[0].active)?.commit;
			this.updateCommit(commit);
		}
	}

	private _cancellationTokenSource: CancellationTokenSource | undefined = undefined;

	@debug({ args: false })
	protected async getState(current: Context): Promise<Serialized<State>> {
		if (this._cancellationTokenSource != null) {
			this._cancellationTokenSource?.cancel();
			this._cancellationTokenSource?.dispose();
		}

		const dateFormat = configuration.get('defaultDateFormat') ?? 'MMMM Do, YYYY h:mma';

		let details;
		if (current.commit != null) {
			if (!current.commit.hasFullDetails()) {
				await current.commit.ensureFullDetails();
				// current.commit.assertsFullDetails();
			}

			details = await this.getDetailsModel(current.commit, current.formattedMessage);

			if (!current.richStateLoaded) {
				this._cancellationTokenSource = new CancellationTokenSource();

				const cancellation = this._cancellationTokenSource.token;
				setTimeout(() => {
					if (cancellation.isCancellationRequested) return;
					void this.updateRichState(cancellation);
				}, 100);
			}
		}

		// const commitChoices = await Promise.all(this.commits.map(async commit => summaryModel(commit)));

		const state = serialize<State>({
			pinned: current.pinned,
			includeRichContent: current.richStateLoaded,
			// commits: commitChoices,
			selected: details,
			autolinkedIssues: current.autolinkedIssues,
			pullRequest: current.pullRequest,

			dateFormat: dateFormat,
		});
		return state;
	}

	private async updateRichState(cancellation: CancellationToken): Promise<void> {
		const commit = this._context.commit;
		if (commit == null) return;

		const remotes = await this.container.git.getRemotesWithProviders(commit.repoPath, { sort: true });
		const remote = await this.container.git.getBestRemoteWithRichProvider(remotes);

		if (cancellation.isCancellationRequested) return;

		let autolinkedIssuesOrPullRequests;
		let pr;

		if (remote?.provider != null) {
			const [autolinkedIssuesOrPullRequestsResult, prResult] = await Promise.allSettled([
				this.container.autolinks.getLinkedIssuesAndPullRequests(commit.message ?? commit.summary, remote),
				commit.getAssociatedPullRequest({ remote: remote }),
			]);

			if (cancellation.isCancellationRequested) return;

			autolinkedIssuesOrPullRequests = getSettledValue(autolinkedIssuesOrPullRequestsResult);
			pr = getSettledValue(prResult);
		}

		// TODO: add HTML formatting option to linkify
		const formattedMessage = this.container.autolinks.linkify(
			encodeMarkup(commit.message!),
			true,
			remote != null ? [remote] : undefined,
			autolinkedIssuesOrPullRequests,
		);

		// Remove possible duplicate pull request
		if (pr != null) {
			autolinkedIssuesOrPullRequests?.delete(pr.id);
		}

		this.updatePendingContext({
			richStateLoaded: true,
			formattedMessage: formattedMessage,
			autolinkedIssues:
				autolinkedIssuesOrPullRequests != null ? [...autolinkedIssuesOrPullRequests.values()] : undefined,
			pullRequest: pr,
		});

		this.updateState();

		// return {
		// 	formattedMessage: formattedMessage,
		// 	pullRequest: pr,
		// 	autolinkedIssues:
		// 		autolinkedIssuesOrPullRequests != null
		// 			? [...autolinkedIssuesOrPullRequests.values()].filter(<T>(i: T | undefined): i is T => i != null)
		// 			: undefined,
		// };
	}

	private updateCommit(commit: GitCommit | undefined) {
		// this.commits = [commit];
		if (this._context.commit?.sha === commit?.sha) return;

		this.updatePendingContext({
			commit: commit,
			richStateLoaded: Boolean(commit?.isUncommitted),
			formattedMessage: undefined,
			autolinkedIssues: undefined,
			pullRequest: undefined,
		});
		this.updateState(true);
	}

	private updatePinned(pinned: boolean = false) {
		if (pinned === this._context.pinned) return;

		this._pinned = pinned;
		this.updatePendingContext({
			pinned: pinned,
		});

		// TODO: this is not ideal
		this.onVisibilityChanged(this.visible);
	}

	private updatePendingContext(context: Partial<Context>): boolean {
		let changed = false;
		for (const [key, value] of Object.entries(context)) {
			const current = (this._context as unknown as Record<string, unknown>)[key];
			if (
				(current instanceof Uri || value instanceof Uri) &&
				(current as any)?.toString() === value?.toString()
			) {
				continue;
			}

			if (current === value) {
				if (value !== undefined || key in this._context) continue;
			}

			if (this._pendingContext == null) {
				this._pendingContext = {};
			}

			(this._pendingContext as Record<string, unknown>)[key] = value;
			changed = true;
		}

		return changed;
	}

	private _notifyDidChangeStateDebounced: Deferrable<() => void> | undefined = undefined;

	@debug()
	private updateState(immediate: boolean = false) {
		if (!this.isReady || !this.visible) return;

		if (immediate) {
			void this.notifyDidChangeState();
			return;
		}

		if (this._notifyDidChangeStateDebounced == null) {
			this._notifyDidChangeStateDebounced = debounce(this.notifyDidChangeState.bind(this), 500);
		}

		this._notifyDidChangeStateDebounced();

		// if (this.commit == null) return;

		// const state = await this.getState(false);
		// if (state != null) {
		// 	void this.notify(DidChangeStateNotificationType, { state: state });
		// 	queueMicrotask(() => this.updateRichState());
		// }
	}

	@debug()
	private async notifyDidChangeState() {
		if (!this.isReady || !this.visible) return false;

		this._notifyDidChangeStateDebounced?.cancel();
		if (this._pendingContext == null) return false;

		const context = { ...this._context, ...this._pendingContext };

		return window.withProgress({ location: { viewId: this.id } }, async () => {
			const success = await this.notify(DidChangeStateNotificationType, {
				state: await this.getState(context),
			});
			if (success) {
				this._context = context;
				this._pendingContext = undefined;
			}
		});
	}

	// private async updateRichState() {
	// 	if (this.commit == null) return;

	// 	const richState = await this.getRichState(this.commit);
	// 	if (richState != null) {
	// 		void this.notify(DidChangeRichStateNotificationType, richState);
	// 	}
	// }

	private async getDetailsModel(commit: GitCommit, formattedMessage?: string): Promise<CommitDetails> {
		// if (commit == null) return undefined;

		// if (!commit.hasFullDetails()) {
		// 	await commit.ensureFullDetails();
		// 	commit.assertsFullDetails();
		// }

		const authorAvatar = await commit.author.getAvatarUri(commit);
		// const committerAvatar = await commit.committer?.getAvatarUri(commit);

		// const formattedMessage = this.container.autolinks.linkify(
		// 	encodeMarkup(commit.message),
		// 	true,
		// 	remote != null ? [remote] : undefined,
		// 	autolinkedIssuesOrPullRequests,
		// );

		return {
			sha: commit.sha,
			shortSha: commit.shortSha,
			// summary: commit.summary,
			message: formattedMessage ?? encodeMarkup(commit.message ?? commit.summary),
			author: { ...commit.author, avatar: authorAvatar.toString(true) },
			// committer: { ...commit.committer, avatar: committerAvatar?.toString(true) },
			files: commit.files?.map(({ status, repoPath, path, originalPath }) => {
				const icon = GitFile.getStatusIcon(status);
				return {
					path: path,
					originalPath: originalPath,
					status: status,
					repoPath: repoPath,
					icon: {
						dark: this._view!.webview.asWebviewUri(
							Uri.joinPath(this.container.context.extensionUri, 'images', 'dark', icon),
						).toString(),
						light: this._view!.webview.asWebviewUri(
							Uri.joinPath(this.container.context.extensionUri, 'images', 'light', icon),
						).toString(),
					},
				};
			}),
			stats: commit.stats,
		};
	}

	private async getFileFromParams(params: FileActionParams): Promise<GitFileChange | undefined> {
		return this._context.commit?.findFile(params.path);
	}

	private showAutolinkSettings() {
		void executeCommand(Commands.ShowSettingsPageAndJumpToAutolinks);
	}

	private showCommitSearch() {
		void executeGitCommand({ command: 'search', state: { openPickInView: true } });
	}

	private showCommitPicker() {
		void executeGitCommand({
			command: 'log',
			state: {
				reference: 'HEAD',
				repo: this._context.commit?.repoPath,
				openPickInView: true,
			},
		});
	}

	private showCommitActions() {
		if (this._context.commit == null) return;

		void GitActions.Commit.showDetailsQuickPick(this._context.commit);

		// void executeCommand(Commands.ShowQuickCommit, {
		// 	commit: this._context.commit,
		// });
	}

	private async showFileActions(params: FileActionParams) {
		if (this._context.commit == null) return;

		const file = await this.getFileFromParams(params);
		if (file == null) return;

		void GitActions.Commit.showDetailsQuickPick(this._context.commit, file);

		// const uri = GitUri.fromFile(file, this._context.commit.repoPath, this._context.commit.sha);
		// void executeCommand(Commands.ShowQuickCommitFile, uri, {
		// 	sha: this._context.commit.sha,
		// });
	}

	private async openFileComparisonWithWorking(params: FileActionParams) {
		if (this._context.commit == null) return;

		const file = await this.getFileFromParams(params);
		if (file == null) return;

		void GitActions.Commit.openChangesWithWorking(file.path, this._context.commit, {
			preserveFocus: true,
			preview: true,
			...params.showOptions,
		});

		// const uri = GitUri.fromFile(file, this._context.commit.repoPath, this._context.commit.sha);
		// void executeCommand<[Uri, DiffWithWorkingCommandArgs]>(Commands.DiffWithWorking, uri, {
		// 	showOptions: {
		// 		preserveFocus: true,
		// 		preview: true,
		// 	},
		// });
	}

	private async openFileComparisonWithPrevious(params: FileActionParams) {
		if (this._context.commit == null) return;

		const file = await this.getFileFromParams(params);
		if (file == null) return;

		void GitActions.Commit.openChanges(file.path, this._context.commit, {
			preserveFocus: true,
			preview: true,
			...params.showOptions,
		});

		// const uri = GitUri.fromFile(file, this._context.commit.repoPath, this._context.commit.sha);
		// const line = this._context.commit.lines.length ? this._context.commit.lines[0].line - 1 : 0;
		// void executeCommand<[Uri, DiffWithPreviousCommandArgs]>(Commands.DiffWithPrevious, uri, {
		// 	commit: this._context.commit,
		// 	line: line,
		// 	showOptions: {
		// 		preserveFocus: true,
		// 		preview: true,
		// 		...params.showOptions,
		// 	},
		// });
	}

	private async openFile(params: FileActionParams) {
		if (this._context.commit == null) return;

		const file = await this.getFileFromParams(params);
		if (file == null) return;

		void GitActions.Commit.openFile(file.path, this._context.commit, {
			preserveFocus: true,
			preview: true,
			...params.showOptions,
		});

		// const uri = GitUri.fromFile(file, this.commit.repoPath, this.commit.sha);
		// void executeCoreCommand(CoreCommands.Open, uri, { background: false, preview: false });
	}

	private async openFileOnRemote(params: FileActionParams) {
		if (this._context.commit == null) return;

		const file = await this.getFileFromParams(params);
		if (file == null) return;

		void GitActions.Commit.openFileOnRemote(file.path, this._context.commit);

		// const uri = GitUri.fromFile(file, this.commit.repoPath, this.commit.sha);

		// void executeCommand<[Uri, OpenFileOnRemoteCommandArgs]>(Commands.OpenFileOnRemote, uri, {
		// 	sha: this.commit?.sha,
		// });
	}
}

// async function summaryModel(commit: GitCommit): Promise<CommitSummary> {
// 	return {
// 		sha: commit.sha,
// 		shortSha: commit.shortSha,
// 		summary: commit.summary,
// 		message: commit.message,
// 		author: commit.author,
// 		avatar: (await commit.getAvatarUri())?.toString(true),
// 	};
// }

function encodeMarkup(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
