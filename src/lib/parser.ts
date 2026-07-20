import { supabase } from './supabase';
import type { ScriptElement } from './types';

// Script parsing runs server-side (supabase/functions/parse-script) so the
// Anthropic key never ships in the browser bundle — see that function's header
// for why. The client just uploads the PDF/photos and gets back structured
// elements. The proxy requires a signed-in user, so parsing needs an account.

export interface ScriptPhoto {
  base64: string;
  mimeType: string | null;
}

export interface ParsedScript {
  title: string;
  elements: ScriptElement[];
}

// True when the accounts backend (the parse proxy) is reachable at all. Screens
// use it to decide whether the script-reading UI can work. It's the client key
// no more: parsing moved to the server, so this tracks the backend instead.
export const parsingAvailable = () => Boolean(supabase);

// Calls the parse-script edge function and unwraps its { error } messages into
// thrown Errors carrying the friendly text, so screens can show e.message.
export async function invokeParseProxy<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) {
    throw new Error('Script reading needs the accounts backend, which is not configured.');
  }
  const { data, error } = await supabase.functions.invoke('parse-script', { body });
  if (error) {
    // functions.invoke turns any non-2xx into an error whose `context` is the
    // raw Response — read the function's { error } message out of it.
    let message = 'Something went wrong reading your script. Try again.';
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') {
        const payload = await ctx.json();
        if (payload?.error) message = String(payload.error);
      }
    } catch {
      // no JSON body — keep the generic message
    }
    throw new Error(message);
  }
  return data as T;
}

export async function parseScriptPhotos(photos: ScriptPhoto[]): Promise<ParsedScript> {
  return invokeParseProxy<ParsedScript>({ mode: 'photos', photos });
}

export async function parseScriptPdf(base64: string): Promise<ParsedScript> {
  return invokeParseProxy<ParsedScript>({ mode: 'pdf', pdf: base64 });
}
