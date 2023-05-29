import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { isSubscriptionStatePaidOrTrial, SubscriptionState } from '../../../../../subscription';
import './plus-feature-gate';

@customElement('plus-feature-welcome')
export class PlusFeatureWelcome extends LitElement {
	static override styles = css`
		:host {
			--background: var(--vscode-sideBar-background);
			--foreground: var(--vscode-sideBar-foreground);
			--link-foreground: var(--vscode-textLink-foreground);
			--link-foreground-active: var(--vscode-textLink-activeForeground);

			position: absolute;
			top: 0;
			left: 0;
			bottom: 0;
			right: 0;
			font-size: 1.3rem;
			overflow: auto;
			z-index: 100;

			box-sizing: border-box;
		}

		:host-context(body[data-placement='editor']) {
			--background: transparent;
			--foreground: var(--vscode-editor-foreground);

			backdrop-filter: blur(3px) saturate(0.8);
			padding: 0 2rem;
		}

		section {
			display: flex;
			flex-direction: column;
			padding: 0 2rem 1.3rem 2rem;
			background: var(--background);
			color: var(--foreground);

			height: min-content;
		}

		/* section.alert {
			--alert-foreground: var(--color-alert-foreground);
			--alert-background: var(--color-alert-infoBackground);
			--alert-border-color: var(--color-alert-infoBorder);
			--alert-hover-background: var(--color-alert-infoHoverBackground);
			display: flex;
			flex-direction: row;
			justify-content: flex-start;
			align-items: flex-start;
			gap: 1rem;
			padding: 1rem;
			border-radius: 0.25rem;
			border: 1px solid var(--alert-border-color);
			background-color: var(--alert-background);
			color: var(--alert-foreground);
			font-size: 1.2rem;
			max-width: 100rem;
			margin-left: auto;
			margin-right: auto;
		}

		section.alert.alert--warning {
			--alert-background: var(--color-alert-warningBackground);
			--alert-border-color: var(--color-alert-warningBorder);
			--alert-hover-background: var(--color-alert-warningHoverBackground);
		} */

		:host-context(body[data-placement='editor']) section {
			max-width: 600px;
			max-height: min-content;
			margin: 0.2rem auto;
			padding: 0 1.3rem;

			background: var(--color-hover-background);
			border: 1px solid var(--color-hover-border);
			border-radius: 0.3rem;
		}
	}`;

	@property({ type: Number })
	state?: SubscriptionState;

	override render() {
		if (this.state == null || isSubscriptionStatePaidOrTrial(this.state)) {
			this.setAttribute('hidden', '');
			return undefined;
		}

		this.removeAttribute('hidden');
		return html`
			<section>
				<slot hidden=${this.state === SubscriptionState.Free ? nothing : ''}></slot>
				<plus-feature-gate state=${this.state}></plus-feature-gate>
			</section>
		`;
	}
}
