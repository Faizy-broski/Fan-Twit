// Shared PostgREST select fragment for the `posts` table + its joins.
// Every page that lists or shows posts (home feed, team/player threads,
// post detail + replies, user profile) should embed this so the shape
// PostCard expects — including like_count/repost_count/reply_count and
// post_players — stays consistent everywhere.
export const POST_SELECT = `
  id,
  body,
  created_at,
  user_id,
  parent_post_id,
  media_url,
  media_type,
  like_count,
  repost_count,
  reply_count,
  profiles!posts_user_id_profiles_fkey (
    username,
    display_name,
    avatar_url
  ),
  likes (
    user_id
  ),
  reposts (
    user_id
  ),
  post_teams (
    team_symbol
  ),
  post_players (
    player_symbol
  )
`;
