-- Atomic score increment to avoid read-modify-write race conditions
-- Called by the submit-answer edge function instead of a manual read + update.

CREATE OR REPLACE FUNCTION increment_player_score(
  p_room_id  uuid,
  p_player_id uuid,
  p_delta    int
)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE room_players
  SET score = score + p_delta
  WHERE room_id = p_room_id
    AND player_id = p_player_id;
$$;

-- Atomic lifetime stats update for end-of-game scoring
CREATE OR REPLACE FUNCTION increment_player_stats(
  p_player_id  uuid,
  p_points     int,
  p_won        boolean
)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE players
  SET
    total_points = total_points + p_points,
    total_wins   = total_wins + CASE WHEN p_won THEN 1 ELSE 0 END
  WHERE id = p_player_id;
$$;
