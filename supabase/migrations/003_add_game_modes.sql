-- Add new game modes: word-meaning, fill-in-blank
-- Buzzer remains but is not yet fully implemented on the client

alter table rooms drop constraint if exists rooms_game_mode_check;
alter table rooms add constraint rooms_game_mode_check
  check (game_mode in ('multiple-choice', 'word-meaning', 'fill-in-blank', 'buzzer'));
