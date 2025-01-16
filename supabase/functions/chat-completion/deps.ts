// @deno-types="https://raw.githubusercontent.com/denoland/deno_std/0.168.0/http/server.ts"
export { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Supabase client
export { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// OpenAI
export { default as OpenAI } from "https://esm.sh/openai@4";

// Environment interface
export interface Env {
  get(key: string): string | undefined;
}

// Declare global Deno namespace
declare global {
  const Deno: {
    env: Env;
  };
}

// Type declarations for external modules
export interface User {
  id: string;
  username: string;
  full_name: string;
}

export interface UserMapEntry {
  username: string;
  full_name: string;
} 