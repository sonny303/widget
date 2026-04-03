import { supabase } from '@/lib/supabase/client';
import { getUserOrgId } from '@/lib/supabase/auth';

export async function getProviders() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const orgId = await getUserOrgId(user.id);
  if (!orgId) throw new Error('No organization found');

  const { data, error } = await supabase
    .from('provider')
    .select(`
      id,
      first_name,
      last_name,
      credentials,
      npi,
      license_state,
      status,
      provider_facility_assignment (
        facility (
          name
        )
      )
    `)
    .order('last_name', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getProvider(id: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('provider')
    .select(`
      *,
      provider_facility_assignment (
        facility (
          name
        ),
        provider_group:provider_group_id (
          name
        )
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getProviderGroups() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('provider_group')
    .select('id, name')
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getFacilitiesByGroup(providerGroupId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('facility')
    .select('id, name')
    .eq('provider_group_id', providerGroupId)
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}
