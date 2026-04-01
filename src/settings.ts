import { App, PluginSettingTab, Setting } from "obsidian";
import type MermaidViewPlugin from "./main";

export type SplitLayout = "editor-left" | "editor-right";
export type PngBackground = "transparent" | "light" | "dark" | "theme";
export type PngScale = 1 | 2 | 3 | 4;

export interface MermaidViewSettings {
	extensions: string[];
	splitLayout: SplitLayout;
	pngBackground: PngBackground;
	pngScale: PngScale;
}

export const DEFAULT_SETTINGS: MermaidViewSettings = {
	extensions: ["mermaid", "mmd"],
	splitLayout: "editor-left",
	pngScale: 2,
	pngBackground: "transparent",
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
				"Comma-separated list of file extensions (without the dot) to treat as Mermaid files. (requires restarting Obsidian to take effect)"
			)
			.addText((text) =>
				text
					.setValue(this.plugin.settings.extensions.join(", "))
					.onChange(async (value) => {
						this.plugin.settings.extensions = parseExtensions(value);
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Split view layout")
			.setDesc("Choose the position of the editor and preview in split mode.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("editor-left", "Editor left, preview right")
					.addOption("editor-right", "Editor right, preview left")
					.setValue(this.plugin.settings.splitLayout)
					.onChange(async (value) => {
						this.plugin.settings.splitLayout = value as SplitLayout;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl).setName("Export").setHeading();

		new Setting(containerEl)
			.setName("PNG background")
			.setDesc("Background color for PNG exports.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("transparent", "Transparent")
					.addOption("light", "Light")
					.addOption("dark", "Dark")
					.addOption("theme", "Match current theme")
					.setValue(this.plugin.settings.pngBackground)
					.onChange(async (value) => {
						this.plugin.settings.pngBackground = value as PngBackground;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("PNG scale")
			.setDesc("Scale factor for PNG exports. Higher values produce larger, sharper images.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("1", "1x (standard)")
					.addOption("2", "2x (retina)")
					.addOption("3", "3x (high resolution)")
					.addOption("4", "4x (very high resolution)")
					.setValue(this.plugin.settings.pngScale.toString())
					.onChange(async (value) => {
						this.plugin.settings.pngScale = parseInt(value) as PngScale;
						await this.plugin.saveSettings();
					})
			);
	}
}
