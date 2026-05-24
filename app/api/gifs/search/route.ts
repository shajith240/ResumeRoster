import type { GifProvider } from "@/lib/comment-media-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GifResult = {
	altText: string;
	height?: number;
	id: string;
	provider: GifProvider;
	previewUrl: string;
	title: string;
	url: string;
	width?: number;
};

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

function firstString(...values: unknown[]) {
	for (const value of values) {
		if (typeof value === "string" && value.trim()) {
			return value.trim();
		}
	}

	return "";
}

function asNumber(value: unknown) {
	const numberValue =
		typeof value === "number"
			? value
			: typeof value === "string"
				? Number(value)
				: Number.NaN;

	return Number.isFinite(numberValue) ? numberValue : undefined;
}

function getKlipyImage(result: Record<string, unknown>) {
	const file = asRecord(result.file);
	const files = asRecord(result.files);
	const media = asRecord(result.media);

	return {
		height: asNumber(
			result.height ??
				file.height ??
				asRecord(files.md).height ??
				asRecord(files.fixed_height).height,
		),
		previewUrl: firstString(
			asRecord(files.sm).url,
			asRecord(files.tiny).url,
			asRecord(files.preview).url,
			asRecord(files.md).url,
			file.sm,
			file.preview,
			result.preview_url,
		),
		url: firstString(
			asRecord(files.md).url,
			asRecord(files.gif).url,
			asRecord(files.original).url,
			file.url,
			file.gif,
			asRecord(media.gif).url,
			result.gif_url,
			result.url,
		),
		width: asNumber(
			result.width ??
				file.width ??
				asRecord(files.md).width ??
				asRecord(files.fixed_height).width,
		),
	};
}

function mapKlipyResults(payload: unknown): GifResult[] {
	const root = asRecord(payload);
	const data = asArray(root.data).length
		? asArray(root.data)
		: asArray(root.results);

	return data
		.map((item, index) => {
			const result = asRecord(item);
			const image = getKlipyImage(result);
			const title = firstString(result.title, result.name, result.slug, "GIF");

			if (!image.url) return null;

			return {
				altText: title,
				height: image.height,
				id: firstString(result.id, result.slug, image.url, `klipy-${index}`),
				provider: "klipy" as const,
				previewUrl: image.previewUrl || image.url,
				title,
				url: image.url,
				width: image.width,
			};
		})
		.filter(Boolean) as GifResult[];
}

function getGiphyImage(result: Record<string, unknown>) {
	const images = asRecord(result.images);
	const fixedHeight = asRecord(images.fixed_height);
	const fixedSmall = asRecord(images.fixed_height_small);
	const downsized = asRecord(images.downsized);
	const original = asRecord(images.original);

	return {
		height: asNumber(fixedHeight.height ?? original.height),
		previewUrl: firstString(fixedSmall.url, downsized.url, fixedHeight.url),
		url: firstString(fixedHeight.url, downsized.url, original.url),
		width: asNumber(fixedHeight.width ?? original.width),
	};
}

function mapGiphyResults(payload: unknown): GifResult[] {
	const data = asArray(asRecord(payload).data);

	return data
		.map((item, index) => {
			const result = asRecord(item);
			const image = getGiphyImage(result);
			const title = firstString(result.title, result.slug, "GIF");

			if (!image.url) return null;

			return {
				altText: title,
				height: image.height,
				id: firstString(result.id, image.url, `giphy-${index}`),
				provider: "giphy" as const,
				previewUrl: image.previewUrl || image.url,
				title,
				url: image.url,
				width: image.width,
			};
		})
		.filter(Boolean) as GifResult[];
}

async function searchKlipy(query: string) {
	const appKey = process.env.KLIPY_API_KEY;
	if (!appKey) return null;

	const endpoint = query
		? `https://api.klipy.com/api/v1/${encodeURIComponent(appKey)}/gifs/search`
		: `https://api.klipy.com/api/v1/${encodeURIComponent(appKey)}/gifs/trending`;
	const url = new URL(endpoint);
	url.searchParams.set("page", "1");
	url.searchParams.set("per_page", "18");
	url.searchParams.set("locale", "en");
	url.searchParams.set("format_filter", "gif");
	url.searchParams.set("content_filter", "medium");
	if (query) url.searchParams.set("q", query);

	const response = await fetch(url, {
		headers: { Accept: "application/json" },
		next: { revalidate: 60 },
	});

	if (!response.ok) {
		throw new Error("KLIPY GIF search failed.");
	}

	return {
		provider: "klipy" as const,
		results: mapKlipyResults(await response.json()),
	};
}

async function searchGiphy(query: string) {
	const apiKey = process.env.GIPHY_API_KEY;
	if (!apiKey) return null;

	const endpoint = query
		? "https://api.giphy.com/v1/gifs/search"
		: "https://api.giphy.com/v1/gifs/trending";
	const url = new URL(endpoint);
	url.searchParams.set("api_key", apiKey);
	url.searchParams.set("limit", "18");
	url.searchParams.set("rating", "pg-13");
	if (query) url.searchParams.set("q", query);

	const response = await fetch(url, {
		headers: { Accept: "application/json" },
		next: { revalidate: 60 },
	});

	if (!response.ok) {
		throw new Error("GIPHY GIF search failed.");
	}

	return {
		provider: "giphy" as const,
		results: mapGiphyResults(await response.json()),
	};
}

export async function GET(request: Request) {
	const url = new URL(request.url);
	const query = (url.searchParams.get("q") ?? "").trim().slice(0, 80);

	try {
		const klipyResult = await searchKlipy(query);
		if (klipyResult) return Response.json(klipyResult);

		const giphyResult = await searchGiphy(query);
		if (giphyResult) return Response.json(giphyResult);

		return Response.json(
			{
				message: "Set KLIPY_API_KEY or GIPHY_API_KEY to enable GIF search.",
				provider: null,
				results: [],
			},
			{ status: 503 },
		);
	} catch (error) {
		const giphyResult = await searchGiphy(query).catch(() => null);
		if (giphyResult) return Response.json(giphyResult);

		return Response.json(
			{
				message:
					error instanceof Error ? error.message : "GIF search is unavailable.",
				provider: null,
				results: [],
			},
			{ status: 502 },
		);
	}
}
