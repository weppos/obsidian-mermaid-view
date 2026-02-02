import { App, MarkdownPostProcessorContext, Menu, setIcon } from "obsidian";
import { exportAsSvg, exportAsPng } from "./export";
import type { MermaidViewSettings, PngBackground } from "./settings";

/**
 * Resolves the background color setting to an actual color value.
 */
function resolveBackgroundColor(setting: PngBackground): string {
	const style = getComputedStyle(document.body);

	switch (setting) {
		case "theme":
			return style.getPropertyValue("--background-primary").trim() || "#ffffff";
		case "light":
			return style.getPropertyValue("--color-base-00").trim() || "#ffffff";
		case "dark":
			return style.getPropertyValue("--color-base-100").trim() || "#1e1e1e";
		default:
			return setting;
	}
}

/**
 * Generates a filename for the export based on the source file path or a default.
 */
function generateFilename(sourcePath: string, index: number): string {
	if (!sourcePath) {
		return index > 0 ? `diagram-${index + 1}` : "diagram";
	}

	// Extract basename without extension
	const parts = sourcePath.split("/");
	const filename = parts[parts.length - 1] || "diagram";
	const basename = filename.replace(/\.[^.]+$/, "");

	// Add index suffix if there might be multiple diagrams
	return index > 0 ? `${basename}-${index + 1}` : basename;
}

/**
 * Creates an export button element for a mermaid diagram.
 */
function createExportButton(
	svg: SVGSVGElement,
	filename: string,
	settings: MermaidViewSettings
): HTMLElement {
	const button = document.createElement("button");
	button.className = "mermaid-export-button";
	button.setAttribute("aria-label", "Export diagram");

	// Use Obsidian's setIcon for consistent icon rendering
	setIcon(button, "download");

	button.addEventListener("click", (event) => {
		event.preventDefault();
		event.stopPropagation();
		showExportMenu(event, svg, filename, settings);
	});

	return button;
}

/**
 * Shows the export menu with SVG and PNG options.
 */
function showExportMenu(
	event: MouseEvent,
	svg: SVGSVGElement,
	filename: string,
	settings: MermaidViewSettings
): void {
	const menu = new Menu();

	menu.addItem((item) => {
		item.setTitle("Export as SVG")
			.setIcon("file-code")
			.onClick(() => {
				void exportAsSvg(svg, { filename });
			});
	});

	menu.addItem((item) => {
		item.setTitle("Export as PNG")
			.setIcon("image")
			.onClick(() => {
				const backgroundColor = resolveBackgroundColor(settings.pngBackground);
				void exportAsPng(svg, {
					filename,
					backgroundColor,
					scale: settings.pngScale,
				});
			});
	});

	menu.showAtMouseEvent(event);
}

/**
 * Adds export functionality to a mermaid container element.
 */
function addExportToMermaid(
	mermaidEl: Element,
	sourcePath: string,
	index: number,
	settings: MermaidViewSettings
): void {
	// Check if we've already processed this element
	if (mermaidEl.classList.contains("mermaid-export-processed")) {
		return;
	}

	const svg = mermaidEl.querySelector<SVGSVGElement>("svg");
	if (!svg) {
		return;
	}

	// Mark as processed
	mermaidEl.classList.add("mermaid-export-processed");

	// Create wrapper for positioning the export button
	const wrapper = document.createElement("div");
	wrapper.className = "mermaid-export-wrapper";

	// Move the mermaid content into the wrapper
	const parent = mermaidEl.parentElement;
	if (!parent) return;

	parent.insertBefore(wrapper, mermaidEl);
	wrapper.appendChild(mermaidEl);

	// Add export button
	const filename = generateFilename(sourcePath, index);
	const button = createExportButton(svg, filename, settings);
	wrapper.appendChild(button);
}

/**
 * Waits for an SVG element to appear in a mermaid container.
 * Mermaid diagrams render asynchronously, so we need to observe for changes.
 */
function waitForSvg(mermaidEl: Element, timeout = 5000): Promise<SVGSVGElement | null> {
	return new Promise((resolve) => {
		// Check if SVG already exists
		const existingSvg = mermaidEl.querySelector<SVGSVGElement>("svg");
		if (existingSvg) {
			resolve(existingSvg);
			return;
		}

		// Set up observer to wait for SVG
		const observer = new MutationObserver((mutations, obs) => {
			const svg = mermaidEl.querySelector<SVGSVGElement>("svg");
			if (svg) {
				obs.disconnect();
				resolve(svg);
			}
		});

		observer.observe(mermaidEl, {
			childList: true,
			subtree: true,
		});

		// Timeout fallback
		setTimeout(() => {
			observer.disconnect();
			resolve(mermaidEl.querySelector<SVGSVGElement>("svg"));
		}, timeout);
	});
}

/**
 * Processes a mermaid element to add export functionality.
 */
function processMermaidElement(
	mermaidEl: Element,
	sourcePath: string,
	index: number,
	settings: MermaidViewSettings
): void {
	void waitForSvg(mermaidEl).then((svg) => {
		if (svg) {
			addExportToMermaid(mermaidEl, sourcePath, index, settings);
		}
	});
}

/**
 * Registers the markdown post-processor for mermaid export functionality.
 * This handles Reading View.
 */
export function registerMermaidExportPostProcessor(
	app: App,
	settings: MermaidViewSettings,
	register: (processor: (el: HTMLElement, ctx: MarkdownPostProcessorContext) => void) => void
): void {
	register((el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
		const mermaidElements = el.querySelectorAll(".mermaid");

		mermaidElements.forEach((mermaidEl, index) => {
			processMermaidElement(mermaidEl, ctx.sourcePath, index, settings);
		});
	});
}

/**
 * Creates a MutationObserver to handle mermaid diagrams in Live Preview mode.
 * Returns a cleanup function to stop observing.
 */
export function createLivePreviewExportObserver(
	app: App,
	settings: MermaidViewSettings
): () => void {
	let diagramCounter = 0;

	const processElement = (el: Element): void => {
		// Look for mermaid containers in Live Preview
		// Structure: .cm-preview-code-block.cm-embed-block.cm-lang-mermaid > .mermaid > svg
		if (el.matches?.(".cm-preview-code-block.cm-lang-mermaid")) {
			const mermaidEl = el.querySelector(".mermaid");
			if (mermaidEl && !mermaidEl.classList.contains("mermaid-export-processed")) {
				// Try to get source path from the active file
				const sourcePath = app.workspace.getActiveFile()?.path ?? "";
				processMermaidElement(mermaidEl, sourcePath, diagramCounter++, settings);
			}
		}

		// Also check for .mermaid elements directly (Reading View structure)
		if (el.matches?.(".mermaid") && !el.classList.contains("mermaid-export-processed")) {
			const sourcePath = app.workspace.getActiveFile()?.path ?? "";
			processMermaidElement(el, sourcePath, diagramCounter++, settings);
		}
	};

	const observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			for (const node of Array.from(mutation.addedNodes)) {
				if (node instanceof HTMLElement) {
					// Check the node itself
					processElement(node);

					// Check children for mermaid containers
					const mermaidContainers = node.querySelectorAll(".cm-preview-code-block.cm-lang-mermaid");
					mermaidContainers.forEach(processElement);

					// Also check for .mermaid elements directly
					const mermaidElements = node.querySelectorAll(".mermaid");
					mermaidElements.forEach(processElement);
				}
			}
		}
	});

	// Observe the entire document
	observer.observe(document.body, {
		childList: true,
		subtree: true,
	});

	// Process any existing mermaid diagrams
	document.querySelectorAll(".cm-preview-code-block.cm-lang-mermaid").forEach(processElement);
	document.querySelectorAll(".mermaid:not(.mermaid-export-processed)").forEach((el) => {
		const sourcePath = app.workspace.getActiveFile()?.path ?? "";
		processMermaidElement(el, sourcePath, diagramCounter++, settings);
	});

	// Return cleanup function
	return () => {
		observer.disconnect();
	};
}
