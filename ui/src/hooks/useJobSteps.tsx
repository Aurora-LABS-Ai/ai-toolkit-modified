'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/utils/api';

export default function useJobSteps(jobIDs: string[]) {
  const [steps, setSteps] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (jobIDs.length === 0) {
      setSteps({});
      return;
    }

    let cancelled = false;
    setLoading(true);

    apiClient
      .get('/api/jobs/steps?' + jobIDs.map(id => `id=${id}`).join('&'))
      .then(res => res.data)
      .then(data => {
        if (!cancelled) {
          setSteps(data.steps ?? {});
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [jobIDs.join(',')]);

  return { steps, loading };
}
