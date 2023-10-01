// import { defineGkElement, Menu, MenuItem, Popover } from '@gitkraken/shared-web-components';
import { html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { when } from 'lit/directives/when.js';
import type { State } from '../../../../../plus/webviews/patchCreate/protocol';
import type { Serialized } from '../../../../../system/serialize';
import '../../../shared/components/button';
import '../../../shared/components/code-icon';
import '../../../commitDetails/components/gl-wip-details';

@customElement('gl-patch-create-app')
export class GlPatchCreateApp extends LitElement {
	@property({ type: Object }) state?: Serialized<State>;

	override render() {
		return html`
			<div class="commit-detail-panel scrollable">
				<main id="main" tabindex="-1">
					<div class="section section--sticky-actions">
						<div class="message-input">
							<textarea class="message-input__control" placeholder="Message"></textarea>
						</div>
						<p class="button-container">
							<span class="button-group button-group--single">
								<gl-button disabled full>Create Patch</gl-button>
								<gl-button
									disabled
									density="compact"
									aria-label="Create Patch Options..."
									title="Create Patch Options..."
									><code-icon icon="chevron-down"></code-icon
								></gl-button>
							</span>
						</p>
					</div>
					${when(
						this.state?.wip != null,
						() => html`
							<gl-wip-details
								.details=${this.state?.wip?.commit}
								.preferences=${this.state?.preferences}
								.isUncommitted=${true}
							></gl-wip-details>
						`,
						() => nothing,
					)}
				</main>
			</div>
		`;
	}

	protected override createRenderRoot() {
		return this;
	}
}
