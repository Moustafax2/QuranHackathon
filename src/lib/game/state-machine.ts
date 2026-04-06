export type GamePhase =
  | "lobby"
  | "round_active"
  | "round_result"
  | "game_over";

export interface RoundData {
  round_id: string;
  round_number: number;
  total_rounds: number;
  prompt_verse_key: string;
  prompt_text: string;
  correct_verse_key: string;
  correct_text?: string;
  options?: OptionData[];
}

export interface OptionData {
  verse_key: string;
  text: string;
}

export interface RoundResult {
  correct_verse_key: string;
  correct_text: string;
  answers: PlayerAnswer[];
  scores: Record<string, number>;
}

export interface PlayerAnswer {
  player_id: string;
  display_name: string;
  answer_verse_key: string | null;
  is_correct: boolean;
  points_awarded: number;
}

export interface GameState {
  phase: GamePhase;
  game_id: string | null;
  current_round: RoundData | null;
  round_result: RoundResult | null;
  scores: Record<string, number>;
  winner_id: string | null;
}

export const INITIAL_GAME_STATE: GameState = {
  phase: "lobby",
  game_id: null,
  current_round: null,
  round_result: null,
  scores: {},
  winner_id: null,
};

// Broadcast event types
export type GameEvent =
  | { type: "round:start"; payload: RoundData }
  | { type: "answer:result"; payload: PlayerAnswer }
  | { type: "buzzer:winner"; payload: { player_id: string; display_name: string } }
  | { type: "round:end"; payload: RoundResult }
  | { type: "game:end"; payload: { scores: Record<string, number>; winner_id: string } };

export function reduceGameState(state: GameState, event: GameEvent): GameState {
  switch (event.type) {
    case "round:start":
      return {
        ...state,
        phase: "round_active",
        current_round: event.payload,
        round_result: null,
      };
    case "answer:result":
      return {
        ...state,
        scores: {
          ...state.scores,
          [event.payload.player_id]:
            (state.scores[event.payload.player_id] ?? 0) +
            event.payload.points_awarded,
        },
      };
    case "round:end":
      return {
        ...state,
        phase: "round_result",
        round_result: event.payload,
        scores: event.payload.scores,
      };
    case "game:end":
      return {
        ...state,
        phase: "game_over",
        scores: event.payload.scores,
        winner_id: event.payload.winner_id,
      };
    case "buzzer:winner":
      return state;
    default:
      return state;
  }
}
