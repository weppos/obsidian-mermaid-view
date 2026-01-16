import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		alias: {
			obsidian: new URL("./test/mocks/obsidian.ts", import.meta.url)
				.pathname,
		},
	},
});
