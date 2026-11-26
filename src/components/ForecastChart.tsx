import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ForecastHorizon, ForecastPoint } from '../types';

interface ForecastChartProps {
  points: ForecastPoint[];
  pollutant: 'pm25' | 'pm10';
  horizon: ForecastHorizon;
}

interface ForecastTooltipPayload {
  payload?: ForecastPoint;
}

function CustomForecastTooltip({
  active,
  payload,
  pollutant,
}: {
  active?: boolean;
  payload?: ForecastTooltipPayload[];
  pollutant: 'pm25' | 'pm10';
}) {
  if (!active || !payload || payload.length === 0 || !payload[0].payload) return null;
  const pt = payload[0].payload;
  const val = pollutant === 'pm25' ? pt.pm25 : pt.pm10;
  const lower = pollutant === 'pm25' ? pt.pm25Lower : pt.pm10Lower;
  const upper = pollutant === 'pm25' ? pt.pm25Upper : pt.pm10Upper;

  return (
    <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2.5 shadow-lg text-xs">
      <div className="flex items-center justify-between gap-4 mb-1">
        <span className="font-mono-tabular font-semibold text-[var(--text-primary)]">
          {pt.label}
        </span>
        <span className="text-[11px] text-[var(--text-muted)]">
          {pt.type === 'historical' ? 'Historical observation' : 'Simulated forecast'}
        </span>
      </div>
      <div className="font-mono-tabular text-sm font-semibold text-[var(--text-primary)]">
        {pollutant === 'pm25' ? 'PM2.5' : 'PM10'}: {val} µg/m³
      </div>
      {lower !== undefined && upper !== undefined && (
        <div className="mt-1 font-mono-tabular text-[11px] text-[var(--text-muted)]">
          Confidence band: {lower}–{upper} µg/m³
        </div>
      )}
      <div className="mt-0.5 font-mono-tabular text-[11px] text-[var(--text-muted)]">
        Equivalent AQI: {pt.aqi}
      </div>
    </div>
  );
}

export function ForecastChart({ points, pollutant, horizon }: ForecastChartProps) {
  const chartData = points.map((p) => {
    const val = pollutant === 'pm25' ? p.pm25 : p.pm10;
    const lower = pollutant === 'pm25' ? p.pm25Lower : p.pm10Lower;
    const upper = pollutant === 'pm25' ? p.pm25Upper : p.pm10Upper;

    return {
      ...p,
      historicalVal: p.type === 'historical' ? val : null,
      forecastVal: p.type === 'forecast' || p.label === 'Now' ? val : null,
      bandRange:
        lower !== undefined && upper !== undefined ? [lower, upper] : undefined,
    };
  });

  return (
    <div className="rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            {pollutant === 'pm25' ? 'PM2.5' : 'PM10'} Trajectory ({horizon.toUpperCase()} Horizon)
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            Solid line marks simulated historical readings; dashed curve indicates simulated projection
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-[#245C45] dark:bg-[#A7B9A1] inline-block" />
            Historical
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 border-b-2 border-dashed border-[#E58B45] inline-block" />
            Simulated forecast
          </span>
        </div>
      </div>

      <div
        role="img"
        aria-label={`${pollutant === 'pm25' ? 'PM2.5' : 'PM10'} trajectory chart for ${horizon.toUpperCase()} horizon`}
        className="h-[300px] w-full"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="var(--border-hairline)"
            />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomForecastTooltip pollutant={pollutant} />} />
            <ReferenceLine
              x="Now"
              stroke="var(--text-muted)"
              strokeDasharray="4 4"
              label={{
                value: 'Present',
                position: 'top',
                fill: 'var(--text-muted)',
                fontSize: 11,
              }}
            />
            <Area
              type="monotone"
              dataKey="bandRange"
              stroke="none"
              fill="#E58B45"
              fillOpacity={0.14}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="historicalVal"
              stroke="#245C45"
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: '#245C45', strokeWidth: 0 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="forecastVal"
              stroke="#E58B45"
              strokeWidth={2.5}
              strokeDasharray="6 4"
              dot={{ r: 3.5, fill: '#E58B45', strokeWidth: 0 }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
