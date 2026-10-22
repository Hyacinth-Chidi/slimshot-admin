'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchKinds } from '@/lib/api/kinds';
import { useProfile } from '@/lib/auth/profile';
import { mobileSections, navGroups } from './nav-items';

/**
 * The navigation for whoever is signed in: the Library from the kinds the
 * server has, System from the role. Audio always exists, so the Library shows
 * it while kinds load instead of flashing empty.
 */
export function useNav() {
  const profile = useProfile();
  const kinds = useQuery({ queryKey: ['kinds'], queryFn: fetchKinds });
  const role = profile.data?.role;
  return {
    groups: navGroups({ kinds: kinds.data?.map((k) => k.kind) ?? ['audio'], role }),
    sections: mobileSections(role),
  };
}
