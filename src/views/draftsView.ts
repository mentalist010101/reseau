import type { Disposable } from 'vscode';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import type { RepositoriesViewConfig } from '../config';
import { Commands } from '../constants';
import type { Container } from '../container';
import { unknownGitUri } from '../git/gitUri';
import { showPatchesView } from '../plus/drafts/actions';
import { ensurePlusFeaturesEnabled } from '../plus/subscription/utils';
import { executeCommand } from '../system/command';
import { gate } from '../system/decorators/gate';
import { debug } from '../system/decorators/log';
import { DraftNode } from './nodes/draftNode';
import { ViewNode } from './nodes/viewNode';
import { ViewBase } from './viewBase';
import { registerViewCommand } from './viewCommands';

export class DraftsViewNode extends ViewNode<DraftsView> {
	private _children: DraftNode[] | undefined;

	async getChildren(): Promise<ViewNode[]> {
		if (this._children == null) {
			const children: DraftNode[] = [];

			const drafts = await this.view.container.drafts.getDrafts();
			drafts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
			for (const draft of drafts) {
				children.push(new DraftNode(this.uri, this.view, this, draft));
			}

			this._children = children;
		}

		return this._children;
	}

	getTreeItem(): TreeItem {
		const item = new TreeItem('Drafts', TreeItemCollapsibleState.Expanded);
		return item;
	}

	@gate()
	@debug()
	override refresh() {
		if (this._children == null) return;

		// if (this._children.length) {
		// 	for (const child of this._children) {
		// 		if ('dispose' in child) {
		// 			child.dispose();
		// 		}
		// 	}
		// }

		this._children = undefined;
	}
}

export class DraftsView extends ViewBase<'drafts', DraftsViewNode, RepositoriesViewConfig> {
	protected readonly configKey = 'drafts';
	private _disposable: Disposable | undefined;

	constructor(container: Container) {
		super(container, 'drafts', 'Cloud Patches', 'draftsView');

		this.description = `PREVIEW\u00a0\u00a0☁️`;
	}

	override dispose() {
		this._disposable?.dispose();
		super.dispose();
	}

	override get canSelectMany(): boolean {
		return false;
	}

	protected getRoot() {
		return new DraftsViewNode(unknownGitUri, this);
	}

	override async show(options?: { preserveFocus?: boolean | undefined }): Promise<void> {
		if (!(await ensurePlusFeaturesEnabled())) return;

		// if (this._disposable == null) {
		// 	this._disposable = Disposable.from(
		// 		this.container.drafts.onDidResetDrafts(() => void this.ensureRoot().triggerChange(true)),
		// 	);
		// }

		return super.show(options);
	}

	override get canReveal(): boolean {
		return false;
	}

	protected registerCommands(): Disposable[] {
		void this.container.viewCommands;

		return [
			// registerViewCommand(
			// 	this.getQualifiedCommand('info'),
			// 	() => env.openExternal(Uri.parse('https://help.gitkraken.com/gitlens/side-bar/#drafts-☁%ef%b8%8f')),
			// 	this,
			// ),
			registerViewCommand(
				this.getQualifiedCommand('copy'),
				() => executeCommand(Commands.ViewsCopy, this.activeSelection, this.selection),
				this,
			),
			registerViewCommand(
				this.getQualifiedCommand('refresh'),
				() => {
					// this.container.drafts.resetDrafts();
				},
				this,
			),
			registerViewCommand(
				this.getQualifiedCommand('create'),
				async () => {
					await executeCommand(Commands.CreateCloudPatch);
					void this.ensureRoot().triggerChange(true);
				},
				this,
			),
			registerViewCommand(
				this.getQualifiedCommand('delete'),
				// eslint-disable-next-line @typescript-eslint/require-await
				async (node: DraftNode) => {
					// await this.container.drafts.deleteDraft(node.draft.id);
					void node.getParent()?.triggerChange(true);
				},
				this,
			),
			registerViewCommand(
				this.getQualifiedCommand('open'),
				async (node: DraftNode) => {
					let draft = node.draft;
					if (draft.changesets == null) {
						draft = await this.container.drafts.getDraft(node.draft.id);
					}
					void showPatchesView(draft);
				},
				this,
			),
		];
	}
}
