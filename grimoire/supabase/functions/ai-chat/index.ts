// ai-chat — the single doorway between Grimoire and Claude.
//
// WHY THIS RUNS ON A SERVER
//
// Two reasons, and the second is the important one:
//
//   1. The Anthropic API key is a secret. A key shipped in a browser bundle is
//      a key anyone can spend. It lives here as a Supabase secret:
//        supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
//   2. Campaign isolation. The assistant is the one part of the product that
//      could plausibly repeat something from the wrong world, because it works
//      by pulling context out of a database and putting it in a prompt. So the
//      retrieval half of that has to happen somewhere the user cannot reach —
//      here, under the caller's own credentials, with Row Level Security doing
//      the same filtering it does for every screen.
//
// THE RULE: the model is never shown anything the caller could not read for
// themselves. Not "we ask it not to repeat DM secrets" — it is never given
// them. A prompt-injection attack against this endpoint can at worst make the
// assistant misbehave with material the user already had.
//
// Phase 1 ships the boundary and a thin conversation on top of it. The
// retrieval layer (lore, journals, character sheets) lands in Phase 4; the
// TODO below marks exactly where it plugs in, and the shape it has to keep.

import Anthropic from 'npm:@anthropic-ai/sdk@^0.111.0';
import { createClient } from 'npm:@supabase/supabase-js@^2.112.3';

const MODEL = 'claude-opus-5';

// A cap, not a target — the model stops when it is done. Sized so a long
// answer is never truncated mid-sentence.
const MAX_TOKENS = 16_000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ChatRequest = {
  campaignId: string;
  threadId: string;
  message: string;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!apiKey || !supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: 'The assistant is not configured on this project.' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Sign in first.' }, 401);

  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Malformed request.' }, 400);
  }

  const { campaignId, threadId, message } = body;
  if (!campaignId || !threadId || !message?.trim()) {
    return json({ error: 'campaignId, threadId and message are all required.' }, 400);
  }

  // The caller's own client. Every read below runs under their JWT, so Row
  // Level Security applies exactly as it does in the browser — this function
  // has no ability to see further into a campaign than the person asking.
  const asUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData } = await asUser.auth.getUser();
  const user = userData?.user;
  if (!user) return json({ error: 'Your session has expired. Sign in again.' }, 401);

  // Membership gate. campaign_role() is the same function the RLS policies
  // use, and it answers only about the caller — so a forged campaignId gets
  // null here and stops at this line.
  const { data: role, error: roleError } = await asUser.rpc('campaign_role', {
    p_campaign: campaignId,
  });
  if (roleError) return json({ error: 'Could not verify your membership.' }, 500);
  if (!role) return json({ error: 'You are not a member of that campaign.' }, 403);

  // The thread pins the perspective, and the thread's own insert policy already
  // refused a DM-perspective thread to a non-DM. Reading it back here means the
  // perspective cannot be raised by editing the request body.
  const { data: thread, error: threadError } = await asUser
    .from('ai_threads')
    .select('id, campaign_id, perspective')
    .eq('campaign_id', campaignId)
    .eq('id', threadId)
    .single();
  if (threadError || !thread) return json({ error: 'That conversation does not exist.' }, 404);

  const perspective = thread.perspective === 'dm' && role === 'dm' ? 'dm' : 'player';

  const { data: campaign } = await asUser
    .from('campaigns')
    .select('name, tagline, description, game_system')
    .eq('id', campaignId)
    .single();

  // ---------------------------------------------------------------------
  // Context assembly (Phase 4).
  //
  // Everything the model is shown gets retrieved HERE, through `asUser`, with
  // `.eq('campaign_id', campaignId)` on every query. Two properties must hold
  // for anything added below:
  //
  //   * it is scoped to this campaign — enforced by RLS and by the filter;
  //   * it is visible to THIS caller — a player's thread never retrieves
  //     DM-only lore, because the read policy already refuses it.
  //
  // Concretely, Phase 4 adds: recent journal entries, lore entries matching
  // the question, the party's character sheets, and the DM's hidden notes when
  // and only when `perspective === 'dm'`.
  // ---------------------------------------------------------------------
  const worldContext = [
    `Campaign: ${campaign?.name ?? 'Unknown'}`,
    campaign?.tagline ? `Tagline: ${campaign.tagline}` : null,
    `Ruleset: ${campaign?.game_system ?? 'dnd5e'}`,
    campaign?.description ? `Premise: ${campaign.description}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const system = [
    "You are the assistant inside Grimoire, a Dungeons & Dragons campaign manager.",
    '',
    perspective === 'dm'
      ? 'You are speaking to the Dungeon Master. You may discuss hidden plot, unrevealed NPCs and anything else behind the screen.'
      : "You are speaking to a player. Answer only from what their character's party has actually discovered, and from public rules knowledge. If you do not know something about this world, say so — never invent campaign facts and present them as established.",
    '',
    'The world you are working in:',
    worldContext,
    '',
    'Everything you have been shown belongs to this campaign alone. You have no knowledge of any other campaign, and must never speculate about one.',
  ].join('\n');

  // Prior turns of this conversation. Scoped by campaign_id as well as
  // thread_id — the composite foreign key makes a mismatch impossible to
  // store, and the filter makes it impossible to read.
  const { data: history } = await asUser
    .from('ai_messages')
    .select('role, content')
    .eq('campaign_id', campaignId)
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .limit(40);

  const messages = [
    ...(history ?? []).map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: message.trim() },
  ];

  const anthropic = new Anthropic({ apiKey });

  let reply: string;
  let usage: unknown;
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages,
    });

    // Safety classifiers can decline a request: that arrives as a normal 200
    // with stop_reason "refusal" and an empty or partial content array, so it
    // has to be checked before reading content.
    if (response.stop_reason === 'refusal') {
      return json({ error: "The assistant declined to answer that one." }, 200);
    }

    reply = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();
    usage = response.usage;
  } catch (error) {
    console.error('anthropic call failed', error);
    return json({ error: 'The assistant is unavailable right now. Try again shortly.' }, 502);
  }

  // The transcript is written with the service role, not by the browser, so it
  // is a record of what the model was actually asked and actually said. There
  // is deliberately no client INSERT policy on ai_messages.
  const asService = createClient(supabaseUrl, serviceKey);
  const { error: writeError } = await asService.from('ai_messages').insert([
    { campaign_id: campaignId, thread_id: threadId, role: 'user', content: message.trim() },
    {
      campaign_id: campaignId,
      thread_id: threadId,
      role: 'assistant',
      content: reply,
      meta: { model: MODEL, perspective, usage },
    },
  ]);
  if (writeError) console.error('failed to store transcript', writeError);

  return json({ reply, perspective });
});
