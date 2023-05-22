/*global*/
import './welcome.scss';
import type { Disposable } from 'vscode';
import { ExecuteCommandType } from '../../protocol';
import type { State } from '../../welcome/protocol';
import { AppWithConfig } from '../shared/appWithConfigBase';
import { DOM } from '../shared/dom';
// import { Snow } from '../shared/snow';
import '../shared/components/code-icon';
import './components/button';
import './components/card';

export class WelcomeApp extends AppWithConfig<State> {
	constructor() {
		super('WelcomeApp');
	}

	protected override onBind(): Disposable[] {
		const disposables = super.onBind?.() ?? [];

		disposables.push(
			DOM.on('[data-command]', 'click', (e, target: HTMLElement) => this.onDataCommandClicked(e, target)),
		);

		return disposables;
	}

	private onDataCommandClicked(_e: MouseEvent, target: HTMLElement) {
		console.log(target);
		const action = target.dataset.command;
		this.onActionClickedCore(action);
	}

	private onActionClickedCore(action?: string) {
		if (action?.startsWith('command:')) {
			this.sendCommand(ExecuteCommandType, { command: action.slice(8) });
		}
	}
}

new WelcomeApp();
// requestAnimationFrame(() => new Snow());
