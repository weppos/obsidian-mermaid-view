import { App, MarkdownPostProcessorContext, Menu, Notice, Platform, TFile, setIcon } from "obsidian";
import { exportAsSvg, exportAsPng } from "./export";
import { PanZoomHandler } from "./panZoom";
import type { MermaidViewSettings, PngBackground } from "./settings";

const MERMAID_TOOLBAR_PROCESSED_CLASS = "mermaid-toolbar-processed";
const processingMermaidElements = new WeakSet<Element>();

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
export function generateFilename(sourcePath: string, index: number): string {
	let base = "diagram";
	if (sourcePath) {
		const parts = sourcePath.split("/");
		const filename = parts[parts.length - 1];
		if (filename) {
			base = filename.replace(/\.[^.]+$/, "");
		}
	}
	return index > 0 ? `${base}-${index + 1}` : base;
}

/**
 * Extracts mermaid code blocks from markdown lines.
 */
export function extractMermaidBlocks(lines: string[]): string[] {
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
 * Extracts Mermaid source from a Live Preview code block container.
 */
function captureSourceFromLivePreviewBlock(cmBlock: Element): string {
	const lines: string[] = [];
	cmBlock.querySelectorAll(".cm-line").forEach((line) => {
		lines.push(line.textContent ?? "");
	});

	if (lines.length === 0) {
		return "";
	}

	const fencedBlocks = extractMermaidBlocks(lines);
	if (fencedBlocks.length > 0) {
		return fencedBlocks[0] ?? "";
	}

	return lines.join("\n").trim();
}

/**
 * Extracts Mermaid source from Reading View code block containers.
 */
function captureSourceFromReadingBlock(mermaidEl: Element): string {
	const readingBlock = mermaidEl.closest(".el-pre, .block-language-mermaid");
	if (!readingBlock) {
		return "";
	}

	const codeEl = readingBlock.querySelector("pre > code, code.language-mermaid, code");
	return codeEl?.textContent?.trim() ?? "";
}

/**
 * Captures source from surrounding DOM before relying on file fallbacks.
 */
function captureMermaidSource(mermaidEl: Element): string {
	const ownSource = (mermaidEl as HTMLElement).dataset.mermaidSource?.trim();
	if (ownSource) {
		return ownSource;
	}

	const embedContainer = mermaidEl.closest<HTMLElement>(".mermaid-embed");
	const embedSource = embedContainer?.dataset.mermaidSource?.trim();
	if (embedSource) {
		return embedSource;
	}

	const readingSource = captureSourceFromReadingBlock(mermaidEl);
	if (readingSource) {
		return readingSource;
	}

	const cmBlock = mermaidEl.closest(".cm-preview-code-block.cm-lang-mermaid");
	if (cmBlock) {
		const livePreviewSource = captureSourceFromLivePreviewBlock(cmBlock);
		if (livePreviewSource) {
			return livePreviewSource;
		}
	}

	if (!mermaidEl.querySelector("svg")) {
		return mermaidEl.textContent?.trim() ?? "";
	}

	return "";
}

/**
 * Reads Mermaid code blocks from the full source file.
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
 * Reads Mermaid code blocks from the markdown section currently being rendered.
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
 * Resolves source for copy action with deterministic fallback order.
 */
async function resolveSourceCode(
	app: App,
	mermaidEl: Element,
	seedSourceCode: string,
	sourcePath: string,
	index: number
): Promise<string> {
	const seed = seedSourceCode.trim();
	if (seed) {
		return seed;
	}

	const domSource = captureMermaidSource(mermaidEl);
	if (domSource) {
		return domSource;
	}

	const fallbackPath = sourcePath || (app.workspace.getActiveFile()?.path ?? "");
	if (!fallbackPath) {
		return "";
	}

	const sources = await getMermaidSourcesFromFile(app, fallbackPath);
	const indexed = sources[index]?.trim();
	if (indexed) {
		return indexed;
	}

	return (sources[0] ?? "").trim();
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
 */
function isInsideMermaidView(el: Element): boolean {
	return el.closest(".mermaid-view-container") !== null;
}

/**
 * Creates the embedded toolbar with zoom and export actions.
 */
function createToolbar(
	app: App,
	mermaidEl: Element,
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
			resolvedSourceCode = await resolveSourceCode(
				app,
				mermaidEl,
				resolvedSourceCode,
				sourcePath,
				index
			);
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
 * Waits for Mermaid async rendering to produce an SVG element.
 */
function waitForSvg(mermaidEl: Element, timeout = 5000): Promise<SVGSVGElement | null> {
	return new Promise((resolve) => {
		const existingSvg = mermaidEl.querySelector<SVGSVGElement>("svg");
		if (existingSvg) {
			resolve(existingSvg);
			return;
		}

		const observer = new MutationObserver((_, obs) => {
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

		setTimeout(() => {
			observer.disconnect();
			resolve(mermaidEl.querySelector<SVGSVGElement>("svg"));
		}, timeout);
	});
}

/**
 * Adds zoom and export UI around a rendered Mermaid diagram.
 */
function addToolbarToMermaid(
	app: App,
	mermaidEl: Element,
	sourcePath: string,
	index: number,
	settings: MermaidViewSettings,
	sourceCode: string
): void {
	if (mermaidEl.classList.contains(MERMAID_TOOLBAR_PROCESSED_CLASS)) {
		return;
	}

	if (isInsideMermaidView(mermaidEl)) {
		return;
	}

	const svg = mermaidEl.querySelector<SVGSVGElement>("svg");
	if (!svg) {
		return;
	}

	mermaidEl.classList.add(MERMAID_TOOLBAR_PROCESSED_CLASS);

	const wrapper = document.createElement("div");
	wrapper.className = "mermaid-diagram-wrapper";
	if (Platform.isMobile) {
		wrapper.classList.add("is-mobile");
	}

	const zoomContainer = document.createElement("div");
	zoomContainer.className = "mermaid-zoom-container";

	const zoomWrapper = document.createElement("div");
	zoomWrapper.className = "mermaid-embedded-zoom-wrapper";

	const parent = mermaidEl.parentElement;
	if (!parent) {
		return;
	}

	// Re-wrap Mermaid output so pan/zoom transforms are isolated from surrounding layout.
	parent.insertBefore(wrapper, mermaidEl);
	zoomWrapper.appendChild(mermaidEl);
	zoomContainer.appendChild(zoomWrapper);
	wrapper.appendChild(zoomContainer);

	// Disable wheel zoom to avoid hijacking normal note scrolling.
	const panZoomHandler = new PanZoomHandler(zoomContainer, zoomWrapper, {
		enableWheelZoom: false,
		enableDragPan: true,
		enableTouchGestures: true,
	});

	// Fit after layout to get stable container dimensions.
	requestAnimationFrame(() => {
		panZoomHandler.fitContent();
	});

	const filename = generateFilename(sourcePath, index);
	const toolbar = createToolbar(
		app,
		mermaidEl,
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
 * Coordinates source capture and delayed toolbar setup for one Mermaid node.
 */
function processMermaidElement(
	app: App,
	mermaidEl: Element,
	sourcePath: string,
	index: number,
	settings: MermaidViewSettings,
	fallbackSourceCode = ""
): void {
	if (processingMermaidElements.has(mermaidEl)) {
		return;
	}

	const sourceCode = captureMermaidSource(mermaidEl) || fallbackSourceCode;
	if (sourceCode) {
		(mermaidEl as HTMLElement).dataset.mermaidSource = sourceCode;
	}

	processingMermaidElements.add(mermaidEl);
	void waitForSvg(mermaidEl).then((svg) => {
		if (svg) {
			addToolbarToMermaid(app, mermaidEl, sourcePath, index, settings, sourceCode);
		}
		// Always clear the guard so future rerenders can be processed.
		processingMermaidElements.delete(mermaidEl);
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
		if (isInsideMermaidView(el)) {
			return;
		}

		if (el.matches?.(".cm-preview-code-block.cm-lang-mermaid")) {
			const mermaidEl = el.querySelector(".mermaid");
			if (mermaidEl && !mermaidEl.classList.contains(MERMAID_TOOLBAR_PROCESSED_CLASS)) {
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

		if (el.matches?.(".mermaid") && !el.classList.contains(MERMAID_TOOLBAR_PROCESSED_CLASS)) {
			const cmBlock = el.closest(".cm-preview-code-block.cm-lang-mermaid");
			const sourcePath = app.workspace.getActiveFile()?.path ?? "";
			const livePreviewSource = cmBlock ? captureSourceFromLivePreviewBlock(cmBlock) : "";
			processMermaidElement(app, el, sourcePath, diagramCounter++, settings, livePreviewSource);
		}
	};

	const observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			for (const node of Array.from(mutation.addedNodes)) {
				if (node instanceof HTMLElement) {
					processElement(node);
					node
						.querySelectorAll(".cm-preview-code-block.cm-lang-mermaid")
						.forEach(processElement);
					node.querySelectorAll(".mermaid").forEach(processElement);
				}
			}
		}
	});

	observer.observe(document.body, {
		childList: true,
		subtree: true,
	});

	document.querySelectorAll(".cm-preview-code-block.cm-lang-mermaid").forEach(processElement);
	document.querySelectorAll(".mermaid:not(.mermaid-toolbar-processed)").forEach((el) => {
		if (!isInsideMermaidView(el)) {
			const cmBlock = el.closest(".cm-preview-code-block.cm-lang-mermaid");
			const sourcePath = app.workspace.getActiveFile()?.path ?? "";
			const livePreviewSource = cmBlock ? captureSourceFromLivePreviewBlock(cmBlock) : "";
			processMermaidElement(app, el, sourcePath, diagramCounter++, settings, livePreviewSource);
		}
	});

	return () => {
		observer.disconnect();
	};
}
