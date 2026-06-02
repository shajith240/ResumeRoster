const LINTY_ICON_SRC = "/assets/linty-favicon.png";

type BrandMarkProps = {
	text?: string;
};

export default function BrandMark({ text = "Linted" }: BrandMarkProps) {
	return (
		<>
			<img
				alt=""
				aria-hidden="true"
				className="brand-mark-icon"
				decoding="async"
				src={LINTY_ICON_SRC}
			/>
			<span className="brand-mark-text">{text}</span>
		</>
	);
}
