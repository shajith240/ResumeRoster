import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

export type AvatarUploadResult = {
	avatar_path: string;
	avatar_url: string;
};

async function getAuthenticatedJsonHeaders(message: string) {
	const {
		data: { session },
	} = await supabase.auth.getSession();

	if (!session?.access_token) {
		throw new Error(message);
	}

	return {
		Authorization: `Bearer ${session.access_token}`,
		"Content-Type": "application/json",
	};
}

export async function uploadProfileAvatar(
	avatarFile: File | null,
	activeUser: User,
): Promise<AvatarUploadResult | null> {
	if (!avatarFile) return null;

	const {
		data: { session },
	} = await supabase.auth.getSession();

	if (!session?.access_token) {
		throw new Error("Sign in again before uploading a profile image.");
	}

	const formData = new FormData();
	formData.set("file", avatarFile);

	const response = await fetch("/api/profile/avatar", {
		body: formData,
		headers: {
			Authorization: `Bearer ${session.access_token}`,
		},
		method: "POST",
	});
	const payload = (await response.json().catch(() => ({}))) as Partial<
		AvatarUploadResult & { message: string }
	>;

	if (!response.ok || !payload.avatar_path || !payload.avatar_url) {
		throw new Error(
			payload.message ?? "Profile image upload failed. Please try again.",
		);
	}

	if (!payload.avatar_path.startsWith(`${activeUser.id}/`)) {
		throw new Error("Profile image upload failed. Please try again.");
	}

	return {
		avatar_path: payload.avatar_path,
		avatar_url: payload.avatar_url,
	};
}

export async function cleanupProfileAvatar(avatarPath: string) {
	const headers = await getAuthenticatedJsonHeaders(
		"Sign in again before cleaning up a profile image.",
	);
	const response = await fetch("/api/profile/avatar", {
		body: JSON.stringify({ avatarPath }),
		headers,
		method: "DELETE",
	});

	if (!response.ok) {
		throw new Error("Profile image cleanup failed.");
	}
}
