'use client';

import { useState, use } from 'react';
import { FaChevronLeft } from 'react-icons/fa';
import { MdDashboard, MdImage, MdShowChart, MdCode } from 'react-icons/md';
import { TopBar, MainContent } from '@/components/layout';
import useJob from '@/hooks/useJob';
import SampleImages, { SampleImagesMenu } from '@/components/SampleImages';
import JobOverview from '@/components/JobOverview';
import { redirect } from 'next/navigation';
import JobActionBar from '@/components/JobActionBar';
import JobConfigViewer from '@/components/JobConfigViewer';
import JobLossGraph from '@/components/JobLossGraph';
import { Job } from '@prisma/client';

type PageKey = 'overview' | 'samples' | 'config' | 'loss_log';

interface Page {
  name: string;
  value: PageKey;
  icon: React.ComponentType<{ className?: string }>;
  component: React.ComponentType<{ job: Job }>;
  menuItem?: React.ComponentType<{ job?: Job | null }> | null;
  mainCss?: string;
  jobTypes?: string[];
}

const pages: Page[] = [
  {
    name: 'Overview',
    value: 'overview',
    icon: MdDashboard,
    component: JobOverview,
    mainCss: 'pt-24',
  },
  {
    name: 'Samples',
    value: 'samples',
    icon: MdImage,
    component: SampleImages,
    menuItem: SampleImagesMenu,
    mainCss: 'pt-24',
    jobTypes: ['train'],
  },
  {
    name: 'Loss Graph',
    value: 'loss_log',
    icon: MdShowChart,
    component: JobLossGraph,
    mainCss: 'pt-24 pb-4',
    jobTypes: ['train'],
  },
  {
    name: 'Config File',
    value: 'config',
    icon: MdCode,
    component: JobConfigViewer,
    mainCss: 'pt-[88px] px-0 pb-0',
  },
];

export default function JobPage({ params }: { params: { jobID: string } }) {
  const usableParams = use(params as any) as { jobID: string };
  const jobID = usableParams.jobID;
  const { job, status, refreshJob } = useJob(jobID, 5000);
  const [pageKey, setPageKey] = useState<PageKey>('overview');

  const page = pages.find(p => p.value === pageKey);
  const jobType = job?.job_type || 'unknown';

  let title = `Job: ${job?.name || 'Loading...'}`;
  if (jobType === 'caption') {
    title = `Captioning: ${job?.job_ref || 'Loading...'}`;
  }

  return (
    <>
      {/* Top bar */}
      <TopBar>
        <button
          className="text-gray-500 hover:text-gray-300 px-3 transition-colors"
          onClick={() => redirect('/jobs')}
        >
          <FaChevronLeft />
        </button>
        <h1 className="text-sm font-medium text-gray-200">{title}</h1>
        <div className="flex-1" />
        {job && (
          <JobActionBar
            job={job}
            onRefresh={refreshJob}
            hideView
            afterDelete={() => redirect('/jobs')}
            autoStartQueue={true}
          />
        )}
      </TopBar>

      <MainContent className={pages.find(p => p.value === pageKey)?.mainCss}>
        {status === 'loading' && job == null && (
          <p className="text-gray-500 text-sm pt-4">Loading...</p>
        )}
        {status === 'error' && job == null && (
          <p className="text-rose-400 text-sm pt-4">Error fetching job</p>
        )}
        {job &&
          pages.map(p => {
            const Component = p.component;
            return p.value === pageKey ? <Component key={p.value} job={job} /> : null;
          })}
      </MainContent>

      {/* Tab bar */}
      <div className="absolute top-12 left-0 w-full h-10 bg-gray-950 border-b border-gray-800 flex items-stretch px-2">
        {pages.map(tab => {
          if (tab.jobTypes && !tab.jobTypes.includes(jobType)) return null;
          const active = tab.value === pageKey;
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              onClick={() => setPageKey(tab.value)}
              className={`relative flex items-center gap-1.5 px-4 text-sm transition-colors ${
                active ? 'text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.name}
              {active && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-500 rounded-t-full" />
              )}
            </button>
          );
        })}
        {page?.menuItem && (
          <>
            <div className="flex-grow" />
            <page.menuItem job={job} />
          </>
        )}
      </div>
    </>
  );
}
