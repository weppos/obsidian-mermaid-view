import { Notice } from "obsidian";

export type ExportFormat = "svg" | "png";

export interface ExportOptions {
	filename: string;
	scale?: number;
	backgroundColor?: string;
}

/**
 * Prepares an SVG element for export by cloning it and setting proper attributes.
 */
function prepareSvgForExport(svg: SVGSVGElement): SVGSVGElement {
	const clone = svg.cloneNode(true) as SVGSVGElement;

	// Ensure the SVG has proper XML namespace
	clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

	// Get dimensions from the original SVG
	const bbox = svg.getBBox();
	const width = svg.getAttribute("width") || bbox.width.toString();
	const height = svg.getAttribute("height") || bbox.height.toString();

	// Set viewBox if not present for proper scaling
	if (!clone.getAttribute("viewBox")) {
		clone.setAttribute("viewBox", `0 0 ${bbox.width} ${bbox.height}`);
	}
	clone.setAttribute("width", width);
	clone.setAttribute("height", height);

	return clone;
}

/**
 * Serializes an SVG element to a string.
 */
function serializeSvg(svg: SVGSVGElement): string {
	const serializer = new XMLSerializer();
	return serializer.serializeToString(svg);
}

/**
 * Downloads a blob as a file.
 */
export function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

/**
 * Exports an SVG element as an SVG file.
 */
export function exportAsSvg(svg: SVGSVGElement, options: ExportOptions): void {
	const clone = prepareSvgForExport(svg);
	const svgString = serializeSvg(clone);

	const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
	const filename = options.filename.endsWith(".svg")
		? options.filename
		: `${options.filename}.svg`;

	downloadBlob(blob, filename);
	new Notice(`Exported ${filename}`);
}
