import type { ResumeAuthorProfile, ResumeSummary } from "@/lib/supabase/types";

function clean(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function cleanUsername(value: string | null | undefined) {
  return clean(value).replace(/^@+/, "");
}

export function roleFromResumeTitle(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("data")) return "Data Analyst";
  if (lower.includes("product")) return "Product Manager";
  if (lower.includes("mba")) return "MBA";
  if (lower.includes("intern")) return "SDE Intern";
  return "Full-time SDE";
}

export function getProfileDisplayName(profile?: ResumeAuthorProfile | null) {
  return clean(profile?.full_name) || cleanUsername(profile?.username);
}

export function getResumePosterLabel(
  resume: ResumeSummary,
  profile?: ResumeAuthorProfile | null,
) {
  if (resume.is_anonymous) return "posted anonymously";

  const displayName = getProfileDisplayName(profile);
  return displayName ? `posted by ${displayName}` : "posted with profile";
}

export function getResumeRoleLabel(
  resume: ResumeSummary,
  profile?: ResumeAuthorProfile | null,
) {
  if (resume.is_anonymous) return roleFromResumeTitle(resume.title);

  return (
    clean(profile?.current_position) ||
    clean(profile?.target_role) ||
    roleFromResumeTitle(resume.title)
  );
}

export function getResumeAffiliationLabel(
  resume: ResumeSummary,
  profile?: ResumeAuthorProfile | null,
) {
  if (resume.is_anonymous) return "Anonymous college";

  return clean(profile?.college) || "Public profile";
}
