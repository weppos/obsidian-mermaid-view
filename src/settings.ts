import { App, PluginSettingTab, Setting } from "obsidian";
import type MermaidViewPlugin from "./main";

export interface MermaidViewSettings {
	extensions: string[];
}

export const DEFAULT_SETTINGS: MermaidViewSettings = {
	extensions: ["mermaid", "mmd"],
};

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
					.setPlaceholder("mermaid, mmd")
					.setValue(this.plugin.settings.extensions.join(", "))
					.onChange(async (value) => {
						const extensions = value
							.split(",")
							.map((ext) => ext.trim().toLowerCase())
							.filter((ext) => ext.length > 0);
						this.plugin.settings.extensions = extensions;
						await this.plugin.saveSettings();
					})
			);

		containerEl.createEl("p", {
			text: "Note: After changing extensions, you need to restart Obsidian for the changes to take effect.",
			cls: "setting-item-description",
		});
	}
}
