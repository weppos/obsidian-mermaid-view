import { App, Component, MarkdownRenderer, TFile } from "obsidian";

/**
 * Handles rendering of embedded mermaid files in notes.
 */
export class EmbedHandler {
	private app: App;
	private extensions: string[];
	private observer: MutationObserver | null = null;
	private components: Component[] = [];

	constructor(app: App, extensions: string[]) {
		this.app = app;
		this.extensions = extensions;
	}

	/**
	 * Starts observing the DOM for mermaid file embeds.
	 */
	start(addChild: (component: Component) => void): () => void {
		this.observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				for (const node of Array.from(mutation.addedNodes)) {
					if (node instanceof HTMLElement) {
						this.processElement(node, addChild);
						// Also check children
						const embeds = node.querySelectorAll<HTMLElement>(".internal-embed.file-embed");
						embeds.forEach((embed) => this.processElement(embed, addChild));
					}
				}
			}
		});

		// Observe the entire document for embed elements
		this.observer.observe(document.body, {
			childList: true,
			subtree: true,
		});

		// Process any existing embeds
		document.querySelectorAll<HTMLElement>(".internal-embed.file-embed").forEach((embed) => {
			this.processElement(embed, addChild);
		});

		return () => this.stop();
	}

	/**
	 * Stops observing and cleans up.
	 */
	stop(): void {
		if (this.observer) {
			this.observer.disconnect();
			this.observer = null;
		}
	}

	/**
	 * Updates the list of supported extensions.
	 */
	setExtensions(extensions: string[]): void {
		this.extensions = extensions;
	}

	/**
	 * Processes an element to check if it's a mermaid embed.
	 */
	private processElement(el: HTMLElement, addChild: (component: Component) => void): void {
		// Check if this is an internal-embed with file-embed class
		if (!el.classList.contains("internal-embed") || !el.classList.contains("file-embed")) {
			return;
		}

		// Skip if already processed
		if (el.classList.contains("mermaid-embed")) return;

		const src = el.getAttribute("src");
		if (!src) return;

		// Check if this is a mermaid file
		const extension = src.split(".").pop()?.toLowerCase();
		if (!extension || !this.extensions.includes(extension)) return;

		void this.renderEmbed(el, src, addChild);
	}

	/**
	 * Renders a mermaid file embed.
	 */
	private async renderEmbed(
		container: HTMLElement,
		src: string,
		addChild: (component: Component) => void
	): Promise<void> {
		// Find the file - try multiple resolution methods
		let linkedFile: TFile | null = this.app.metadataCache.getFirstLinkpathDest(src, "");

		if (!linkedFile) {
			// Try finding by path directly
			const abstractFile = this.app.vault.getAbstractFileByPath(src);
			if (abstractFile instanceof TFile) {
				linkedFile = abstractFile;
			}
		}

		if (!linkedFile) return;

		const content = await this.app.vault.read(linkedFile);
		const trimmedContent = content.trim();

		// Mark as processed and update classes
		container.empty();
		container.addClass("mermaid-embed");
		container.removeClass("file-embed", "mod-generic");
		// Preserve original diagram code so toolbar copy can still access it after SVG render.
		container.dataset.mermaidSource = trimmedContent;
		container.dataset.mermaidSourcePath = linkedFile.path;

		const mermaidMarkdown = "```mermaid\n" + trimmedContent + "\n```";

		const embedComponent = new Component();
		addChild(embedComponent);
		this.components.push(embedComponent);

		await MarkdownRenderer.render(
			this.app,
			mermaidMarkdown,
			container,
			linkedFile.path,
			embedComponent
		);
	}
}
