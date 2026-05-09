'use client';

import { Job } from '@prisma/client';
import useGPUInfo from '@/hooks/useGPUInfo';
import useCPUInfo from '@/hooks/useCPUInfo';
import GPUWidget from '@/components/GPUWidget';
import CPUWidget from '@/components/CPUWidget';
import FilesWidget from '@/components/FilesWidget';
import { getTotalSteps } from '@/utils/jobs';
import { useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import useJobLog from '@/hooks/useJobLog';
import { Cpu, HardDrive, Gauge, Clock, TrendingDown } from 'lucide-react';

interface JobOverviewProps {
  job: Job;
}

interface ParsedProgress {
  step: number;
  total: number;
  elapsed: string;
  eta: string;
  speed: string;
  loss: string;
}

const ANSI_RE = /\x1B\[[0-9;]*[mGKHFJA]/g;

function parseProgressFromLog(log: string): ParsedProgress | null {
  const lines = log.split(/\n|\r\n/);
  const processedLines = lines.map(line =>
    line
      .split(/\r/)
      .pop()!
      .replace(ANSI_RE, ''),
  );

  for (let i = processedLines.length - 1; i >= 0; i--) {
    const line = processedLines[i];
    const match = line.match(/\|\s*(\d+)\/(\d+)\s+\[([^<]+)<([^,]+),\s*([^,\]]+)/);
    if (match) {
      const lossMatch = line.match(/loss:\s*([\d.eE+\-]+)/);
      return {
        step: parseInt(match[1], 10),
        total: parseInt(match[2], 10),
        elapsed: match[3].trim(),
        eta: match[4].trim(),
        speed: match[5].trim(),
        loss: lossMatch ? lossMatch[1] : '',
      };
    }
  }
  return null;
}

function formatEta(eta: string): string {
  const parts = eta.split(':').map(Number);
  if (parts.length === 3) {
    if (parts[0] > 0) return `${parts[0]}h ${parts[1]}m`;
    return `${parts[1]}m ${parts[2]}s`;
  }
  if (parts.length === 2) {
    if (parts[0] > 0) return `${parts[0]}m ${parts[1]}s`;
    return `${parts[1]}s`;
  }
  return eta;
}

function getLogLineStyle(line: string): string {
  const lower = line.toLowerCase();
  if (lower.includes('error') || lower.includes('exception') || lower.includes('traceback')) {
    return 'text-rose-400';
  }
  if (lower.includes('warning') || lower.includes('warn')) {
    return 'text-amber-400';
  }
  if (/\|\s*\d+\/\d+\s+\[/.test(line)) {
    return 'text-cyan-300';
  }
  return 'text-gray-500';
}

const STATUS_CONFIG: Record<string, { dot: string; badge: string; label: string }> = {
  running: {
    dot: 'bg-emerald-500 animate-pulse',
    badge: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    label: 'Running',
  },
  stopping: {
    dot: 'bg-amber-500 animate-pulse',
    badge: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    label: 'Stopping',
  },
  stopped: {
    dot: 'bg-gray-600',
    badge: 'bg-gray-700/50 text-gray-400 border border-gray-700',
    label: 'Stopped',
  },
  completed: {
    dot: 'bg-blue-500',
    badge: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    label: 'Completed',
  },
  error: {
    dot: 'bg-rose-500 animate-pulse',
    badge: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
    label: 'Error',
  },
  queued: {
    dot: 'bg-violet-500',
    badge: 'bg-violet-500/10 text-violet-400 border border-violet-500/20',
    label: 'Queued',
  },
};

function MetricCell({
  icon,
  label,
  value,
  mono,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-600 mb-0.5">{label}</p>
        <p className={`text-sm font-medium text-gray-200 truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
    </div>
  );
}

export default function JobOverview({ job }: JobOverviewProps) {
  const gpuIds = useMemo(() => {
    if (job.gpu_ids === 'mps') return [0];
    return job.gpu_ids.split(',').map(id => parseInt(id, 10));
  }, [job.gpu_ids]);

  const { log, status: statusLog } = useJobLog(job.id, 2000);
  const logRef = useRef<HTMLDivElement>(null);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
  const { gpuList, isGPUInfoLoaded } = useGPUInfo(gpuIds, 5000);
  const { cpuInfo, isCPUInfoLoaded } = useCPUInfo(5000);

  const totalSteps = getTotalSteps(job);
  const isStopping = job.stop && job.status === 'running';
  const status = isStopping ? 'stopping' : job.status;
  const sc = STATUS_CONFIG[status] ?? STATUS_CONFIG.stopped;

  const logProgress = useMemo(() => parseProgressFromLog(log), [log]);

  const currentStep = logProgress ? Math.max(job.step, logProgress.step) : job.step;
  const effectiveTotal = logProgress?.total ?? totalSteps;
  const progress = effectiveTotal > 0 ? Math.min((currentStep / effectiveTotal) * 100, 100) : 0;

  const logLines = useMemo(() => {
    let splits = log.split(/\n|\r\n/);
    splits = splits.map(line => line.split(/\r/).pop() as string);
    if (splits.length > 1000) splits = splits.slice(splits.length - 1000);
    return splits;
  }, [log]);

  const handleScroll = () => {
    if (!logRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logRef.current;
    setIsScrolledToBottom(scrollHeight - scrollTop - clientHeight < 10);
  };

  useEffect(() => {
    if (logRef.current && isScrolledToBottom) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log, isScrolledToBottom]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 pb-4">
      {/* Left / main panel */}
      <div className="lg:col-span-2 flex flex-col gap-4">
        {/* Status + progress card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {/* Status header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={`flex-shrink-0 w-2 h-2 rounded-full ${sc.dot}`} />
              <span className="text-sm text-gray-300 truncate">{job.info || 'Initializing…'}</span>
            </div>
            <span className={`ml-3 flex-shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium ${sc.badge}`}>
              {sc.label}
            </span>
          </div>

          {/* Progress */}
          {job.job_type === 'train' && (
            <div className="px-5 py-4 border-b border-gray-800">
              <div className="flex items-end justify-between mb-3">
                <div>
                  <span className="text-3xl font-bold text-white tabular-nums">
                    {currentStep.toLocaleString()}
                  </span>
                  <span className="text-gray-600 text-sm ml-2">/ {effectiveTotal.toLocaleString()} steps</span>
                </div>
                <div className="flex items-center gap-4 text-sm pb-0.5">
                  <span className="text-gray-300 font-semibold tabular-nums">{progress.toFixed(1)}%</span>
                  {logProgress?.eta && (
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatEta(logProgress.eta)}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%)',
                  }}
                />
              </div>
            </div>
          )}

          {/* Metrics row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-800">
            <MetricCell
              icon={<HardDrive className="w-4 h-4 text-blue-400" />}
              label="Job Name"
              value={job.name}
            />
            <MetricCell
              icon={<Cpu className="w-4 h-4 text-violet-400" />}
              label="GPU"
              value={`GPU: ${job.gpu_ids}`}
            />
            <MetricCell
              icon={<Gauge className="w-4 h-4 text-emerald-400" />}
              label="Speed"
              value={logProgress?.speed || (job.speed_string !== '' ? job.speed_string : '—')}
              mono
            />
            <MetricCell
              icon={<TrendingDown className="w-4 h-4 text-amber-400" />}
              label="Loss"
              value={logProgress?.loss ? parseFloat(logProgress.loss).toFixed(4) : '—'}
              mono
            />
          </div>
        </div>

        {/* Terminal log */}
        <div className="bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden flex flex-col min-h-72">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-800 bg-gray-900/50 flex-shrink-0">
            <span className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-gray-700" />
              <span className="w-3 h-3 rounded-full bg-gray-700" />
              <span className="w-3 h-3 rounded-full bg-gray-700" />
            </span>
            <span className="text-xs text-gray-600 font-mono ml-1">training.log</span>
            {statusLog === 'refreshing' && (
              <span className="ml-auto text-xs text-emerald-600 animate-pulse">● live</span>
            )}
          </div>
          <div
            ref={logRef}
            className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-5"
            onScroll={handleScroll}
            style={{ maxHeight: '400px' }}
          >
            {statusLog === 'loading' && <span className="text-gray-700">Loading log…</span>}
            {statusLog === 'error' && <span className="text-rose-500">Failed to load log.</span>}
            {['success', 'refreshing'].includes(statusLog) &&
              logLines.map((line, i) => (
                <pre key={i} className={`whitespace-pre-wrap break-all leading-5 ${getLogLineStyle(line)}`}>
                  {line || ' '}
                </pre>
              ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="lg:col-span-1 flex flex-col gap-4">
        {isCPUInfoLoaded && cpuInfo && <CPUWidget cpu={cpuInfo} />}
        {isGPUInfoLoaded && gpuList.length > 0 && <GPUWidget gpu={gpuList[0]} />}
        {job.job_type === 'train' && <FilesWidget jobID={job.id} />}
      </div>
    </div>
  );
}
