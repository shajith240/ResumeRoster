"use client";

import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import type {
	PDFDocumentProxy,
	PDFPageProxy,
} from "pdfjs-dist/types/src/display/api";
import {
	allowsResumePreviewInteractions,
	isResumePreviewLocked,
	type ResumePrivacyMode,
} from "@/lib/resume-privacy";

const PDF_WORKER_SRC = "/assets/pdf.worker.min.mjs";

pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;

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
};

type LinkAnnotation = {
	rect?: number[];
	unsafeUrl?: string;
	url?: string;
};

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

function SecureResumePage({
	allowInteractions,
	containerWidth,
	pageNumber,
	pdf,
}: PagePreviewProps) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const linkLayerRef = useRef<HTMLDivElement | null>(null);
	const pageShellRef = useRef<HTMLDivElement | null>(null);
	const textLayerRef = useRef<HTMLDivElement | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		let renderTask: pdfjs.RenderTask | null = null;
		let textLayer: InstanceType<typeof pdfjs.TextLayer> | null = null;

		async function renderPage() {
			const canvas = canvasRef.current;
			if (!canvas || containerWidth <= 0) return;

			setLoading(true);

			const page = await pdf.getPage(pageNumber);
			if (cancelled) return;

			const baseViewport = page.getViewport({ scale: 1 });
			const targetWidth = Math.min(Math.max(containerWidth - 32, 280), 980);
			const scale = Math.max(
				0.45,
				Math.min(1.55, targetWidth / baseViewport.width),
			);
			const viewport = page.getViewport({ scale });
			const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
			const pageShell = pageShellRef.current;
			const context = canvas.getContext("2d", {
				alpha: false,
				willReadFrequently: false,
			});

			if (!context) return;
			if (pageShell) {
				pageShell.style.width = `${viewport.width}px`;
				pageShell.style.height = `${viewport.height}px`;
			}

			canvas.width = Math.floor(viewport.width * pixelRatio);
			canvas.height = Math.floor(viewport.height * pixelRatio);
			canvas.style.width = `${viewport.width}px`;
			canvas.style.height = `${viewport.height}px`;

			context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
			context.fillStyle = "#fff";
			context.fillRect(0, 0, viewport.width, viewport.height);

			renderTask = page.render({ canvas, canvasContext: context, viewport });
			await renderTask.promise;

			if (cancelled) return;

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
	}, [allowInteractions, containerWidth, pageNumber, pdf]);

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
		let documentTask: pdfjs.PDFDocumentLoadingTask | null = null;

		async function loadPdf() {
			setError("");
			setPdf(null);
			setPageCount(0);

			documentTask = pdfjs.getDocument({
				url: fileUrl,
				disableAutoFetch: true,
				disableRange: true,
				disableStream: false,
			});

			const loadedPdf = await documentTask.promise;
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
			void pdf?.destroy();
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
				<span>
					{pageCount
						? `${pageCount} page${pageCount === 1 ? "" : "s"}`
						: "Loading"}
				</span>
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
	);
}
