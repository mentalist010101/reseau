import type { Disposable } from 'vscode';
import type { Container } from '../../container';
import type { GitCloudPatch, GitPatch } from '../../git/models/patch';
import { isSha } from '../../git/models/reference';
import type { Repository } from '../../git/models/repository';
import { getSettledValue } from '../../system/promise';
import type { ServerConnection } from '../gk/serverConnection';

export const nonexistingChangesetId = '00000000-0000-0000-0000-000000000000';

export interface LocalDraft {
	readonly type: 'local';

	patch: GitPatch;
}

export interface Draft {
	readonly type: 'cloud';
	readonly id: string;

	readonly createdBy: string; // userId of creator
	readonly organizationId?: string;

	readonly deepLinkUrl: string;
	readonly isPublic: boolean;

	readonly createdAt: Date;
	readonly updatedAt: Date;

	readonly title?: string;
	readonly description?: string;

	readonly user?: {
		readonly id: string;
		readonly name: string;
		readonly email: string;
	};

	changesets?: DraftChangeset[];
}

export interface DraftChangeset {
	readonly id: string;
	readonly draftId: string;
	readonly parentChangesetId: string;

	readonly userId: string;
	readonly gitUserName: string;
	readonly gitUserEmail: string;

	readonly deepLinkUrl?: string;

	readonly createdAt: Date;
	readonly updatedAt: Date;

	readonly patches: GitCloudPatch[];
}

export interface DraftPatch {
	readonly id: string;
	// readonly draftId: string;
	readonly changesetId: string;
	readonly userId: string;

	readonly baseCommitSHA: string;
	readonly baseBranchName: string;

	contents?: string;
}

type GitRepositoryDataRequest =
	| {
			readonly initialCommitSha: string;
			readonly remoteURL?: undefined;
			readonly remoteDomain?: undefined;
			readonly remotePath?: undefined;
	  }
	| ({
			readonly initialCommitSha?: string;
			readonly remoteURL: string;
			readonly remoteDomain: string;
			readonly remotePath: string;
	  } & (
			| { readonly remoteProvider?: undefined }
			| {
					readonly remoteProvider: string;
					readonly remoteProviderRepoDomain: string;
					readonly remoteProviderRepoName: string;
					readonly remoteProviderRepoOwnerDomain?: string;
			  }
	  ));

interface GitRepositoryDataResponse {
	readonly id: string;

	readonly initialCommitSha?: string;
	readonly remoteURL?: string;
	readonly remoteDomain?: string;
	readonly remotePath?: string;
	readonly remoteProvider?: string;
	readonly remoteProviderRepoDomain?: string;
	readonly remoteProviderRepoName?: string;
	readonly remoteProviderRepoOwnerDomain?: string;

	readonly createdAt: string;
	readonly updatedAt: string;
}

interface CreateDraftRequest {
	readonly organizationId?: string;
	readonly isPublic: boolean;
}

interface CreateDraftChangesetRequest {
	readonly parentChangesetId?: string | null;
	readonly gitUserName?: string;
	readonly gitUserEmail?: string;
	readonly patches: CreateDraftPatchRequest[];
}

interface CreateDraftChangesetResponse {
	readonly id: string;
	readonly draftId: string;
	readonly parentChangesetId: string;

	readonly userId: string;
	readonly gitUserName: string;
	readonly gitUserEmail: string;

	readonly deepLink?: string;

	readonly createdAt: string;
	readonly updatedAt: string;
	readonly patches: CreateDraftPatchResponse[];
}

interface CreateDraftPatchRequest {
	readonly baseCommitSha: string;
	readonly baseBranchName: string;
	readonly gitRepoData: GitRepositoryDataRequest;
}

interface CreateDraftPatchResponse {
	readonly id: string;
	readonly changesetId: string;

	readonly baseCommitSha: string;
	readonly baseBranchName: string;
	readonly gitRepositoryId: string;

	readonly secureUploadData: {
		readonly headers: {
			readonly Host: string[];
		};
		readonly method: string;
		readonly url: string;
	};
}

interface DraftResponse {
	readonly id: string;
	readonly createdBy: string;
	readonly organizationId?: string;

	readonly deepLink: string;
	readonly isPublic: boolean;

	readonly createdAt: string;
	readonly updatedAt: string;

	readonly title?: string;
	readonly description?: string;
}

interface DraftChangesetResponse {
	readonly id: string;
	readonly draftId: string;
	readonly parentChangesetId: string;

	readonly userId: string;
	readonly gitUserName: string;
	readonly gitUserEmail: string;

	readonly deepLink?: string;

	readonly createdAt: Date;
	readonly updatedAt: Date;

	readonly patches: DraftPatchResponse[];
}

interface DraftPatchResponse {
	readonly id: string;

	readonly changesetId: string;
	readonly userId: string;

	readonly baseCommitSha: string;
	readonly baseBranchName: string;

	readonly secureDownloadData: {
		readonly url: string;
		readonly method: string;
		readonly headers: {
			readonly Host: string[];
		};
	};

	readonly gitRepositoryId: string;
	readonly gitRepositoryData: GitRepositoryDataResponse;

	readonly createdAt: string;
	readonly updatedAt: string;
}

export class DraftService implements Disposable {
	// private _disposable: Disposable;
	// private _subscription: Subscription | undefined;

	constructor(
		private readonly container: Container,
		private readonly connection: ServerConnection,
	) {
		// this._disposable = Disposable.from(container.subscription.onDidChange(this.onSubscriptionChanged, this));
	}

	dispose(): void {
		// this._disposable.dispose();
	}

	// private onSubscriptionChanged(_e: SubscriptionChangeEvent): void {
	// 	this._subscription = undefined;
	// }

	// private async ensureSubscription(force?: boolean) {
	// 	if (force || this._subscription == null) {
	// 		this._subscription = await this.container.subscription.getSubscription();
	// 	}
	// 	return this._subscription;
	// }

	async createDraft(repository: Repository, baseSha: string, contents: string): Promise<Draft | undefined> {
		// const subscription = await this.ensureSubscription();
		// if (subscription.account == null) return undefined;

		const [remoteResult, userResult, branchResult] = await Promise.allSettled([
			this.container.git.getBestRemoteWithProvider(repository.uri),
			this.container.git.getCurrentUser(repository.uri),
			repository.getBranch(),
		]);

		// TODO: what happens if there are multiple remotes -- which one should we use? Do we need to ask? See more notes below
		const remote = getSettledValue(remoteResult);
		if (remote?.provider == null) throw new Error('No Git provider found');

		const user = getSettledValue(userResult);

		const branch = getSettledValue(branchResult);
		const branchName = branch?.name ?? '';

		if (!isSha(baseSha)) {
			const commit = await repository.getCommit(baseSha);
			if (commit == null) throw new Error(`No commit found for ${baseSha}`);

			baseSha = commit.sha;
		}

		type DraftResult = { data: DraftResponse };

		// POST v1/drafts
		const draftRsp = await this.connection.fetchGkDevApi('v1/drafts', {
			method: 'POST',
			body: JSON.stringify({ /*organizationId: undefined,*/ isPublic: true } satisfies CreateDraftRequest),
		});

		const draftData = ((await draftRsp.json()) as DraftResult).data;
		const draftId = draftData.id;

		// const newDraft = await this.getDraft(draftId);
		// if (newDraft == null) return undefined;

		const repoFirstCommitSha = await this.container.git.getUniqueRepositoryId(repository.path);

		type ChangesetResult = { data: CreateDraftChangesetResponse };

		// POST /v1/drafts/:draftId/changesets
		const changesetRsp = await this.connection.fetchGkDevApi(`v1/drafts/${draftId}/changesets`, {
			method: 'POST',
			body: JSON.stringify({
				// parentChangesetId: null,
				gitUserName: user?.name,
				gitUserEmail: user?.email,
				patches: [
					{
						baseCommitSha: baseSha,
						baseBranchName: branchName,
						gitRepoData: {
							initialCommitSha:
								repoFirstCommitSha != null && repoFirstCommitSha != '-'
									? repoFirstCommitSha
									: undefined!,
							// TODO - Add other repo provider data once the model documentation is available
						},
					},
				],
			} satisfies CreateDraftChangesetRequest),
		});

		const changesetData = ((await changesetRsp.json()) as ChangesetResult).data;
		const patch = changesetData.patches[0];

		const { url, method, headers } = patch.secureUploadData;
		// const patchId = patch.id;

		// Upload patch to returned S3 url
		await this.connection.fetchRaw(url, {
			method: method,
			headers: {
				'Content-Type': 'plain/text',
				Host: headers?.['Host']?.['0'] ?? '',
			},
			body: contents,
		});

		return {
			type: 'cloud',
			id: draftId,
			createdBy: draftData.createdBy,
			organizationId: draftData.organizationId,
			deepLinkUrl: draftData.deepLink,
			isPublic: draftData.isPublic,

			createdAt: new Date(draftData.createdAt),
			updatedAt: new Date(draftData.updatedAt),

			title: draftData.title,
			description: draftData.description,

			changesets: [
				{
					id: changesetData.id,
					draftId: changesetData.draftId,
					parentChangesetId: changesetData.parentChangesetId,
					userId: changesetData.userId,
					gitUserName: changesetData.gitUserName,
					gitUserEmail: changesetData.gitUserEmail,
					deepLinkUrl: changesetData.deepLink,
					createdAt: new Date(changesetData.createdAt),
					updatedAt: new Date(changesetData.updatedAt),
					patches: changesetData.patches.map(p => ({
						type: 'cloud',
						id: p.id,
						changesetId: p.changesetId,
						userId: changesetData.userId,
						baseBranchName: p.baseBranchName,
						baseCommitSha: p.baseCommitSha,
						contents: contents,

						repo: undefined!,
					})),
				},
			],
		};
	}

	async getDraft(id: string): Promise<Draft> {
		type Result = { data: DraftResponse };

		const rsp = await this.connection.fetchGkDevApi(`v1/drafts/${id}`, {
			method: 'GET',
		});

		const result = ((await rsp.json()) as Result).data;
		const changeSets = await this.getChangesets(id); // TODO@eamodio The changesets don't come in on the GET call above, and the GET call for changesets is 404ing.
		return {
			type: 'cloud',
			id: result.id,
			createdBy: result.createdBy,
			organizationId: result.organizationId,
			deepLinkUrl: result.deepLink,
			isPublic: result.isPublic,
			createdAt: new Date(result.createdAt),
			updatedAt: new Date(result.updatedAt),
			title: result.title,
			description: result.description,
			changesets: changeSets ?? [],
		};
	}

	async getDrafts(): Promise<Draft[]> {
		type Result = { data: DraftResponse[] };

		const rsp = await this.connection.fetchGkDevApi('/v1/drafts', {
			method: 'GET',
		});

		const data = ((await rsp.json()) as Result).data;
		return data.map(
			(d): Draft => ({
				type: 'cloud',
				id: d.id,
				createdBy: d.createdBy,
				organizationId: d.organizationId,
				deepLinkUrl: d.deepLink,
				isPublic: d.isPublic,
				createdAt: new Date(d.createdAt),
				updatedAt: new Date(d.updatedAt),
				title: d.title,
				description: d.description,
			}),
		);
	}

	async getChangesets(id: string): Promise<DraftChangeset[]> {
		type Result = { data: DraftChangesetResponse[] };

		const rsp = await this.connection.fetchGkDevApi(`/v1/drafts/${id}/changesets`, {
			method: 'GET',
		});

		const data = ((await rsp.json()) as Result).data;
		return data.map(
			(d): DraftChangeset => ({
				id: d.id,
				draftId: d.draftId,
				parentChangesetId: d.parentChangesetId,
				userId: d.userId,
				gitUserName: d.gitUserName,
				gitUserEmail: d.gitUserEmail,
				deepLinkUrl: d.deepLink,
				createdAt: new Date(d.createdAt),
				updatedAt: new Date(d.updatedAt),
				patches: d.patches.map(p => ({
					type: 'cloud',
					id: p.id,
					changesetId: p.changesetId,
					userId: d.userId,
					baseBranchName: p.baseBranchName,
					baseCommitSha: p.baseCommitSha,
					contents: undefined!,

					// TODO@eamodio FIX THIS
					repo: this.container.git.getBestRepository()!,
				})),
			}),
		);
	}

	async getPatches(id: string, options?: { includeContents?: boolean }): Promise<DraftPatch[]> {
		type Result = { data: DraftPatchResponse[] };

		const rsp = await this.connection.fetchGkDevApi(`/v1/drafts/${id}/patches`, {
			method: 'GET',
		});

		const data = ((await rsp.json()) as Result).data;
		const patches = await Promise.allSettled(
			data.map(async (d): Promise<DraftPatch> => {
				let contents = undefined;
				if (options?.includeContents) {
					try {
						contents = await this.getPatchContentsCore(d.secureDownloadData);
					} catch (ex) {
						debugger;
					}
				}

				return {
					id: d.id,
					// draftId: d.draftId,
					changesetId: d.changesetId,
					userId: d.userId,
					baseBranchName: d.baseBranchName,
					baseCommitSHA: d.baseCommitSha,
					contents: contents,
				};
			}),
		);

		return patches
			.filter(
				(p: PromiseSettledResult<DraftPatch>): p is PromiseFulfilledResult<DraftPatch> =>
					p.status === 'fulfilled',
			)
			.map(p => p.value);
	}

	async getPatch(id: string): Promise<DraftPatch | undefined> {
		type Result = { data: DraftPatchResponse };

		const rsp = await this.connection.fetchGkDevApi(`/v1/patches/${id}`, {
			method: 'GET',
		});

		const data = ((await rsp.json()) as Result).data;
		const contents = await this.getPatchContentsCore(data.secureDownloadData);

		return {
			id: data.id,
			// draftId: data.draftId,
			changesetId: data.changesetId,
			userId: data.userId,
			baseBranchName: data.baseBranchName,
			baseCommitSHA: data.baseCommitSha,
			contents: contents,
		};
	}

	async getPatchContents(id: string): Promise<string | undefined> {
		type Result = { data: DraftPatchResponse };

		// GET /v1/patches/:patchId
		const rsp = await this.connection.fetchGkDevApi(`/v1/patches/${id}`, {
			method: 'GET',
		});

		const data = ((await rsp.json()) as Result).data;
		return this.getPatchContentsCore(data.secureDownloadData);
	}

	private async getPatchContentsCore(
		secureLink: DraftPatchResponse['secureDownloadData'],
	): Promise<string | undefined> {
		const { url, method, headers } = secureLink;

		// Download patch from returned S3 url
		const contentsRsp = await this.connection.fetchRaw(url, {
			method: method,
			headers: {
				Accept: 'text/plain',
				Host: headers?.['Host']?.['0'] ?? '',
			},
		});

		return contentsRsp.text();
	}
}
