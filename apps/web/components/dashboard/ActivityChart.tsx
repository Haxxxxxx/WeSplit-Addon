'use client';

import { useId } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
interface ActivityChartProps {
  data?: { day: string; amount: number }[];
}

const DEFAULT_DATA = [
  { day: 'Mon', amount: 120 },
  { day: 'Tue', amount: 250 },
  { day: 'Wed', amount: 180 },
  { day: 'Thu', amount: 420 },
  { day: 'Fri', amount: 350 },
  { day: 'Sat', amount: 580 },
  { day: 'Sun', amount: 450 },
];

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value?: number }[];
  label?: string;
}) {
  if (!active || !payload || !payload.length) return null;

  const value = payload[0]?.value ?? 0;

  return (
    <div
      className="rounded-xl px-3 py-2 border"
      style={{
        backgroundColor: 'var(--color-surface-elevated)',
        borderColor: 'var(--color-white-10)',
      }}
    >
      <p
        className="text-[11px] font-normal"
        style={{ color: 'var(--color-text-tertiary)' }}
      >
        {label}
      </p>
      <p
        className="text-[14px] font-medium"
        style={{
          color: 'var(--color-text)',
          fontFamily: 'var(--font-family-number)',
        }}
      >
        {value} USDC
      </p>
    </div>
  );
}

export function ActivityChart({ data }: ActivityChartProps) {
  const gradientId = useId();
  const chartData = data ?? DEFAULT_DATA;

  return (
    <div
      className="rounded-2xl border border-[var(--color-white-5)] p-5"
    >
      <div className="flex items-center justify-between mb-5">
        <span
          className="text-[16px] font-semibold"
          style={{ color: 'var(--color-text)' }}
        >
          Weekly Activity
        </span>
      </div>
      <div className="h-[180px] w-full" style={{ minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.2} />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{
                fill: 'var(--color-text-disabled)',
                fontSize: 11,
                fontFamily: 'var(--font-family-body)',
              }}
              dy={8}
            />
            <YAxis hide />
            <Tooltip content={<CustomTooltip />} cursor={false} />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="var(--color-primary)"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
