'use client';

import GpuMonitor from '@/components/GPUMonitor';
import JobsTable from '@/components/JobsTable';
import { TopBar, MainContent } from '@/components/layout';
import Link from 'next/link';
import { LayoutDashboard, Layers } from 'lucide-react';

export default function Dashboard() {
  return (
    <>
      <TopBar>
        <div>
          <h1 className="text-sm font-medium text-gray-200">Dashboard</h1>
        </div>
        <div className="flex-1" />
      </TopBar>
      <MainContent>
        <div className="space-y-6">
          {/* GPU section */}
          <section>
            <GpuMonitor />
          </section>

          {/* Jobs section */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-gray-500" />
                <h2 className="text-base font-semibold text-gray-200">Queues</h2>
              </div>
              <Link
                href="/jobs"
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                View All
              </Link>
            </div>
            <JobsTable onlyActive />
          </section>
        </div>
      </MainContent>
    </>
  );
}
