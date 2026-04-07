export interface Database {
  public: {
    Tables: {
      players: {
        Row: {
          id: string;
          quran_foundation_uid: string | null;
          qf_email: string | null;
          display_name: string;
          avatar_url: string | null;
          total_points: number;
          total_wins: number;
          last_login_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          quran_foundation_uid?: string | null;
          qf_email?: string | null;
          display_name: string;
          avatar_url?: string | null;
          total_points?: number;
          total_wins?: number;
          last_login_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          quran_foundation_uid?: string | null;
          qf_email?: string | null;
          display_name?: string;
          avatar_url?: string | null;
          total_points?: number;
          total_wins?: number;
          last_login_at?: string;
          created_at?: string;
        };
      };
      rooms: {
        Row: {
          id: string;
          code: string;
          host_id: string;
          game_mode: "buzzer" | "multiple-choice";
          status: "lobby" | "in_progress" | "finished";
          settings: RoomSettings;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          host_id: string;
          game_mode: "buzzer" | "multiple-choice";
          status?: "lobby" | "in_progress" | "finished";
          settings?: RoomSettings;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          host_id?: string;
          game_mode?: "buzzer" | "multiple-choice";
          status?: "lobby" | "in_progress" | "finished";
          settings?: RoomSettings;
          created_at?: string;
        };
      };
      room_players: {
        Row: {
          room_id: string;
          player_id: string;
          score: number;
          joined_at: string;
        };
        Insert: {
          room_id: string;
          player_id: string;
          score?: number;
          joined_at?: string;
        };
        Update: {
          room_id?: string;
          player_id?: string;
          score?: number;
          joined_at?: string;
        };
      };
      games: {
        Row: {
          id: string;
          room_id: string;
          started_at: string;
          ended_at: string | null;
          total_rounds: number;
          winner_id: string | null;
        };
        Insert: {
          id?: string;
          room_id: string;
          started_at?: string;
          ended_at?: string | null;
          total_rounds: number;
          winner_id?: string | null;
        };
        Update: {
          id?: string;
          room_id?: string;
          started_at?: string;
          ended_at?: string | null;
          total_rounds?: number;
          winner_id?: string | null;
        };
      };
      game_rounds: {
        Row: {
          id: string;
          game_id: string;
          round_number: number;
          prompt_verse_key: string;
          correct_verse_key: string;
          prompt_text: string | null;
          correct_text: string | null;
          options: string[] | null;
          started_at: string | null;
          ended_at: string | null;
        };
        Insert: {
          id?: string;
          game_id: string;
          round_number: number;
          prompt_verse_key: string;
          correct_verse_key: string;
          prompt_text?: string | null;
          correct_text?: string | null;
          options?: string[] | null;
          started_at?: string | null;
          ended_at?: string | null;
        };
        Update: {
          id?: string;
          game_id?: string;
          round_number?: number;
          prompt_verse_key?: string;
          correct_verse_key?: string;
          prompt_text?: string | null;
          correct_text?: string | null;
          options?: string[] | null;
          started_at?: string | null;
          ended_at?: string | null;
        };
      };
      round_answers: {
        Row: {
          id: string;
          round_id: string;
          player_id: string;
          answer_verse_key: string | null;
          is_correct: boolean;
          server_received_at: string;
          points_awarded: number;
        };
        Insert: {
          id?: string;
          round_id: string;
          player_id: string;
          answer_verse_key?: string | null;
          is_correct: boolean;
          server_received_at?: string;
          points_awarded?: number;
        };
        Update: {
          id?: string;
          round_id?: string;
          player_id?: string;
          answer_verse_key?: string | null;
          is_correct?: boolean;
          server_received_at?: string;
          points_awarded?: number;
        };
      };
      friends: {
        Row: {
          player_a: string;
          player_b: string;
          status: "pending" | "accepted";
          created_at: string;
        };
        Insert: {
          player_a: string;
          player_b: string;
          status?: "pending" | "accepted";
          created_at?: string;
        };
        Update: {
          player_a?: string;
          player_b?: string;
          status?: "pending" | "accepted";
          created_at?: string;
        };
      };
      verse_mistakes: {
        Row: {
          player_id: string;
          verse_key: string;
          mistake_count: number;
          last_mistake_at: string;
        };
        Insert: {
          player_id: string;
          verse_key: string;
          mistake_count?: number;
          last_mistake_at?: string;
        };
        Update: {
          player_id?: string;
          verse_key?: string;
          mistake_count?: number;
          last_mistake_at?: string;
        };
      };
    };
  };
}

export interface RoomSettings {
  num_rounds: number;
  surah_filter: number[] | null;
  time_per_question: number;
}
