// import { defineGkElement, Menu, MenuItem, Popover } from '@gitkraken/shared-web-components';
import { html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { when } from 'lit/directives/when.js';
import type { State } from '../../../../../plus/webviews/patchDetails/protocol';
import type { Serialized } from '../../../../../system/serialize';
import '../../../shared/components/button';
import '../../../shared/components/code-icon';
import './gl-wip-details';

@customElement('gl-patch-create')
export class GlPatchCreate extends LitElement {
	@property({ type: Object }) state?: Serialized<State>;

	@state()
	patchTitle = '';

	@state()
	description = '';

	override render() {
		return html`
			<div class="section section--sticky-actions">
				<div class="message-input">
					<input type="text" class="message-input__control" placeholder="Title"></textarea>
				</div>
				<div class="message-input">
					<textarea class="message-input__control" placeholder="Description"></textarea>
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
				this.state?.create != null,
				() => html`
					<gl-wip-details
						.details=${this.state?.create?.[0]}
						.preferences=${this.state?.preferences}
						.isUncommitted=${true}
					></gl-wip-details>
				`,
				() => nothing,
			)}
		`;
	}

	protected override createRenderRoot() {
		return this;
	}
}
