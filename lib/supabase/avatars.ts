import { supabase } from "@/lib/supabase/client";

const AVATAR_BUCKET = "avatars";

export function resolveAvatarUrl(
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

