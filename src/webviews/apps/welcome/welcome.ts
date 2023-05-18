/*global*/
import './welcome.scss';
import type { State } from '../../welcome/protocol';
import { AppWithConfig } from '../shared/appWithConfigBase';
// import { Snow } from '../shared/snow';
import '../shared/components/code-icon';
import './components/button';
import './components/card';

export class WelcomeApp extends AppWithConfig<State> {
	constructor() {
		super('WelcomeApp');
	}
}

new WelcomeApp();
// requestAnimationFrame(() => new Snow());
