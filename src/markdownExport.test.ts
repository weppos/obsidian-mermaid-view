import { describe, expect, it } from "vitest";
import { extractMermaidBlocks, generateFilename } from "./markdownExport";

describe("generateFilename", () => {
	it("returns 'diagram' when sourcePath is empty and index is 0", () => {
		expect(generateFilename("", 0)).toBe("diagram");
	});

	it("returns 'diagram-N' when sourcePath is empty and index > 0", () => {
		expect(generateFilename("", 1)).toBe("diagram-2");
		expect(generateFilename("", 2)).toBe("diagram-3");
	});

	it("uses basename without extension when sourcePath is set and index is 0", () => {
		expect(generateFilename("folder/file.mmd", 0)).toBe("file");
		expect(generateFilename("folder/file.mermaid", 0)).toBe("file");
		expect(generateFilename("file.mmd", 0)).toBe("file");
	});

	it("appends index to basename when index > 0", () => {
		expect(generateFilename("folder/diagram.mmd", 1)).toBe("diagram-2");
		expect(generateFilename("a/b/c.mermaid", 2)).toBe("c-3");
	});

	it("falls back to 'diagram' when path has trailing slash (empty filename)", () => {
		expect(generateFilename("foo/bar/", 0)).toBe("diagram");
	});
});

describe("extractMermaidBlocks", () => {
	it("returns empty array for empty lines", () => {
		expect(extractMermaidBlocks([])).toEqual([]);
	});

	it("returns empty array when there are no mermaid blocks", () => {
		expect(extractMermaidBlocks(["# Heading", "Some text"])).toEqual([]);
	});

	it("ignores non-mermaid code blocks", () => {
		const lines = ["```js", "const x = 1;", "```"];
		expect(extractMermaidBlocks(lines)).toEqual([]);
	});

	it("extracts a single mermaid block", () => {
		const lines = ["```mermaid", "graph TD", "  A --> B", "```"];
		expect(extractMermaidBlocks(lines)).toEqual(["graph TD\n  A --> B"]);
	});

	it("extracts multiple mermaid blocks", () => {
		const lines = [
			"```mermaid",
			"graph TD",
			"A --> B",
			"```",
			"text",
			"```mermaid",
			"flowchart LR",
			"C --> D",
			"```",
		];
		expect(extractMermaidBlocks(lines)).toEqual([
			"graph TD\nA --> B",
			"flowchart LR\nC --> D",
		]);
	});

	it("recognizes mermaid block with different casing", () => {
		const lines = ["```Mermaid", "graph TD", "A --> B", "```"];
		expect(extractMermaidBlocks(lines)).toEqual(["graph TD\nA --> B"]);
	});

	it("returns empty block for mermaid fence with no content", () => {
		const lines = ["```mermaid", "```"];
		expect(extractMermaidBlocks(lines)).toEqual([""]);
	});

	it("trims leading and trailing whitespace of the block", () => {
		const lines = ["```mermaid", "  graph TD  ", "  A --> B  ", "```"];
		expect(extractMermaidBlocks(lines)).toEqual(["graph TD  \n  A --> B"]);
	});
});
