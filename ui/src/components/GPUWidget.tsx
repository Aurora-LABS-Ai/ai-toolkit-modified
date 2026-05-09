import React from 'react';
import { GpuInfo } from '@/types';
import { Thermometer, Zap, Clock, HardDrive, Cpu } from 'lucide-react';

interface GPUWidgetProps {
  gpu: GpuInfo;
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

export default function GPUWidget({ gpu }: GPUWidgetProps) {
  const fmt = (mb: number): string =>
    mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;

  const tempColor =
    gpu.temperature < 50
      ? 'text-emerald-400'
      : gpu.temperature < 80
        ? 'text-amber-400'
        : 'text-rose-400';

  const loadColor =
    gpu.utilization.gpu < 30
      ? 'bg-emerald-500'
      : gpu.utilization.gpu < 70
        ? 'bg-amber-500'
        : 'bg-rose-500';

  const memPct = gpu.memory.total > 0 ? (gpu.memory.used / gpu.memory.total) * 100 : 0;
  const powerPct = gpu.power.limit ? (gpu.power.draw / gpu.power.limit) * 100 : 0;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <span className="text-sm font-medium text-gray-100 truncate">{gpu.name}</span>
        <span className="ml-2 flex-shrink-0 px-2 py-0.5 bg-gray-800 rounded-full text-xs text-gray-400">
          #{gpu.index}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Temperature + Fan */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Thermometer className={`w-4 h-4 ${tempColor}`} />
            <div>
              <p className="text-xs text-gray-600">Temperature</p>
              <p className={`text-sm font-semibold ${tempColor}`}>{gpu.temperature}°C</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-600">Fan Speed</p>
            <p className="text-sm font-medium text-gray-300">{gpu.fan.speed}%</p>
          </div>
        </div>

        {/* GPU Load */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs text-gray-500">GPU Load</span>
            </div>
            <span className="text-xs font-medium text-gray-300">{gpu.utilization.gpu}%</span>
          </div>
          <StatBar value={gpu.utilization.gpu} color={loadColor} />
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
            {fmt(gpu.memory.used)} / {fmt(gpu.memory.total)}
          </p>
        </div>

        <div className="border-t border-gray-800" />

        {/* Clock + Power */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-violet-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-600">Clock Speed</p>
              <p className="text-sm text-gray-200">{gpu.clocks.graphics} MHz</p>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs text-gray-500">Power</span>
              </div>
              <span className="text-xs font-medium text-gray-300">{gpu.power.draw?.toFixed(0)}W</span>
            </div>
            <StatBar value={powerPct} color="bg-amber-500" />
            <p className="text-xs text-gray-600 mt-1">/ {gpu.power.limit?.toFixed(0) ?? '?'}W</p>
          </div>
        </div>
      </div>
    </div>
  );
}
