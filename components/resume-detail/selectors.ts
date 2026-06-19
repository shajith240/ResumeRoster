

export const REVIEW_SELECT_WITH_MEDIA =
	"id,resume_id,parent_id,author_id,content,attachment_id,content_format,helpful_votes,dislike_count,reply_count,is_deleted,deleted_at,created_at";

export const REVIEW_SELECT_WITH_THREADS =
	"id,resume_id,parent_id,author_id,content,helpful_votes,dislike_count,reply_count,is_deleted,deleted_at,created_at";

export const REVIEW_SELECT_WITH_THREADS_LEGACY =
	"id,resume_id,parent_id,author_id,content,helpful_votes,dislike_count,reply_count,created_at";

export const REVIEW_SELECT_WITH_REACTIONS =
	"id,resume_id,author_id,content,helpful_votes,dislike_count,created_at";

export const REVIEW_SELECT_BASE =
	"id,resume_id,author_id,content,helpful_votes,created_at";

export const RESUME_SELECT_WITH_CONTEXT =
	"id,user_id,title,file_path,is_anonymous,privacy_mode,status,review_queue_status,activation_reviews_required,activation_reviews_completed,roast_count,read_count,job_description,post_description,is_premium,payment_status,assigned_reviewer_id,created_at";

export const RESUME_SELECT_WITH_READS =
	"id,user_id,title,file_path,is_anonymous,privacy_mode,status,roast_count,read_count,is_premium,payment_status,assigned_reviewer_id,created_at";

export const RESUME_SELECT_BASE =
	"id,user_id,title,file_path,is_anonymous,status,roast_count,is_premium,payment_status,assigned_reviewer_id,created_at";

export const RESUME_AUTHOR_PROFILE_SELECT_WITH_STATUS =
	"id,username,full_name,avatar_url,avatar_path,college,target_role,current_position,app_status,community_role,reviewer_type,reviewer_headline,reviewer_expertise,reviewer_verification_status";

export const RESUME_AUTHOR_PROFILE_SELECT_BASE =
	"id,username,full_name,avatar_url,college,target_role";

export const SUPABASE_MIGRATION_MESSAGE =
	"Discussion controls are temporarily unavailable. Please refresh and try again.";
