import { ExternalLink } from "lucide-react";

type HnStory = {
	created_at?: string;
	num_comments?: number;
	objectID?: string;
	points?: number;
	title?: string;
	url?: string;
};

type HnSearchResponse = {
	hits?: HnStory[];
};

type NewsItem = {
	comments: number;
	createdAt: string;
	domain: string;
	id: string;
	points: number;
	title: string;
	url: string;
};

const AI_NEWS_ENDPOINT =
	"https://hn.algolia.com/api/v1/search_by_date?query=AI&tags=story&hitsPerPage=8";
const HN_ITEM_URL = "https://news.ycombinator.com/item?id=";

function decodeHtml(value: string) {
	return value.replace(/&(#\d+|#x[\da-f]+|amp|lt|gt|quot|apos);/gi, (match, entity) => {
		const normalized = entity.toLowerCase();

		if (normalized === "amp") return "&";
		if (normalized === "lt") return "<";
		if (normalized === "gt") return ">";
		if (normalized === "quot") return '"';
		if (normalized === "apos") return "'";

		if (normalized.startsWith("#x")) {
			const codePoint = Number.parseInt(normalized.slice(2), 16);
			return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
		}

		if (normalized.startsWith("#")) {
			const codePoint = Number.parseInt(normalized.slice(1), 10);
			return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
		}

		return match;
	});
}

function getDomain(url: string) {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return "news.ycombinator.com";
	}
}

function formatRelativeTime(value: string) {
	const createdAt = new Date(value).getTime();
	if (!Number.isFinite(createdAt)) return "recent";

	const diffMs = Math.max(0, Date.now() - createdAt);
	const minutes = Math.max(1, Math.round(diffMs / 60_000));

	if (minutes < 60) return `${minutes}m ago`;

	const hours = Math.round(minutes / 60);
	if (hours < 48) return `${hours}h ago`;

	const days = Math.round(hours / 24);
	return `${days}d ago`;
}

function normalizeStory(story: HnStory): NewsItem | null {
	const title = story.title?.trim();
	const id = story.objectID?.trim();

	if (!title || !id) return null;

	const url = story.url?.trim() || `${HN_ITEM_URL}${id}`;

	return {
		comments: story.num_comments ?? 0,
		createdAt: story.created_at ?? new Date().toISOString(),
		domain: getDomain(url),
		id,
		points: story.points ?? 0,
		title: decodeHtml(title),
		url,
	};
}

async function getAiNews() {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => {
		controller.abort();
	}, 3_000);

	try {
		const response = await fetch(AI_NEWS_ENDPOINT, {
			next: { revalidate: 15 * 60 },
			signal: controller.signal,
		});

		if (!response.ok) return [];

		const payload = (await response.json()) as HnSearchResponse;
		return (payload.hits ?? [])
			.map(normalizeStory)
			.filter((item): item is NewsItem => Boolean(item))
			.slice(0, 6);
	} catch {
		return [];
	} finally {
		clearTimeout(timeoutId);
	}
}

export default async function CommunityAiNewsRail() {
	const news = await getAiNews();

	return (
		<aside className="feed-right-rail community-news-rail" aria-label="AI news">
			<section className="community-news-card">
				<header className="community-news-header">
					<div>
						<span>Live rail</span>
						<h2>AI news</h2>
					</div>
					<a
						aria-label="Open Hacker News AI search"
						href="https://hn.algolia.com/?q=AI"
						rel="noreferrer"
						target="_blank"
					>
						<ExternalLink aria-hidden="true" />
					</a>
				</header>

				{news.length ? (
					<ul className="community-news-list">
						{news.map((item) => (
							<li key={item.id}>
								<a href={item.url} rel="noreferrer" target="_blank">
									<strong>{item.title}</strong>
									<span className="community-news-meta">
										<span>{item.domain}</span>
										<time dateTime={item.createdAt}>
											{formatRelativeTime(item.createdAt)}
										</time>
									</span>
									<span className="community-news-stats">
										{item.points} points - {item.comments} comments
									</span>
								</a>
							</li>
						))}
					</ul>
				) : (
					<p className="community-news-empty">
						Could not load AI news right now.
					</p>
				)}
			</section>
		</aside>
	);
}
