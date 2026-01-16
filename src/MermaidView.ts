import {
	TextFileView,
	WorkspaceLeaf,
	MarkdownRenderer,
	setIcon,
} from "obsidian";
import type MermaidViewPlugin from "./main";

export const VIEW_TYPE_MERMAID = "mermaid-view";

type ViewMode = "preview" | "source";

export class MermaidView extends TextFileView {
	plugin: MermaidViewPlugin;
	private mode: ViewMode = "preview";
	private previewEl: HTMLElement;
	private sourceEl: HTMLElement;
	private editorEl: HTMLTextAreaElement;

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
		});

		// Add view action button for toggling mode
		this.addAction("code", "Toggle source/preview", () => {
			this.toggleMode();
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

		if (this.mode === "preview") {
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

		if (mode === "preview") {
			this.sourceEl.hide();
			this.previewEl.show();
			this.renderPreview();
		} else {
			this.previewEl.hide();
			this.sourceEl.show();
			this.editorEl.value = this.data;
			this.editorEl.focus();
		}

		// Update the action button icon
		const actionButton = this.contentEl.parentElement?.querySelector(
			'.view-action[aria-label="Toggle source/preview"]'
		);
		if (actionButton) {
			actionButton.empty();
			setIcon(actionButton as HTMLElement, mode === "preview" ? "code" : "eye");
		}
	}

	toggleMode(): void {
		this.setMode(this.mode === "preview" ? "source" : "preview");
	}

	private async renderPreview(): Promise<void> {
		this.previewEl.empty();

		const content = this.data.trim();

		if (!content) {
			this.previewEl.createDiv({
				cls: "mermaid-view-empty",
				text: "Empty diagram. Switch to source mode to add content.",
			});
			return;
		}

		// Create a wrapper for the mermaid content
		const wrapper = this.previewEl.createDiv();

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
			this.previewEl.empty();
			this.previewEl.createDiv({
				cls: "mermaid-view-error",
				text: `Error rendering diagram:\n${error}`,
			});
		}
	}
}
