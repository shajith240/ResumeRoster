"use client";

import { Search, Sticker, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Sticker as StickerRecord } from "@/lib/supabase/types";

export type StickerOption = Pick<
	StickerRecord,
	"id" | "title" | "alt_text" | "storage_path"
> & {
	publicUrl: string;
};

type StickerPickerProps = {
	disabled?: boolean;
	onClear: () => void;
	onSelect: (stickerId: string) => void;
	selectedStickerId: string | null;
	stickers: StickerOption[];
};

export default function StickerPicker({
	disabled = false,
	onClear,
	onSelect,
	selectedStickerId,
	stickers,
}: StickerPickerProps) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const selectedSticker = stickers.find((sticker) => sticker.id === selectedStickerId);
	const filteredStickers = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();
		if (!normalizedQuery) return stickers;

		return stickers.filter((sticker) =>
			`${sticker.title} ${sticker.alt_text}`.toLowerCase().includes(normalizedQuery),
		);
	}, [query, stickers]);

	return (
		<div className="sticker-picker">
			<button
				aria-expanded={open}
				className="sticker-picker-trigger"
				disabled={disabled || !stickers.length}
				onClick={() => setOpen((current) => !current)}
				type="button"
			>
				<Sticker size={16} strokeWidth={2} aria-hidden="true" />
				{selectedSticker ? "Change sticker" : "Sticker"}
			</button>

			{selectedSticker ? (
				<div className="selected-sticker-preview">
					<img
						alt={selectedSticker.alt_text || selectedSticker.title}
						src={selectedSticker.publicUrl}
					/>
					<span>{selectedSticker.title}</span>
					<button aria-label="Remove sticker" onClick={onClear} type="button">
						<X size={14} strokeWidth={2} aria-hidden="true" />
					</button>
				</div>
			) : null}

			{open ? (
				<div className="sticker-popover">
					<label className="sticker-search">
						<Search size={15} strokeWidth={2} aria-hidden="true" />
						<input
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Search stickers"
							value={query}
						/>
					</label>
					<div className="sticker-grid" role="list">
						{filteredStickers.map((sticker) => (
							<button
								aria-pressed={selectedStickerId === sticker.id}
								className={selectedStickerId === sticker.id ? "is-selected" : ""}
								key={sticker.id}
								onClick={() => {
									onSelect(sticker.id);
									setOpen(false);
								}}
								type="button"
							>
								<img
									alt={sticker.alt_text || sticker.title}
									src={sticker.publicUrl}
								/>
								<span>{sticker.title}</span>
							</button>
						))}
						{!filteredStickers.length ? (
							<p className="sticker-empty">No stickers match that search.</p>
						) : null}
					</div>
				</div>
			) : null}
		</div>
	);
}
