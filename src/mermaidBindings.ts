import { setTooltip } from "obsidian";

/**
 * A link declared by a `click` directive in the diagram source.
 */
interface MermaidLink {
	/** The node or task id, as written in the directive. */
	id: string;
	url: string;
}

// Matches `click <ids> href "<url>"` and the short form `click <ids> "<url>"`.
const CLICK_DIRECTIVE = /^[ \t]*click[ \t]+([^\s"]+)[ \t]+(?:href[ \t]+)?"([^"]+)"/;

const SAFE_PROTOCOLS = ["http:", "https:", "mailto:", "obsidian:"];

/**
 * Extracts the link targets from the `click` directives of a diagram source.
 */
export function parseMermaidLinks(source: string): MermaidLink[] {
	const links: MermaidLink[] = [];

	for (const line of source.split("\n")) {
		const match = CLICK_DIRECTIVE.exec(line);
		if (!match) continue;

		const ids = match[1];
		const url = match[2];
		if (!ids || !url || !isSafeUrl(url)) continue;

		for (const id of ids.split(",")) {
			const trimmed = id.trim();
			if (trimmed) links.push({ id: trimmed, url });
		}
	}

	return links;
}

/**
 * Extracts the diagram sources from the fenced mermaid blocks of a note.
 */
export function extractMermaidBlocks(markdown: string): string {
	// The fence can hold more than three backticks, so the closing fence matches the opening one.
	const block = /^[ \t]*(`{3,})[ \t]*mermaid[^\n]*\n([\s\S]*?)^[ \t]*\1/gm;
	const sources: string[] = [];

	let match = block.exec(markdown);
	while (match !== null) {
		if (match[2]) sources.push(match[2]);
		match = block.exec(markdown);
	}

	return sources.join("\n");
}

/**
 * Applies the interactions of the `click` directives to a rendered diagram.
 *
 * Obsidian renders Mermaid without the `bindFunctions` callback of the renderer, so the
 * links and the tooltips that Mermaid installs from that callback never reach the diagram.
 */
export function bindMermaidFunctions(svg: SVGSVGElement, source: string): void {
	bindLinks(svg, source);
	bindTooltips(svg);
}

/**
 * Opens the link of a node on click.
 * Diagram types that render an `<a>` element (flowchart) are left to Obsidian.
 */
function bindLinks(svg: SVGSVGElement, source: string): void {
	for (const link of parseMermaidLinks(source)) {
		for (const el of findLinkTargets(svg, link.id)) {
			if (el.closest("a")) continue;

			el.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				svg.win.open(link.url, "_blank");
			});
		}
	}
}

/**
 * Shows the tooltip of a node on hover.
 * Mermaid keeps the tooltip in a `title` attribute, which SVG does not display.
 */
function bindTooltips(svg: SVGSVGElement): void {
	for (const el of Array.from(svg.querySelectorAll("[title]"))) {
		const tooltip = el.getAttribute("title");
		if (!tooltip || el.querySelector(":scope > title")) continue;

		el.createSvg("title", { prepend: true }).textContent = tooltip;

		// Mermaid draws the label of a node as HTML in a `foreignObject`, which covers most
		// of the node. The Obsidian tooltip shows there without the delay of the SVG title.
		for (const label of Array.from(el.querySelectorAll<HTMLElement>("foreignObject > div"))) {
			setTooltip(label, tooltip);
		}
	}
}

/**
 * Finds the diagram elements that a `click` directive applies to.
 * Mermaid gives the shape the id of the node, and the label the same id with a `-text` suffix.
 */
function findLinkTargets(svg: SVGSVGElement, id: string): Element[] {
	const shape = CSS.escape(id);
	const label = CSS.escape(`${id}-text`);
	return Array.from(svg.querySelectorAll(`#${shape}, #${label}`));
}

/**
 * Accepts absolute URLs of a known scheme only. The URL parser normalizes the scheme
 * the same way the browser does, so obfuscated `javascript:` URLs cannot pass.
 */
function isSafeUrl(url: string): boolean {
	try {
		return SAFE_PROTOCOLS.includes(new URL(url).protocol);
	} catch {
		return false;
	}
}
