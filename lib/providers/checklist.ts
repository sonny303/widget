import { supabase } from '@/lib/supabase/client';
import { getUserOrgId } from '@/lib/supabase/auth';
import { QueryClient } from '@tanstack/react-query';

export async function getProviderChecklist(providerId: string) {
  const { data: checklist, error: checklistError } = await supabase
    .from('onboarding_checklist')
    .select('id')
    .eq('provider_id', providerId)
    .maybeSingle();

  if (checklistError) throw checklistError;
  if (!checklist) return null;

  const { data: tasks, error: tasksError } = await supabase
    .from('onboarding_task')
    .select('*')
    .eq('checklist_id', checklist.id)
    .order('step_number', { ascending: true });

  if (tasksError) throw tasksError;

  return {
    checklist,
    tasks: tasks || [],
  };
}

export async function handleTaskComplete(
  taskId: string,
  providerId: string,
  queryClient: QueryClient
) {
  const { data: task, error: fetchError } = await supabase
    .from('onboarding_task')
    .select('id, status')
    .eq('id', taskId)
    .single();

  if (fetchError) throw fetchError;
  if (!task || task.status !== 'pending') return;

  const { error: updateError } = await supabase
    .from('onboarding_task')
    .update({
      status: 'complete',
      completed_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  if (updateError) throw updateError;

  const { data: nextTask, error: nextError } = await supabase
    .from('onboarding_task')
    .select('id')
    .eq('depends_on_task_id', taskId)
    .maybeSingle();

  if (nextError) throw nextError;

  if (nextTask) {
    const { error: unlockError } = await supabase
      .from('onboarding_task')
      .update({ status: 'pending' })
      .eq('id', nextTask.id);

    if (unlockError) throw unlockError;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const orgId = await getUserOrgId(user.id);
  if (!orgId) throw new Error('No organization found');

  const { error: auditError } = await supabase
    .from('audit_log')
    .insert({
      org_id: orgId,
      action: 'checklist_step_completed',
      entity_type: 'onboarding_task',
      entity_id: taskId,
      performed_by: user.id,
      created_at: new Date().toISOString(),
    });

  if (auditError) throw auditError;

  await queryClient.invalidateQueries({ queryKey: ['checklist', providerId] });
}
