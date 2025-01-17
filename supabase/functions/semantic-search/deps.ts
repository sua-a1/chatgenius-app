// @deno-types="npm:@types/node"
export { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// Supabase client
export { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// OpenAI
export { OpenAI } from "https://esm.sh/openai@4.24.1";

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