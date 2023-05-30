import { css } from 'lit';

export const linkStyles = css`
	a {
		color: var(--link-foreground);
		text-decoration: none;
	}
	a:focus {
		outline-color: var(--focus-border);
	}
	a:hover {
		color: var(--link-foreground-active);
		text-decoration: underline;
	}
`;
