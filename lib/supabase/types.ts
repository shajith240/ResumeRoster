export type ResumeStatus = "open" | "roasted" | "closed";

export type ResumeSummary = {
  id: string;
  user_id: string;
  title: string;
  file_path: string;
  is_anonymous: boolean;
  status: ResumeStatus;
  roast_count: number;
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
  college: string | null;
  target_role: string | null;
  roast_count: number;
  helpful_votes: number;
};

export type PublicProfile = RoasterLeaderboardEntry & {
  created_at: string;
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
