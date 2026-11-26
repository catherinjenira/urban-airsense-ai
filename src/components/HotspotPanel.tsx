import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CITY_MAP } from '../data/cities';
import { HotspotEpisodeMonth, PollutionHotspot } from '../types';
import { AQI_COLORS, AQI_TEXT_CLASSES } from '../utils/aqi';

interface HotspotPanelProps {
  hotspot: PollutionHotspot | null;
}

function EpisodeTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: HotspotEpisodeMonth }[];
}) {
  if (!active || !payload || !payload[0]?.payload) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 shadow-lg text-xs">
      <div className="font-semibold text-[var(--text-primary)]">{item.month}</div>
      <div className="font-mono-tabular text-[var(--text-muted)] mt-0.5">
        Elevated episodes: <span className="text-[var(--text-primary)] font-semibold">{item.episodes} days</span>
      </div>
      <div className="font-mono-tabular text-[var(--text-muted)]">
        Avg peak AQI: <span className="text-[var(--text-primary)] font-semibold">{item.avgPeakAqi}</span>
      </div>
    </div>
  );
}

export function HotspotPanel({ hotspot }: HotspotPanelProps) {
  if (!hotspot) {
    return (
      <div className="rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 text-sm text-[var(--text-muted)]">
        Select a pollution hotspot from the map or ranking list to inspect simulated emission drivers and episode frequency.
      </div>
    );
  }

  const city = CITY_MAP[hotspot.cityId];
  const severityColor = AQI_COLORS[hotspot.severity];
  const severityTextClass = AQI_TEXT_CLASSES[hotspot.severity];

  return (
    <div className="rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-hairline)] pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span>{city.name}</span>
            <span aria-hidden="true">·</span>
            <span>{hotspot.wardOrZone}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">City Rank #{hotspot.rankInCity}</span>
          </div>
          <h3 className="mt-1.5 font-display text-xl sm:text-2xl font-medium text-[var(--text-primary)]">
            {hotspot.name}
          </h3>
        </div>

        <div className="text-right">
          <div className="inline-flex items-center gap-1.5 text-sm font-semibold">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: severityColor }}
              aria-hidden="true"
            />
            <span className={severityTextClass}>{hotspot.severity}</span>
          </div>
          <div className="mt-0.5 font-mono-tabular text-xs text-[var(--text-muted)]">
            Severity score {hotspot.severityScore}/100
          </div>
        </div>
      </div>

      {/* Key Hotspot Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <span className="block text-xs text-[var(--text-muted)]">Dominant Pollutant</span>
          <span className="mt-1 block font-mono-tabular text-lg font-semibold text-[var(--text-primary)]">
            {hotspot.dominantPollutant}
          </span>
        </div>
        <div>
          <span className="block text-xs text-[var(--text-muted)]">Simulated PM2.5</span>
          <span className="mt-1 block font-mono-tabular text-lg font-semibold text-[var(--text-primary)]">
            {hotspot.pm25Avg} <span className="text-xs font-normal text-[var(--text-muted)]">µg/m³</span>
          </span>
        </div>
        <div>
          <span className="block text-xs text-[var(--text-muted)]">Annual Episode Days</span>
          <span className="mt-1 block font-mono-tabular text-lg font-semibold text-[var(--text-primary)]">
            {hotspot.annualEpisodeDays} <span className="text-xs font-normal text-[var(--text-muted)]">days/yr</span>
          </span>
        </div>
        <div>
          <span className="block text-xs text-[var(--text-muted)]">Peak Window</span>
          <span className="mt-1 block font-mono-tabular text-sm font-semibold text-[var(--text-primary)]">
            {hotspot.peakWindow}
          </span>
        </div>
      </div>

      {/* Repeated Pollution Episode Frequency Chart */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-[var(--text-primary)]">
            6-Month Repeated Pollution Episode Frequency (Simulated)
          </h4>
          <span className="text-[11px] font-mono-tabular text-[var(--text-muted)]">
            Days exceeding Moderate threshold
          </span>
        </div>
        <div
          role="img"
          aria-label={`6-month episode frequency chart for ${hotspot.name}`}
          className="h-[180px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={hotspot.monthlyEpisodes}
              margin={{ top: 6, right: 8, left: -18, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border-hairline)"
              />
              <XAxis
                dataKey="month"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<EpisodeTooltip />} cursor={{ fill: 'var(--bg-subtle)', opacity: 0.45 }} />
              <Bar
                dataKey="episodes"
                fill={severityColor}
                radius={[4, 4, 0, 0]}
                maxBarSize={34}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Emission Drivers & Mitigation Context */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-[var(--border-hairline)] pt-5">
        <div>
          <h4 className="text-xs font-semibold text-[var(--text-primary)]">
            Primary Emission Drivers
          </h4>
          <ul className="mt-2 space-y-1.5 text-xs text-[var(--text-muted)]">
            {hotspot.primaryDrivers.map((driver) => (
              <li key={driver} className="flex items-start gap-2">
                <span aria-hidden="true">·</span>
                <span>{driver}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-[var(--text-primary)]">
            Urban Dispersion & Mitigation Note
          </h4>
          <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">
            {hotspot.mitigationBrief}
          </p>
        </div>
      </div>
    </div>
  );
}
