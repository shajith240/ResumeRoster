"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type ReviewerAccessState = {
	isVerifiedReviewer: boolean;
	loading: boolean;
};

export function useReviewerAccess(): ReviewerAccessState {
	const [state, setState] = useState<ReviewerAccessState>({
		isVerifiedReviewer: false,
		loading: true,
	});

	useEffect(() => {
		let active = true;

		async function check() {
			const {
				data: { session },
			} = await supabase.auth.getSession();

			if (!session?.user?.id) {
				if (active) setState({ isVerifiedReviewer: false, loading: false });
				return;
			}

			const { data } = await supabase
				.from("profiles")
				.select("reviewer_verification_status")
				.eq("id", session.user.id)
				.maybeSingle();

			if (active) {
				setState({
					isVerifiedReviewer: data?.reviewer_verification_status === "verified",
					loading: false,
				});
			}
		}

		void check().catch(() => {
			if (active) setState({ isVerifiedReviewer: false, loading: false });
		});

		return () => {
			active = false;
		};
	}, []);

	return state;
}
