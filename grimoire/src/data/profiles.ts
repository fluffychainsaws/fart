import { supabase, readableError } from '@/lib/supabase';
import type { Profile } from '@/domain/types';

function fail(error: unknown): never {
  throw new Error(readableError(error));
}

export async function getMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) fail(error);
  return (data as Profile | null) ?? null;
}

export async function updateMyProfile(
  userId: string,
  patch: Partial<Pick<Profile, 'display_name' | 'avatar_url'>>,
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select('*')
    .single();
  if (error) fail(error);
  return data as Profile;
}
