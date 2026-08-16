/**
 * Options for configuring PanZoomHandler behavior.
 */
export interface PanZoomOptions {
	/** Minimum scale factor (default: 0.1) */
	minScale?: number;
	/** Maximum scale factor (default: 5) */
	maxScale?: number;
	/** Enable mouse wheel zoom (default: true). Disable to avoid scroll interference. */
	enableWheelZoom?: boolean;
	/** Enable click-drag panning (default: true) */
	enableDragPan?: boolean;
	/** Enable touch gestures - pinch zoom and single-finger pan (default: true) */
	enableTouchGestures?: boolean;
	/** Fit content to container on initialization (default: false) */
	fitToContainer?: boolean;
}

/**
 * Handles pan and zoom functionality for a container element.
 * Supports both full interactivity (wheel zoom, drag pan, touch gestures)
 * and toolbar-only mode (buttons only, no gesture interaction).
 */
export class PanZoomHandler {
	private container: HTMLElement;
	private wrapper: HTMLElement;

	private scale = 1;
	private translateX = 0;
	private translateY = 0;
	private isPanning = false;
	private didPan = false; // Track if actual movement occurred
	private startX = 0;
	private startY = 0;
	private downX = 0;
	private downY = 0;

	// A click keeps its default action below this distance, so links stay clickable.
	private static readonly PAN_THRESHOLD_PX = 3;

	private readonly minScale: number;
	private readonly maxScale: number;
	private readonly enableWheelZoom: boolean;
	private readonly enableDragPan: boolean;
	private readonly enableTouchGestures: boolean;
	private readonly fitToContainer: boolean;

	// Initial fit state (for reset)
	private initialScale = 1;
	private initialTranslateX = 0;
	private initialTranslateY = 0;

	// Touch gesture state
	private initialPinchDistance = 0;
	private initialPinchScale = 1;

	// Event listener cleanup
	private cleanupFns: (() => void)[] = [];

	// Callback for scale changes
	private onScaleChange?: (scale: number, translateX: number, translateY: number) => void;

	constructor(container: HTMLElement, wrapper: HTMLElement, options?: PanZoomOptions) {
		this.container = container;
		this.wrapper = wrapper;

		this.minScale = options?.minScale ?? 0.1;
		this.maxScale = options?.maxScale ?? 5;
		this.enableWheelZoom = options?.enableWheelZoom ?? true;
		this.enableDragPan = options?.enableDragPan ?? true;
		this.enableTouchGestures = options?.enableTouchGestures ?? true;
		this.fitToContainer = options?.fitToContainer ?? false;

		this.setupGestures();
	}

	/**
	 * Calculates and applies the initial scale to fit content width within the container.
	 * Call this after content has been added to the wrapper.
	 */
	fitContent(): void {
		const containerRect = this.container.getBoundingClientRect();
		const wrapperRect = this.wrapper.getBoundingClientRect();

		if (wrapperRect.width === 0 || wrapperRect.height === 0) {
			return;
		}

		// Calculate scale to fit content width in container (don't scale up, only down)
		const fitScale = Math.min(containerRect.width / wrapperRect.width, 1);

		// Center horizontally
		const scaledWidth = wrapperRect.width * fitScale;
		const translateX = (containerRect.width - scaledWidth) / 2;

		// Store as initial state
		this.initialScale = fitScale;
		this.initialTranslateX = translateX;
		this.initialTranslateY = 0;

		// Apply
		this.scale = fitScale;
		this.translateX = translateX;
		this.translateY = 0;
		this.applyTransform();
	}

	/**
	 * Sets a callback to be called when the scale or position changes.
	 */
	setOnScaleChange(callback: (scale: number, translateX: number, translateY: number) => void): void {
		this.onScaleChange = callback;
	}

	/**
	 * Resets zoom and pan to initial state.
	 */
	resetZoom(): void {
		this.scale = this.initialScale;
		this.translateX = this.initialTranslateX;
		this.translateY = this.initialTranslateY;
		this.applyTransform();
	}

	/**
	 * Zooms in by a factor (default: 1.2x).
	 */
	zoomIn(factor = 1.2): void {
		this.zoomToCenter(factor);
	}

	/**
	 * Zooms out by a factor (default: 0.8x).
	 */
	zoomOut(factor = 0.8): void {
		this.zoomToCenter(factor);
	}

	/**
	 * Returns the current scale factor.
	 */
	getScale(): number {
		return this.scale;
	}

	/**
	 * Returns the current translation values.
	 */
	getTranslate(): { x: number; y: number } {
		return { x: this.translateX, y: this.translateY };
	}

	/**
	 * Cleans up event listeners. Call this when the handler is no longer needed.
	 */
	destroy(): void {
		for (const cleanup of this.cleanupFns) {
			cleanup();
		}
		this.cleanupFns = [];
	}

	private setupGestures(): void {
		// Wheel event for zooming
		if (this.enableWheelZoom) {
			const handleWheel = (e: WheelEvent): void => {
				e.preventDefault();

				const rect = this.container.getBoundingClientRect();
				const mouseX = e.clientX - rect.left;
				const mouseY = e.clientY - rect.top;

				// Calculate zoom
				const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
				const newScale = Math.min(
					this.maxScale,
					Math.max(this.minScale, this.scale * zoomFactor)
				);

				// Zoom toward mouse position
				const scaleChange = newScale / this.scale;
				this.translateX = mouseX - scaleChange * (mouseX - this.translateX);
				this.translateY = mouseY - scaleChange * (mouseY - this.translateY);
				this.scale = newScale;

				this.applyTransform();
			};
			this.container.addEventListener("wheel", handleWheel, { passive: false });
			this.cleanupFns.push(() => this.container.removeEventListener("wheel", handleWheel));
		}

		// Mouse events for panning
		if (this.enableDragPan) {
			const handleMouseDown = (e: MouseEvent): void => {
				if (e.button !== 0) return; // Only left click
				this.isPanning = true;
				this.didPan = false; // Reset pan tracking
				this.startX = e.clientX - this.translateX;
				this.startY = e.clientY - this.translateY;
				this.downX = e.clientX;
				this.downY = e.clientY;
			};
			this.container.addEventListener("mousedown", handleMouseDown);
			this.cleanupFns.push(() => this.container.removeEventListener("mousedown", handleMouseDown));

			const handleMouseMove = (e: MouseEvent): void => {
				if (!this.isPanning) return;
				if (!this.startPan(e.clientX, e.clientY)) return;
				this.translateX = e.clientX - this.startX;
				this.translateY = e.clientY - this.startY;
				this.applyTransform();
			};
			this.container.addEventListener("mousemove", handleMouseMove);
			this.cleanupFns.push(() => this.container.removeEventListener("mousemove", handleMouseMove));

			const handleMouseUp = (): void => {
				this.isPanning = false;
				this.container.classList.remove("mermaid-view-panning");
			};
			this.container.addEventListener("mouseup", handleMouseUp);
			this.cleanupFns.push(() => this.container.removeEventListener("mouseup", handleMouseUp));

			const handleMouseLeave = (): void => {
				this.isPanning = false;
				this.container.classList.remove("mermaid-view-panning");
			};
			this.container.addEventListener("mouseleave", handleMouseLeave);
			this.cleanupFns.push(() => this.container.removeEventListener("mouseleave", handleMouseLeave));

			// Double-click to reset (only makes sense if pan is enabled)
			const handleDblClick = (): void => {
				this.resetZoom();
			};
			this.container.addEventListener("dblclick", handleDblClick);
			this.cleanupFns.push(() => this.container.removeEventListener("dblclick", handleDblClick));

			// Prevent click from navigating if we just panned
			const handleClick = (e: MouseEvent): void => {
				if (this.didPan) {
					e.preventDefault();
					e.stopPropagation();
					this.didPan = false;
				}
			};
			this.container.addEventListener("click", handleClick, true); // Use capture phase
			this.cleanupFns.push(() => this.container.removeEventListener("click", handleClick, true));
		}

		// Touch events for mobile pan/zoom
		if (this.enableTouchGestures) {
			const handleTouchStart = (e: TouchEvent): void => {
				const touch1 = e.touches[0];
				const touch2 = e.touches[1];

				if (e.touches.length === 2 && touch1 && touch2) {
					// Pinch zoom start
					this.initialPinchDistance = Math.hypot(
						touch2.clientX - touch1.clientX,
						touch2.clientY - touch1.clientY
					);
					this.initialPinchScale = this.scale;
				} else if (e.touches.length === 1 && touch1) {
					// Single touch pan
					this.isPanning = true;
					this.didPan = false; // Reset pan tracking
					this.startX = touch1.clientX - this.translateX;
					this.startY = touch1.clientY - this.translateY;
					this.downX = touch1.clientX;
					this.downY = touch1.clientY;
				}
			};
			this.container.addEventListener("touchstart", handleTouchStart);
			this.cleanupFns.push(() => this.container.removeEventListener("touchstart", handleTouchStart));

			const handleTouchMove = (e: TouchEvent): void => {
				e.preventDefault();

				const touch1 = e.touches[0];
				const touch2 = e.touches[1];

				if (e.touches.length === 2 && touch1 && touch2) {
					// Pinch zoom
					this.didPan = true; // Treat pinch as interaction that prevents navigation
					const currentDistance = Math.hypot(
						touch2.clientX - touch1.clientX,
						touch2.clientY - touch1.clientY
					);

					const scaleRatio = currentDistance / this.initialPinchDistance;
					const newScale = Math.min(
						this.maxScale,
						Math.max(this.minScale, this.initialPinchScale * scaleRatio)
					);

					// Zoom toward pinch center
					const rect = this.container.getBoundingClientRect();
					const centerX = (touch1.clientX + touch2.clientX) / 2 - rect.left;
					const centerY = (touch1.clientY + touch2.clientY) / 2 - rect.top;

					const scaleChange = newScale / this.scale;
					this.translateX = centerX - scaleChange * (centerX - this.translateX);
					this.translateY = centerY - scaleChange * (centerY - this.translateY);
					this.scale = newScale;

					this.applyTransform();
				} else if (e.touches.length === 1 && touch1 && this.isPanning) {
					// Single touch pan
					if (!this.startPan(touch1.clientX, touch1.clientY)) return;
					this.translateX = touch1.clientX - this.startX;
					this.translateY = touch1.clientY - this.startY;
					this.applyTransform();
				}
			};
			this.container.addEventListener("touchmove", handleTouchMove, { passive: false });
			this.cleanupFns.push(() => this.container.removeEventListener("touchmove", handleTouchMove));

			const handleTouchEnd = (): void => {
				this.isPanning = false;
				this.container.classList.remove("mermaid-view-panning");
			};
			this.container.addEventListener("touchend", handleTouchEnd);
			this.cleanupFns.push(() => this.container.removeEventListener("touchend", handleTouchEnd));
		}
	}

	/**
	 * Starts the pan when the pointer passes the threshold.
	 * Returns true when the pan is active.
	 */
	private startPan(clientX: number, clientY: number): boolean {
		if (!this.didPan) {
			const distance = Math.hypot(clientX - this.downX, clientY - this.downY);
			if (distance <= PanZoomHandler.PAN_THRESHOLD_PX) return false;

			this.didPan = true;
			this.container.classList.add("mermaid-view-panning");
		}

		return true;
	}

	private applyTransform(): void {
		this.wrapper.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`;
		this.onScaleChange?.(this.scale, this.translateX, this.translateY);
	}

	private zoomToCenter(factor: number): void {
		const newScale = Math.min(
			this.maxScale,
			Math.max(this.minScale, this.scale * factor)
		);

		// Zoom toward center of container
		const rect = this.container.getBoundingClientRect();
		const centerX = rect.width / 2;
		const centerY = rect.height / 2;

		const scaleChange = newScale / this.scale;
		this.translateX = centerX - scaleChange * (centerX - this.translateX);
		this.translateY = centerY - scaleChange * (centerY - this.translateY);
		this.scale = newScale;

		this.applyTransform();
	}
}
