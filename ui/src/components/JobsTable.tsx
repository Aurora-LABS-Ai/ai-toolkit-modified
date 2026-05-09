import { useMemo } from 'react';
import useJobsList from '@/hooks/useJobsList';
import Link from 'next/link';
import UniversalTable, { TableColumn } from '@/components/UniversalTable';
import { GpuInfo, JobConfig } from '@/types';
import JobActionBar from './JobActionBar';
import { Job, Queue } from '@prisma/client';
import useQueueList from '@/hooks/useQueueList';
import useJobSteps from '@/hooks/useJobSteps';
import classNames from 'classnames';
import { startQueue, stopQueue } from '@/utils/queue';
import { CgSpinner } from 'react-icons/cg';
import useGPUInfo from '@/hooks/useGPUInfo';
import { Clock, HardDrive } from 'lucide-react';

interface JobsTableProps {
  autoStartQueue?: boolean;
  onlyActive?: boolean;
  job_type?: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  running: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  stopping: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  queued: 'bg-violet-500/10 text-violet-400 border border-violet-500/20',
  completed: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  stopped: 'bg-gray-700/50 text-gray-400 border border-gray-700',
  error: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
};

export default function JobsTable({ onlyActive = false, job_type = null }: JobsTableProps) {
  const { jobs, status, refreshJobs } = useJobsList({ onlyActive, reloadInterval: 5000, job_type });
  const { queues, status: queueStatus, refreshQueues } = useQueueList();
  const { gpuList, isGPUInfoLoaded } = useGPUInfo();

  const liveJobIDs = useMemo(
    () => jobs.filter(j => ['running', 'queued', 'stopping'].includes(j.status)).map(j => j.id),
    [jobs],
  );
  const { steps: liveSteps } = useJobSteps(liveJobIDs);

  const refresh = () => {
    refreshJobs();
    refreshQueues();
  };

  const columns: TableColumn[] = [
    {
      title: 'Name',
      key: 'name',
      render: (row: Job) => {
        let title = row.name;
        if (row.job_type === 'caption') {
          const splits = row.job_ref.split(/[/\\]/);
          title = (
            <>
              <small className="opacity-50">CAPTION: </small>
              {splits[splits.length - 1]}
            </>
          );
        }
        return (
          <Link href={`/jobs/${row.id}`} className="font-medium whitespace-nowrap hover:text-white transition-colors">
            {['running', 'stopping'].includes(row.status) ? (
              <CgSpinner className="inline animate-spin mr-2 text-blue-400" />
            ) : null}
            {title}
          </Link>
        );
      },
    },
    {
      title: 'Progress',
      key: 'steps',
      render: (row: Job) => {
        const jobConfig: JobConfig = JSON.parse(row.job_config);
        if (row.job_type !== 'train') return <></>;
        const totalSteps = jobConfig.config.process[0].train?.steps;

        // Use live step from log for active jobs, DB step for completed/stopped
        const isLive = ['running', 'queued', 'stopping'].includes(row.status);
        const currentStep = isLive && liveSteps[row.id] !== undefined ? liveSteps[row.id] : row.step;
        const progress = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

        return (
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-24">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span className="tabular-nums">{currentStep.toLocaleString()}</span>
                <span className="tabular-nums text-gray-600">{totalSteps.toLocaleString()}</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full transition-all duration-1000"
                  style={{
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                  }}
                />
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: 'GPU',
      key: 'gpu_ids',
      render: (row: Job) => (
        <div className="flex items-center gap-1.5 text-sm text-gray-400">
          <HardDrive className="w-3.5 h-3.5 text-gray-600" />
          {row.gpu_ids}
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (row: Job) => {
        const badge = STATUS_BADGE[row.status] ?? STATUS_BADGE.stopped;
        return (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge}`}>
            {row.status}
          </span>
        );
      },
    },
    {
      title: 'Info',
      key: 'info',
      className: 'truncate max-w-xs',
    },
    {
      title: '',
      key: 'actions',
      className: 'text-right',
      render: (row: Job) => {
        return <JobActionBar job={row} onRefresh={refreshJobs} autoStartQueue={false} />;
      },
    },
  ];

  const jobsDict = useMemo(() => {
    if (!isGPUInfoLoaded) return {};
    if (jobs.length === 0) return {};
    const jd: Record<string, { name: string; jobs: Job[] }> = {};
    gpuList.forEach(gpu => {
      jd[`${gpu.index}`] = { name: gpu.name, jobs: [] };
    });
    jd['Idle'] = { name: 'Idle', jobs: [] };
    jobs.forEach(job => {
      const gpu = gpuList.find(gpu => job.gpu_ids?.split(',').includes(gpu.index.toString())) as GpuInfo;
      const key = `${gpu?.index || '0'}`;
      if (['queued', 'running', 'stopping'].includes(job.status) && key in jd) {
        jd[key].jobs.push(job);
      } else {
        jd['Idle'].jobs.push(job);
      }
    });
    Object.keys(jd).forEach(key => {
      if (key === 'Idle') {
        jd[key].jobs.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      } else {
        jd[key].jobs.sort((a, b) => {
          if (a.queue_position === null) return 1;
          if (b.queue_position === null) return -1;
          return a.queue_position - b.queue_position;
        });
      }
    });
    return jd;
  }, [jobs, queues, isGPUInfoLoaded]);

  const isLoading = status === 'loading' || queueStatus === 'loading' || !isGPUInfoLoaded;
  if (Object.keys(jobsDict).length > 0) isLoading = false;

  return (
    <div className="space-y-4">
      {Object.keys(jobsDict)
        .sort()
        .filter(key => key !== 'Idle')
        .map(gpuKey => {
          const queue = queues.find(q => `${q.gpu_ids}` === gpuKey) as Queue;
          const isRunning = !!queue?.is_running;
          return (
            <div key={gpuKey} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              {/* Queue header */}
              <div
                className={classNames(
                  'flex items-center justify-between px-4 py-3',
                  isRunning
                    ? 'bg-emerald-900/20 border-b border-emerald-500/10'
                    : 'bg-gray-800/50 border-b border-gray-800',
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={classNames(
                      'w-2 h-2 rounded-full flex-shrink-0',
                      isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-gray-600',
                    )}
                  />
                  <h2 className="text-sm font-semibold text-gray-100 truncate">{jobsDict[gpuKey].name}</h2>
                  <span className="flex-shrink-0 px-2 py-0.5 bg-gray-800 rounded-full text-xs text-gray-400">
                    #{queue?.gpu_ids ?? gpuKey}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-gray-500" />
                    {isRunning ? (
                      <span className="text-emerald-400 font-medium">Queue Running</span>
                    ) : (
                      <span className="text-gray-500">Queue Stopped</span>
                    )}
                  </div>
                  <button
                    onClick={async () => {
                      isRunning ? await stopQueue(queue.gpu_ids as string) : await startQueue(gpuKey);
                      refresh();
                    }}
                    className={classNames(
                      'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                      isRunning
                        ? 'bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/20'
                        : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/20',
                    )}
                  >
                    {isRunning ? 'STOP' : 'START'}
                  </button>
                </div>
              </div>

              <UniversalTable
                columns={columns}
                rows={jobsDict[gpuKey].jobs}
                isLoading={isLoading}
                onRefresh={refresh}
                theadClassName={classNames('bg-gray-800/50 text-gray-400')}
              />
            </div>
          );
        })}
      {!onlyActive && Object.keys(jobsDict).includes('Idle') && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden opacity-60">
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-800/30 border-b border-gray-800">
            <div className="w-2 h-2 rounded-full bg-gray-600" />
            <h2 className="text-sm font-semibold text-gray-100">Idle</h2>
          </div>
          <UniversalTable
            columns={columns}
            rows={jobsDict['Idle'].jobs}
            isLoading={isLoading}
            onRefresh={refresh}
            theadClassName="bg-gray-800/30 text-gray-400"
          />
        </div>
      )}
    </div>
  );
}
