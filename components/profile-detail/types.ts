

export type ProfileDetailProps = {
	profileId: string;
};

export type ActivityItem = {
	id: string;
	title: string;
	detail: string;
	href?: string;
	timestamp: number;
};

export type UsernameAvailability = {
	status: "idle" | "checking" | "available" | "taken";
	message: string;
	suggestions: string[];
};
