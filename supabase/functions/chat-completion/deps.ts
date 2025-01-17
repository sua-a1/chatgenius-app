// @deno-types="npm:@types/node"
export { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// Supabase client
import { createClient as supabaseCreateClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
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

// Initialize Supabase client with auth context
export function createSupabaseClient(user_id: string) {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return supabaseCreateClient(
    Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      global: {
        headers: {
          // Set service role auth
          Authorization: `Bearer ${serviceRoleKey}`,
          // Pass user context for RLS policies
          'x-supabase-auth-user-id': user_id,
          // Set role to service_role to bypass RLS
          'x-supabase-auth-role': 'service_role'
        }
      }
    }
  );
} 