import type { Serialized } from '../../../system/serialize';
import type { WebviewsController } from '../../../webviews/webviewsController';
import type { State } from './protocol';

export function registerPatchCreateWebviewView(controller: WebviewsController) {
	return controller.registerWebviewView<State, Serialized<State>>(
		{
			id: 'gitlens.views.patchCreate',
			fileName: 'patchCreate.html',
			title: 'Create Patch',
			contextKeyPrefix: `gitlens:webviewView:patchCreate`,
			trackingFeature: 'patchCreateView',
			plusFeature: true,
			webviewHostOptions: {
				retainContextWhenHidden: false,
			},
		},
		async (container, host) => {
			const { PatchCreateWebviewProvider } = await import(
				/* webpackChunkName: "patchCreate" */ './patchCreateWebview'
			);
			return new PatchCreateWebviewProvider(container, host);
		},
	);
}
