export interface Database {
  public: {
    Tables: {
      players: {
        Row: {
          id: string;
          quran_foundation_uid: string | null;
          display_name: string;
          avatar_url: string | null;
          total_points: number;
          total_wins: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          quran_foundation_uid?: string | null;
          display_name: string;
          avatar_url?: string | null;
          total_points?: number;
          total_wins?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          quran_foundation_uid?: string | null;
          display_name?: string;
          avatar_url?: string | null;
          total_points?: number;
          total_wins?: number;
          created_at?: string;
        };
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
      };
      lexical_entries: {
        Row: {
          id: string;
          word_id: string;
          type: "VERB" | "NOUN" | "PARTICLE";
          canonical_form: string;
          root: string | null;
          lemma: string | null;
          forms: VerbForms | NounForms | null;
          translation: string;
          arabic_explanation: string | null;
          examples: ExampleReference[];
          source: string;
          frequency: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          word_id: string;
          type: "VERB" | "NOUN" | "PARTICLE";
          canonical_form: string;
          root?: string | null;
          lemma?: string | null;
          forms?: VerbForms | NounForms | null;
          translation: string;
          arabic_explanation?: string | null;
          examples?: ExampleReference[];
          source: string;
          frequency?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          word_id?: string;
          type?: "VERB" | "NOUN" | "PARTICLE";
          canonical_form?: string;
          root?: string | null;
          lemma?: string | null;
          forms?: VerbForms | NounForms | null;
          translation?: string;
          arabic_explanation?: string | null;
          examples?: ExampleReference[];
          source?: string;
          frequency?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      user_flashcards: {
        Row: {
          id: string;
          user_id: string;
          word_id: string;
          status: "IN_BANK" | "KNOWN_NOT_IN_BANK" | "UNKNOWN_SELECTED";
          fsrs_state: FSRSCard;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          word_id: string;
          status?: "IN_BANK" | "KNOWN_NOT_IN_BANK" | "UNKNOWN_SELECTED";
          fsrs_state: FSRSCard;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          word_id?: string;
          status?: "IN_BANK" | "KNOWN_NOT_IN_BANK" | "UNKNOWN_SELECTED";
          fsrs_state?: FSRSCard;
          created_at?: string;
        };
        Relationships: [];
      };
      review_log: {
        Row: {
          id: string;
          user_id: string;
          card_id: string;
          word_id: string;
          rating: number;
          timestamp: string;
          session_id: string;
          review_duration_ms: number | null;
          state_before: number;
          state_after: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          card_id: string;
          word_id: string;
          rating: number;
          timestamp?: string;
          session_id: string;
          review_duration_ms?: number | null;
          state_before: number;
          state_after: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          card_id?: string;
          word_id?: string;
          rating?: number;
          timestamp?: string;
          session_id?: string;
          review_duration_ms?: number | null;
          state_before?: number;
          state_after?: number;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          user_id: string;
          show_arabic_explanation: boolean;
          show_root: boolean;
          show_ayah_examples: boolean;
          include_particles: boolean;
          include_proper_nouns: boolean;
          auto_audio: boolean;
          show_transliteration: boolean;
          daily_new_cards_limit: number;
          daily_review_cards_limit: number;
          session_size: number;
          normalization_level: "strict" | "moderate" | "broad";
          updated_at: string;
        };
        Insert: {
          user_id: string;
          show_arabic_explanation?: boolean;
          show_root?: boolean;
          show_ayah_examples?: boolean;
          include_particles?: boolean;
          include_proper_nouns?: boolean;
          auto_audio?: boolean;
          show_transliteration?: boolean;
          daily_new_cards_limit?: number;
          daily_review_cards_limit?: number;
          session_size?: number;
          normalization_level?: "strict" | "moderate" | "broad";
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          show_arabic_explanation?: boolean;
          show_root?: boolean;
          show_ayah_examples?: boolean;
          include_particles?: boolean;
          include_proper_nouns?: boolean;
          auto_audio?: boolean;
          show_transliteration?: boolean;
          daily_new_cards_limit?: number;
          daily_review_cards_limit?: number;
          session_size?: number;
          normalization_level?: "strict" | "moderate" | "broad";
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

export interface RoomSettings {
  num_rounds: number;
  surah_filter: number[] | null;
  time_per_question: number;
}

export interface VerbForms {
  past: string;
  present: string;
  imperative: string;
  verbal_noun: string;
}

export interface NounForms {
  singular: string;
  plural: string;
}

export interface ExampleReference {
  surah: number;
  ayah: number;
  position: number;
}

export interface FSRSCard {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: string;
}
