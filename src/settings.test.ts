import { describe, expect, it } from "vitest";
import { parseExtensions } from "./settings";

describe("parseExtensions", () => {
	it("parses comma-separated extensions with space after comma", () => {
		expect(parseExtensions("mermaid, mmd")).toEqual(["mermaid", "mmd"]);
	});

	it("parses comma-separated extensions without spaces", () => {
		expect(parseExtensions("mermaid,mmd")).toEqual(["mermaid", "mmd"]);
	});

	it("handles leading spaces", () => {
		expect(parseExtensions("  mermaid, mmd")).toEqual(["mermaid", "mmd"]);
	});

	it("handles trailing spaces", () => {
		expect(parseExtensions("mermaid, mmd  ")).toEqual(["mermaid", "mmd"]);
	});

	it("handles leading and trailing spaces", () => {
		expect(parseExtensions("  mermaid, mmd  ")).toEqual(["mermaid", "mmd"]);
	});

	it("handles multiple spaces around comma", () => {
		expect(parseExtensions("mermaid  ,  mmd")).toEqual(["mermaid", "mmd"]);
	});

	it("handles mixed spacing variations", () => {
		expect(parseExtensions("  mermaid  ,   mmd  ")).toEqual([
			"mermaid",
			"mmd",
		]);
	});

	it("converts extensions to lowercase", () => {
		expect(parseExtensions("MERMAID, MMD")).toEqual(["mermaid", "mmd"]);
	});

	it("handles mixed case with spaces", () => {
		expect(parseExtensions("  MerMaid  ,  Mmd  ")).toEqual([
			"mermaid",
			"mmd",
		]);
	});

	it("filters out empty extensions", () => {
		expect(parseExtensions("mermaid,,mmd")).toEqual(["mermaid", "mmd"]);
	});

	it("filters out whitespace-only extensions", () => {
		expect(parseExtensions("mermaid,   ,mmd")).toEqual(["mermaid", "mmd"]);
	});

	it("handles single extension", () => {
		expect(parseExtensions("mermaid")).toEqual(["mermaid"]);
	});

	it("handles empty string", () => {
		expect(parseExtensions("")).toEqual([]);
	});

	it("handles whitespace-only string", () => {
		expect(parseExtensions("   ")).toEqual([]);
	});
});
