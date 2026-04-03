'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { ProtectedRoute } from '@/components/providers/ProtectedRoute';
import { getProvider } from '@/lib/providers/queries';
import { getProviderChecklist, handleTaskComplete } from '@/lib/providers/checklist';
import { ArrowLeft, Mail, Building2, Users, Calendar, FileText } from 'lucide-react';
import { format } from 'date-fns';

function ProviderDetailContent() {
  const params = useParams();
  const providerId = params.id as string;
  const queryClient = useQueryClient();

  const { data: provider, isLoading: providerLoading } = useQuery<any>({
    queryKey: ['provider', providerId],
    queryFn: () => getProvider(providerId),
  });

  const { data: checklistData, isLoading: checklistLoading } = useQuery({
    queryKey: ['checklist', providerId],
    queryFn: () => getProviderChecklist(providerId),
  });

  if (providerLoading || checklistLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <Skeleton className="h-8 w-64 mb-8" />
          <div className="space-y-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Provider not found</h2>
          <Link href="/providers" className="text-blue-600 hover:underline">
            Back to Providers
          </Link>
        </div>
      </div>
    );
  }

  const tasks = checklistData?.tasks || [];
  const completedTasks = tasks.filter((t: any) => t.status === 'complete').length;
  const totalTasks = tasks.length;
  const progressPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const isTaskLocked = (task: any) => {
    if (!task.depends_on_item_id) return false;
    const dependentTask: any = tasks.find((t: any) => t.id === task.depends_on_item_id);
    return dependentTask?.status !== 'complete';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const facility = provider.provider_facility_assignment?.[0]?.facility;
  const providerGroup = provider.provider_facility_assignment?.[0]?.provider_group;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/providers" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Providers
          </Link>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl">
                    {provider.last_name}, {provider.first_name} {provider.middle_name || ''} {provider.suffix || ''}
                  </CardTitle>
                  <CardDescription className="text-lg mt-1">
                    {provider.credentials}
                  </CardDescription>
                </div>
                <Badge className={getStatusColor(provider.status)} variant="secondary">
                  {provider.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-1">Individual NPI</div>
                    <div className="text-base">{provider.npi}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-1">Date of Birth</div>
                    <div className="text-base">{format(new Date(provider.dob), 'MMMM d, yyyy')}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-1">License</div>
                    <div className="text-base">
                      {provider.license_number} ({provider.license_state})
                    </div>
                    <div className="text-sm text-gray-500">
                      Expires: {format(new Date(provider.license_expiration), 'MMM d, yyyy')}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-1">CAQH ProView ID</div>
                    <div className="text-base">{provider.caqh_id}</div>
                  </div>
                </div>

                <div className="space-y-4">
                  {facility && (
                    <div className="flex items-start gap-3">
                      <Building2 className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-gray-500">Facility</div>
                        <div className="text-base">{facility.name}</div>
                      </div>
                    </div>
                  )}
                  {providerGroup && (
                    <div className="flex items-start gap-3">
                      <Users className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-gray-500">Provider Group</div>
                        <div className="text-base">{providerGroup.name}</div>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-gray-500">Hire Date</div>
                      <div className="text-base">{format(new Date(provider.hire_date), 'MMMM d, yyyy')}</div>
                    </div>
                  </div>
                  {provider.email && (
                    <div className="flex items-start gap-3">
                      <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-gray-500">Email</div>
                        <div className="text-base">{provider.email}</div>
                      </div>
                    </div>
                  )}
                  {provider.notes && (
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-gray-500">Notes</div>
                        <div className="text-base text-gray-700">{provider.notes}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Onboarding Checklist</CardTitle>
              <CardDescription>
                Complete all steps to finish provider onboarding
              </CardDescription>
            </CardHeader>
            <CardContent>
              {totalTasks > 0 ? (
                <>
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium text-gray-700">
                        {completedTasks} of {totalTasks} steps complete
                      </div>
                      <div className="text-sm text-gray-500">
                        {Math.round(progressPercentage)}%
                      </div>
                    </div>
                    <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    {tasks.map((task: any) => {
                      const locked = isTaskLocked(task);
                      const completed = task.status === 'complete';

                      return (
                        <div
                          key={task.id}
                          className={`flex items-start gap-3 p-4 rounded-lg border ${
                            locked
                              ? 'bg-gray-50 border-gray-200'
                              : completed
                              ? 'bg-green-50 border-green-200'
                              : 'bg-white border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <Checkbox
                            id={task.id}
                            checked={completed}
                            disabled={locked}
                            onCheckedChange={() => handleTaskComplete(task.id, providerId, queryClient)}
                            className="mt-1"
                          />
                          <label
                            htmlFor={task.id}
                            className={`flex-1 cursor-pointer ${
                              locked ? 'text-gray-400' : completed ? 'text-gray-700' : 'text-gray-900'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-medium ${locked ? 'text-gray-400' : 'text-gray-500'}`}>
                                Step {task.step_number}
                              </span>
                              {locked && (
                                <Badge variant="outline" className="text-xs">
                                  Locked
                                </Badge>
                              )}
                            </div>
                            <div className={`text-sm mt-1 ${completed ? 'line-through' : ''}`}>
                              {task.title}
                            </div>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <p>No onboarding checklist has been generated yet.</p>
                  <p className="text-sm mt-2">The checklist will be created automatically.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function ProviderDetailPage() {
  return (
    <ProtectedRoute>
      <ProviderDetailContent />
    </ProtectedRoute>
  );
}
