"use client";

import {
	Children,
	cloneElement,
	isValidElement,
	type ReactNode,
} from "react";
import ReactMarkdown, {
	defaultUrlTransform,
	type Components,
} from "react-markdown";
import hljs from "highlight.js/lib/common";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import {
	getCommunityInlineImageId,
	normalizeCommunityMarkdown,
} from "@/lib/community-markdown";
import {
	COMMUNITY_CODE_HIGHLIGHT_LANGUAGES,
	getCommunityCodeLanguageLabel,
	normalizeCommunityCodeLanguage,
} from "@/lib/community-code-languages";
import { cn } from "@/lib/utils";
import styles from "./CommunityMarkdown.module.css";

type CommunityMarkdownProps = {
	className?: string;
	content: string;
	inlineImageSources?: Record<string, string>;
	renderText?: (text: string, keyPrefix: string) => ReactNode;
	variant?: "composer" | "default" | "compact";
};

function getSafeHref(href: unknown) {
	if (typeof href !== "string") return "";

	const trimmedHref = href.trim();
	if (!trimmedHref) return "";
	if (trimmedHref.startsWith("/") && !trimmedHref.startsWith("//")) {
		return trimmedHref;
	}

	try {
		const url = new URL(trimmedHref);
		return ["http:", "https:", "mailto:"].includes(url.protocol)
			? trimmedHref
			: "";
	} catch {
		return "";
	}
}

function getSafeImageSrc(
	src: unknown,
	inlineImageSources: Record<string, string>,
) {
	if (typeof src !== "string") return "";

	const inlineImageId = getCommunityInlineImageId(src);
	if (inlineImageId) return inlineImageSources[inlineImageId] ?? "";

	try {
		const url = new URL(src);
		return ["http:", "https:"].includes(url.protocol) ? src : "";
	} catch {
		return "";
	}
}

function transformMarkdownUrl(url: string) {
	if (getCommunityInlineImageId(url)) return url;
	return defaultUrlTransform(url);
}

function getCodeLanguage(className: unknown) {
	if (typeof className !== "string") return "auto";

	const match = /(?:^|\s)language-([^\s]+)/.exec(className);
	return match ? normalizeCommunityCodeLanguage(match[1] ?? "") : "auto";
}

function highlightCode(code: string, language: string) {
	const normalizedLanguage = normalizeCommunityCodeLanguage(language);

	if (normalizedLanguage !== "auto" && hljs.getLanguage(normalizedLanguage)) {
		return {
			html: hljs.highlight(code, {
				ignoreIllegals: true,
				language: normalizedLanguage,
			}).value,
			language: normalizedLanguage,
		};
	}

	const result = hljs.highlightAuto(code, COMMUNITY_CODE_HIGHLIGHT_LANGUAGES);
	return {
		html: result.value,
		language: normalizeCommunityCodeLanguage(result.language ?? ""),
	};
}

function renderTextChildren(
	children: ReactNode,
	renderText: CommunityMarkdownProps["renderText"],
	keyPrefix: string,
): ReactNode {
	if (!renderText) return children;

	return Children.map(children, (child, index) => {
		const childKey = `${keyPrefix}-${index}`;
		if (typeof child === "string") {
			return renderText(child, childKey);
		}

		if (!isValidElement<{ children?: ReactNode }>(child)) return child;
		if (!child.props.children) return child;

		return cloneElement(
			child,
			undefined,
			renderTextChildren(child.props.children, renderText, childKey),
		);
	});
}

export default function CommunityMarkdown({
	className,
	content,
	inlineImageSources = {},
	renderText,
	variant = "default",
}: CommunityMarkdownProps) {
	const normalizedContent = normalizeCommunityMarkdown(content);
	const components = {
		a({ children, href, ...props }) {
			const safeHref = getSafeHref(href);
			if (!safeHref) return <>{children}</>;

			const isInternal = safeHref.startsWith("/");
			return (
				<a
					{...props}
					href={safeHref}
					rel={isInternal ? undefined : "noopener noreferrer"}
					target={isInternal ? undefined : "_blank"}
				>
					{children}
				</a>
			);
		},
		blockquote({ children }) {
			return (
				<blockquote>
					{renderTextChildren(children, renderText, "blockquote")}
				</blockquote>
			);
		},
		del({ children }) {
			return <del>{renderTextChildren(children, renderText, "del")}</del>;
		},
		em({ children }) {
			return <em>{renderTextChildren(children, renderText, "em")}</em>;
		},
		h1({ children }) {
			return <h1>{renderTextChildren(children, renderText, "h1")}</h1>;
		},
		h2({ children }) {
			return <h2>{renderTextChildren(children, renderText, "h2")}</h2>;
		},
		h3({ children }) {
			return <h3>{renderTextChildren(children, renderText, "h3")}</h3>;
		},
		h4({ children }) {
			return <h4>{renderTextChildren(children, renderText, "h4")}</h4>;
		},
		h5({ children }) {
			return <h5>{renderTextChildren(children, renderText, "h5")}</h5>;
		},
		h6({ children }) {
			return <h6>{renderTextChildren(children, renderText, "h6")}</h6>;
		},
		img({ alt, src }) {
			const safeSrc = getSafeImageSrc(src, inlineImageSources);
			if (!safeSrc) {
				return alt ? (
					<span className={styles.imageFallback}>{alt}</span>
				) : null;
			}

			return (
				<img
					alt={alt ?? ""}
					className={styles.image}
					loading="lazy"
					src={safeSrc}
				/>
			);
		},
		code({ children, className, ...props }) {
			const code = String(children).replace(/\n$/, "");
			const language = getCodeLanguage(className);
			const isBlock = Boolean(className) || code.includes("\n");

			if (!isBlock) {
				return (
					<code className={className} {...props}>
						{children}
					</code>
				);
			}

			const highlighted = highlightCode(code, language);
			const languageLabel =
				highlighted.language === "auto"
					? ""
					: getCommunityCodeLanguageLabel(highlighted.language);

			return (
				<code
					{...props}
					className={styles.codeBlock}
					data-language-label={languageLabel || undefined}
					dangerouslySetInnerHTML={{ __html: highlighted.html }}
				/>
			);
		},
		li({ children }) {
			return <li>{renderTextChildren(children, renderText, "li")}</li>;
		},
		p({ children }) {
			return <p>{renderTextChildren(children, renderText, "p")}</p>;
		},
		strong({ children }) {
			return (
				<strong>{renderTextChildren(children, renderText, "strong")}</strong>
			);
		},
		pre({ children }) {
			return <pre className={styles.codePre}>{children}</pre>;
		},
		table({ children }) {
			return (
				<div className={styles.tableScroll}>
					<table>{children}</table>
				</div>
			);
		},
		td({ children }) {
			return <td>{renderTextChildren(children, renderText, "td")}</td>;
		},
		th({ children }) {
			return <th>{renderTextChildren(children, renderText, "th")}</th>;
		},
	} satisfies Components;

	return (
		<div
			className={cn(
				styles.markdown,
				variant === "compact" ? styles.compact : "",
				variant === "composer" ? styles.composerPreview : "",
				className,
			)}
		>
			<ReactMarkdown
				components={components}
				remarkPlugins={[remarkGfm, remarkBreaks]}
				urlTransform={transformMarkdownUrl}
			>
				{normalizedContent}
			</ReactMarkdown>
		</div>
	);
}
