"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type AdminAccessState = {
	email: string | null;
	isAdmin: boolean;
	loading: boolean;
};

export function useAdminAccess() {
	const [state, setState] = useState<AdminAccessState>({
		email: null,
		isAdmin: false,
		loading: true,
	});

	useEffect(() => {
		let active = true;

		async function checkAdmin() {
			const {
				data: { session },
			} = await supabase.auth.getSession();

			if (!session?.access_token) {
				if (active) {
					setState({ email: null, isAdmin: false, loading: false });
				}
				return;
			}

			const response = await fetch("/api/admin/me", {
				headers: {
					Authorization: `Bearer ${session.access_token}`,
				},
			});

			if (!active) return;

			if (!response.ok) {
				setState({ email: null, isAdmin: false, loading: false });
				return;
			}

			const data = (await response.json()) as {
				email?: string | null;
				isAdmin?: boolean;
			};

			setState({
				email: data.email ?? null,
				isAdmin: Boolean(data.isAdmin),
				loading: false,
			});
		}

		void checkAdmin().catch(() => {
			if (active) {
				setState({ email: null, isAdmin: false, loading: false });
			}
		});

		return () => {
			active = false;
		};
	}, []);

	return state;
}
