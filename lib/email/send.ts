import type { SupabaseClient } from "@supabase/supabase-js";
import { capturePrivateError } from "@/lib/monitoring/capture-errors";
import { FROM_ADDRESS, getResendClient } from "./client";

export async function sendEmail({
	to,
	subject,
	html,
}: {
	to: string;
	subject: string;
	html: string;
}): Promise<void> {
	if (!process.env.RESEND_API_KEY) return; // silently no-op without config

	try {
		const resend = getResendClient();
		await resend.emails.send({ from: FROM_ADDRESS, to, subject, html });
	} catch (error) {
		capturePrivateError(error, { area: "email", operation: "send_email", to });
	}
}

export async function getUserEmail(
	admin: SupabaseClient,
	userId: string,
): Promise<string | null> {
	const { data, error } = await admin.auth.admin.getUserById(userId);
	if (error || !data.user?.email) return null;
	return data.user.email;
}
