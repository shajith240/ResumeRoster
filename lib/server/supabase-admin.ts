import { createServiceSupabaseClient } from "@/lib/server-auth";

export function createServiceRoleClient() {
	return createServiceSupabaseClient("Service-role Supabase setup is missing.");
}
