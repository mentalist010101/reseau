import type { State } from '../../../../plus/webviews/patchCreate/protocol';
import { DidChangeNotificationType } from '../../../../plus/webviews/patchCreate/protocol';
import type { Serialized } from '../../../../system/serialize';
import type { IpcMessage } from '../../../protocol';
import { ExecuteCommandType, onIpc } from '../../../protocol';
import { App } from '../../shared/appBase';
import { DOM } from '../../shared/dom';
import type { GlPatchCreateApp } from './components/patch-create-app';
import '../../shared/components/actions/action-item';
import '../../shared/components/actions/action-nav';
import '../../shared/components/code-icon';
import '../../shared/components/commit/commit-identity';
import '../../shared/components/formatted-date';
import '../../shared/components/rich/issue-pull-request';
import '../../shared/components/skeleton-loader';
import '../../shared/components/commit/commit-stats';
import '../../shared/components/webview-pane';
import '../../shared/components/progress';
import '../../shared/components/list/list-container';
import '../../shared/components/list/list-item';
import '../../shared/components/list/file-change-list-item';
import './components/patch-create-app';
import './patchCreate.scss';

export class PatchCreateApp extends App<Serialized<State>> {
	constructor() {
		super('PatchCreateApp');
	}

	override onInitialize() {
		this.attachState();
	}

	protected override onMessageReceived(e: MessageEvent) {
		const msg = e.data as IpcMessage;
		this.log(`onMessageReceived(${msg.id}): name=${msg.method}`);

		switch (msg.method) {
			case DidChangeNotificationType.method:
				onIpc(DidChangeNotificationType, msg, params => {
					assertsSerialized<State>(params.state);

					this.state = params.state;
					this.setState(this.state);
					this.attachState();
				});
				break;

			default:
				super.onMessageReceived?.(e);
		}
	}

	private _component?: GlPatchCreateApp;
	private get component() {
		if (this._component == null) {
			this._component = (document.getElementById('app') as GlPatchCreateApp)!;
		}
		return this._component;
	}

	attachState() {
		this.component.state = this.state!;
	}
}

function assertsSerialized<T>(obj: unknown): asserts obj is Serialized<T> {}

new PatchCreateApp();
