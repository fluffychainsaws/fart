import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './supabase';

// Lightweight community poll shown in the helper bot. Votes land in the Supabase
// `poll_votes` table (see schema.sql); live tallies come back from the public
// poll_results() RPC (counts only, never who voted). One vote per signed-in user
// is enforced by a unique index; anonymous votes are deduped best-effort by a
// local "already voted" flag. Editing the options below changes the poll — bump
// the poll id if you want a fresh tally.

export const APP_NAME_POLL = 'app-name-v1';

export interface PollOption {
  id: string;
  label: string;
}

export const APP_NAME_OPTIONS: PollOption[] = [
  { id: 'green-room', label: 'The Green Room 🎭' },
  { id: 'side-piece', label: 'Side Piece 😏' },
  { id: 'castmate', label: 'Castmate 🎬' },
  { id: 'keep-fart', label: 'Keep it F.A.R.T.! 💨' },
];

export type PollResults = Record<string, number>; // optionId -> vote count

const votedKey = (poll: string) => `fart.poll.voted.${poll}`;

// Returns the option id the user already voted for on this device, or null.
export async function votedOptionFor(poll: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(votedKey(poll));
  } catch {
    return null;
  }
}

export async function castVote(poll: string, optionId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user.id ?? null;
    const { error } = await supabase
      .from('poll_votes')
      .insert({ poll_id: poll, option_id: optionId, user_id: uid });
    // A duplicate (a signed-in user who already voted) is fine — the unique
    // index rejects it, but from the user's side they've still "voted".
    if (error && !`${error.message}`.toLowerCase().includes('duplicate')) return false;
    await AsyncStorage.setItem(votedKey(poll), optionId).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

export async function pollResults(poll: string): Promise<PollResults> {
  if (!supabase) return {};
  try {
    const { data } = await supabase.rpc('poll_results', { p_poll: poll });
    const out: PollResults = {};
    for (const row of (data as { option_id: string; votes: number }[]) ?? []) {
      out[row.option_id] = row.votes;
    }
    return out;
  } catch {
    return {};
  }
}
