export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          username: string | null
          avatar_url: string | null
        }
        Insert: {
          id: string
          username?: string | null
          avatar_url?: string | null
        }
        Update: {
          id?: string
          username?: string | null
          avatar_url?: string | null
        }
      }
      exercises: {
        Row: {
          id: string
          name: string
          target_muscle: string | null
          equipment: string | null
        }
        Insert: {
          id?: string // uuid generated
          name: string
          target_muscle?: string | null
          equipment?: string | null
        }
        Update: {
          id?: string
          name?: string
          target_muscle?: string | null
          equipment?: string | null
        }
      }
      routines: {
        Row: {
          id: string
          user_id: string
          name: string
          notes: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          notes?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          notes?: string | null
        }
      }
      workouts: {
        Row: {
          id: string
          user_id: string
          routine_id: string | null
          start_time: string
          end_time: string | null
        }
        Insert: {
          id?: string
          user_id: string
          routine_id?: string | null
          start_time?: string
          end_time?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          routine_id?: string | null
          start_time?: string
          end_time?: string | null
        }
      }
      workout_sets: {
        Row: {
          id: string
          workout_id: string
          exercise_id: string
          set_number: number
          weight_kg: number | null
          reps: number | null
          is_completed: boolean
        }
        Insert: {
          id?: string
          workout_id: string
          exercise_id: string
          set_number: number
          weight_kg?: number | null
          reps?: number | null
          is_completed?: boolean
        }
        Update: {
          id?: string
          workout_id?: string
          exercise_id?: string
          set_number?: number
          weight_kg?: number | null
          reps?: number | null
          is_completed?: boolean
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
