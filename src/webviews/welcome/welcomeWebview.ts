import { Disposable } from 'vscode';
import type { Container } from '../../container';
import { configuration } from '../../system/configuration';
import type { WebviewController, WebviewProvider } from '../webviewController';
import type { State } from './protocol';

export class WelcomeWebviewProvider implements WebviewProvider<State> {
	private readonly _disposable: Disposable;

	constructor(private readonly container: Container, private readonly host: WebviewController<State>) {
		this._disposable = Disposable.from();
	}

	dispose() {
		this._disposable.dispose();
	}

	includeBootstrap(): State {
		return {
			timestamp: Date.now(),
			// Make sure to get the raw config, not from the container which has the modes mixed in
			config: configuration.getAll(true),
		};
	}
}
