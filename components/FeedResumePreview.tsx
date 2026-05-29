"use client";

import { useEffect, useRef, useState } from "react";
import type {
	PDFDocumentLoadingTask,
	PDFDocumentProxy,
	RenderTask,
} from "pdfjs-dist/types/src/display/api";

const PDF_WORKER_SRC = "/assets/pdf.worker.min.mjs";
const MAX_RENDER_PIXEL_RATIO = 2;
const VIEWPORT_MARGIN = 520;

type PdfJsModule = typeof import("pdfjs-dist");

type FeedResumePreviewProps = {
	fileUrl?: string;
	isLoading?: boolean;
	title: string;
};

type FrameSize = {
	height: number;
	width: number;
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

export default function FeedResumePreview({
	fileUrl,
	isLoading = false,
	title,
}: FeedResumePreviewProps) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const frameRef = useRef<HTMLDivElement | null>(null);
	const [frameSize, setFrameSize] = useState<FrameSize>({ height: 0, width: 0 });
	const [isNearViewport, setIsNearViewport] = useState(false);
	const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
		"idle",
	);

	useEffect(() => {
		const element = frameRef.current;
		if (!element) return;
		const previewFrame = element;

		function measure() {
			const rect = previewFrame.getBoundingClientRect();
			setFrameSize({
				height: Math.round(rect.height),
				width: Math.round(rect.width),
			});
		}

		measure();

		if (typeof ResizeObserver === "undefined") {
			window.addEventListener("resize", measure);
			return () => window.removeEventListener("resize", measure);
		}

		const observer = new ResizeObserver(measure);
		observer.observe(previewFrame);

		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		const element = frameRef.current;
		if (!element) return;

		if (typeof IntersectionObserver === "undefined") {
			setIsNearViewport(true);
			return;
		}

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setIsNearViewport(true);
					observer.disconnect();
				}
			},
			{ rootMargin: `${VIEWPORT_MARGIN}px 0px` },
		);

		observer.observe(element);

		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || !fileUrl || !isNearViewport || !frameSize.width || !frameSize.height) {
			if (!fileUrl) setStatus("idle");
			return;
		}
		const activeCanvas = canvas;

		let cancelled = false;
		let documentTask: PDFDocumentLoadingTask | null = null;
		let loadedPdf: PDFDocumentProxy | null = null;
		let renderTask: RenderTask | null = null;

		async function renderPreview() {
			setStatus("loading");

			const pdfjs = await loadPdfJs();
			if (cancelled) return;

			documentTask = pdfjs.getDocument({
				url: fileUrl,
				disableAutoFetch: true,
				disableStream: false,
			});

			loadedPdf = await documentTask.promise;
			if (cancelled) return;

			const page = await loadedPdf.getPage(1);
			if (cancelled) {
				page.cleanup();
				return;
			}

			const baseViewport = page.getViewport({ scale: 1 });
			const maxWidth = Math.max(frameSize.width - 48, 180);
			const maxHeight = Math.max(frameSize.height - 24, 220);
			const scale = Math.max(
				0.18,
				Math.min(1.05, maxWidth / baseViewport.width, maxHeight / baseViewport.height),
			);
			const viewport = page.getViewport({ scale });
			const context = activeCanvas.getContext("2d", {
				alpha: false,
				willReadFrequently: false,
			});

			if (!context) {
				page.cleanup();
				return;
			}

			const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_RENDER_PIXEL_RATIO);
			activeCanvas.width = Math.floor(viewport.width * pixelRatio);
			activeCanvas.height = Math.floor(viewport.height * pixelRatio);
			activeCanvas.style.width = `${viewport.width}px`;
			activeCanvas.style.height = `${viewport.height}px`;

			context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
			context.fillStyle = "#fff";
			context.fillRect(0, 0, viewport.width, viewport.height);

			renderTask = page.render({ canvas: activeCanvas, canvasContext: context, viewport });
			await renderTask.promise;
			page.cleanup();

			if (!cancelled) {
				setStatus("ready");
			}
		}

		void renderPreview().catch((error) => {
			if (cancelled || error?.name === "RenderingCancelledException") return;
			setStatus("error");
		});

		return () => {
			cancelled = true;
			renderTask?.cancel();
			documentTask?.destroy();
			void loadedPdf?.destroy();
		};
	}, [fileUrl, frameSize.height, frameSize.width, isNearViewport]);

	const showSkeleton = status !== "ready";
	const screenReaderStatus =
		status === "error" || (!fileUrl && !isLoading)
			? "Resume preview unavailable"
			: "Resume preview loading";

	return (
		<div
			aria-label={`Preview of ${title}`}
			className="feed-resume-preview"
			data-status={status}
			ref={frameRef}
		>
			<canvas
				aria-label={`First page preview of ${title}`}
				aria-hidden={status !== "ready"}
				className={status === "ready" ? "is-ready" : ""}
				ref={canvasRef}
			/>
			{showSkeleton ? (
				<div className="feed-resume-preview-placeholder" aria-hidden="true">
					<span />
					<span />
					<span />
					<span />
					<span />
					<span />
				</div>
			) : null}
			<span className="sr-only">{screenReaderStatus}</span>
		</div>
	);
}
