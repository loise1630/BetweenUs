import { getAccountState } from './account';
import { supabase } from './supabase';

export type OpenWhenLetter = {
  id: string;
  user_id: string;
  prompt: string;
  title: string;
  body: string;
  created_at: string;
};

async function getUserId() {
  const account = await getAccountState();
  if (!account.user_id || account.status !== 'paired') {
    throw new Error('Pair with your partner to sync letters.');
  }
  return account.user_id;
}

export async function getOpenWhenLetters(): Promise<OpenWhenLetter[]> {
  const { user_id } = await getAccountState();
  if (!user_id) throw new Error('Your account could not be identified.');
  const { data, error } = await supabase.from('open_when_letters')
    .select('id,user_id,prompt,title,body,created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as OpenWhenLetter[];
}

export async function addOpenWhenLetter(prompt: string, title: string, body: string): Promise<OpenWhenLetter> {
  const user_id = await getUserId();
  const { data, error } = await supabase.from('open_when_letters')
    .insert({ user_id, prompt: prompt.trim(), title: title.trim(), body: body.trim() })
    .select('id,user_id,prompt,title,body,created_at').single();
  if (error) throw error;
  return data as OpenWhenLetter;
}

export async function importOpenWhenLetters(letters: { prompt: string; title: string; body: string; createdAt?: string }[]): Promise<void> {
  if (!letters.length) return;
  const user_id = await getUserId();
  const { error } = await supabase.from('open_when_letters').insert(
    letters.map((letter) => ({ user_id, prompt: letter.prompt, title: letter.title, body: letter.body,
      ...(letter.createdAt ? { created_at: letter.createdAt } : {}) }))
  );
  if (error) throw error;
}

export async function deleteOpenWhenLetter(id: string): Promise<void> {
  const user_id = await getUserId();
  const { error } = await supabase.from('open_when_letters').delete().eq('id', id).eq('user_id', user_id);
  if (error) throw error;
}
