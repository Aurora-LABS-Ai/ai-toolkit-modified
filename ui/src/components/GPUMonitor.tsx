import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GPUApiResponse } from '@/types';
import Loading from '@/components/Loading';
import GPUWidget from '@/components/GPUWidget';
import { apiClient } from '@/utils/api';

const GpuMonitor: React.FC = () => {
  const [gpuData, setGpuData] = useState<GPUApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const isFetchingGpuRef = useRef(false);

  useEffect(() => {
    const fetchGpuInfo = async () => {
      if (isFetchingGpuRef.current) {
        return;
      }
      setLoading(true);
      isFetchingGpuRef.current = true;
      apiClient
        .get('/api/gpu')
        .then(res => res.data)
        .then(data => {
          setGpuData(data);
          setLastUpdated(new Date());
          setError(null);
        })
        .catch(err => {
          setError(`Failed to fetch GPU data: ${err instanceof Error ? err.message : String(err)}`);
        })
        .finally(() => {
          isFetchingGpuRef.current = false;
          setLoading(false);
        });
    };

    fetchGpuInfo();

    const intervalId = setInterval(fetchGpuInfo, 1000);

    return () => clearInterval(intervalId);
  }, []);

  const getGridClasses = (gpuCount: number): string => {
    switch (gpuCount) {
      case 1:
        return 'grid-cols-1';
      case 2:
        return 'grid-cols-2';
      case 3:
        return 'grid-cols-3';
      case 4:
        return 'grid-cols-4';
      case 5:
      case 6:
        return 'grid-cols-3';
      case 7:
      case 8:
        return 'grid-cols-4';
      case 9:
      case 10:
        return 'grid-cols-5';
      default:
        return 'grid-cols-3';
    }
  };

  const content = useMemo(() => {
    if (loading && !gpuData) {
      return <Loading />;
    }

    if (error) {
      return (
        <div className="bg-gray-900 border border-rose-500/20 rounded-xl px-4 py-3 text-rose-400 text-sm">
          {error}
        </div>
      );
    }

    if (!gpuData) {
      return (
        <div className="bg-gray-900 border border-amber-500/20 rounded-xl px-4 py-3 text-amber-400 text-sm">
          No GPU data available.
        </div>
      );
    }

    if (!gpuData.hasNvidiaSmi && !gpuData.isMac) {
      return (
        <div className="bg-gray-900 border border-amber-500/20 rounded-xl px-4 py-3 text-amber-400 text-sm">
          <span className="font-semibold">No NVIDIA GPUs detected.</span> nvidia-smi is not available on this system.
          {gpuData.error && <p className="mt-2 text-xs opacity-70">{gpuData.error}</p>}
        </div>
      );
    }

    if (gpuData.gpus.length === 0) {
      return (
        <div className="bg-gray-900 border border-amber-500/20 rounded-xl px-4 py-3 text-amber-400 text-sm">
          No GPUs found, but nvidia-smi is available.
        </div>
      );
    }

    const gridClass = getGridClasses(gpuData?.gpus?.length || 1);

    return (
      <div className={`grid ${gridClass} gap-4`}>
        {gpuData.gpus.map((gpu, idx) => (
          <GPUWidget key={idx} gpu={gpu} />
        ))}
      </div>
    );
  }, [loading, gpuData, error]);

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-200">GPU Monitor</h2>
        {lastUpdated && (
          <span className="text-xs text-gray-600">
            Updated {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>
      {content}
    </div>
  );
};

export default GpuMonitor;
