const LINTLY_WORDMARK_SYMBOL_SRC = "/assets/lintly/wordmark-symbol-96.png";

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
				src={LINTLY_WORDMARK_SYMBOL_SRC}
			/>
			<span className="brand-mark-text">{text}</span>
		</>
	);
}
