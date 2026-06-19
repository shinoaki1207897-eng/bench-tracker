import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Record = {
  id: string;
  user_id: string;
  weight: number;
  reps: number;
  date: string;
  created_at: string;
};

export type Profile = {
  id: string;
  username: string;
  created_at: string;
};

export type Goal = {
  id: string;
  user_id: string;
  target_weight: number;
  created_at: string;
};
