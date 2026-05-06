import {
	TextFileView,
	WorkspaceLeaf,
	MarkdownRenderer,
	setIcon,
	Notice,
	Menu,
} from "obsidian";
import { EditorView, lineNumbers, highlightActiveLine, drawSelection, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import type MermaidViewPlugin from "./main";
import { exportAsSvg, exportAsPng } from "./export";
import { PanZoomHandler } from "./panZoom";

export const VIEW_TYPE_MERMAID = "mermaid-view";

type ViewMode = "preview" | "split" | "source";

export class MermaidView extends TextFileView {
	plugin: MermaidViewPlugin;
	private mode: ViewMode = "preview";
	private previewEl!: HTMLElement;
	private sourceEl!: HTMLElement;
	private editorView!: EditorView;

	// Pan/zoom handler
	private zoomWrapper!: HTMLElement;
	private panZoomHandler!: PanZoomHandler;
	private zoomIndicator!: HTMLElement;

	// Debounce timer for live preview
	private renderDebounceTimer: number | null = null;
	private readonly RENDER_DEBOUNCE_MS = 300;

	constructor(leaf: WorkspaceLeaf, plugin: MermaidViewPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_MERMAID;
	}

	getDisplayText(): string {
		return this.file?.basename ?? "Mermaid Diagram";
	}

	getIcon(): string {
		return "git-branch";
	}

	async onOpen(): Promise<void> {
		await super.onOpen();
		const container = this.contentEl;
		container.empty();
		container.addClass("mermaid-view-container");

		// Create preview container
		this.previewEl = container.createDiv({ cls: "mermaid-view-preview" });

		// Create zoom wrapper inside preview
		this.zoomWrapper = this.previewEl.createDiv({ cls: "mermaid-zoom-wrapper" });

		// Create zoom indicator
		this.zoomIndicator = this.previewEl.createDiv({
			cls: "mermaid-zoom-indicator",
			text: "100%",
		});

		// Set up pan/zoom handler with full gesture support
		this.panZoomHandler = new PanZoomHandler(this.previewEl, this.zoomWrapper);
		this.panZoomHandler.setOnScaleChange((scale, translateX, translateY) => {
			this.updateZoomIndicator(scale, translateX, translateY);
		});

		// Create source editor container
		this.sourceEl = container.createDiv({ cls: "mermaid-view-source" });

		// Create CodeMirror editor
		this.editorView = new EditorView({
			state: EditorState.create({
				doc: "",
				extensions: [
					lineNumbers(),
					highlightActiveLine(),
					drawSelection(),
					history(),
					keymap.of([...defaultKeymap, ...historyKeymap]),
					EditorView.updateListener.of((update) => {
						if (update.docChanged) {
							this.data = update.state.doc.toString();
							this.requestSave();

							// Live preview update in split mode (debounced)
							if (this.mode === "split") {
								this.debouncedRenderPreview();
							}
						}
					}),
					EditorView.theme({
						"&": {
							height: "100%",
							backgroundColor: "var(--background-primary)",
						},
						".cm-scroller": {
							fontFamily: "var(--font-monospace)",
							fontSize: "var(--font-text-size)",
							overflow: "auto",
						},
						".cm-content": {
							caretColor: "var(--text-normal)",
						},
						".cm-gutters": {
							backgroundColor: "var(--background-secondary)",
							color: "var(--text-muted)",
							border: "none",
						},
						".cm-activeLineGutter": {
							backgroundColor: "var(--background-modifier-hover)",
						},
						".cm-activeLine": {
							backgroundColor: "var(--background-modifier-hover)",
						},
					}),
				],
			}),
			parent: this.sourceEl,
		});

		// Add view action button for toggling mode
		this.addAction("code", "Toggle source/preview", () => {
			this.toggleMode();
		});

		// Create zoom controls and export panel on the right side
		this.createZoomControls();

		// Set initial mode
		this.setMode("preview");
	}

	async onClose(): Promise<void> {
		this.panZoomHandler.destroy();
		this.editorView.destroy();
		this.contentEl.empty();
		await super.onClose();
	}

	getViewData(): string {
		return this.data;
	}

	setViewData(data: string, clear: boolean): void {
		this.data = data;

		// Update CodeMirror content
		this.editorView.dispatch({
			changes: {
				from: 0,
				to: this.editorView.state.doc.length,
				insert: data,
			},
		});

		if (this.mode === "preview" || this.mode === "split") {
			void this.renderPreview();
		}
	}

	clear(): void {
		this.data = "";
		this.editorView.dispatch({
			changes: {
				from: 0,
				to: this.editorView.state.doc.length,
				insert: "",
			},
		});
		this.previewEl.empty();
	}

	setMode(mode: ViewMode): void {
		this.mode = mode;

		// Remove mode and layout classes
		this.contentEl.removeClass(
			"mermaid-mode-preview",
			"mermaid-mode-split",
			"mermaid-mode-source",
			"mermaid-layout-editor-left",
			"mermaid-layout-editor-right"
		);
		this.contentEl.addClass(`mermaid-mode-${mode}`);

		if (mode === "preview") {
			this.sourceEl.hide();
			this.previewEl.show();
			void this.renderPreview();
		} else if (mode === "split") {
			this.contentEl.addClass(`mermaid-layout-${this.plugin.settings.splitLayout}`);
			this.sourceEl.show();
			this.previewEl.show();
			void this.renderPreview();
		} else {
			this.previewEl.hide();
			this.sourceEl.show();
			this.editorView.focus();
		}

		// Update the action button icon and label
		const actionButton = this.contentEl.parentElement?.querySelector(
			'.view-action[aria-label^="Toggle"]'
		);
		if (actionButton) {
			actionButton.empty();
			const icon = mode === "preview" ? "columns" : mode === "split" ? "code" : "eye";
			setIcon(actionButton as HTMLElement, icon);
			actionButton.setAttribute("aria-label", `Toggle view mode (${mode})`);
		}
	}

	toggleMode(): void {
		const nextMode: ViewMode =
			this.mode === "preview" ? "split" :
			this.mode === "split" ? "source" : "preview";
		this.setMode(nextMode);
	}

	private debouncedRenderPreview(): void {
		if (this.renderDebounceTimer !== null) {
			window.clearTimeout(this.renderDebounceTimer);
		}
		this.renderDebounceTimer = window.setTimeout(() => {
			this.renderDebounceTimer = null;
			void this.renderPreview(true);
		}, this.RENDER_DEBOUNCE_MS);
	}

	private async renderPreview(preserveZoom = false): Promise<void> {
		this.zoomWrapper.empty();
		if (!preserveZoom) {
			this.panZoomHandler.resetZoom();
		}

		const content = (this.data ?? "").trim();

		if (!content) {
			this.zoomWrapper.createDiv({
				cls: "mermaid-view-empty",
				text: "Empty diagram. Switch to source mode to add content.",
			});
			return;
		}

		// Create a wrapper for the mermaid content
		const wrapper = this.zoomWrapper.createDiv();

		// Wrap the content in a mermaid code block for rendering
		const mermaidMarkdown = "```mermaid\n" + content + "\n```";

		try {
			await MarkdownRenderer.render(
				this.app,
				mermaidMarkdown,
				wrapper,
				this.file?.path ?? "",
				this
			);
		} catch (error) {
			this.zoomWrapper.empty();
			this.zoomWrapper.createDiv({
				cls: "mermaid-view-error",
				text: `Error rendering diagram:\n${String(error)}`,
			});
		}
	}

	private updateZoomIndicator(scale: number, translateX: number, translateY: number): void {
		const percentage = Math.round(scale * 100);
		this.zoomIndicator.textContent = `${percentage}%`;

		// Show/hide based on whether zoom is at default
		if (scale === 1 && translateX === 0 && translateY === 0) {
			this.zoomIndicator.removeClass("mermaid-zoom-indicator-active");
		} else {
			this.zoomIndicator.addClass("mermaid-zoom-indicator-active");
		}
	}

	private createZoomControls(): void {
		const controls = this.previewEl.createDiv({ cls: "mermaid-zoom-controls" });

		// Zoom control group
		const zoomGroup = controls.createDiv({ cls: "mermaid-zoom-control-group" });

		const zoomInBtn = zoomGroup.createDiv({
			cls: "mermaid-zoom-control-item",
			attr: { "aria-label": "Zoom in" },
		});
		setIcon(zoomInBtn, "plus");
		zoomInBtn.addEventListener("click", () => this.panZoomHandler.zoomIn());

		const resetBtn = zoomGroup.createDiv({
			cls: "mermaid-zoom-control-item",
			attr: { "aria-label": "Reset zoom" },
		});
		setIcon(resetBtn, "rotate-cw");
		resetBtn.addEventListener("click", () => this.panZoomHandler.resetZoom());

		const zoomOutBtn = zoomGroup.createDiv({
			cls: "mermaid-zoom-control-item",
			attr: { "aria-label": "Zoom out" },
		});
		setIcon(zoomOutBtn, "minus");
		zoomOutBtn.addEventListener("click", () => this.panZoomHandler.zoomOut());

		// Export control group
		const exportGroup = controls.createDiv({ cls: "mermaid-zoom-control-group" });

		const exportBtn = exportGroup.createDiv({
			cls: "mermaid-zoom-control-item",
			attr: { "aria-label": "Export diagram" },
		});
		setIcon(exportBtn, "download");
		exportBtn.addEventListener("click", (event) => this.showExportMenu(event));
	}

	// ========== Export Methods ==========

	private getSvgElement(): SVGSVGElement | null {
		return this.zoomWrapper.querySelector(".mermaid svg");
	}

	private showExportMenu(event: MouseEvent): void {
		const svg = this.getSvgElement();
		if (!svg) {
			new Notice("No diagram to export. Render a diagram first.");
			return;
		}

		const menu = new Menu();
		const filename = this.file?.basename ?? "diagram";

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
					const { pngBackground, pngScale } = this.plugin.settings;
					const backgroundColor = this.resolveBackgroundColor(pngBackground);
					void exportAsPng(svg, {
						filename,
						backgroundColor,
						scale: pngScale,
					});
				});
		});

		menu.showAtMouseEvent(event);
	}

	private resolveBackgroundColor(setting: string): string {
		const style = getComputedStyle(activeDocument.body);

		switch (setting) {
			case "theme":
				// Use the current theme's background
				return style.getPropertyValue("--background-primary").trim() || "#ffffff";
			case "light":
				// Use the light theme background color
				return style.getPropertyValue("--color-base-00").trim() || "#ffffff";
			case "dark":
				// Use the dark theme background color
				return style.getPropertyValue("--color-base-100").trim() || "#1e1e1e";
			default:
				return setting;
		}
	}
}
