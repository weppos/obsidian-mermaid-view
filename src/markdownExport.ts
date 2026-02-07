import { App, MarkdownPostProcessorContext, Menu, Notice, Platform, TFile, setIcon } from "obsidian";
import { exportAsSvg, exportAsPng } from "./export";
import { PanZoomHandler } from "./panZoom";
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
 * Creates the toolbar with zoom controls and export button.
 */
function createToolbar(
	app: App,
	svg: SVGSVGElement,
	filename: string,
	settings: MermaidViewSettings,
	panZoomHandler: PanZoomHandler,
	sourceCode: string,
	sourcePath: string,
	index: number
): HTMLElement {
	const toolbar = document.createElement("div");
	toolbar.className = "mermaid-toolbar";

	// Zoom control group
	const zoomGroup = document.createElement("div");
	zoomGroup.className = "mermaid-toolbar-group";

	const zoomInBtn = document.createElement("button");
	zoomInBtn.className = "mermaid-toolbar-button";
	zoomInBtn.setAttribute("aria-label", "Zoom in");
	setIcon(zoomInBtn, "plus");
	zoomInBtn.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		panZoomHandler.zoomIn();
	});
	zoomGroup.appendChild(zoomInBtn);

	const resetBtn = document.createElement("button");
	resetBtn.className = "mermaid-toolbar-button";
	resetBtn.setAttribute("aria-label", "Reset zoom");
	setIcon(resetBtn, "rotate-cw");
	resetBtn.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		panZoomHandler.resetZoom();
	});
	zoomGroup.appendChild(resetBtn);

	const zoomOutBtn = document.createElement("button");
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
	const exportGroup = document.createElement("div");
	exportGroup.className = "mermaid-toolbar-group";

	const copyBtn = document.createElement("button");
	copyBtn.className = "mermaid-toolbar-button";
	copyBtn.setAttribute("aria-label", "Copy diagram code");
	setIcon(copyBtn, "copy");
	let resolvedSourceCode = sourceCode.trim();
	copyBtn.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		void (async () => {
			if (!resolvedSourceCode) {
				const containerSource = svg
					.closest(".mermaid")
					?.getAttribute("data-mermaid-source")
					?.trim();
				if (containerSource) {
					resolvedSourceCode = containerSource;
				}
			}

			if (!resolvedSourceCode) {
				const fallbackPath = sourcePath || (app.workspace.getActiveFile()?.path ?? "");
				if (fallbackPath) {
					const sources = await getMermaidSourcesFromFile(app, fallbackPath);
					const matchedSource = sources[index]?.trim();
					if (matchedSource) {
						resolvedSourceCode = matchedSource;
					} else if (sources.length > 0) {
						resolvedSourceCode = (sources[0] ?? "").trim();
					}
				}
			}

			if (!resolvedSourceCode) {
				new Notice("Diagram code not available.");
				return;
			}

			await navigator.clipboard.writeText(resolvedSourceCode);
			new Notice("Diagram code copied to clipboard");
			setIcon(copyBtn, "check");
			setTimeout(() => setIcon(copyBtn, "copy"), 2000);
		})().catch(() => {
			new Notice("Unable to copy diagram code.");
		});
	});
	exportGroup.appendChild(copyBtn);

	const exportBtn = document.createElement("button");
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
	app: App,
	mermaidEl: Element,
	sourcePath: string,
	index: number,
	settings: MermaidViewSettings,
	sourceCode: string
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
	const wrapper = document.createElement("div");
	wrapper.className = "mermaid-diagram-wrapper";
	if (Platform.isMobile) {
		wrapper.classList.add("is-mobile");
	}

	// Create zoom container (provides overflow: hidden)
	const zoomContainer = document.createElement("div");
	zoomContainer.className = "mermaid-zoom-container";

	// Create zoom wrapper (receives transforms)
	const zoomWrapper = document.createElement("div");
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
	requestAnimationFrame(() => {
		panZoomHandler.fitContent();
	});

	// Add toolbar with zoom controls and export button
	const filename = generateFilename(sourcePath, index);
	const toolbar = createToolbar(
		app,
		svg,
		filename,
		settings,
		panZoomHandler,
		sourceCode,
		sourcePath,
		index
	);
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
		setTimeout(() => {
			observer.disconnect();
			resolve(mermaidEl.querySelector<SVGSVGElement>("svg"));
		}, timeout);
	});
}

/**
 * Captures the mermaid source code from the element before SVG rendering
 * replaces the text content, with fallbacks for when SVG is already rendered.
 */
function captureMermaidSource(mermaidEl: Element): string {
	// Embed mode: source is preserved by EmbedHandler on the container element.
	const embedContainer = mermaidEl.closest<HTMLElement>(".mermaid-embed");
	if (embedContainer?.dataset.mermaidSource) {
		return embedContainer.dataset.mermaidSource.trim();
	}

	// If SVG hasn't rendered yet, text content is the source
	if (!mermaidEl.querySelector("svg")) {
		return mermaidEl.textContent?.trim() ?? "";
	}

	// Fallback: look for <code> element in parent block (Reading View)
	const readingBlock = mermaidEl.closest(".el-pre, .block-language-mermaid");
	if (readingBlock) {
		const codeEl = readingBlock.querySelector("pre > code, code.language-mermaid, code");
		if (codeEl?.textContent?.trim()) {
			return codeEl.textContent.trim();
		}
	}

	// Fallback: extract from Live Preview code block structure
	const cmBlock = mermaidEl.closest(".cm-preview-code-block");
	if (cmBlock) {
		const lines: string[] = [];
		cmBlock.querySelectorAll(".cm-line").forEach((line) => {
			lines.push(line.textContent ?? "");
		});
		if (lines.length > 0) {
			return lines.join("\n").trim();
		}
	}

	return "";
}

/**
 * Extracts mermaid source from a Live Preview code block container.
 */
function captureSourceFromLivePreviewBlock(cmBlock: Element): string {
	const lines: string[] = [];
	cmBlock.querySelectorAll(".cm-line").forEach((line) => {
		lines.push(line.textContent ?? "");
	});

	if (lines.length === 0) {
		return "";
	}

	// If fences are present, extract content inside ```mermaid ... ```
	const fenced = extractMermaidBlocks(lines);
	if (fenced.length > 0) {
		return fenced[0] ?? "";
	}

	// Some Live Preview structures expose only block content lines.
	return lines.join("\n").trim();
}

/**
 * Extracts mermaid code blocks from markdown lines.
 */
function extractMermaidBlocks(lines: string[]): string[] {
	const blocks: string[] = [];
	let inMermaidBlock = false;
	let currentBlock: string[] = [];

	for (const line of lines) {
		if (!inMermaidBlock) {
			const fenceMatch = line.match(/^```([\w-]+)?\s*$/);
			if (fenceMatch && fenceMatch[1]?.toLowerCase() === "mermaid") {
				inMermaidBlock = true;
				currentBlock = [];
			}
			continue;
		}

		if (/^```\s*$/.test(line)) {
			blocks.push(currentBlock.join("\n").trim());
			inMermaidBlock = false;
			currentBlock = [];
			continue;
		}

		currentBlock.push(line);
	}

	return blocks;
}

/**
 * Extracts mermaid source blocks from a markdown file.
 */
async function getMermaidSourcesFromFile(app: App, sourcePath: string): Promise<string[]> {
	const abstractFile = app.vault.getAbstractFileByPath(sourcePath);
	if (!(abstractFile instanceof TFile)) {
		return [];
	}

	const fileContent = await app.vault.read(abstractFile);
	return extractMermaidBlocks(fileContent.split(/\r?\n/));
}

/**
 * Extracts mermaid source code from the current rendered section using source lines.
 */
async function getMermaidSourcesFromSection(
	app: App,
	containerEl: HTMLElement,
	ctx: MarkdownPostProcessorContext
): Promise<string[]> {
	const sectionInfo = ctx.getSectionInfo(containerEl);
	if (!sectionInfo || !ctx.sourcePath) {
		return [];
	}

	const abstractFile = app.vault.getAbstractFileByPath(ctx.sourcePath);
	if (!(abstractFile instanceof TFile)) {
		return [];
	}
	const fileContent = await app.vault.read(abstractFile);
	const lines = fileContent.split(/\r?\n/);
	const sectionLines = lines.slice(sectionInfo.lineStart, sectionInfo.lineEnd + 1);
	return extractMermaidBlocks(sectionLines);
}

/**
 * Processes a mermaid element to add toolbar functionality.
 */
function processMermaidElement(
	app: App,
	mermaidEl: Element,
	sourcePath: string,
	index: number,
	settings: MermaidViewSettings,
	fallbackSourceCode = ""
): void {
	// Capture source code before SVG rendering replaces text content
	const sourceCode = captureMermaidSource(mermaidEl) || fallbackSourceCode;
	if (sourceCode) {
		(mermaidEl as HTMLElement).dataset.mermaidSource = sourceCode;
	}

	void waitForSvg(mermaidEl).then((svg) => {
		if (svg) {
			addToolbarToMermaid(app, mermaidEl, sourcePath, index, settings, sourceCode);
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
		let sectionSourcesPromise: Promise<string[]> | null = null;

		const getSectionSources = async (): Promise<string[]> => {
			if (!sectionSourcesPromise) {
				sectionSourcesPromise = getMermaidSourcesFromSection(app, el, ctx);
			}
			return sectionSourcesPromise;
		};

		mermaidElements.forEach((mermaidEl, index) => {
			const directSource = captureMermaidSource(mermaidEl);
			if (directSource) {
				processMermaidElement(app, mermaidEl, ctx.sourcePath, index, settings, directSource);
				return;
			}

			void getSectionSources().then((sources) => {
				processMermaidElement(
					app,
					mermaidEl,
					ctx.sourcePath,
					index,
					settings,
					sources[index] ?? ""
				);
			});
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
				const livePreviewSource = captureSourceFromLivePreviewBlock(el);
				processMermaidElement(
					app,
					mermaidEl,
					sourcePath,
					diagramCounter++,
					settings,
					livePreviewSource
				);
			}
		}

		// Also check for .mermaid elements directly (Reading View structure)
		if (el.matches?.(".mermaid") && !el.classList.contains("mermaid-toolbar-processed")) {
			const cmBlock = el.closest(".cm-preview-code-block.cm-lang-mermaid");
			const sourcePath = app.workspace.getActiveFile()?.path ?? "";
			const livePreviewSource = cmBlock ? captureSourceFromLivePreviewBlock(cmBlock) : "";
			processMermaidElement(
				app,
				el,
				sourcePath,
				diagramCounter++,
				settings,
				livePreviewSource
			);
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

	// Process any existing mermaid diagrams (excluding those in standalone MermaidView)
	document.querySelectorAll(".cm-preview-code-block.cm-lang-mermaid").forEach(processElement);
	document.querySelectorAll(".mermaid:not(.mermaid-toolbar-processed)").forEach((el) => {
		if (!isInsideMermaidView(el)) {
			const cmBlock = el.closest(".cm-preview-code-block.cm-lang-mermaid");
			const sourcePath = app.workspace.getActiveFile()?.path ?? "";
			const livePreviewSource = cmBlock ? captureSourceFromLivePreviewBlock(cmBlock) : "";
			processMermaidElement(
				app,
				el,
				sourcePath,
				diagramCounter++,
				settings,
				livePreviewSource
			);
		}
	});

	// Return cleanup function
	return () => {
		observer.disconnect();
	};
}
