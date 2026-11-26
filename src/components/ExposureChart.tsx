import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface WeeklyExposureBar {
  day: string;
  doseUg: number;
  outdoorHrs: number;
  isToday?: boolean;
}

interface ExposureChartProps {
  data: WeeklyExposureBar[];
  recommendedMaxDose?: number;
}

interface ExposureTooltipPayload {
  payload?: WeeklyExposureBar;
}

function CustomExposureTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ExposureTooltipPayload[];
}) {
  if (!active || !payload || !payload[0]?.payload) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2.5 shadow-lg text-xs">
      <div className="font-semibold text-[var(--text-primary)] mb-1">
        {item.day} {item.isToday ? '(Today)' : ''}
      </div>
      <div className="font-mono-tabular text-[var(--text-primary)]">
        Estimated intake: <span className="font-semibold">{item.doseUg.toFixed(1)} µg</span>
      </div>
      <div className="font-mono-tabular text-[var(--text-muted)] mt-0.5">
        Outdoor duration: {item.outdoorHrs.toFixed(1)} hrs
      </div>
    </div>
  );
}

export function ExposureChart({
  data,
  recommendedMaxDose = 110,
}: ExposureChartProps) {
  return (
    <div className="rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            7-Day Simulated Inhaled PM2.5 Dose
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            Illustrative daily cumulative dose (µg) vs {recommendedMaxDose} µg benchmark
          </p>
        </div>
        <span className="text-xs font-mono-tabular text-[var(--text-muted)]">
          µg PM2.5
        </span>
      </div>

      <div
        role="img"
        aria-label="7-day simulated inhaled PM2.5 dose bar chart"
        className="h-[260px] w-full"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 12, left: -14, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="var(--border-hairline)"
            />
            <XAxis
              dataKey="day"
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomExposureTooltip />} cursor={{ fill: 'var(--bg-subtle)', opacity: 0.45 }} />
            <ReferenceLine
              y={recommendedMaxDose}
              stroke="#E58B45"
              strokeDasharray="4 4"
              label={{
                value: 'Advisory threshold',
                position: 'insideTopRight',
                fill: '#E58B45',
                fontSize: 11,
              }}
            />
            <Bar dataKey="doseUg" radius={[4, 4, 0, 0]} maxBarSize={42}>
              {data.map((entry) => (
                <Cell
                  key={entry.day}
                  fill={
                    entry.doseUg > recommendedMaxDose
                      ? '#D65C50'
                      : entry.isToday
                      ? '#245C45'
                      : '#A7B9A1'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
