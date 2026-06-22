"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minus, Plus, X } from "@/components/ui/solar-icons";
import type {
	PDFDocumentLoadingTask,
	PDFDocumentProxy,
	PDFPageProxy,
	RenderTask,
} from "pdfjs-dist/types/src/display/api";
import {
	allowsResumePreviewInteractions,
	isResumePreviewLocked,
	type ResumePrivacyMode,
} from "@/lib/resume-privacy";

const PDF_WORKER_SRC = "/assets/pdf.worker.min.mjs";

type ReaderMode = "fit" | "read";
type PdfJsModule = typeof import("pdfjs-dist");
type TextLayerHandle = {
	cancel: () => void;
	render: () => Promise<void>;
};

type SecureResumePreviewProps = {
	fileUrl: string;
	privacyMode: ResumePrivacyMode;
	title: string;
};

type PagePreviewProps = {
	allowInteractions: boolean;
	containerWidth: number;
	pageNumber: number;
	pdf: PDFDocumentProxy;
	readerMode?: ReaderMode;
	variant?: "inline" | "reader";
	zoom?: number;
};

type LinkAnnotation = {
	rect?: number[];
	unsafeUrl?: string;
	url?: string;
};

let pdfJsModulePromise: Promise<PdfJsModule> | null = null;

async function loadPdfJs() {
	if (!pdfJsModulePromise) {
		pdfJsModulePromise = import("pdfjs-dist").then((pdfjs) => {
			pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
			return pdfjs;
		});
	}

	return pdfJsModulePromise;
}

function normalizeExternalUrl(value: unknown) {
	if (typeof value !== "string") return "";

	const trimmed = value.trim();
	if (!trimmed || /\s/.test(trimmed)) return "";

	const withProtocol = /^[a-z][a-z\d+.-]*:/i.test(trimmed)
		? trimmed
		: /^[^\s/]+\.[^\s]+$/i.test(trimmed)
			? `https://${trimmed}`
			: "";

	if (!withProtocol) return "";

	try {
		const url = new URL(withProtocol);
		return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol)
			? url.toString()
			: "";
	} catch {
		return "";
	}
}

function renderLinkLayer(
	layer: HTMLDivElement,
	annotations: LinkAnnotation[],
	viewport: ReturnType<PDFPageProxy["getViewport"]>,
) {
	layer.replaceChildren();

	for (const annotation of annotations) {
		const url = normalizeExternalUrl(annotation.url ?? annotation.unsafeUrl);
		if (!url || !Array.isArray(annotation.rect)) continue;

		const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(
			annotation.rect,
		);
		const left = Math.min(x1, x2);
		const top = Math.min(y1, y2);
		const width = Math.abs(x2 - x1);
		const height = Math.abs(y2 - y1);

		if (width <= 0 || height <= 0) continue;

		const link = document.createElement("a");
		link.className = "secure-resume-link";
		link.href = url;
		link.rel = "noopener noreferrer";
		link.target = "_blank";
		link.title = "Open link in a new tab";
		link.setAttribute("aria-label", "Open resume link in a new tab");
		link.style.left = `${left}px`;
		link.style.top = `${top}px`;
		link.style.width = `${width}px`;
		link.style.height = `${height}px`;
		link.addEventListener("click", (event) => {
			if (!url.startsWith("http")) return;
			event.preventDefault();
			window.open(url, "_blank", "noopener,noreferrer");
		});

		layer.append(link);
	}
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function getTouchDistance(touches: React.TouchList) {
	if (touches.length < 2) return 0;

	const first = touches[0];
	const second = touches[1];
	return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
}

function SecureResumePage({
	allowInteractions,
	containerWidth,
	pageNumber,
	pdf,
	readerMode = "fit",
	variant = "inline",
	zoom = 1,
}: PagePreviewProps) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const linkLayerRef = useRef<HTMLDivElement | null>(null);
	const pageShellRef = useRef<HTMLDivElement | null>(null);
	const textLayerRef = useRef<HTMLDivElement | null>(null);
	const hasRenderedRef = useRef(false);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		let renderTask: RenderTask | null = null;
		let textLayer: TextLayerHandle | null = null;

		async function renderPage() {
			const canvas = canvasRef.current;
			if (!canvas || containerWidth <= 0) return;

			if (!hasRenderedRef.current) setLoading(true);

			const pdfjs = await loadPdfJs();
			if (cancelled) return;

			const page = await pdf.getPage(pageNumber);
			if (cancelled) return;

			const baseViewport = page.getViewport({ scale: 1 });
			const inlineTargetWidth = Math.min(Math.max(containerWidth - 32, 280), 980);
			const readerFitWidth = Math.min(Math.max(containerWidth - 32, 280), 1120);
			const readerReadWidth = Math.min(
				Math.max(containerWidth * 1.55, 560),
				1040,
			);
			const targetWidth =
				variant === "reader"
					? readerMode === "read"
						? readerReadWidth
						: readerFitWidth
					: inlineTargetWidth;
			const maxScale = variant === "reader" ? 2.4 : 1.55;
			const scale = clamp((targetWidth / baseViewport.width) * zoom, 0.45, maxScale);
			const viewport = page.getViewport({ scale });
			const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
			const draftCanvas = document.createElement("canvas");
			const draftContext = draftCanvas.getContext("2d", {
				alpha: false,
				willReadFrequently: false,
			});

			if (!draftContext) return;

			draftCanvas.width = Math.floor(viewport.width * pixelRatio);
			draftCanvas.height = Math.floor(viewport.height * pixelRatio);
			draftCanvas.style.width = `${viewport.width}px`;
			draftCanvas.style.height = `${viewport.height}px`;

			draftContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
			draftContext.fillStyle = "#fff";
			draftContext.fillRect(0, 0, viewport.width, viewport.height);

			renderTask = page.render({
				canvas: draftCanvas,
				canvasContext: draftContext,
				viewport,
			});
			await renderTask.promise;

			if (cancelled) return;

			const pageShell = pageShellRef.current;
			const visibleContext = canvas.getContext("2d", {
				alpha: false,
				willReadFrequently: false,
			});

			if (!visibleContext) return;

			if (pageShell) {
				pageShell.style.width = `${viewport.width}px`;
				pageShell.style.height = `${viewport.height}px`;
			}

			canvas.width = draftCanvas.width;
			canvas.height = draftCanvas.height;
			canvas.style.width = `${viewport.width}px`;
			canvas.style.height = `${viewport.height}px`;
			visibleContext.setTransform(1, 0, 0, 1, 0, 0);
			visibleContext.drawImage(draftCanvas, 0, 0);

			if (allowInteractions) {
				const textContent = await page.getTextContent();
				if (cancelled) return;

				if (textLayerRef.current) {
					textLayerRef.current.replaceChildren();
					textLayer = new pdfjs.TextLayer({
						container: textLayerRef.current,
						textContentSource: textContent,
						viewport,
					});
					await textLayer.render();
				}

				if (cancelled) return;

				const annotations = (await page.getAnnotations({
					intent: "display",
				})) as LinkAnnotation[];
				if (cancelled) return;

				if (linkLayerRef.current) {
					renderLinkLayer(linkLayerRef.current, annotations, viewport);
				}
			} else {
				textLayerRef.current?.replaceChildren();
				linkLayerRef.current?.replaceChildren();
			}

			page.cleanup();
			hasRenderedRef.current = true;
			setLoading(false);
		}

		void renderPage().catch((error) => {
			if (cancelled || error?.name === "RenderingCancelledException") return;
			setLoading(false);
		});

		return () => {
			cancelled = true;
			renderTask?.cancel();
			textLayer?.cancel();
		};
	}, [allowInteractions, containerWidth, pageNumber, pdf, readerMode, variant, zoom]);

	return (
		<div className="secure-resume-page">
			<div className="secure-resume-page-shell" ref={pageShellRef}>
				{loading ? (
					<div className="secure-resume-page-loader">Rendering page...</div>
				) : null}
				<canvas
					aria-label={`Protected resume preview page ${pageNumber}`}
					ref={canvasRef}
				/>
				{allowInteractions ? (
					<>
						<div
							className="textLayer secure-resume-text-layer"
							ref={textLayerRef}
						/>
						<div className="secure-resume-link-layer" ref={linkLayerRef} />
					</>
				) : null}
			</div>
		</div>
	);
}

function SecureResumeReader({
	allowInteractions,
	isLocked,
	onClose,
	onProtectedKeyDown,
	open,
	pageCount,
	pdf,
	title,
}: {
	allowInteractions: boolean;
	isLocked: boolean;
	onClose: () => void;
	onProtectedKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
	open: boolean;
	pageCount: number;
	pdf: PDFDocumentProxy | null;
	title: string;
}) {
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
	const lastTapRef = useRef(0);
	const pendingZoomRef = useRef(1);
	const zoomFrameRef = useRef<number | null>(null);
	const [mounted, setMounted] = useState(false);
	const [readerWidth, setReaderWidth] = useState(0);
	const [mode, setMode] = useState<ReaderMode>("read");
	const [zoom, setZoom] = useState(1);

	useEffect(() => {
		setMounted(true);

		return () => {
			if (zoomFrameRef.current !== null) {
				window.cancelAnimationFrame(zoomFrameRef.current);
			}
		};
	}, []);

	useEffect(() => {
		if (!open) return;

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};

		document.body.classList.add("secure-resume-reader-active");
		window.addEventListener("keydown", onKeyDown);

		return () => {
			document.body.classList.remove("secure-resume-reader-active");
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [onClose, open]);

	useEffect(() => {
		if (!open) return;

		setMode("read");
		setZoom(1);
		pendingZoomRef.current = 1;
	}, [open]);

	useEffect(() => {
		const element = scrollRef.current;
		if (!element || !open) return;

		const observer = new ResizeObserver(([entry]) => {
			setReaderWidth(entry.contentRect.width);
		});

		observer.observe(element);
		setReaderWidth(element.getBoundingClientRect().width);

		return () => observer.disconnect();
	}, [open]);

	if (!open || !mounted || !pdf) return null;

	function updateZoom(nextZoom: number) {
		pendingZoomRef.current = clamp(nextZoom, 0.75, 2.25);

		if (zoomFrameRef.current !== null) return;

		zoomFrameRef.current = window.requestAnimationFrame(() => {
			zoomFrameRef.current = null;
			setZoom(pendingZoomRef.current);
		});
	}

	function selectMode(nextMode: ReaderMode) {
		setMode(nextMode);
		pendingZoomRef.current = 1;
		setZoom(1);
	}

	function toggleReaderMode() {
		selectMode(mode === "read" ? "fit" : "read");
	}

	function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
		if (event.touches.length === 2) {
			pinchRef.current = {
				distance: getTouchDistance(event.touches),
				zoom,
			};
			return;
		}

		if (event.touches.length === 1) {
			const now = window.performance.now();
			if (now - lastTapRef.current < 280) {
				event.preventDefault();
				toggleReaderMode();
				lastTapRef.current = 0;
				return;
			}

			lastTapRef.current = now;
		}
	}

	function handleTouchMove(event: React.TouchEvent<HTMLDivElement>) {
		if (event.touches.length !== 2 || !pinchRef.current) return;

		event.preventDefault();
		const distance = getTouchDistance(event.touches);
		if (!distance || !pinchRef.current.distance) return;

		const nextZoom =
			pinchRef.current.zoom * (distance / pinchRef.current.distance);
		if (Math.abs(nextZoom - zoom) >= 0.04) updateZoom(nextZoom);
	}

	function handleTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
		if (event.touches.length < 2) pinchRef.current = null;
	}

	function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
		if (!event.ctrlKey && !event.metaKey) return;

		event.preventDefault();
		updateZoom(zoom + (event.deltaY < 0 ? 0.12 : -0.12));
	}

	return createPortal(
		<div
			aria-label={`Protected reader for ${title}`}
			aria-modal="true"
			className={`secure-resume-reader ${isLocked ? "is-locked" : "is-interactive"}`}
			onContextMenu={isLocked ? (event) => event.preventDefault() : undefined}
			onKeyDown={isLocked ? onProtectedKeyDown : undefined}
			role="dialog"
			tabIndex={-1}
		>
			<header className="secure-resume-reader-bar">
				<div className="secure-resume-reader-title">
					<strong>{title}</strong>
					<span>{pageCount} page{pageCount === 1 ? "" : "s"} - protected canvas reader</span>
				</div>
				<div className="secure-resume-reader-controls">
					<div className="secure-resume-reader-mode" aria-label="Resume view mode">
						<button
							aria-pressed={mode === "fit"}
							onClick={() => selectMode("fit")}
							type="button"
						>
							Fit
						</button>
						<button
							aria-pressed={mode === "read"}
							onClick={() => selectMode("read")}
							type="button"
						>
							Read
						</button>
					</div>
					<div className="secure-resume-reader-zoom" aria-label="Zoom controls">
						<button
							aria-label="Zoom out"
							disabled={zoom <= 0.76}
							onClick={() => updateZoom(zoom - 0.15)}
							type="button"
						>
							<Minus aria-hidden="true" />
						</button>
						<span>{Math.round(zoom * 100)}%</span>
						<button
							aria-label="Zoom in"
							disabled={zoom >= 2.24}
							onClick={() => updateZoom(zoom + 0.15)}
							type="button"
						>
							<Plus aria-hidden="true" />
						</button>
					</div>
					<button
						aria-label="Close protected reader"
						className="secure-resume-reader-close"
						onClick={onClose}
						type="button"
					>
						<X aria-hidden="true" />
					</button>
				</div>
			</header>
			<div
				className="secure-resume-reader-pages"
				onTouchEnd={handleTouchEnd}
				onTouchMove={handleTouchMove}
				onTouchStart={handleTouchStart}
				onWheel={handleWheel}
				ref={scrollRef}
			>
				{readerWidth > 0 ? (
					<div className="secure-resume-reader-stack">
						{Array.from({ length: pageCount }, (_, index) => (
							<SecureResumePage
								allowInteractions={allowInteractions}
								containerWidth={readerWidth}
								key={index + 1}
								pageNumber={index + 1}
								pdf={pdf}
								readerMode={mode}
								variant="reader"
								zoom={zoom}
							/>
						))}
					</div>
				) : (
					<div className="secure-resume-loading">Preparing reader...</div>
				)}
			</div>
			<footer className="secure-resume-reader-foot">
				<span>Double tap to switch Fit and Read. Pinch or use zoom controls for detail.</span>
				<span>{isLocked ? "Copy, save, print, and links stay disabled." : "Selectable text and resume links are enabled."}</span>
			</footer>
		</div>,
		document.body,
	);
}

export default function SecureResumePreview({
	fileUrl,
	privacyMode,
	title,
}: SecureResumePreviewProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [containerWidth, setContainerWidth] = useState(0);
	const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
	const [pageCount, setPageCount] = useState(0);
	const [error, setError] = useState("");
	const [readerOpen, setReaderOpen] = useState(false);

	useEffect(() => {
		const element = containerRef.current;
		if (!element) return;

		const observer = new ResizeObserver(([entry]) => {
			setContainerWidth(entry.contentRect.width);
		});

		observer.observe(element);
		setContainerWidth(element.getBoundingClientRect().width);

		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		let cancelled = false;
		let documentTask: PDFDocumentLoadingTask | null = null;
		let loadedPdf: PDFDocumentProxy | null = null;

		async function loadPdf() {
			setError("");
			setPdf(null);
			setPageCount(0);

			const pdfjs = await loadPdfJs();
			if (cancelled) return;

			documentTask = pdfjs.getDocument({
				url: fileUrl,
				disableAutoFetch: true,
				disableStream: false,
			});

			loadedPdf = await documentTask.promise;
			if (cancelled) {
				await loadedPdf.destroy();
				return;
			}

			setPdf(loadedPdf);
			setPageCount(loadedPdf.numPages);
		}

		void loadPdf().catch((loadError) => {
			if (cancelled) return;
			setError(
				loadError instanceof Error
					? loadError.message
					: "Unable to render the protected resume preview.",
			);
		});

		return () => {
			cancelled = true;
			documentTask?.destroy();
			void loadedPdf?.destroy();
		};
	}, [fileUrl]);

	function blockProtectedShortcuts(event: React.KeyboardEvent<HTMLDivElement>) {
		if (!event.ctrlKey && !event.metaKey) return;

		if (["c", "s", "p", "a"].includes(event.key.toLowerCase())) {
			event.preventDefault();
		}
	}

	const isLocked = isResumePreviewLocked(privacyMode);
	const allowInteractions = allowsResumePreviewInteractions(privacyMode);
	const previewTitle = isLocked ? "Protected preview" : "Interactive preview";
	const previewDescription = isLocked
		? "Anonymous PDFs are redacted on the server and shown without copy or link actions."
		: "This PDF keeps selectable text and opens resume links in a new tab.";

	return (
		<>
			<section
				aria-label={`Protected preview for ${title}`}
				className={`secure-resume-preview ${
					isLocked ? "is-locked" : "is-interactive"
				}`}
				onContextMenu={isLocked ? (event) => event.preventDefault() : undefined}
				onKeyDown={isLocked ? blockProtectedShortcuts : undefined}
				ref={containerRef}
				tabIndex={isLocked ? 0 : undefined}
			>
				<div className="secure-resume-preview-bar">
					<div>
						<strong>{previewTitle}</strong>
						<span>{previewDescription}</span>
					</div>
					<div className="secure-resume-preview-actions">
						<span>
							{pageCount
								? `${pageCount} page${pageCount === 1 ? "" : "s"}`
								: "Loading"}
						</span>
						<button
							disabled={!pdf || Boolean(error)}
							onClick={() => setReaderOpen(true)}
							type="button"
						>
							<Maximize2 aria-hidden="true" />
							Read resume
						</button>
					</div>
				</div>

				{error ? (
					<div className="secure-resume-error">
						<p>{error}</p>
					</div>
				) : null}

				{pdf && containerWidth > 0 ? (
					<div className="secure-resume-pages">
						{Array.from({ length: pageCount }, (_, index) => (
							<SecureResumePage
								allowInteractions={allowInteractions}
								containerWidth={containerWidth}
								key={index + 1}
								pageNumber={index + 1}
								pdf={pdf}
							/>
						))}
					</div>
				) : !error ? (
					<div className="secure-resume-loading">Preparing protected preview...</div>
				) : null}
			</section>
			<SecureResumeReader
				allowInteractions={allowInteractions}
				isLocked={isLocked}
				onClose={() => setReaderOpen(false)}
				onProtectedKeyDown={blockProtectedShortcuts}
				open={readerOpen}
				pageCount={pageCount}
				pdf={pdf}
				title={title}
			/>
		</>
	);
}
