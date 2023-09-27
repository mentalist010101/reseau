import type { TemplateResult } from 'lit';
import { html, LitElement, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import type { HierarchicalItem } from '../../../../system/array';
import { makeHierarchical } from '../../../../system/array';
import type { Serialized } from '../../../../system/serialize';
import type { CommitDetails, Preferences, State } from '../../../commitDetails/protocol';

type Files = NonNullable<NonNullable<State['commit']>['files']>;
type File = Files[0];

export class GlDetailsBase extends LitElement {
	@property({ type: Object })
	details?: Serialized<CommitDetails>;

	@property({ type: Object })
	preferences?: Preferences;

	@property({ type: Boolean })
	isUncommitted = false;

	@state()
	get isStash() {
		return this.details?.stashNumber != null;
	}

	@state()
	get shortSha() {
		return this.details?.shortSha ?? '';
	}

	private renderCommitStats(details?: Serialized<CommitDetails>) {
		if (details?.stats?.changedFiles == null) {
			return undefined;
		}

		if (typeof details.stats.changedFiles === 'number') {
			return html`<commit-stats added="?" modified="${details.stats.changedFiles}" removed="?"></commit-stats>`;
		}

		const { added, deleted, changed } = details.stats.changedFiles;
		return html`<commit-stats added="${added}" modified="${changed}" removed="${deleted}"></commit-stats>`;
	}

	private renderFileList(files: CommitDetails['files'] = [], isUncommitted = false) {
		// const files = this.state!.commit!.files!;

		let items;
		let classes;

		if (isUncommitted) {
			items = [];
			classes = `indentGuides-${this.preferences?.indentGuides}`;

			const staged = files.filter(f => f.staged);
			if (staged.length) {
				items.push(html`<list-item tree branch hide-icon>Staged Changes</list-item>`);

				for (const f of staged) {
					items.push(this.renderFile(f, 2, true));
				}
			}

			const unstaged = files.filter(f => !f.staged);
			if (unstaged.length) {
				items.push(html`<list-item tree branch hide-icon>Unstaged Changes</list-item>`);

				for (const f of unstaged) {
					items.push(this.renderFile(f, 2, true));
				}
			}
		} else {
			items = files.map(f => this.renderFile(f));
		}

		return html`<list-container class=${classes ?? nothing}>${items}</list-container>`;
	}

	private renderFileTree(files: CommitDetails['files'] = [], isUncommitted = false) {
		// const files = this.state!.commit!.files!;
		const compact = this.preferences?.files?.compact ?? true;

		let items;

		if (isUncommitted) {
			items = [];

			const staged = files.filter(f => f.staged);
			if (staged.length) {
				items.push(html`<list-item tree branch hide-icon>Staged Changes</list-item>`);
				items.push(...this.renderFileSubtree(staged, 1, compact));
			}

			const unstaged = files.filter(f => !f.staged);
			if (unstaged.length) {
				items.push(html`<list-item tree branch hide-icon>Unstaged Changes</list-item>`);
				items.push(...this.renderFileSubtree(unstaged, 1, compact));
			}
		} else {
			items = this.renderFileSubtree(files, 0, compact);
		}

		return html`<list-container class="indentGuides-${this.preferences?.indentGuides}">${items}</list-container>`;
	}

	private renderFileSubtree(files: Files, rootLevel: number, compact: boolean) {
		const tree = makeHierarchical(
			files,
			n => n.path.split('/'),
			(...parts: string[]) => parts.join('/'),
			compact,
		);
		const flatTree = flattenHeirarchy(tree);
		return flatTree.map(({ level, item }) => {
			if (item.name === '') return undefined;

			if (item.value == null) {
				return html`
					<list-item level="${rootLevel + level}" tree branch>
						<code-icon slot="icon" icon="folder" title="Directory" aria-label="Directory"></code-icon>
						${item.name}
					</list-item>
				`;
			}

			return this.renderFile(item.value, rootLevel + level, true);
		});
	}

	private renderFile(file: File, level: number = 1, tree: boolean = false): TemplateResult<1> {
		return html`
			<file-change-list-item
				?tree=${tree}
				level="${level}"
				?stash=${this.isStash}
				?uncommitted=${this.isUncommitted}
				icon="${file.icon.dark}"
				path="${file.path}"
				repo="${file.repoPath}"
				?staged=${file.staged}
				status="${file.status}"
			></file-change-list-item>
		`;
	}

	protected renderChangedFiles() {
		const layout = this.preferences?.files?.layout ?? 'auto';
		const files = this.details?.files;

		let value = 'tree';
		let icon = 'list-tree';
		let label = 'View as Tree';
		let isTree = false;
		if (this.preferences != null && files != null) {
			if (layout === 'auto') {
				isTree = files.length > (this.preferences.files?.threshold ?? 5);
			} else {
				isTree = layout === 'tree';
			}

			switch (layout) {
				case 'auto':
					value = 'list';
					icon = 'gl-list-auto';
					label = 'View as List';
					break;
				case 'list':
					value = 'tree';
					icon = 'list-flat';
					label = 'View as Tree';
					break;
				case 'tree':
					value = 'auto';
					icon = 'list-tree';
					label = 'View as Auto';
					break;
			}
		}

		return html`
			<webview-pane collapsable expanded>
				<span slot="title">Files changed </span>
				<span slot="subtitle" data-region="stats">${this.renderCommitStats(this.details)}</span>
				<action-nav slot="actions">
					<action-item
						data-action="files-layout"
						data-files-layout="${value}"
						label="${label}"
						icon="${icon}"
					></action-item>
				</action-nav>

				<div class="change-list" data-region="files">
					${when(
						files == null,
						() => html`
							<div class="section section--skeleton">
								<skeleton-loader></skeleton-loader>
							</div>
							<div class="section section--skeleton">
								<skeleton-loader></skeleton-loader>
							</div>
							<div class="section section--skeleton">
								<skeleton-loader></skeleton-loader>
							</div>
						`,
						() =>
							isTree
								? this.renderFileTree(files, this.isUncommitted)
								: this.renderFileList(files, this.isUncommitted),
					)}
				</div>
			</webview-pane>
		`;
	}

	protected override createRenderRoot() {
		return this;
	}
}

function flattenHeirarchy<T>(item: HierarchicalItem<T>, level = 0): { level: number; item: HierarchicalItem<T> }[] {
	const flattened: { level: number; item: HierarchicalItem<T> }[] = [];
	if (item == null) return flattened;

	flattened.push({ level: level, item: item });

	if (item.children != null) {
		const children = Array.from(item.children.values());
		children.sort((a, b) => {
			if (!a.value || !b.value) {
				return (a.value ? 1 : -1) - (b.value ? 1 : -1);
			}

			if (a.relativePath < b.relativePath) {
				return -1;
			}

			if (a.relativePath > b.relativePath) {
				return 1;
			}

			return 0;
		});

		children.forEach(child => {
			flattened.push(...flattenHeirarchy(child, level + 1));
		});
	}

	return flattened;
}
