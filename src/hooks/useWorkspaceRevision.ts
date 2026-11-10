import { useEffect, useState } from 'react';
import { subscribeCompanyStorage } from '@/lib/workspaceStorage';

/** Refresh consumers after committed writes, cross-tab changes and focus. */
export function useWorkspaceRevision(companyId: string | null | undefined) {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!companyId) return;
    return subscribeCompanyStorage(companyId, () => setRevision((value) => value + 1));
  }, [companyId]);
  return revision;
}