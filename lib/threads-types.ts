export type Thread = {
  id: string; text?: string; username?: string; timestamp?: string;
  permalink?: string; media_type?: string; media_url?: string; thumbnail_url?: string;
  has_replies?: boolean; is_reply?: boolean; is_reply_owned_by_me?: boolean;
  replied_to?: { id: string }; root_post?: { id: string };
  children?: { data: Thread[] };
};
export type Profile = { id: string; username: string; name?: string; threads_profile_picture_url?: string };
export type ThreadPage = { data: Thread[]; after: string | null };
