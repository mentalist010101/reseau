import { Badge, defineGkElement } from '@gitkraken/shared-web-components';
import { html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import type { Serialized } from '../../../../system/serialize';
import type { State } from '../../../commitDetails/protocol';
import { uncommittedSha } from '../commitDetails';
import '../../shared/components/button';
import './gl-commit-details';
import './gl-wip-details';

interface ExplainState {
	cancelled?: boolean;
	error?: { message: string };
	summary?: string;
}

@customElement('gl-commit-details-app')
export class GlCommitDetailsApp extends LitElement {
	@property({ type: Object })
	state?: Serialized<State>;

	@property({ type: Object })
	explain?: ExplainState;

	@state()
	get isUncommitted() {
		return this.state?.commit?.sha === uncommittedSha;
	}

	@state()
	get isStash() {
		return this.state?.commit?.stashNumber != null;
	}

	@state()
	get shortSha() {
		return this.state?.commit?.shortSha ?? '';
	}

	get navigation() {
		if (this.state?.navigationStack == null) {
			return {
				back: false,
				forward: false,
			};
		}

		const actions = {
			back: true,
			forward: true,
		};

		if (this.state.navigationStack.count <= 1) {
			actions.back = false;
			actions.forward = false;
		} else if (this.state.navigationStack.position === 0) {
			actions.back = true;
			actions.forward = false;
		} else if (this.state.navigationStack.position === this.state.navigationStack.count - 1) {
			actions.back = false;
			actions.forward = true;
		}

		return actions;
	}

	constructor() {
		super();

		defineGkElement(Badge);
	}

	override render() {
		return html`
			<div class="commit-detail-panel scrollable">
				<main id="main" tabindex="-1">
					<nav class="details-tab">
						<button
							class="details-tab__item ${this.state?.mode === 'commit' ? ' is-active' : ''}"
							data-action="details"
						>
							Details
						</button>
						<button
							class="details-tab__item ${this.state?.mode === 'wip' ? ' is-active' : ''}"
							data-action="wip"
						>
							WIP${this.state?.wip?.changes
								? html` <gk-badge variant="filled">${this.state?.wip?.changes}</gk-badge>`
								: ''}
						</button>
					</nav>
					${when(
						this.state?.mode === 'commit',
						() =>
							html`<gl-commit-details
								.state=${this.state}
								.details=${this.state?.commit}
								.explain=${this.explain}
								.preferences=${this.state?.preferences}
								.isUncommitted=${this.isUncommitted}
							></gl-commit-details>`,
						() =>
							html`<gl-wip-details
								.details=${this.state?.wip?.commit}
								.preferences=${this.state?.preferences}
								.isUncommitted=${true}
							></gl-wip-details>`,
					)}
				</main>
			</div>
		`;
	}

	protected override createRenderRoot() {
		return this;
	}
}
