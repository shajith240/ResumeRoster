const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://linted.space";

function layout(title: string, body: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1a1a1a;border-radius:12px;border:1px solid #2a2a2a;overflow:hidden;">
      <tr><td style="padding:32px 40px 0;">
        <p style="margin:0 0 24px;font-size:13px;font-weight:600;letter-spacing:.08em;color:#888;text-transform:uppercase;">Linted</p>
        ${body}
      </td></tr>
      <tr><td style="padding:24px 40px 32px;border-top:1px solid #2a2a2a;margin-top:32px;">
        <p style="margin:0;font-size:12px;color:#555;">
          You're receiving this because of activity on your Linted account.<br />
          <a href="${BASE_URL}/settings" style="color:#888;text-decoration:underline;">Manage notification preferences</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function btn(label: string, href: string): string {
	return `<a href="${href}" style="display:inline-block;margin:24px 0 8px;padding:12px 24px;background:#e8b86a;color:#0f0f0f;font-weight:600;font-size:14px;border-radius:8px;text-decoration:none;">${label}</a>`;
}

function h1(text: string): string {
	return `<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#f5f5f5;line-height:1.3;">${text}</h1>`;
}

function p(text: string): string {
	return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#aaa;">${text}</p>`;
}

// ─── templates ──────────────────────────────────────────────────────────────

export function reviewerAssigned(resumeId: string) {
	const href = `${BASE_URL}/resumes/${resumeId}`;
	return {
		subject: "You've been assigned a priority resume — clock starts now",
		html: layout(
			"Priority review assigned",
			h1("You claimed a priority review") +
			p("Your 24-hour window to submit a structured review has started. The candidate is counting on you — a missed deadline will issue an automatic refund and may affect your reviewer standing.") +
			btn("Open the resume", href) +
			p("Tip: use the structured review form in the feedback panel. The candidate will see your rating and all five sections."),
		),
	};
}

export function reviewerApproved() {
	const href = `${BASE_URL}/reviewer`;
	return {
		subject: "You're approved as a verified reviewer on Resume Roster",
		html: layout(
			"Reviewer approved",
			h1("You're a verified reviewer") +
			p("Your application has been approved. You can now claim priority resume reviews and help candidates land their next role.") +
			btn("Go to your reviewer hub", href) +
			p("Each priority review has a 24-hour window. Once you claim a resume, the clock starts immediately."),
		),
	};
}

export function reviewerRejected(adminNote?: string) {
	const href = `${BASE_URL}/profile`;
	return {
		subject: "Update on your Resume Roster reviewer application",
		html: layout(
			"Reviewer application update",
			h1("Application not approved") +
			p("After reviewing your application, we weren't able to approve you as a verified reviewer at this time.") +
			(adminNote ? p(`<strong style="color:#f5f5f5;">Admin note:</strong> ${adminNote}`) : "") +
			p("You're welcome to update your profile and reapply — we look at work experience, writing quality, and community contributions.") +
			btn("Update your profile", href),
		),
	};
}

export function refundIssued(resumeId: string) {
	const href = `${BASE_URL}/resumes/${resumeId}`;
	return {
		subject: "Refund processed for your priority resume review",
		html: layout(
			"Refund processed",
			h1("Your refund has been issued") +
			p("We weren't able to complete your priority review — your ₹399 payment will be returned to your original payment method within 5–7 business days.") +
			btn("View your resume", href) +
			p("Your resume is still open for community feedback. You can request a new priority review at any time."),
		),
	};
}

export function premiumReviewPosted(resumeId: string) {
	const href = `${BASE_URL}/resumes/${resumeId}`;
	return {
		subject: "Your priority review is ready",
		html: layout(
			"Priority review received",
			h1("Your priority review has been submitted") +
			p("A verified reviewer has completed your priority review. Open your resume to read the structured feedback — it includes a star rating, clarity notes, impact assessment, skills gap analysis, and the top 3 changes they recommend.") +
			btn("Read your review", href),
		),
	};
}

export function reviewerMissedWarning(missedCount: number) {
	const href = `${BASE_URL}/reviewer`;
	return {
		subject: `Warning: ${missedCount} missed review deadline${missedCount !== 1 ? "s" : ""} on your reviewer account`,
		html: layout(
			"Missed deadline warning",
			h1(`${missedCount} missed deadline${missedCount !== 1 ? "s" : ""}`) +
			p("You've missed a priority review deadline. The candidate received an automatic refund.") +
			p("<strong style=\"color:#f5f5f5;\">One more missed deadline will suspend your ability to claim new priority reviews.</strong> Your verified reviewer status remains intact — only claiming is affected.") +
			btn("View your reviewer hub", href) +
			p("If you believe this was an error or had extenuating circumstances, reply to this email to appeal."),
		),
	};
}

export function reviewerClaimSuspended() {
	const href = `${BASE_URL}/reviewer`;
	return {
		subject: "Your priority review claiming has been suspended",
		html: layout(
			"Claiming suspended",
			h1("Claiming ability suspended") +
			p("You've missed 3 priority review deadlines. Your ability to claim new priority reviews has been automatically suspended.") +
			p("Your verified reviewer status and community standing are not affected — you can still post feedback on any public resume.") +
			btn("View your reviewer hub", href) +
			p("To appeal this suspension, reply to this email with context. Suspensions are reviewed within 48 hours."),
		),
	};
}

export function deadlineReminder12h(resumeId: string) {
	const href = `${BASE_URL}/resumes/${resumeId}`;
	return {
		subject: "Reminder: 12 hours left to submit your priority review",
		html: layout(
			"12 hours left",
			h1("12 hours left on your priority review") +
			p("You have 12 hours remaining to submit your structured review. Failing to submit will trigger an automatic refund to the candidate and count as a missed deadline on your reviewer record.") +
			btn("Submit your review now", href),
		),
	};
}

export function deadlineReminder4h(resumeId: string) {
	const href = `${BASE_URL}/resumes/${resumeId}`;
	return {
		subject: "Urgent: 4 hours left to submit your priority review",
		html: layout(
			"4 hours left — urgent",
			h1("Only 4 hours left") +
			p("This is your final reminder. You have 4 hours to submit your priority review before the deadline expires and an automatic refund is issued.") +
			btn("Submit now", href),
		),
	};
}
