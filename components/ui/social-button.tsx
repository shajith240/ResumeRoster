"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Share2 } from "@/components/ui/solar-icons";
import { cn } from "@/lib/utils";

function XIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.629L18.244 2.25Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
		</svg>
	);
}

function LinkedInIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
		</svg>
	);
}

function LinkIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
			<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
		</svg>
	);
}

function SmallCheckIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<polyline points="20 6 9 17 4 12" />
		</svg>
	);
}

type SocialShareButtonProps = {
	/** Path (e.g. /resume/123) or full URL to share. */
	href: string;
	title?: string;
	/** Extra classes on the trigger button. */
	className?: string;
	/** Extra classes on the outer wrapper div. */
	wrapperClassName?: string;
	label?: string;
};

export function SocialShareButton({
	href,
	title = "",
	className,
	wrapperClassName,
	label = "Share",
}: SocialShareButtonProps) {
	const [open, setOpen] = useState(false);
	const [copied, setCopied] = useState(false);
	const wrapperRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;

		function onOutside(e: MouseEvent) {
			if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
				setOpen(false);
			}
		}
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") setOpen(false);
		}

		document.addEventListener("mousedown", onOutside);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onOutside);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	function getFullUrl() {
		if (typeof window === "undefined") return href;
		return href.startsWith("/") ? `${window.location.origin}${href}` : href;
	}

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(getFullUrl());
			setCopied(true);
			window.setTimeout(() => setCopied(false), 2000);
		} catch {}
		setOpen(false);
	}

	function handleX() {
		const url = getFullUrl();
		const text = title ? `${title}\n${url}` : url;
		window.open(
			`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`,
			"_blank",
			"noopener,noreferrer",
		);
		setOpen(false);
	}

	function handleLinkedIn() {
		window.open(
			`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(getFullUrl())}`,
			"_blank",
			"noopener,noreferrer",
		);
		setOpen(false);
	}

	return (
		<div ref={wrapperRef} className={cn("social-share-root", wrapperClassName)}>
			<button
				aria-expanded={open}
				aria-label="Share"
				className={cn("post-action-button copy-button", className)}
				onClick={() => setOpen((o) => !o)}
				type="button"
			>
				<Share2 className="post-action-icon" size={16} aria-hidden="true" />
				<span className="post-action-label">{copied ? "Copied!" : label}</span>
			</button>

			<AnimatePresence>
				{open && (
					<motion.div
						aria-label="Share options"
						className="social-share-popover"
						initial={{ opacity: 0, y: 5, scale: 0.94 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 5, scale: 0.94 }}
						transition={{ duration: 0.13, ease: [0, 0, 0.2, 1] }}
						role="dialog"
					>
						<button
							aria-label="Share on X"
							className="social-share-item"
							onClick={handleX}
							type="button"
						>
							<XIcon />
						</button>
						<button
							aria-label="Share on LinkedIn"
							className="social-share-item"
							onClick={handleLinkedIn}
							type="button"
						>
							<LinkedInIcon />
						</button>
						<div aria-hidden="true" className="social-share-divider" />
						<button
							aria-label="Copy link"
							className="social-share-item"
							onClick={() => void handleCopy()}
							type="button"
						>
							{copied ? <SmallCheckIcon /> : <LinkIcon />}
						</button>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
