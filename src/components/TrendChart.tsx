import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendPoint } from '../types';

interface TrendChartProps {
  hourly24h: TrendPoint[];
  daily7d: TrendPoint[];
  cityName: string;
}

type RangeKey = '6h' | '12h' | '24h' | '7d';
type SeriesFocus = 'both' | 'pm25' | 'pm10';

interface TooltipPayloadEntry {
  dataKey?: string;
  name?: string;
  value?: number;
  color?: string;
  payload?: TrendPoint;
}

function CustomTrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  return (
    <div className="rounded-md border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2 shadow-md text-xs">
      <div className="font-mono-tabular font-semibold text-[var(--text-primary)] mb-1">
        {label} {point ? `· AQI ${point.aqi}` : ''}
      </div>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-[var(--text-muted)]">
              <span
                className="h-2 w-2 rounded-xs"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}
            </span>
            <span className="font-mono-tabular font-semibold text-[var(--text-primary)]">
              {entry.value} µg/m³
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrendChart({ hourly24h, daily7d, cityName }: TrendChartProps) {
  const [range, setRange] = useState<RangeKey>('24h');
  const [focus, setFocus] = useState<SeriesFocus>('both');

  const chartData = useMemo(() => {
    if (range === '7d') return daily7d;
    if (range === '6h') return hourly24h.slice(-4);
    if (range === '12h') return hourly24h.slice(-6);
    return hourly24h;
  }, [range, hourly24h, daily7d]);

  return (
    <section
      aria-label="Particulate Trend History"
      className="rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Particulate Trend — {cityName}
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            Simulated PM2.5 &amp; PM10 concentration (µg/m³)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Pollutant series filter"
            className="inline-flex items-center rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-0.5"
          >
            {(
              [
                { id: 'both', label: 'Both' },
                { id: 'pm25', label: 'PM2.5' },
                { id: 'pm10', label: 'PM10' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={focus === item.id}
                onClick={() => setFocus(item.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-sm transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#245C45] ${
                  focus === item.id
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div
            role="group"
            aria-label="Time range selector"
            className="inline-flex items-center rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-0.5"
          >
            {(['6h', '12h', '24h', '7d'] as const).map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={range === r}
                onClick={() => setRange(r)}
                className={`px-2 py-1 text-xs font-mono-tabular font-medium rounded-sm transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#245C45] ${
                  range === r
                    ? 'bg-[#245C45] text-white'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        role="img"
        aria-label={`Particulate trend chart for ${cityName} over ${range.toUpperCase()}`}
        className="h-[290px] w-full"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 10, left: -14, bottom: 0 }}>
            <defs>
              <linearGradient id="gradPm25" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#245C45" stopOpacity={0.22} />
                <stop offset="95%" stopColor="#245C45" stopOpacity={0.01} />
              </linearGradient>
              <linearGradient id="gradPm10" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#A7B9A1" stopOpacity={0.26} />
                <stop offset="95%" stopColor="#A7B9A1" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="2 4"
              vertical={false}
              stroke="var(--border-hairline)"
            />
            <XAxis
              dataKey="time"
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTrendTooltip />} />
            {(focus === 'both' || focus === 'pm10') && (
              <Area
                type="monotone"
                dataKey="pm10"
                name="PM10"
                stroke="#8EA687"
                strokeWidth={1.75}
                fillOpacity={1}
                fill="url(#gradPm10)"
                activeDot={{ r: 3.5, strokeWidth: 0, fill: '#8EA687' }}
              />
            )}
            {(focus === 'both' || focus === 'pm25') && (
              <Area
                type="monotone"
                dataKey="pm25"
                name="PM2.5"
                stroke="#245C45"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#gradPm25)"
                activeDot={{ r: 3.5, strokeWidth: 0, fill: '#245C45' }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
