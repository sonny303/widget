'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ProtectedRoute } from '@/components/providers/ProtectedRoute';
import { getProviderGroups, getFacilitiesByGroup } from '@/lib/providers/queries';
import { supabase } from '@/lib/supabase/client';
import { getUserOrgId } from '@/lib/supabase/auth';
import { toast } from 'sonner';
import { ArrowLeft, Loader as Loader2 } from 'lucide-react';
import Link from 'next/link';

const providerSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  middle_name: z.string().optional(),
  last_name: z.string().min(1, 'Last name is required'),
  former_last_name: z.string().optional(),
  suffix: z.string().optional(),
  credentials: z.string().min(1, 'Credentials are required'),
  dob: z.string().min(1, 'Date of birth is required'),
  gender: z.string().min(1, 'Gender is required'),
  npi: z.string().min(1, 'NPI is required'),
  taxonomy_code: z.string().min(1, 'Taxonomy code is required'),
  license_state: z.string().min(1, 'License state is required'),
  license_number: z.string().min(1, 'License number is required'),
  license_expiration: z.string().min(1, 'License expiration is required'),
  caqh_id: z.string().min(1, 'CAQH ProView ID is required'),
  employment_type: z.enum(['full-time', 'part-time', 'contractor'], {
    required_error: 'Employment type is required',
  }),
  hire_date: z.string().min(1, 'Hire date is required'),
  provider_group_id: z.string().min(1, 'Provider group is required'),
  facility_id: z.string().min(1, 'Facility is required'),
  email: z.string().email().optional().or(z.literal('')),
  notes: z.string().optional(),
});

type ProviderFormData = z.infer<typeof providerSchema>;

const ONBOARDING_STEPS = [
  { step_order: 1, title: 'Collect provider demographic info (name, DOB, address, email)' },
  { step_order: 2, title: 'Confirm Individual NPI and taxonomy code' },
  { step_order: 3, title: 'Verify state license (number, state, expiry)' },
  { step_order: 4, title: 'Confirm group/facility assignment (TIN, Group NPI, location)' },
  { step_order: 5, title: 'Upload W-9 and credentialing application' },
  { step_order: 6, title: 'Confirm malpractice insurance (carrier, policy number, expiry)' },
  { step_order: 7, title: 'Open credential cases for all required payers' },
  { step_order: 8, title: 'Generate and review payer enrollment forms / portal data guides' },
  { step_order: 9, title: 'Submit all payer enrollments and log submission dates' },
  { step_order: 10, title: 'Set 14-day follow-up tickler for each open case' },
];

const DEFAULT_TEMPLATE_ID = '00000000-0000-0000-0000-000000000050';

async function generateOnboardingChecklist(providerId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const orgId = await getUserOrgId(user.id);
  if (!orgId) throw new Error('No organization found');

  const { data: checklist, error: checklistError } = await supabase
    .from('onboarding_checklist')
    .insert({
      provider_id: providerId,
      org_id: orgId,
      template_id: DEFAULT_TEMPLATE_ID,
      status: 'in_progress',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (checklistError) throw checklistError;

  const taskIds: string[] = [];

  for (let i = 0; i < ONBOARDING_STEPS.length; i++) {
    const step = ONBOARDING_STEPS[i];
    const taskRow = {
      checklist_id: checklist.id,
      org_id: orgId,
      title: step.title,
      step_order: step.step_order,
      status: step.step_order === 1 ? 'pending' : 'locked',
      depends_on_task_id: i === 0 ? null : taskIds[i - 1],
      is_required: true,
      completed_at: null,
    };

    const result: { data: { id: string } | null; error: unknown } = await supabase
      .from('onboarding_task')
      .insert(taskRow)
      .select('id')
      .single();

    if (result.error) throw result.error;
    taskIds.push(result.data!.id);
  }

  const { error: auditError } = await supabase
    .from('audit_log')
    .insert({
      org_id: orgId,
      action: 'onboarding_checklist_created',
      entity_type: 'provider',
      entity_id: providerId,
      performed_by: user.id,
      created_at: new Date().toISOString(),
    });

  if (auditError) throw auditError;
}

function NewProviderContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProviderFormData>({
    resolver: zodResolver(providerSchema),
  });

  const { data: providerGroups = [], isLoading: groupsLoading } = useQuery<any[]>({
    queryKey: ['provider-groups'],
    queryFn: getProviderGroups,
    enabled: true,
  });

  const { data: facilities = [], isLoading: facilitiesLoading } = useQuery<any[]>({
    queryKey: ['facilities', selectedGroupId],
    queryFn: () => getFacilitiesByGroup(selectedGroupId),
    enabled: !!selectedGroupId,
  });

  const onSubmit = async (data: ProviderFormData) => {
    setLoading(true);
    setError(null);
    setValidationErrors({});

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const orgId = await getUserOrgId(user.id);
      if (!orgId) throw new Error('No organization found');

      const providerData = {
        org_id: orgId,
        first_name: data.first_name,
        middle_name: data.middle_name || null,
        last_name: data.last_name,
        former_last_name: data.former_last_name || null,
        suffix: data.suffix || null,
        credentials: data.credentials,
        dob: data.dob,
        gender: data.gender,
        npi: data.npi,
        taxonomy_code: data.taxonomy_code,
        license_state: data.license_state,
        license_number: data.license_number,
        license_expiration: data.license_expiration,
        caqh_id: data.caqh_id,
        employment_type: data.employment_type,
        hire_date: data.hire_date,
        email: data.email || null,
        notes: data.notes || null,
        status: 'pending',
      };

      const { data: provider, error: providerError } = await supabase
        .from('provider')
        .insert(providerData)
        .select()
        .single();

      if (providerError) throw providerError;

      const assignmentData = {
        provider_id: provider.id,
        facility_id: data.facility_id,
        provider_group_id: data.provider_group_id,
        is_primary: true,
        start_date: data.hire_date,
        end_date: null,
      };

      const { error: assignmentError } = await supabase
        .from('provider_facility_assignment')
        .insert(assignmentData);

      if (assignmentError) throw assignmentError;

      await generateOnboardingChecklist(provider.id);

      toast.success('Provider added successfully');
      router.push(`/providers/${provider.id}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create provider';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/providers" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Providers
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Add New Provider</h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Basic demographic information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name *</Label>
                    <Input
                      id="first_name"
                      {...register('first_name')}
                      className={errors.first_name ? 'border-red-500' : ''}
                    />
                    {errors.first_name && (
                      <p className="text-sm text-red-500">{errors.first_name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="middle_name">Middle Name</Label>
                    <Input id="middle_name" {...register('middle_name')} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name *</Label>
                    <Input
                      id="last_name"
                      {...register('last_name')}
                      className={errors.last_name ? 'border-red-500' : ''}
                    />
                    {errors.last_name && (
                      <p className="text-sm text-red-500">{errors.last_name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="former_last_name">Former Last Name</Label>
                    <Input id="former_last_name" {...register('former_last_name')} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="suffix">Suffix</Label>
                    <Input id="suffix" {...register('suffix')} placeholder="Jr., Sr., III, etc." />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="credentials">Credentials *</Label>
                    <Input
                      id="credentials"
                      {...register('credentials')}
                      placeholder="e.g., DPT, MD, DO"
                      className={errors.credentials ? 'border-red-500' : ''}
                    />
                    {errors.credentials && (
                      <p className="text-sm text-red-500">{errors.credentials.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dob">Date of Birth *</Label>
                    <Input
                      id="dob"
                      type="date"
                      {...register('dob')}
                      className={errors.dob ? 'border-red-500' : ''}
                    />
                    {errors.dob && (
                      <p className="text-sm text-red-500">{errors.dob.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender *</Label>
                    <Input
                      id="gender"
                      {...register('gender')}
                      placeholder="e.g., Male, Female"
                      className={errors.gender ? 'border-red-500' : ''}
                    />
                    {errors.gender && (
                      <p className="text-sm text-red-500">{errors.gender.message}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Professional Information</CardTitle>
                <CardDescription>Licensing and credentialing details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="npi">Individual NPI *</Label>
                    <Input
                      id="npi"
                      {...register('npi')}
                      className={errors.npi ? 'border-red-500' : ''}
                    />
                    {errors.npi && (
                      <p className="text-sm text-red-500">{errors.npi.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="taxonomy_code">Taxonomy Code (Primary) *</Label>
                    <Input
                      id="taxonomy_code"
                      {...register('taxonomy_code')}
                      className={errors.taxonomy_code ? 'border-red-500' : ''}
                    />
                    {errors.taxonomy_code && (
                      <p className="text-sm text-red-500">{errors.taxonomy_code.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="license_state">License State *</Label>
                    <Input
                      id="license_state"
                      {...register('license_state')}
                      placeholder="e.g., CA, NY"
                      className={errors.license_state ? 'border-red-500' : ''}
                    />
                    {errors.license_state && (
                      <p className="text-sm text-red-500">{errors.license_state.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="license_number">License Number *</Label>
                    <Input
                      id="license_number"
                      {...register('license_number')}
                      className={errors.license_number ? 'border-red-500' : ''}
                    />
                    {errors.license_number && (
                      <p className="text-sm text-red-500">{errors.license_number.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="license_expiration">License Expiration Date *</Label>
                    <Input
                      id="license_expiration"
                      type="date"
                      {...register('license_expiration')}
                      className={errors.license_expiration ? 'border-red-500' : ''}
                    />
                    {errors.license_expiration && (
                      <p className="text-sm text-red-500">{errors.license_expiration.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="caqh_id">CAQH ProView ID *</Label>
                    <Input
                      id="caqh_id"
                      {...register('caqh_id')}
                      className={errors.caqh_id ? 'border-red-500' : ''}
                    />
                    {errors.caqh_id && (
                      <p className="text-sm text-red-500">{errors.caqh_id.message}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Employment Details</CardTitle>
                <CardDescription>Assignment and employment information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="employment_type">Employment Type *</Label>
                    <Select onValueChange={(value) => setValue('employment_type', value as any)}>
                      <SelectTrigger className={errors.employment_type ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Select employment type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full-time">Full-time</SelectItem>
                        <SelectItem value="part-time">Part-time</SelectItem>
                        <SelectItem value="contractor">Contractor</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.employment_type && (
                      <p className="text-sm text-red-500">{errors.employment_type.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="hire_date">Hire Date *</Label>
                    <Input
                      id="hire_date"
                      type="date"
                      {...register('hire_date')}
                      className={errors.hire_date ? 'border-red-500' : ''}
                    />
                    {errors.hire_date && (
                      <p className="text-sm text-red-500">{errors.hire_date.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="provider_group_id">Provider Group *</Label>
                    <Select
                      onValueChange={(value) => {
                        setValue('provider_group_id', value);
                        setSelectedGroupId(value);
                        setValue('facility_id', '');
                      }}
                    >
                      <SelectTrigger className={errors.provider_group_id ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Select provider group" />
                      </SelectTrigger>
                      <SelectContent>
                        {providerGroups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.provider_group_id && (
                      <p className="text-sm text-red-500">{errors.provider_group_id.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="facility_id">Facility Assignment *</Label>
                    <Select
                      onValueChange={(value) => setValue('facility_id', value)}
                      disabled={!selectedGroupId}
                    >
                      <SelectTrigger className={errors.facility_id ? 'border-red-500' : ''}>
                        <SelectValue placeholder={selectedGroupId ? "Select facility" : "Select provider group first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {facilities.map((facility) => (
                          <SelectItem key={facility.id} value={facility.id}>
                            {facility.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.facility_id && (
                      <p className="text-sm text-red-500">{errors.facility_id.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Provider Email</Label>
                    <Input
                      id="email"
                      type="email"
                      {...register('email')}
                      placeholder="provider@example.com"
                      className={errors.email ? 'border-red-500' : ''}
                    />
                    {errors.email && (
                      <p className="text-sm text-red-500">{errors.email.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Provider Notes</Label>
                  <Textarea
                    id="notes"
                    {...register('notes')}
                    rows={4}
                    placeholder="Additional notes or comments..."
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
              <Link href="/providers">
                <Button type="button" variant="outline" disabled={loading}>
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? 'Saving...' : 'Save Provider'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NewProviderPage() {
  return (
    <ProtectedRoute>
      <NewProviderContent />
    </ProtectedRoute>
  );
}
