"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CommunityPostAttachment } from "@/lib/supabase/types";

type PublicAttachment = CommunityPostAttachment & {
	publicUrl: string;
};

type CommunityMediaGalleryProps = {
	attachments: PublicAttachment[];
	openHref?: string;
	openLabel?: string;
	variant: "detail" | "feed";
};

export default function CommunityMediaGallery({
	attachments,
	openHref,
	openLabel = "Open post",
	variant,
}: CommunityMediaGalleryProps) {
	const [activeIndex, setActiveIndex] = useState(0);
	const activeAttachment = attachments[activeIndex] ?? null;
	const hasMultipleImages = attachments.length > 1;
	const frameClass =
		variant === "feed" ? "community-feed-media" : "community-post-media-frame";
	const imageClass =
		variant === "feed"
			? "community-feed-media-image"
			: "community-post-media-image";
	const backdropClass =
		variant === "feed"
			? "community-feed-media-backdrop"
			: "community-post-media-backdrop";

	useEffect(() => {
		setActiveIndex((index) =>
			attachments.length ? Math.min(index, attachments.length - 1) : 0,
		);
	}, [attachments.length]);

	if (!activeAttachment) return null;

	function showPrevious() {
		setActiveIndex((index) =>
			index === 0 ? attachments.length - 1 : index - 1,
		);
	}

	function showNext() {
		setActiveIndex((index) =>
			index === attachments.length - 1 ? 0 : index + 1,
		);
	}

	function showImage(index: number) {
		setActiveIndex(index);
	}

	return (
		<figure className={`community-media-gallery community-media-gallery-${variant}`}>
			<div
				className={`${frameClass} community-media-gallery-frame${
					openHref ? " is-clickable" : ""
				}`}
			>
				<img
					alt=""
					aria-hidden="true"
					className={backdropClass}
					src={activeAttachment.publicUrl}
				/>
				<img
					alt={activeAttachment.alt_text}
					className={imageClass}
					src={activeAttachment.publicUrl}
				/>
				{openHref ? (
					<Link
						aria-label={openLabel}
						className="community-media-gallery-open"
						href={openHref}
					/>
				) : null}
				{hasMultipleImages ? (
					<>
						<button
							aria-label="Show previous image"
							className="community-media-gallery-arrow is-previous"
							onClick={showPrevious}
							type="button"
						>
							<ChevronLeft aria-hidden="true" />
						</button>
						<button
							aria-label="Show next image"
							className="community-media-gallery-arrow is-next"
							onClick={showNext}
							type="button"
						>
							<ChevronRight aria-hidden="true" />
						</button>
						<div
							aria-label="Image carousel position"
							className="community-media-gallery-dots"
						>
							{attachments.map((attachment, index) => (
								<button
									aria-current={index === activeIndex ? "true" : undefined}
									aria-label={`Show image ${index + 1} of ${attachments.length}`}
									className={
										index === activeIndex
											? "community-media-gallery-dot is-active"
											: "community-media-gallery-dot"
									}
									key={attachment.id}
									onClick={() => showImage(index)}
									type="button"
								/>
							))}
						</div>
					</>
				) : null}
			</div>
		</figure>
	);
}
