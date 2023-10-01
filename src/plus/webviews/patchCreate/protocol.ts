import type { Config } from '../../../config';
import type { WebviewIds, WebviewViewIds } from '../../../constants';
import type { GitFileChangeShape } from '../../../git/models/file';
import type { Serialized } from '../../../system/serialize';
import { IpcNotificationType } from '../../../webviews/protocol';

export interface RangeRef {
	baseSha: string;
	sha: string | undefined;
	branchName: string;
	// shortSha: string;
	// summary: string;
	// message: string;
	// author: GitCommitIdentityShape & { avatar: string | undefined };
	// committer: GitCommitIdentityShape & { avatar: string | undefined };
	// parents: string[];
	// repoPath: string;
	// stashNumber?: string;
}

export interface Change {
	repository: { name: string; path: string };
	range: RangeRef;
	files: GitFileChangeShape[];
	type: 'commit' | 'wip';
}

export interface State {
	webviewId: WebviewIds | WebviewViewIds;
	timestamp: number;
	preferences: Preferences;
	changes?: Change[];
}

export interface Preferences {
	files: Config['views']['patchCreate']['files'];
	indentGuides: 'none' | 'onHover' | 'always';
}

// NOTIFICATIONS

export interface DidChangeParams {
	state: Serialized<State>;
}
export const DidChangeNotificationType = new IpcNotificationType<DidChangeParams>('patchCreate/didChange', true);

export type DidChangeChangesParams = Pick<Serialized<State>, 'changes'>;
export const DidChangeChangesNotificationType = new IpcNotificationType<DidChangeChangesParams>(
	'patchCreate/didChange/wip',
);
