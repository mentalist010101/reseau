import type { CancellationToken, ConfigurationChangeEvent, Disposable } from 'vscode';
import { CancellationTokenSource, Uri, window } from 'vscode';
import type { CoreConfiguration } from '../../../constants';
import type { Container } from '../../../container';
import type { GitCommit } from '../../../git/models/commit';
import { uncommitted } from '../../../git/models/constants';
import type { GitFileChangeShape } from '../../../git/models/file';
import { getGitFileStatusIcon } from '../../../git/models/file';
import type { GitRemote } from '../../../git/models/remote';
import type { Repository } from '../../../git/models/repository';
import { configuration } from '../../../system/configuration';
import { debug } from '../../../system/decorators/log';
import type { Deferrable } from '../../../system/function';
import { debounce } from '../../../system/function';
import { Logger } from '../../../system/logger';
import { getLogScope } from '../../../system/logger.scope';
import { getSettledValue } from '../../../system/promise';
import type { Serialized } from '../../../system/serialize';
import { serialize } from '../../../system/serialize';
import type { WebviewController, WebviewProvider } from '../../../webviews/webviewController';
import { updatePendingContext } from '../../../webviews/webviewController';
import type { Change, Preferences, State } from './protocol';
import { DidChangeChangesNotificationType, DidChangeNotificationType } from './protocol';

interface Context {
	preferences: Preferences;
	visible: boolean;
	changes: Change[] | undefined;
}

export class PatchCreateWebviewProvider implements WebviewProvider<State, Serialized<State>> {
	private _bootstraping = true;
	/** The context the webview has */
	private _context: Context;
	/** The context the webview should have */
	private _pendingContext: Partial<Context> | undefined;
	private readonly _disposable: Disposable;
	private _focused = false;

	constructor(
		private readonly container: Container,
		private readonly host: WebviewController<State, Serialized<State>>,
	) {
		this._context = {
			preferences: {
				files: configuration.get('views.patchCreate.files'),
				indentGuides:
					configuration.getAny<CoreConfiguration, Preferences['indentGuides']>(
						'workbench.tree.renderIndentGuides',
					) ?? 'onHover',
			},
			visible: false,
			changes: undefined,
		};
		this._disposable = configuration.onDidChangeAny(this.onAnyConfigurationChanged, this);
	}

	dispose() {
		this._disposable.dispose();
	}

	onFocusChanged(focused: boolean): void {
		if (this._focused === focused) return;

		this._focused = focused;
		// if (focused) {
		// 	this.ensureTrackers();
		// }
	}

	onVisibilityChanged(visible: boolean) {
		// this.ensureTrackers();
		this.updatePendingContext({ visible: visible });
		if (!visible) return;

		// Since this gets called even the first time the webview is shown, avoid sending an update, because the bootstrap has the data
		if (this._bootstraping) {
			this._bootstraping = false;

			if (this._pendingContext == null) return;
		}

		// this.onRefresh();
		this.updateState(true);
	}

	private onAnyConfigurationChanged(e: ConfigurationChangeEvent) {
		if (
			configuration.changed(e, ['defaultDateFormat', 'views.patchCreate.files', 'views.patchCreate.avatars']) ||
			configuration.changedAny<CoreConfiguration>(e, 'workbench.tree.renderIndentGuides')
		) {
			this.updatePendingContext({
				preferences: {
					...this._context.preferences,
					...this._pendingContext?.preferences,
					files: configuration.get('views.patchCreate.files'),
					indentGuides:
						configuration.getAny<CoreConfiguration, Preferences['indentGuides']>(
							'workbench.tree.renderIndentGuides',
						) ?? 'onHover',
				},
			});
			this.updateState();
		}
	}

	private updatePendingContext(context: Partial<Context>, force: boolean = false): boolean {
		const [changed, pending] = updatePendingContext(this._context, this._pendingContext, context, force);
		if (changed) {
			this._pendingContext = pending;
		}

		return changed;
	}

	private _notifyDidChangeStateDebounced: Deferrable<() => void> | undefined = undefined;

	private updateState(immediate: boolean = false) {
		if (immediate) {
			void this.notifyDidChangeState();
			return;
		}

		if (this._notifyDidChangeStateDebounced == null) {
			this._notifyDidChangeStateDebounced = debounce(this.notifyDidChangeState.bind(this), 500);
		}

		this._notifyDidChangeStateDebounced();
	}

	private _cancellationTokenSource: CancellationTokenSource | undefined = undefined;

	@debug({ args: false })
	protected getState(current: Context): Promise<Serialized<State>> {
		if (this._cancellationTokenSource != null) {
			this._cancellationTokenSource.cancel();
			this._cancellationTokenSource = undefined;
		}

		if (current.changes == null) {
			const repo = this.container.git.getBestRepositoryOrFirst();
			this._cancellationTokenSource = new CancellationTokenSource();
			if (repo != null) {
				const cancellation = this._cancellationTokenSource.token;
				setTimeout(() => {
					if (cancellation.isCancellationRequested) return;
					void this.updateWipState(repo, cancellation);
				}, 100);
			}
		}

		const state = serialize<State>({
			webviewId: this.host.id,
			timestamp: Date.now(),
			preferences: current.preferences,
			changes: current.changes,
		});

		return Promise.resolve(state);
	}

	@debug({ args: false })
	private async updateWipState(repository: Repository, cancellation?: CancellationToken): Promise<void> {
		const change = await this.getWipChange(repository);
		if (cancellation?.isCancellationRequested) return;

		const success =
			!this.host.ready || !this.host.visible
				? await this.host.notify(DidChangeChangesNotificationType, {
						changes: change != null ? [serialize<Change>(change)] : undefined,
				  })
				: false;
		if (success) {
			this._context.changes = change != null ? [change] : undefined;
		} else {
			this.updatePendingContext({ changes: change != null ? [change] : undefined });
			this.updateState();
		}
	}

	private async getWipChange(repository: Repository): Promise<Change | undefined> {
		const status = await this.container.git.getStatusForRepo(repository.path);
		return status == null
			? undefined
			: {
					type: 'wip',
					repository: {
						name: repository.name,
						path: repository.path,
					},
					files: status.files,
					range: {
						baseSha: 'HEAD',
						sha: undefined,
						branchName: status.branch,
					},
			  };
	}

	private async getCommitChange(commit: GitCommit): Promise<Change> {
		// const [commitResult, avatarUriResult, remoteResult] = await Promise.allSettled([
		// 	!commit.hasFullDetails() ? commit.ensureFullDetails().then(() => commit) : commit,
		// 	commit.author.getAvatarUri(commit, { size: 32 }),
		// 	this.container.git.getBestRemoteWithRichProvider(commit.repoPath, { includeDisconnected: true }),
		// ]);
		// commit = getSettledValue(commitResult, commit);
		// const avatarUri = getSettledValue(avatarUriResult);
		// const remote = getSettledValue(remoteResult);

		commit = !commit.hasFullDetails() ? await commit.ensureFullDetails().then(() => commit) : commit;
		const repo = commit.getRepository()!;

		return {
			type: 'commit',
			repository: {
				name: repo.name,
				path: repo.path,
			},
			range: {
				baseSha: commit.sha,
				sha: undefined,
				branchName: repo.branch.name,
			},
			files:
				commit.files?.map(({ status, repoPath, path, originalPath, staged }) => {
					return {
						repoPath: repoPath,
						path: path,
						status: status,
						originalPath: originalPath,
						staged: staged,
					};
				}) ?? [],
		};
	}

	private async notifyDidChangeState(force: boolean = false) {
		const scope = getLogScope();

		this._notifyDidChangeStateDebounced?.cancel();
		if (!force && this._pendingContext == null) return false;

		let context: Context;
		if (this._pendingContext != null) {
			context = { ...this._context, ...this._pendingContext };
			this._context = context;
			this._pendingContext = undefined;
		} else {
			context = this._context;
		}

		return window.withProgress({ location: { viewId: this.host.id } }, async () => {
			try {
				await this.host.notify(DidChangeNotificationType, {
					state: await this.getState(context),
				});
			} catch (ex) {
				Logger.error(scope, ex);
				debugger;
			}
		});
	}

	includeBootstrap(): Promise<Serialized<State>> {
		this._bootstraping = true;

		this._context = { ...this._context, ...this._pendingContext };
		this._pendingContext = undefined;

		return this.getState(this._context);
	}
}
