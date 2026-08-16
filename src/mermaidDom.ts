/**
 * Waits for an SVG element to appear in a mermaid container.
 * Mermaid diagrams render asynchronously, so we need to observe for changes.
 */
export function waitForSvg(container: Element, timeout = 5000): Promise<SVGSVGElement | null> {
	return new Promise((resolve) => {
		// Check if SVG already exists
		const existingSvg = container.querySelector<SVGSVGElement>("svg");
		if (existingSvg) {
			resolve(existingSvg);
			return;
		}

		// Set up observer to wait for SVG
		const observer = new MutationObserver((mutations, obs) => {
			const svg = container.querySelector<SVGSVGElement>("svg");
			if (svg) {
				obs.disconnect();
				container.win.clearTimeout(timer);
				resolve(svg);
			}
		});

		observer.observe(container, {
			childList: true,
			subtree: true,
		});

		// Timeout fallback
		const timer = container.win.setTimeout(() => {
			observer.disconnect();
			resolve(container.querySelector<SVGSVGElement>("svg"));
		}, timeout);
	});
}
