import tseslint from 'typescript-eslint';
import obsidianmd from "eslint-plugin-obsidianmd";
import json from "@eslint/json";
import globals from "globals";
import { globalIgnores } from "eslint/config";

export default tseslint.config(
	{
		languageOptions: {
			globals: {
				...globals.browser,
				activeDocument: "readonly",
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: [
						'eslint.config.js',
					]
				},
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
	...obsidianmd.configs.recommended.map((c) =>
		c.files ? c : { ...c, files: ["**/*.ts", "**/*.tsx"] }
	),
	{
		files: ["**/*.json"],
		ignores: ["**/*.jsonc", "tsconfig.json", "package-lock.json"],
		language: "json/json",
		plugins: { json },
		rules: json.configs.recommended.rules,
	},
	{
		files: ["**/*.jsonc", "tsconfig.json"],
		language: "json/jsonc",
		plugins: { json },
		rules: json.configs.recommended.rules,
	},
	globalIgnores([
		".claude",
		"node_modules",
		"dist",
		"esbuild.config.mjs",
		"eslint.config.js",
		"version-bump.mjs",
		"versions.json",
		"main.js",
		"test/**",
		"vitest.config.ts",
	]),
);
