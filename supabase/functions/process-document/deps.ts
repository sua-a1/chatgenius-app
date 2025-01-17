// @deno-types="npm:@types/node"
export { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// Supabase client
import { createClient as supabaseCreateClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
export { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// OpenAI
export { OpenAI } from "https://esm.sh/openai@4.24.1";

// PDF and DOCX parsing
export { default as PDFParser } from "https://esm.sh/pdf2json@2.0.1";
export { default as mammoth } from "https://esm.sh/mammoth@1.6.0";

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

// Initialize Supabase client with auth context
export function createSupabaseClient(user_id?: string) {
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
          Authorization: `Bearer ${serviceRoleKey}`,
          ...(user_id && {
            'x-supabase-auth-user-id': user_id,
          }),
          'x-supabase-auth-role': 'service_role'
        }
      }
    }
  );
}

// CORS headers
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
}; 