import { Notice, Platform } from "obsidian";

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
 * On mobile, uses the Web Share API to trigger the native share sheet.
 * On desktop, uses a traditional download link.
 */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
	if (Platform.isMobileApp && navigator.share && navigator.canShare) {
		const file = new File([blob], filename, { type: blob.type });
		if (navigator.canShare({ files: [file] })) {
			await navigator.share({ files: [file] });
			return;
		}
	}

	// Desktop fallback
	const url = URL.createObjectURL(blob);
	const link = activeDocument.createEl("a");
	link.href = url;
	link.download = filename;
	activeDocument.body.appendChild(link);
	link.click();
	activeDocument.body.removeChild(link);
	URL.revokeObjectURL(url);
}

/**
 * Exports an SVG element as an SVG file.
 */
export async function exportAsSvg(svg: SVGSVGElement, options: ExportOptions): Promise<void> {
	const clone = prepareSvgForExport(svg);
	const svgString = serializeSvg(clone);

	const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
	const filename = options.filename.endsWith(".svg")
		? options.filename
		: `${options.filename}.svg`;

	await downloadBlob(blob, filename);
	new Notice(`Exported ${filename}`);
}

/**
 * Gets the dimensions of an SVG element.
 */
function getSvgDimensions(svg: SVGSVGElement): { width: number; height: number } {
	// Try to get dimensions from attributes first
	const widthAttr = svg.getAttribute("width");
	const heightAttr = svg.getAttribute("height");

	if (widthAttr && heightAttr) {
		const width = parseFloat(widthAttr);
		const height = parseFloat(heightAttr);
		if (!isNaN(width) && !isNaN(height)) {
			return { width, height };
		}
	}

	// Fall back to viewBox
	const viewBox = svg.getAttribute("viewBox");
	if (viewBox) {
		const parts = viewBox.split(/\s+/);
		const widthPart = parts[2];
		const heightPart = parts[3];
		if (parts.length === 4 && widthPart && heightPart) {
			const width = parseFloat(widthPart);
			const height = parseFloat(heightPart);
			if (!isNaN(width) && !isNaN(height)) {
				return { width, height };
			}
		}
	}

	// Last resort: getBBox
	const bbox = svg.getBBox();
	return { width: bbox.width, height: bbox.height };
}

/**
 * Exports an SVG element as a PNG file.
 */
export async function exportAsPng(svg: SVGSVGElement, options: ExportOptions): Promise<void> {
	const scale = options.scale ?? 2; // Default to 2x for retina displays
	const backgroundColor = options.backgroundColor ?? "transparent";

	const clone = prepareSvgForExport(svg);
	const { width, height } = getSvgDimensions(svg);

	// Set explicit dimensions on the clone for proper rendering
	clone.setAttribute("width", width.toString());
	clone.setAttribute("height", height.toString());

	const svgString = serializeSvg(clone);

	// Use data URL to avoid "tainted canvas" security error
	const bytes = new TextEncoder().encode(svgString);
	const base64 = btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
	const dataUrl = `data:image/svg+xml;base64,${base64}`;

	const img = await loadImage(dataUrl);

	// Create canvas with scaled dimensions
	const canvas = activeDocument.createEl("canvas");
	canvas.width = width * scale;
	canvas.height = height * scale;

	const ctx = canvas.getContext("2d");
	if (!ctx) {
		throw new Error("Failed to get canvas context");
	}

	// Apply background color
	if (backgroundColor !== "transparent") {
		ctx.fillStyle = backgroundColor;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
	}

	// Scale and draw the image
	ctx.scale(scale, scale);
	ctx.drawImage(img, 0, 0, width, height);

	// Convert to blob and download
	const blob = await canvasToBlob(canvas, "image/png");
	const filename = options.filename.endsWith(".png")
		? options.filename
		: `${options.filename}.png`;

	await downloadBlob(blob, filename);
	new Notice(`Exported ${filename}`);
}

/**
 * Loads an image from a URL.
 */
function loadImage(url: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error("Failed to load image"));
		img.src = url;
	});
}

/**
 * Converts a canvas to a blob.
 */
function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (blob) {
				resolve(blob);
			} else {
				reject(new Error("Failed to create blob from canvas"));
			}
		}, type);
	});
}
