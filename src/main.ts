import { MarkdownRenderer, Menu, Plugin, TAbstractFile, TFile, TFolder } from "obsidian";
import { MermaidView, VIEW_TYPE_MERMAID } from "./MermaidView";
import {
	MermaidViewSettings,
	DEFAULT_SETTINGS,
	MermaidViewSettingTab,
} from "./settings";

export default class MermaidViewPlugin extends Plugin {
	settings: MermaidViewSettings;

	async onload(): Promise<void> {
		await this.loadSettings();

		// Register the custom view
		this.registerView(VIEW_TYPE_MERMAID, (leaf) => new MermaidView(leaf, this));

		// Register file extensions
		this.registerExtensions(this.settings.extensions, VIEW_TYPE_MERMAID);

		// Add settings tab
		this.addSettingTab(new MermaidViewSettingTab(this.app, this));

		// Add command to toggle between source and preview
		this.addCommand({
			id: "toggle-mermaid-mode",
			name: "Toggle source/preview mode",
			checkCallback: (checking: boolean) => {
				const view = this.app.workspace.getActiveViewOfType(MermaidView);
				if (view) {
					if (!checking) {
						view.toggleMode();
					}
					return true;
				}
				return false;
			},
		});

		// Add command to create a new mermaid file
		this.addCommand({
			id: "create-mermaid-file",
			name: "Create new Mermaid file",
			callback: () => {
				void this.createNewMermaidFile();
			},
		});

		// Add "New Mermaid file" to file explorer context menu
		this.registerEvent(
			this.app.workspace.on(
				"file-menu",
				(menu: Menu, file: TAbstractFile) => {
					const folder =
						file instanceof TFolder ? file : file.parent;
					if (!folder) return;

					menu.addItem((item) => {
						item.setTitle("New Mermaid file")
							.setIcon("diamond")
							.onClick(() => this.createMermaidFile(folder));
					});
				}
			)
		);

		// Watch for mermaid file embeds being added to the DOM
		this.setupEmbedObserver();
	}

	private setupEmbedObserver(): void {
		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				for (const node of Array.from(mutation.addedNodes)) {
					if (node instanceof HTMLElement) {
						this.processEmbedElement(node);
						// Also check children
						const embeds = node.querySelectorAll<HTMLElement>(".internal-embed.file-embed");
						embeds.forEach((embed) => this.processEmbedElement(embed));
					}
				}
			}
		});

		// Observe the entire document for embed elements
		observer.observe(document.body, {
			childList: true,
			subtree: true,
		});

		// Store observer for cleanup
		this.register(() => observer.disconnect());

		// Process any existing embeds
		document.querySelectorAll<HTMLElement>(".internal-embed.file-embed").forEach((embed) => {
			this.processEmbedElement(embed);
		});
	}

	private processEmbedElement(el: HTMLElement): void {
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
		if (!extension || !this.settings.extensions.includes(extension)) return;

		// Render the mermaid embed
		void this.renderMermaidEmbed(el, src);
	}

	private async renderMermaidEmbed(container: HTMLElement, src: string): Promise<void> {
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

		// Read the mermaid file content
		const content = await this.app.vault.read(linkedFile);

		// Mark as processed and update classes
		container.empty();
		container.addClass("mermaid-embed");
		container.removeClass("file-embed", "mod-generic");

		const mermaidMarkdown = "```mermaid\n" + content.trim() + "\n```";

		/* eslint-disable obsidianmd/no-plugin-as-component -- embed rendering is short-lived */
		await MarkdownRenderer.render(
			this.app,
			mermaidMarkdown,
			container,
			linkedFile.path,
			this
		);
		/* eslint-enable obsidianmd/no-plugin-as-component */
	}

	async createMermaidFile(folder: TFolder): Promise<void> {
		await this.createMermaidFileInFolder(folder, false);
	}

	private async createNewMermaidFile(): Promise<void> {
		// Determine the folder: use active file's folder or vault root
		const activeFile = this.app.workspace.getActiveFile();
		const folder = activeFile?.parent ?? this.app.vault.getRoot();
		await this.createMermaidFileInFolder(folder, true);
	}

	private async createMermaidFileInFolder(folder: TFolder, openInSourceMode: boolean): Promise<void> {
		const extension = this.settings.extensions[0] || "mermaid";
		const baseName = "Untitled";
		let fileName = `${baseName}.${extension}`;
		let counter = 1;

		// Find a unique filename
		while (
			this.app.vault.getAbstractFileByPath(`${folder.path}/${fileName}`)
		) {
			fileName = `${baseName} ${counter}.${extension}`;
			counter++;
		}

		const filePath =
			folder.path === "/" ? fileName : `${folder.path}/${fileName}`;
		const file = await this.app.vault.create(filePath, "");
		const leaf = this.app.workspace.getLeaf();
		await leaf.openFile(file);

		// Switch to source mode if requested
		if (openInSourceMode) {
			const view = this.app.workspace.getActiveViewOfType(MermaidView);
			if (view) {
				view.setMode("source");
			}
		}
	}

	onunload(): void {
		// Obsidian handles cleanup automatically
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<MermaidViewSettings>);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
