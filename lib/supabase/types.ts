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
export type StickerStatus = "active" | "hidden";

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
  sticker_id?: string | null;
  helpful_votes: number;
  dislike_count?: number;
  reply_count?: number;
  is_deleted?: boolean;
  deleted_at?: string | null;
  created_at: string;
};

export type Sticker = {
  id: string;
  title: string;
  alt_text: string;
  storage_path: string;
  mime_type: "image/png" | "image/webp" | "image/gif";
  file_size: number;
  status: StickerStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
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
