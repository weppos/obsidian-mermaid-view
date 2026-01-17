import {
	TextFileView,
	WorkspaceLeaf,
	MarkdownRenderer,
	setIcon,
} from "obsidian";
import type MermaidViewPlugin from "./main";

export const VIEW_TYPE_MERMAID = "mermaid-view";

type ViewMode = "preview" | "split" | "source";

export class MermaidView extends TextFileView {
	plugin: MermaidViewPlugin;
	private mode: ViewMode = "preview";
	private previewEl: HTMLElement;
	private sourceEl: HTMLElement;
	private editorEl: HTMLTextAreaElement;

	// Pan/zoom state
	private zoomWrapper: HTMLElement;
	private scale = 1;
	private translateX = 0;
	private translateY = 0;
	private isPanning = false;
	private startX = 0;
	private startY = 0;
	private readonly MIN_SCALE = 0.1;
	private readonly MAX_SCALE = 5;

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
		const container = this.contentEl;
		container.empty();
		container.addClass("mermaid-view-container");

		// Create preview container
		this.previewEl = container.createDiv({ cls: "mermaid-view-preview" });

		// Create zoom wrapper inside preview
		this.zoomWrapper = this.previewEl.createDiv({ cls: "mermaid-zoom-wrapper" });

		// Set up pan/zoom event handlers
		this.setupPanZoom();

		// Create source editor container
		this.sourceEl = container.createDiv({ cls: "mermaid-view-source" });
		this.editorEl = this.sourceEl.createEl("textarea");
		this.editorEl.addClass("mermaid-view-editor");
		this.editorEl.spellcheck = false;

		// Style the textarea to fill the container
		this.editorEl.style.width = "100%";
		this.editorEl.style.height = "100%";
		this.editorEl.style.resize = "none";
		this.editorEl.style.border = "none";
		this.editorEl.style.outline = "none";
		this.editorEl.style.padding = "20px";
		this.editorEl.style.fontFamily = "var(--font-monospace)";
		this.editorEl.style.fontSize = "var(--font-text-size)";
		this.editorEl.style.backgroundColor = "var(--background-primary)";
		this.editorEl.style.color = "var(--text-normal)";
		this.editorEl.style.boxSizing = "border-box";

		// Listen for changes in the editor
		this.editorEl.addEventListener("input", () => {
			this.data = this.editorEl.value;
			this.requestSave();

			// Live preview update in split mode (debounced)
			if (this.mode === "split") {
				this.debouncedRenderPreview();
			}
		});

		// Add view action button for toggling mode
		this.addAction("code", "Toggle source/preview", () => {
			this.toggleMode();
		});

		// Add reset zoom button
		this.addAction("maximize", "Reset zoom", () => {
			this.resetZoom();
		});

		// Set initial mode
		this.setMode("preview");
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	getViewData(): string {
		return this.data;
	}

	setViewData(data: string, clear: boolean): void {
		this.data = data;
		this.editorEl.value = data;

		if (this.mode === "preview" || this.mode === "split") {
			this.renderPreview();
		}
	}

	clear(): void {
		this.data = "";
		this.editorEl.value = "";
		this.previewEl.empty();
	}

	private setMode(mode: ViewMode): void {
		this.mode = mode;

		// Remove mode classes
		this.contentEl.removeClass("mermaid-mode-preview", "mermaid-mode-split", "mermaid-mode-source");
		this.contentEl.addClass(`mermaid-mode-${mode}`);

		if (mode === "preview") {
			this.sourceEl.hide();
			this.previewEl.show();
			this.renderPreview();
		} else if (mode === "split") {
			this.sourceEl.show();
			this.previewEl.show();
			this.editorEl.value = this.data;
			this.renderPreview();
		} else {
			this.previewEl.hide();
			this.sourceEl.show();
			this.editorEl.value = this.data;
			this.editorEl.focus();
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
			this.renderPreview();
		}, this.RENDER_DEBOUNCE_MS);
	}

	private async renderPreview(): Promise<void> {
		this.zoomWrapper.empty();
		this.resetZoom();

		const content = this.data.trim();

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
				text: `Error rendering diagram:\n${error}`,
			});
		}
	}

	private setupPanZoom(): void {
		// Wheel event for zooming
		this.previewEl.addEventListener("wheel", (e: WheelEvent) => {
			e.preventDefault();

			const rect = this.previewEl.getBoundingClientRect();
			const mouseX = e.clientX - rect.left;
			const mouseY = e.clientY - rect.top;

			// Calculate zoom
			const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
			const newScale = Math.min(
				this.MAX_SCALE,
				Math.max(this.MIN_SCALE, this.scale * zoomFactor)
			);

			// Zoom toward mouse position
			const scaleChange = newScale / this.scale;
			this.translateX = mouseX - scaleChange * (mouseX - this.translateX);
			this.translateY = mouseY - scaleChange * (mouseY - this.translateY);
			this.scale = newScale;

			this.applyTransform();
		});

		// Mouse events for panning
		this.previewEl.addEventListener("mousedown", (e: MouseEvent) => {
			if (e.button !== 0) return; // Only left click
			this.isPanning = true;
			this.startX = e.clientX - this.translateX;
			this.startY = e.clientY - this.translateY;
			this.previewEl.addClass("mermaid-view-panning");
		});

		this.previewEl.addEventListener("mousemove", (e: MouseEvent) => {
			if (!this.isPanning) return;
			this.translateX = e.clientX - this.startX;
			this.translateY = e.clientY - this.startY;
			this.applyTransform();
		});

		this.previewEl.addEventListener("mouseup", () => {
			this.isPanning = false;
			this.previewEl.removeClass("mermaid-view-panning");
		});

		this.previewEl.addEventListener("mouseleave", () => {
			this.isPanning = false;
			this.previewEl.removeClass("mermaid-view-panning");
		});

		// Double-click to reset
		this.previewEl.addEventListener("dblclick", () => {
			this.resetZoom();
		});
	}

	private applyTransform(): void {
		this.zoomWrapper.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`;
	}

	private resetZoom(): void {
		this.scale = 1;
		this.translateX = 0;
		this.translateY = 0;
		this.applyTransform();
	}
}
