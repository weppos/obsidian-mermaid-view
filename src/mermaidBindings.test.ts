import { describe, expect, it } from "vitest";
import { extractMermaidBlocks, parseMermaidLinks } from "./mermaidBindings";

describe("parseMermaidLinks", () => {
	it("parses a click directive with the href keyword", () => {
		expect(parseMermaidLinks('click des1 href "https://google.com/"')).toEqual([
			{ id: "des1", url: "https://google.com/" },
		]);
	});

	it("parses a click directive without the href keyword", () => {
		expect(parseMermaidLinks('click des1 "https://google.com/"')).toEqual([
			{ id: "des1", url: "https://google.com/" },
		]);
	});

	it("parses a directive that lists several ids", () => {
		expect(parseMermaidLinks('click des1,des2 href "https://google.com/"')).toEqual([
			{ id: "des1", url: "https://google.com/" },
			{ id: "des2", url: "https://google.com/" },
		]);
	});

	it("keeps the indentation of the directive out of the id", () => {
		expect(parseMermaidLinks('    click des1 href "https://google.com/"')).toEqual([
			{ id: "des1", url: "https://google.com/" },
		]);
	});

	it("parses every directive of a diagram", () => {
		const source = [
			"gantt",
			"    title Project Tasks",
			"    section Project Alpha",
			"        Sample Task 1 :milestone, des1, 2026-04-16, 0d",
			"",
			'click des1 href "https://google.com/"',
			'click des2 href "https://www.google.com/maps"',
		].join("\n");

		expect(parseMermaidLinks(source)).toEqual([
			{ id: "des1", url: "https://google.com/" },
			{ id: "des2", url: "https://www.google.com/maps" },
		]);
	});

	it("ignores a directive that calls a function", () => {
		expect(parseMermaidLinks('click des1 call myCallback("arg")')).toEqual([]);
	});

	it("ignores a tooltip that follows the url", () => {
		expect(parseMermaidLinks('click des1 href "https://google.com/" "A tooltip"')).toEqual([
			{ id: "des1", url: "https://google.com/" },
		]);
	});

	it("ignores a line that does not start with click", () => {
		expect(parseMermaidLinks('A --> B: click des1 href "https://google.com/"')).toEqual([]);
	});

	it("rejects a javascript url", () => {
		expect(parseMermaidLinks('click des1 href "javascript:alert(1)"')).toEqual([]);
	});

	it("rejects a javascript url that contains a control character", () => {
		expect(parseMermaidLinks('click des1 href "java\tscript:alert(1)"')).toEqual([]);
	});

	it("rejects a data url", () => {
		expect(parseMermaidLinks('click des1 href "data:text/html,<script></script>"')).toEqual([]);
	});

	it("rejects a relative url", () => {
		expect(parseMermaidLinks('click des1 href "notes/diagram.md"')).toEqual([]);
	});

	it("accepts a mailto url", () => {
		expect(parseMermaidLinks('click des1 href "mailto:someone@example.com"')).toEqual([
			{ id: "des1", url: "mailto:someone@example.com" },
		]);
	});

	it("accepts an obsidian url", () => {
		expect(parseMermaidLinks('click des1 href "obsidian://open?vault=Notes"')).toEqual([
			{ id: "des1", url: "obsidian://open?vault=Notes" },
		]);
	});

	it("handles a source without directives", () => {
		expect(parseMermaidLinks("flowchart LR\n  A --> B\n")).toEqual([]);
	});

	it("handles an empty source", () => {
		expect(parseMermaidLinks("")).toEqual([]);
	});
});

describe("extractMermaidBlocks", () => {
	it("extracts the source of a fenced mermaid block", () => {
		const note = "# Note\n\n```mermaid\nflowchart LR\n  A --> B\n```\n";

		expect(extractMermaidBlocks(note).trim()).toBe("flowchart LR\n  A --> B");
	});

	it("ignores a fenced block of another language", () => {
		const note = '```js\nclick des1 href "https://example.com/"\n```\n';

		expect(extractMermaidBlocks(note)).toBe("");
	});

	it("extracts every block of a note", () => {
		const note =
			'```mermaid\nflowchart LR\nclick a href "https://a.example/"\n```\n\n' +
			'```mermaid\nflowchart LR\nclick b href "https://b.example/"\n```\n';

		expect(parseMermaidLinks(extractMermaidBlocks(note))).toEqual([
			{ id: "a", url: "https://a.example/" },
			{ id: "b", url: "https://b.example/" },
		]);
	});

	it("extracts a block that is indented in a list item", () => {
		const note = '- item\n\n\t```mermaid\n\tflowchart LR\n\tclick a href "https://a.example/"\n\t```\n';

		expect(parseMermaidLinks(extractMermaidBlocks(note))).toEqual([
			{ id: "a", url: "https://a.example/" },
		]);
	});

	it("extracts a block that uses more than three backticks", () => {
		const note = '````mermaid\nflowchart LR\nclick a href "https://a.example/"\n````\n';

		expect(parseMermaidLinks(extractMermaidBlocks(note))).toEqual([
			{ id: "a", url: "https://a.example/" },
		]);
	});

	it("handles a note without a mermaid block", () => {
		expect(extractMermaidBlocks("# Note\n\nSome text.\n")).toBe("");
	});

	it("handles an empty note", () => {
		expect(extractMermaidBlocks("")).toBe("");
	});

	it("extracts the gantt diagram of the reported note", () => {
		const note = [
			"The following diagram in an obsidian note that has clickable tasks:",
			"",
			"```mermaid",
			"gantt",
			"    title Project Tasks",
			"    dateFormat YYYY-MM-DD",
			"",
			"    section Project Alpha",
			"        Sample Task 1 :milestone, des1, 2026-04-16, 0d",
			"",
			'click des1 href "https://google.com/"',
			'click des2 href "https://www.google.com/maps"',
			"```",
			"",
		].join("\n");

		expect(parseMermaidLinks(extractMermaidBlocks(note))).toEqual([
			{ id: "des1", url: "https://google.com/" },
			{ id: "des2", url: "https://www.google.com/maps" },
		]);
	});
});
