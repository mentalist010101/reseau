/*global*/
import './welcome.scss';
import type { Disposable } from 'vscode';
import { ExecuteCommandType } from '../../protocol';
import type { State } from '../../welcome/protocol';
import { UpdateConfigurationCommandType } from '../../welcome/protocol';
import { App } from '../shared/appBase';
import { DOM } from '../shared/dom';
// import { Snow } from '../shared/snow';
import '../shared/components/code-icon';
import './components/button';
import './components/card';
import './components/gitlens-logo';
import './components/gitlens-plus-logo';

export class WelcomeApp extends App<State> {
	constructor() {
		super('WelcomeApp');
	}

	protected override onInitialize() {
		this.state = this.getState() ?? this.state;
		this.updateState();
	}

	protected override onBind(): Disposable[] {
		const disposables = super.onBind?.() ?? [];

		disposables.push(
			DOM.on('[data-command]', 'click', (e, target: HTMLElement) => this.onDataCommandClicked(e, target)),
			DOM.on('[data-feature]', 'change', (e, target: HTMLInputElement) => this.onFeatureToggled(e, target)),
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
			let commandName = action.slice(8);
			const args = [];
			if (commandName.includes('?')) {
				const [name, argsRaw] = decodeURIComponent(commandName).split('?');
				commandName = name;
				args.push(...argsRaw.substring(1, argsRaw.length - 1).split('|'));
			}
			this.sendCommand(ExecuteCommandType, { command: commandName, args: args as [] });
		}
	}

	private onFeatureToggled(_e: Event, target: HTMLElement) {
		const feature = target.dataset.feature;
		const enabled = (target as HTMLInputElement).checked;

		const type = feature === 'git-codelens' ? 'codeLens' : 'currentLine';
		this.state.config[type].enabled = enabled;
		this.sendCommand(UpdateConfigurationCommandType, { type: type, value: enabled });
		this.updateToggledFeatures();
	}

	private updateState() {
		this.updateVersion();
		this.updateToggledFeatures();
	}

	private updateVersion() {
		const { version } = this.state;
		document.getElementById('version')!.textContent = version;
	}

	private updateToggledFeatures() {
		const { config } = this.state;

		[
			{ id: 'git-codelens', enabled: config.codeLens.enabled ?? false },
			{ id: 'inline-blame', enabled: config.currentLine.enabled ?? false },
		].forEach(({ id, enabled }) => {
			[...document.querySelectorAll<HTMLElement>(`[data-feature="${id}"]`)].forEach((el: HTMLElement) => {
				if ((el as HTMLInputElement).type === 'checkbox') {
					(el as HTMLInputElement).checked = enabled;
				} else {
					el.classList.toggle('is-disabled', !enabled);
				}
			});
		});
	}
}

new WelcomeApp();
// requestAnimationFrame(() => new Snow());
