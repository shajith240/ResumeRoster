export type ResumeStatus = "open" | "roasted" | "closed";

export type ResumeSummary = {
  id: string;
  user_id: string;
  title: string;
  file_path: string;
  is_anonymous: boolean;
  status: ResumeStatus;
  roast_count: number;
  read_count: number;
  created_at: string;
};

export type Roast = {
  id: string;
  resume_id: string;
  parent_id?: string | null;
  author_id: string;
  content: string;
  helpful_votes: number;
  dislike_count?: number;
  reply_count?: number;
  created_at: string;
};

export type RoasterLeaderboardEntry = {
  id: string;
  username: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  college: string | null;
  target_role: string | null;
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
