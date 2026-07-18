import { supabase } from './supabase';

// Fire-and-forget usage telemetry feeding the monthly cost analysis
// (/admin). Signed-out users log nothing; failures are swallowed — metrics
// must never break playback or recording.

export function logUsage(kind: 'tts' | 'audition', chars = 0, voice?: string): void {
  if (!supabase) return;
  void (async () => {
    try {
      const { data } = await supabase!.auth.getSession();
      const uid = data.session?.user.id;
      if (!uid) return;
      await supabase!.from('usage_events').insert({ user_id: uid, kind, chars, voice });
    } catch {
      // never surface metrics failures
    }
  })();
}
