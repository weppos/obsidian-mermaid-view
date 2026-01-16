import { Menu, Plugin, TAbstractFile, TFolder } from "obsidian";
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

		// Add "New mermaid" to file explorer context menu
		this.registerEvent(
			this.app.workspace.on(
				"file-menu",
				(menu: Menu, file: TAbstractFile) => {
					const folder =
						file instanceof TFolder ? file : file.parent;
					if (!folder) return;

					menu.addItem((item) => {
						item.setTitle("New mermaid")
							.setIcon("diamond")
							.onClick(() => this.createMermaidFile(folder));
					});
				}
			)
		);
	}

	async createMermaidFile(folder: TFolder): Promise<void> {
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
	}

	onunload(): void {
		// Obsidian handles cleanup automatically
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
