"use client";

import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import type {
	PDFDocumentProxy,
	PDFPageProxy,
	TextItem,
	TextMarkedContent,
} from "pdfjs-dist/types/src/display/api";
import { containsContactSignal } from "@/lib/pdf-privacy";

const PDF_WORKER_SRC = "/assets/pdf.worker.min.mjs";

pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;

type SecureResumePreviewProps = {
	fileUrl: string;
	title: string;
};

type PagePreviewProps = {
	containerWidth: number;
	pageNumber: number;
	pdf: PDFDocumentProxy;
};

function isTextItem(item: TextItem | TextMarkedContent): item is TextItem {
	return "str" in item;
}

function paintRedactions(
	context: CanvasRenderingContext2D,
	page: PDFPageProxy,
	viewport: ReturnType<PDFPageProxy["getViewport"]>,
	items: Array<TextItem | TextMarkedContent>,
) {
	const pageWidth = viewport.width;

	for (const item of items) {
		if (!isTextItem(item) || !containsContactSignal(item.str)) continue;

		const transform = pdfjs.Util.transform(viewport.transform, item.transform);
		const fontHeight = Math.max(8, Math.hypot(transform[2], transform[3]));
		const width = Math.min(
			pageWidth - transform[4],
			Math.max(item.width * viewport.scale, item.str.length * fontHeight * 0.52),
		);
		const x = Math.max(0, transform[4] - 3);
		const y = Math.max(0, transform[5] - fontHeight - 3);
		const height = fontHeight + 7;

		context.save();
		context.fillStyle = "#f5f1ea";
		context.fillRect(x, y, width + 8, height);
		context.strokeStyle = "rgba(23, 20, 15, 0.12)";
		context.strokeRect(x + 0.5, y + 0.5, width + 7, height - 1);
		context.fillStyle = "#8a8178";
		context.font = `${Math.max(9, Math.min(12, fontHeight * 0.62))}px system-ui, sans-serif`;
		context.fillText("redacted", x + 6, y + height - 6);
		context.restore();
	}

	page.cleanup();
}

function SecureResumePage({ containerWidth, pageNumber, pdf }: PagePreviewProps) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		let renderTask: pdfjs.RenderTask | null = null;

		async function renderPage() {
			const canvas = canvasRef.current;
			if (!canvas || containerWidth <= 0) return;

			setLoading(true);

			const page = await pdf.getPage(pageNumber);
			if (cancelled) return;

			const baseViewport = page.getViewport({ scale: 1 });
			const targetWidth = Math.min(Math.max(containerWidth - 32, 280), 980);
			const scale = Math.max(0.45, Math.min(1.55, targetWidth / baseViewport.width));
			const viewport = page.getViewport({ scale });
			const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
			const context = canvas.getContext("2d", {
				alpha: false,
				willReadFrequently: false,
			});

			if (!context) return;

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

			const textContent = await page.getTextContent();
			if (cancelled) return;

			paintRedactions(context, page, viewport, textContent.items);
			setLoading(false);
		}

		void renderPage().catch((error) => {
			if (cancelled || error?.name === "RenderingCancelledException") return;
			setLoading(false);
		});

		return () => {
			cancelled = true;
			renderTask?.cancel();
		};
	}, [containerWidth, pageNumber, pdf]);

	return (
		<div className="secure-resume-page">
			{loading ? <div className="secure-resume-page-loader">Rendering page...</div> : null}
			<canvas
				aria-label={`Protected resume preview page ${pageNumber}`}
				ref={canvasRef}
			/>
		</div>
	);
}

export default function SecureResumePreview({
	fileUrl,
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

	return (
		<section
			aria-label={`Protected preview for ${title}`}
			className="secure-resume-preview"
			onContextMenu={(event) => event.preventDefault()}
			onKeyDown={blockProtectedShortcuts}
			ref={containerRef}
			tabIndex={0}
		>
			<div className="secure-resume-preview-bar">
				<div>
					<strong>Protected preview</strong>
					<span>Obvious contact details are visually masked. Source PDFs should be redacted before upload.</span>
				</div>
				<span>{pageCount ? `${pageCount} page${pageCount === 1 ? "" : "s"}` : "Loading"}</span>
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
