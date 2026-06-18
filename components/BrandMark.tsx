const LINTED_WORDMARK_SYMBOL_SRC =
	"/assets/linted/wordmark-symbol.svg#linted-wordmark";

type BrandMarkProps = {
	text?: string;
};

export default function BrandMark({ text = "Linted" }: BrandMarkProps) {
	if (text.toLowerCase() !== "linted") {
		return <span className="brand-mark-text">{text}</span>;
	}

	return (
		<svg
			aria-label={text}
			className="brand-mark-wordmark"
			preserveAspectRatio="xMinYMid meet"
			role="img"
			viewBox="0 0 399.102 170"
		>
			<use href={LINTED_WORDMARK_SYMBOL_SRC} />
		</svg>
	);
}
