import React from 'react';
import { CpuInfo } from '@/types';
import { Cpu, HardDrive } from 'lucide-react';

interface CPUWidgetProps {
  cpu: CpuInfo | null;
}

function StatBar({ value, color = 'bg-blue-500' }: { value: number; color?: string }) {
  return (
    <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
      />
    </div>
  );
}

export default function CPUWidget({ cpu }: CPUWidgetProps) {
  if (!cpu) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <span className="text-sm font-medium text-gray-100">System</span>
        </div>
        <div className="p-4">
          <p className="text-sm text-gray-600">No data available</p>
        </div>
      </div>
    );
  }

  const fmt = (mb: number): string =>
    mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;

  const usedMem = cpu.totalMemory - cpu.availableMemory;
  const memPct = cpu.totalMemory > 0 ? (usedMem / cpu.totalMemory) * 100 : 0;

  const loadColor =
    cpu.currentLoad < 30
      ? 'bg-emerald-500'
      : cpu.currentLoad < 70
        ? 'bg-amber-500'
        : 'bg-rose-500';

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-gray-800">
        <span className="text-sm font-medium text-gray-100 truncate">{cpu.name}</span>
      </div>

      <div className="p-4 space-y-4">
        {/* CPU Load */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs text-gray-500">CPU Load</span>
            </div>
            <span className="text-xs font-medium text-gray-300">{cpu.currentLoad.toFixed(1)}%</span>
          </div>
          <StatBar value={cpu.currentLoad} color={loadColor} />
        </div>

        {/* Memory */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs text-gray-500">Memory</span>
            </div>
            <span className="text-xs font-medium text-gray-300">{memPct.toFixed(1)}%</span>
          </div>
          <StatBar value={memPct} color="bg-blue-500" />
          <p className="text-xs text-gray-600 mt-1">
            {fmt(usedMem)} / {fmt(cpu.totalMemory)}
          </p>
        </div>
      </div>
    </div>
  );
}
