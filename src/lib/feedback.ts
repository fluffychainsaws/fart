import { Platform } from 'react-native';

import { supabase } from './supabase';

// In-app feedback / bug reports from the helper bot. Rows land in the Supabase
// `feedback` table (see schema.sql); anyone can submit (signed in or not) and
// only the site owner reads them (admin_feedback RPC / dashboard). Returns true
// on success so the UI can show a gentle retry on failure.

export type FeedbackKind = 'bug' | 'idea' | 'feedback';

export async function submitFeedback(
  kind: FeedbackKind,
  message: string,
  context?: string,
): Promise<boolean> {
  if (!supabase) return false;
  const text = message.trim();
  if (!text) return false;
  try {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user.id ?? null;
    const ctx = [context, `platform:${Platform.OS}`].filter(Boolean).join(' · ');
    const { error } = await supabase.from('feedback').insert({
      user_id: uid,
      kind,
      message: text.slice(0, 4000), // matches the client-side limit; keeps rows sane
      context: ctx,
    });
    return !error;
  } catch {
    return false;
  }
}
