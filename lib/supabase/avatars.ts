import { supabase } from "@/lib/supabase/client";

const AVATAR_BUCKET = "avatars";

function resolveAvatarUrl(
	avatarUrl?: string | null,
	avatarPath?: string | null,
) {
	const directUrl = avatarUrl?.trim();
	if (directUrl) return directUrl;

	const storagePath = avatarPath?.trim();
	if (!storagePath) return "";

	if (/^(https?:)?\/\//i.test(storagePath) || storagePath.startsWith("/")) {
		return storagePath;
	}

	return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(storagePath).data
		.publicUrl;
}

export function getGeneratedAvatarUrl(seed: string) {
	return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seed)}`;
}

export function resolveProfileAvatarUrl(
	profile: {
		avatar_path?: string | null;
		avatar_url?: string | null;
		full_name?: string | null;
		id?: string | null;
		username?: string | null;
	} | null | undefined,
	fallbackSeed: string,
) {
	const resolved = resolveAvatarUrl(profile?.avatar_url, profile?.avatar_path);
	if (resolved) return resolved;

	return getGeneratedAvatarUrl(
		profile?.full_name?.trim() ||
			profile?.username?.trim() ||
			profile?.id?.trim() ||
			fallbackSeed,
	);
}
