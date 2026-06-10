import { supabase } from "@/lib/supabase/client";

export const ONLINE_PRESENCE_WINDOW_SECONDS = 120;
const ONLINE_PRESENCE_LOOKUP_CHUNK_SIZE = 200;
const MAX_ONLINE_PRESENCE_LOOKUP_IDS = 500;

type OnlineProfileIdRow = {
	user_id: string | null;
};

export async function loadOnlineProfileIds(
	profileIds: Array<string | null | undefined>,
) {
	const uniqueProfileIds = Array.from(
		new Set(
			profileIds
				.map((profileId) => profileId?.trim())
				.filter((profileId): profileId is string => Boolean(profileId)),
		),
	).slice(0, MAX_ONLINE_PRESENCE_LOOKUP_IDS);

	if (!uniqueProfileIds.length) return new Set<string>();

	const onlineProfileIds = new Set<string>();

	for (
		let index = 0;
		index < uniqueProfileIds.length;
		index += ONLINE_PRESENCE_LOOKUP_CHUNK_SIZE
	) {
		const { data, error } = await supabase.rpc("get_online_profile_ids", {
			profile_ids: uniqueProfileIds.slice(
				index,
				index + ONLINE_PRESENCE_LOOKUP_CHUNK_SIZE,
			),
			window_seconds: ONLINE_PRESENCE_WINDOW_SECONDS,
		});

		if (error) continue;

		for (const profileId of ((data ?? []) as OnlineProfileIdRow[])
			.map((row) => row.user_id)
			.filter((rowUserId): rowUserId is string => Boolean(rowUserId))) {
			onlineProfileIds.add(profileId);
		}
	}

	return onlineProfileIds;
}
