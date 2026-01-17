import { App, PluginSettingTab, Setting } from "obsidian";
import type MermaidViewPlugin from "./main";

export type SplitLayout = "editor-left" | "editor-right";

export interface MermaidViewSettings {
	extensions: string[];
	splitLayout: SplitLayout;
}

export const DEFAULT_SETTINGS: MermaidViewSettings = {
	extensions: ["mermaid", "mmd"],
	splitLayout: "editor-left",
};

export function parseExtensions(value: string): string[] {
	return value
		.split(",")
		.map((ext) => ext.trim().toLowerCase())
		.filter((ext) => ext.length > 0);
}

export class MermaidViewSettingTab extends PluginSettingTab {
	plugin: MermaidViewPlugin;

	constructor(app: App, plugin: MermaidViewPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("File extensions")
			.setDesc(
				"Comma-separated list of file extensions to treat as Mermaid files (without the dot). Changes require restarting Obsidian."
			)
			.addText((text) =>
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case -- file extensions are lowercase
					.setPlaceholder("mermaid, mmd")
					.setValue(this.plugin.settings.extensions.join(", "))
					.onChange(async (value) => {
						this.plugin.settings.extensions = parseExtensions(value);
						await this.plugin.saveSettings();
					})
			);

		containerEl.createEl("p", {
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- "Note:" prefix is intentional
			text: "Note: After changing extensions, you need to restart Obsidian for the changes to take effect.",
			cls: "setting-item-description",
		});

		new Setting(containerEl)
			.setName("Split view layout")
			.setDesc("Choose the position of the editor and preview in split mode.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("editor-left", "Editor left, preview right")
					.addOption("editor-right", "Editor right, preview left")
					.setValue(this.plugin.settings.splitLayout)
					.onChange(async (value: SplitLayout) => {
						this.plugin.settings.splitLayout = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
