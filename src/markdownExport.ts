import { App, MarkdownPostProcessorContext, Menu, Platform, setIcon } from "obsidian";
import { exportAsSvg, exportAsPng } from "./export";
import { PanZoomHandler } from "./panZoom";
import type { MermaidViewSettings, PngBackground } from "./settings";

/**
 * Resolves the background color setting to an actual color value.
 */
function resolveBackgroundColor(setting: PngBackground): string {
	const style = getComputedStyle(activeDocument.body);

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
 * Creates the toolbar with zoom controls and export button.
 */
function createToolbar(
	svg: SVGSVGElement,
	filename: string,
	settings: MermaidViewSettings,
	panZoomHandler: PanZoomHandler
): HTMLElement {
	const toolbar = activeDocument.createDiv();
	toolbar.className = "mermaid-toolbar";

	// Zoom control group
	const zoomGroup = activeDocument.createDiv();
	zoomGroup.className = "mermaid-toolbar-group";

	const zoomInBtn = activeDocument.createEl("button");
	zoomInBtn.className = "mermaid-toolbar-button";
	zoomInBtn.setAttribute("aria-label", "Zoom in");
	setIcon(zoomInBtn, "plus");
	zoomInBtn.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		panZoomHandler.zoomIn();
	});
	zoomGroup.appendChild(zoomInBtn);

	const resetBtn = activeDocument.createEl("button");
	resetBtn.className = "mermaid-toolbar-button";
	resetBtn.setAttribute("aria-label", "Reset zoom");
	setIcon(resetBtn, "rotate-cw");
	resetBtn.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		panZoomHandler.resetZoom();
	});
	zoomGroup.appendChild(resetBtn);

	const zoomOutBtn = activeDocument.createEl("button");
	zoomOutBtn.className = "mermaid-toolbar-button";
	zoomOutBtn.setAttribute("aria-label", "Zoom out");
	setIcon(zoomOutBtn, "minus");
	zoomOutBtn.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		panZoomHandler.zoomOut();
	});
	zoomGroup.appendChild(zoomOutBtn);

	toolbar.appendChild(zoomGroup);

	// Export control group
	const exportGroup = activeDocument.createDiv();
	exportGroup.className = "mermaid-toolbar-group";

	const exportBtn = activeDocument.createEl("button");
	exportBtn.className = "mermaid-toolbar-button";
	exportBtn.setAttribute("aria-label", "Export diagram");
	setIcon(exportBtn, "download");
	exportBtn.addEventListener("click", (event) => {
		event.preventDefault();
		event.stopPropagation();
		showExportMenu(event, svg, filename, settings);
	});
	exportGroup.appendChild(exportBtn);

	toolbar.appendChild(exportGroup);

	return toolbar;
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
 * Checks if an element is inside the standalone MermaidView.
 * We don't want to add toolbar/zoom there since it has its own controls.
 */
function isInsideMermaidView(el: Element): boolean {
	return el.closest(".mermaid-view-container") !== null;
}

/**
 * Adds pan/zoom and export functionality to a mermaid container element.
 */
function addToolbarToMermaid(
	mermaidEl: Element,
	sourcePath: string,
	index: number,
	settings: MermaidViewSettings
): void {
	// Check if we've already processed this element
	if (mermaidEl.classList.contains("mermaid-toolbar-processed")) {
		return;
	}

	// Skip elements inside the standalone MermaidView (it has its own controls)
	if (isInsideMermaidView(mermaidEl)) {
		return;
	}

	const svg = mermaidEl.querySelector<SVGSVGElement>("svg");
	if (!svg) {
		return;
	}

	// Mark as processed
	mermaidEl.classList.add("mermaid-toolbar-processed");

	// Create main wrapper for the diagram
	const wrapper = activeDocument.createDiv();
	wrapper.className = "mermaid-diagram-wrapper";
	if (Platform.isMobile) {
		wrapper.classList.add("is-mobile");
	}

	// Create zoom container (provides overflow: hidden)
	const zoomContainer = activeDocument.createDiv();
	zoomContainer.className = "mermaid-zoom-container";

	// Create zoom wrapper (receives transforms)
	const zoomWrapper = activeDocument.createDiv();
	zoomWrapper.className = "mermaid-embedded-zoom-wrapper";

	// Move the mermaid content into the zoom wrapper
	const parent = mermaidEl.parentElement;
	if (!parent) return;

	parent.insertBefore(wrapper, mermaidEl);
	zoomWrapper.appendChild(mermaidEl);
	zoomContainer.appendChild(zoomWrapper);
	wrapper.appendChild(zoomContainer);

	// Create pan/zoom handler (disable wheel zoom to avoid scroll interference)
	const panZoomHandler = new PanZoomHandler(zoomContainer, zoomWrapper, {
		enableWheelZoom: false,
		enableDragPan: true,
		enableTouchGestures: true,
	});

	// Fit content to container after a brief delay to ensure layout is complete
	zoomContainer.win.requestAnimationFrame(() => {
		panZoomHandler.fitContent();
	});

	// Add toolbar with zoom controls and export button
	const filename = generateFilename(sourcePath, index);
	const toolbar = createToolbar(svg, filename, settings, panZoomHandler);
	wrapper.appendChild(toolbar);
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
		mermaidEl.win.setTimeout(() => {
			observer.disconnect();
			resolve(mermaidEl.querySelector<SVGSVGElement>("svg"));
		}, timeout);
	});
}

/**
 * Processes a mermaid element to add toolbar functionality.
 */
function processMermaidElement(
	mermaidEl: Element,
	sourcePath: string,
	index: number,
	settings: MermaidViewSettings
): void {
	void waitForSvg(mermaidEl).then((svg) => {
		if (svg) {
			addToolbarToMermaid(mermaidEl, sourcePath, index, settings);
		}
	});
}

/**
 * Registers the markdown post-processor for mermaid toolbar functionality.
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
		// Skip elements inside the standalone MermaidView (it has its own controls)
		if (isInsideMermaidView(el)) {
			return;
		}

		// Look for mermaid containers in Live Preview
		// Structure: .cm-preview-code-block.cm-embed-block.cm-lang-mermaid > .mermaid > svg
		if (el.matches?.(".cm-preview-code-block.cm-lang-mermaid")) {
			const mermaidEl = el.querySelector(".mermaid");
			if (mermaidEl && !mermaidEl.classList.contains("mermaid-toolbar-processed")) {
				// Try to get source path from the active file
				const sourcePath = app.workspace.getActiveFile()?.path ?? "";
				processMermaidElement(mermaidEl, sourcePath, diagramCounter++, settings);
			}
		}

		// Also check for .mermaid elements directly (Reading View structure)
		if (el.matches?.(".mermaid") && !el.classList.contains("mermaid-toolbar-processed")) {
			const sourcePath = app.workspace.getActiveFile()?.path ?? "";
			processMermaidElement(el, sourcePath, diagramCounter++, settings);
		}
	};

	const observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			for (const node of Array.from(mutation.addedNodes)) {
				if (node.instanceOf(HTMLElement)) {
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
	observer.observe(activeDocument.body, {
		childList: true,
		subtree: true,
	});

	// Process any existing mermaid diagrams (excluding those in standalone MermaidView)
	activeDocument.querySelectorAll(".cm-preview-code-block.cm-lang-mermaid").forEach(processElement);
	activeDocument.querySelectorAll(".mermaid:not(.mermaid-toolbar-processed)").forEach((el) => {
		if (!isInsideMermaidView(el)) {
			const sourcePath = app.workspace.getActiveFile()?.path ?? "";
			processMermaidElement(el, sourcePath, diagramCounter++, settings);
		}
	});

	// Return cleanup function
	return () => {
		observer.disconnect();
	};
}
