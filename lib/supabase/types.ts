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
export type CommentContentFormat = "plain" | "markdown";
export type CommentAttachmentKind = "image";
export type CommentAttachmentSource = "upload";

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
