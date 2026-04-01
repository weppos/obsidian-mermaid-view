import { Menu, Plugin, TAbstractFile, TFolder } from "obsidian";
import { MermaidView, VIEW_TYPE_MERMAID } from "./MermaidView";
import {
	MermaidViewSettings,
	DEFAULT_SETTINGS,
	MermaidViewSettingTab,
} from "./settings";
import { EmbedHandler } from "./embed";
import { registerMermaidExportPostProcessor, createLivePreviewExportObserver } from "./markdownExport";

export default class MermaidViewPlugin extends Plugin {
	settings!: MermaidViewSettings;
	private embedHandler!: EmbedHandler;

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
		this.embedHandler = new EmbedHandler(this.app, this.settings.extensions);
		const stopEmbedObserver = this.embedHandler.start((component) => this.addChild(component));
		this.register(stopEmbedObserver);

		// Register post-processor for export buttons on mermaid diagrams in markdown (Reading View)
		registerMermaidExportPostProcessor(
			this.app,
			this.settings,
			(processor) => this.registerMarkdownPostProcessor(processor)
		);

		// Register observer for export buttons on mermaid diagrams in Live Preview
		const stopLivePreviewObserver = createLivePreviewExportObserver(this.app, this.settings);
		this.register(stopLivePreviewObserver);
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
