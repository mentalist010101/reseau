import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { focusOutline } from './a11y.css';
import { elementBase } from './base.css';

@customElement('gk-button')
export class GKButton extends LitElement {
	static override styles = [
		elementBase,
		css`
			:host {
				--button-foreground: var(--vscode-button-foreground);
				--button-background: var(--vscode-button-background);
				--button-hover-background: var(--vscode-button-hoverBackground);

				display: inline-block;
				border: none;
				padding: 0.4rem 1.1rem;
				font-family: inherit;
				font-size: inherit;
				line-height: 1.694;
				text-align: center;
				text-decoration: none;
				user-select: none;
				background: var(--button-background);
				color: var(--button-foreground);
				cursor: pointer;
				border-radius: var(--gk-action-radius);
			}
			:host(:hover) {
				background: var(--button-hover-background);
			}

			:host(:focus) {
				${focusOutline}
			}

			:host([full]) {
				width: 100%;
			}

			:host([appearance='secondary']) {
				--button-background: var(--vscode-button-secondaryBackground);
				--button-foreground: var(--vscode-button-secondaryForeground);
				--button-hover-background: var(--vscode-button-secondaryHoverBackground);
			}
		`,
	];

	@property({ type: Boolean, reflect: true })
	full = false;

	@property()
	href?: string;

	@property({ reflect: true })
	override get role() {
		return this.href ? 'link' : 'button';
	}

	@property()
	appearance?: string;

	@property({ type: Number, reflect: true })
	override tabIndex = 0;

	override render() {
		return html`<slot></slot>`;
	}
}
