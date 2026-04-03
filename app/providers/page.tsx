'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ProtectedRoute } from '@/components/providers/ProtectedRoute';
import { getProviders } from '@/lib/providers/queries';
import { Plus, Search } from 'lucide-react';

function ProvidersContent() {
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const { data: providers, isLoading } = useQuery<any[]>({
    queryKey: ['providers'],
    queryFn: getProviders,
  });

  const filteredProviders = useMemo(() => {
    if (!providers) return [];
    if (!searchQuery.trim()) return providers;

    const query = searchQuery.toLowerCase();
    return providers.filter((provider) => {
      const fullName = `${provider.first_name} ${provider.last_name}`.toLowerCase();
      const npi = provider.npi.toLowerCase();
      return fullName.includes(query) || npi.includes(query);
    });
  }, [providers, searchQuery]);

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Providers</h1>
          <p className="text-gray-600">Manage your provider credentialing and onboarding</p>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by name or NPI..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Link href="/providers/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Provider
                </Button>
              </Link>
            </div>
          </div>

          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredProviders.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Plus className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchQuery ? 'No providers found' : 'No providers yet'}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchQuery
                  ? 'Try adjusting your search terms'
                  : 'Get started by adding your first provider'}
              </p>
              {!searchQuery && (
                <Link href="/providers/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Provider
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Credentials</TableHead>
                  <TableHead>NPI</TableHead>
                  <TableHead>License State</TableHead>
                  <TableHead>Facility</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProviders.map((provider) => (
                  <TableRow
                    key={provider.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => router.push(`/providers/${provider.id}`)}
                  >
                    <TableCell className="font-medium">
                      {provider.last_name}, {provider.first_name}
                    </TableCell>
                    <TableCell>{provider.credentials}</TableCell>
                    <TableCell>{provider.npi}</TableCell>
                    <TableCell>{provider.license_state}</TableCell>
                    <TableCell>
                      {provider.provider_facility_assignment?.[0]?.facility?.name || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(provider.status)} variant="secondary">
                        {provider.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProvidersPage() {
  return (
    <ProtectedRoute>
      <ProvidersContent />
    </ProtectedRoute>
  );
}
