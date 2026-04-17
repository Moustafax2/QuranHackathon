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
        Relationships: [];
      };
      rooms: {
        Row: {
          id: string;
          code: string;
          host_id: string;
          game_mode: PlayGameMode;
          status: "lobby" | "in_progress" | "finished";
          settings: RoomSettings;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          host_id: string;
          game_mode: PlayGameMode;
          status?: "lobby" | "in_progress" | "finished";
          settings?: RoomSettings;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          host_id?: string;
          game_mode?: PlayGameMode;
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
          status: "active" | "left";
          joined_at: string;
          left_at: string | null;
          last_seen_at: string;
        };
        Insert: {
          room_id: string;
          player_id: string;
          score?: number;
          status?: "active" | "left";
          joined_at?: string;
          left_at?: string | null;
          last_seen_at?: string;
        };
        Update: {
          room_id?: string;
          player_id?: string;
          score?: number;
          status?: "active" | "left";
          joined_at?: string;
          left_at?: string | null;
          last_seen_at?: string;
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
          game_mode: PlayGameMode | null;
          prompt_verse_key: string;
          prompt_surah_id: number | null;
          prompt_juz_number: number | null;
          prompt_page_number: number | null;
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
          game_mode?: PlayGameMode | null;
          prompt_verse_key: string;
          prompt_surah_id?: number | null;
          prompt_juz_number?: number | null;
          prompt_page_number?: number | null;
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
          game_mode?: PlayGameMode | null;
          prompt_verse_key?: string;
          prompt_surah_id?: number | null;
          prompt_juz_number?: number | null;
          prompt_page_number?: number | null;
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
      game_invitations: {
        Row: {
          id: string;
          room_id: string;
          inviter_player_id: string;
          invitee_qf_user_id: string;
          invitee_display_name: string;
          invitee_username: string | null;
          invitee_avatar_url: string | null;
          status: "pending" | "accepted" | "declined" | "revoked";
          created_at: string;
          responded_at: string | null;
        };
        Insert: {
          id?: string;
          room_id: string;
          inviter_player_id: string;
          invitee_qf_user_id: string;
          invitee_display_name: string;
          invitee_username?: string | null;
          invitee_avatar_url?: string | null;
          status?: "pending" | "accepted" | "declined" | "revoked";
          created_at?: string;
          responded_at?: string | null;
        };
        Update: {
          id?: string;
          room_id?: string;
          inviter_player_id?: string;
          invitee_qf_user_id?: string;
          invitee_display_name?: string;
          invitee_username?: string | null;
          invitee_avatar_url?: string | null;
          status?: "pending" | "accepted" | "declined" | "revoked";
          created_at?: string;
          responded_at?: string | null;
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
          source_surah_id: number | null;
          source_ayah_number: number | null;
          source_juz_number: number | null;
          source_page_number: number | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          word_id: string;
          status?: "IN_BANK" | "KNOWN_NOT_IN_BANK" | "UNKNOWN_SELECTED";
          fsrs_state: FSRSCard;
          created_at?: string;
          source_surah_id?: number | null;
          source_ayah_number?: number | null;
          source_juz_number?: number | null;
          source_page_number?: number | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          word_id?: string;
          status?: "IN_BANK" | "KNOWN_NOT_IN_BANK" | "UNKNOWN_SELECTED";
          fsrs_state?: FSRSCard;
          created_at?: string;
          source_surah_id?: number | null;
          source_ayah_number?: number | null;
          source_juz_number?: number | null;
          source_page_number?: number | null;
        };
        Relationships: [];
      };
      memorization_attempts: {
        Row: {
          id: string;
          player_id: string;
          client_attempt_id: string;
          mode: "ayah" | "page-blank";
          rating_level: number;
          verse_key: string | null;
          surah_id: number | null;
          ayah_number: number | null;
          juz_number: number | null;
          page_number: number | null;
          selection_type: "juz" | "surah" | null;
          cover_region: "top" | "middle" | "bottom" | null;
          tested_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          player_id: string;
          client_attempt_id: string;
          mode: "ayah" | "page-blank";
          rating_level: number;
          verse_key?: string | null;
          surah_id?: number | null;
          ayah_number?: number | null;
          juz_number?: number | null;
          page_number?: number | null;
          selection_type?: "juz" | "surah" | null;
          cover_region?: "top" | "middle" | "bottom" | null;
          tested_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          player_id?: string;
          client_attempt_id?: string;
          mode?: "ayah" | "page-blank";
          rating_level?: number;
          verse_key?: string | null;
          surah_id?: number | null;
          ayah_number?: number | null;
          juz_number?: number | null;
          page_number?: number | null;
          selection_type?: "juz" | "surah" | null;
          cover_region?: "top" | "middle" | "bottom" | null;
          tested_at?: string;
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

export type PlayGameMode =
  | "multiple-choice"
  | "word-meaning"
  | "fill-in-blank"
  | "trivia"
  | "buzzer";

export type QuranScopeType = "all" | "juz" | "surah";

export interface RoomSettings {
  num_rounds: number;
  game_modes?: PlayGameMode[] | null;
  scope?: QuranScopeType;
  surah_filter?: number[] | null;
  juz_filter?: number[] | null;
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
