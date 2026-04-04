import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export async function getCurrentUser() {
  const supabase = createClientComponentClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

export async function getUserOrgId(userId: string): Promise<string | null> {
  const supabase = createClientComponentClient();
  const { data, error } = await supabase
    .from('org_user')
    .select('org_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data?.org_id || null;
}

export async function signInWithMagicLink(email: string) {
  const supabase = createClientComponentClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) throw error;
}

export async function signOut() {
  const supabase = createClientComponentClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
