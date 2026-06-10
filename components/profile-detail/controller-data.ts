import type { User } from "@supabase/supabase-js";
import { getAnonymousProfileUsername } from "@/lib/anonymous-profile";
import { supabase } from "@/lib/supabase/client";
import type {
	PublicProfile,
	PublicProfileReview,
	PublicProfileResume,
} from "@/lib/supabase/types";
import { SUPABASE_MIGRATION_MESSAGE } from "./constants";
import { loadPublicProfileReviews } from "./data";
import {
	isProfileFeatureError,
	isUuid,
	normalizeProfileToken,
} from "./utils";

export type LoadedProfileDetail = {
	activeUser: User | null;
	errorMessage: string;
	isOnline: boolean;
	loadedProfile: PublicProfile | null;
	loadedResumes: PublicProfileResume[];
	loadedReviews: PublicProfileReview[];
};

const PROFILE_ONLINE_WINDOW_SECONDS = 120;

async function loadProfileOnlineState(profileId: string) {
	const { data, error } = await supabase.rpc("is_profile_online", {
		profile_id: profileId,
		window_seconds: PROFILE_ONLINE_WINDOW_SECONDS,
	});

	if (error) return false;

	return data === true;
}

export async function loadProfileDetailData(
	profileId: string,
): Promise<LoadedProfileDetail> {
	const profileToken = normalizeProfileToken(profileId);
	const { data: userData } = await supabase.auth.getUser();
	const activeUser = userData.user;
	let resolvedProfileId = profileToken;

	if (profileToken.toLowerCase() === "me") {
		if (!activeUser) {
			return {
				activeUser,
				errorMessage: "Sign in to open your profile.",
				isOnline: false,
				loadedProfile: null,
				loadedResumes: [],
				loadedReviews: [],
			};
		}

		resolvedProfileId = activeUser.id;
	} else if (!isUuid(profileToken)) {
		const { data: matchedProfile, error: matchError } = await supabase
			.from("profiles")
			.select("id")
			.ilike("username", profileToken)
			.maybeSingle();

		if (matchError) {
			return {
				activeUser,
				errorMessage: matchError.message,
				isOnline: false,
				loadedProfile: null,
				loadedResumes: [],
				loadedReviews: [],
			};
		}

		if (!matchedProfile?.id) {
			return {
				activeUser,
				errorMessage: `We could not find a profile for @${profileToken}.`,
				isOnline: false,
				loadedProfile: null,
				loadedResumes: [],
				loadedReviews: [],
			};
		}

		resolvedProfileId = matchedProfile.id;
	}

	if (activeUser?.id === resolvedProfileId) {
		const seedResult = await supabase.from("profiles").insert({
			id: activeUser.id,
			username: getAnonymousProfileUsername(activeUser.id),
		});

		if (
			seedResult.error &&
			seedResult.error.code !== "23505" &&
			isProfileFeatureError(seedResult.error.message)
		) {
			return {
				activeUser,
				errorMessage: SUPABASE_MIGRATION_MESSAGE,
				isOnline: false,
				loadedProfile: null,
				loadedResumes: [],
				loadedReviews: [],
			};
		}
	}

	const [profileResult, reviewsResult, resumesResult, onlineResult] =
		await Promise.all([
			supabase.rpc("get_public_profile", { profile_id: resolvedProfileId }),
			loadPublicProfileReviews(resolvedProfileId),
			supabase.rpc("get_public_profile_resumes", {
				profile_id: resolvedProfileId,
				limit_count: 20,
			}),
			loadProfileOnlineState(resolvedProfileId),
		]);

	if (profileResult.error) {
		return {
			activeUser,
			errorMessage: isProfileFeatureError(profileResult.error.message)
				? SUPABASE_MIGRATION_MESSAGE
				: profileResult.error.message,
			isOnline: false,
			loadedProfile: null,
			loadedResumes: [],
			loadedReviews: [],
		};
	}

	if (resumesResult.error && isProfileFeatureError(resumesResult.error.message)) {
		return {
			activeUser,
			errorMessage: SUPABASE_MIGRATION_MESSAGE,
			isOnline: false,
			loadedProfile: null,
			loadedResumes: [],
			loadedReviews: [],
		};
	}

	const loadedProfile = (profileResult.data?.[0] ?? null) as PublicProfile | null;

	if (!loadedProfile) {
		return {
			activeUser,
			errorMessage: isUuid(profileToken)
				? "We could not find a profile row for this user yet."
				: `We could not find a profile for @${profileToken}.`,
			isOnline: false,
			loadedProfile: null,
			loadedResumes: [],
			loadedReviews: [],
		};
	}

	return {
		activeUser,
		errorMessage: "",
		isOnline: onlineResult,
		loadedProfile,
		loadedResumes: (resumesResult.data ?? []) as PublicProfileResume[],
		loadedReviews: (reviewsResult.data ?? []) as PublicProfileReview[],
	};
}
