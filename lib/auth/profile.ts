import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { withRefresh } from './session';
import type { AdminProfile } from './session';

export function fetchMe(): Promise<AdminProfile> {
  return withRefresh(() => apiFetch<AdminProfile>('/auth/me'));
}

/**
 * Settings is owner-only, and the role that gates it lives on the profile,
 * not in anything the client already holds, so an owner-only screen needs
 * this before it decides what to render or fetch.
 */
export function useProfile(): UseQueryResult<AdminProfile> {
  return useQuery({ queryKey: ['auth', 'me'], queryFn: fetchMe });
}
