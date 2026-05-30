export type ResumeStatus = "open" | "roasted" | "closed";
export type ResumePrivacyMode = "public" | "contact_hidden" | "anonymous";
export type AppStatus = "online" | "focus" | "offline";
export type ContentReportReason =
  | "personal_info"
  | "harassment"
  | "spam"
  | "unsafe"
  | "off_topic"
  | "other";
export type ContentReportStatus =
  | "pending"
  | "reviewing"
  | "dismissed"
  | "actioned";
export type ContentReportTargetType = "resume" | "roast" | "profile";
export type CommentContentFormat = "plain" | "markdown";
export type CommentAttachmentKind = "image";
export type CommentAttachmentSource = "upload";
export type CommunityRole = "candidate" | "reviewer" | "both";
export type ReviewerType =
  | "student"
  | "placed_professional"
  | "recruiter"
  | "hiring_manager"
  | "engineer"
  | "designer"
  | "product_manager"
  | "career_coach"
  | "founder"
  | "other";
export type ReviewerVerificationStatus =
  | "none"
  | "pending"
  | "verified"
  | "rejected";
export type ReviewerApplicationStatus = "pending" | "approved" | "rejected";
export type OnboardingGoalId = "get_feedback" | "review_resumes" | "both";
export type OnboardingPersonaId =
  | "student"
  | "new_grad"
  | "job_seeker"
  | "career_switcher"
  | "recruiter_hr"
  | "hiring_manager"
  | "engineer"
  | "designer"
  | "product_manager"
  | "career_coach"
  | "founder"
  | "other";
export type OnboardingStatus = "pending" | "completed" | "not_required";
export type NotificationType =
  | "resume_feedback"
  | "comment_reply"
  | "resume_thread_reply"
  | "helpful_vote"
  | "reviewer_status"
  | "moderation"
  | "system";

export type ResumeAuthorProfile = {
  id: string;
  username: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  avatar_path?: string | null;
  college?: string | null;
  target_role?: string | null;
  current_position?: string | null;
  app_status?: AppStatus | null;
  community_role?: CommunityRole | null;
  reviewer_type?: ReviewerType | null;
  reviewer_headline?: string | null;
  reviewer_expertise?: string[] | null;
  reviewer_verification_status?: ReviewerVerificationStatus | null;
};

export type ResumeSummary = {
  id: string;
  user_id: string;
  title: string;
  file_path: string;
  is_anonymous: boolean;
  privacy_mode?: ResumePrivacyMode;
  status: ResumeStatus;
  roast_count: number;
  read_count: number;
  job_description: string | null;
  post_description: string | null;
  created_at: string;
  author_profile?: ResumeAuthorProfile | null;
};

export type Roast = {
  id: string;
  resume_id: string;
  parent_id?: string | null;
  author_id: string;
  content: string;
  attachment_id?: string | null;
  content_format?: CommentContentFormat;
  helpful_votes: number;
  dislike_count?: number;
  reply_count?: number;
  is_deleted?: boolean;
  deleted_at?: string | null;
  created_at: string;
};

export type CommentAttachment = {
  id: string;
  user_id?: string | null;
  kind: CommentAttachmentKind;
  source: CommentAttachmentSource;
  storage_path: string | null;
  title: string;
  alt_text: string;
  mime_type: "image/png" | "image/jpeg" | "image/webp" | null;
  file_size: number | null;
  created_at: string;
};

export type RoasterLeaderboardEntry = {
  id: string;
  username: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  avatar_path?: string | null;
  college: string | null;
  target_role: string | null;
  app_status?: AppStatus | null;
  community_role?: CommunityRole | null;
  reviewer_type?: ReviewerType | null;
  reviewer_headline?: string | null;
  reviewer_expertise?: string[] | null;
  reviewer_verification_status?: ReviewerVerificationStatus | null;
  roast_count: number;
  helpful_votes: number;
};

export type PublicProfile = RoasterLeaderboardEntry & {
  avatar_path: string | null;
  tagline: string | null;
  current_position: string | null;
  college_location: string | null;
  about: string | null;
  skills: string[] | null;
  community_role: CommunityRole;
  reviewer_type: ReviewerType | null;
  reviewer_headline: string | null;
  reviewer_bio: string | null;
  reviewer_expertise: string[] | null;
  reviewer_verification_status: ReviewerVerificationStatus;
  reviewer_verified_at: string | null;
  reviewer_verified_by: string | null;
  resume_highlight_id: string | null;
  roast_points: number;
  resume_improvement: number;
  resumes_submitted_count: number;
  resumes_roasted_count: number;
  best_roast_count: number;
  received_roast_count: number;
  received_helpful_votes: number;
  created_at: string;
};

export type ReviewerApplication = {
  id: string;
  user_id: string;
  requested_type: ReviewerType;
  expertise: string[];
  proof_url: string;
  note: string;
  status: ReviewerApplicationStatus;
  admin_note: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileOnboarding = {
  user_id: string;
  goal_id: OnboardingGoalId | null;
  persona_id: OnboardingPersonaId | null;
  status: OnboardingStatus;
  version: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PublicProfileResume = {
  id: string;
  title: string;
  status: ResumeStatus;
  roast_count: number;
  created_at: string;
  is_highlight: boolean;
};

export type PublicProfileRoast = {
  id: string;
  resume_id: string;
  resume_title: string;
  resume_status: ResumeStatus;
  content: string;
  helpful_votes: number;
  created_at: string;
};

export type LintedNotification = {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: NotificationType;
  title: string;
  body: string;
  link_href: string;
  resume_id: string | null;
  roast_id: string | null;
  parent_roast_id: string | null;
  related_user_id: string | null;
  metadata: Record<string, unknown>;
  dedupe_key: string | null;
  read_at: string | null;
  seen_at: string | null;
  created_at: string;
  updated_at: string;
};
