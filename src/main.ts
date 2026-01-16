import { Plugin } from "obsidian";
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
