import { CityInfo, CityMeasurement } from '../types';
import {
  AQI_COLORS,
  AQI_TEXT_CLASSES,
  getCategoryRangeLabel,
  getHealthGuidance,
} from '../utils/aqi';

interface AQIOverviewProps {
  city: CityInfo;
  measurement: CityMeasurement;
}

const SCALE_SEGMENTS = [
  { label: 'Good', range: '0–50', color: '#54A875' },
  { label: 'Satisfactory', range: '51–100', color: '#A7BE57' },
  { label: 'Moderate', range: '101–200', color: '#E7B64F' },
  { label: 'Poor', range: '201–300', color: '#E58B45' },
  { label: 'Very Poor', range: '301–400', color: '#D65C50' },
  { label: 'Severe', range: '401–500', color: '#8F3440' },
];

export function AQIOverview({ city, measurement }: AQIOverviewProps) {
  const categoryColor = AQI_COLORS[measurement.category];
  const categoryTextClass = AQI_TEXT_CLASSES[measurement.category];
  const markerPositionPct = Math.min(98, Math.max(2, (measurement.aqi / 500) * 100));

  return (
    <section aria-label="Primary Air Quality Index Reading" className="py-2">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left: Calm Focal AQI Metric */}
        <div className="lg:col-span-5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-muted)]">
            <span className="font-medium text-[var(--text-primary)]">
              {city.name}, {city.state}
            </span>
            <span aria-hidden="true">·</span>
            <span>{city.regionLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{measurement.lastUpdated}</span>
          </div>

          <div className="mt-5 flex items-baseline gap-5">
            <span className="font-mono-tabular text-7xl sm:text-[84px] leading-none font-medium tracking-tight text-[var(--text-primary)]">
              {measurement.aqi}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-xs shrink-0"
                  style={{ backgroundColor: categoryColor }}
                  aria-hidden="true"
                />
                <span className={`text-xl sm:text-2xl font-semibold ${categoryTextClass}`}>
                  {measurement.category}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)] font-mono-tabular">
                {getCategoryRangeLabel(measurement.category)} · Dominant: {measurement.dominantPollutant}
              </p>
            </div>
          </div>

          {/* Crisp Hairline AQI Spectrum */}
          <div className="mt-7 max-w-md">
            <div className="relative h-1.5 w-full flex gap-0.5">
              {SCALE_SEGMENTS.map((seg) => (
                <div
                  key={seg.label}
                  className="h-full flex-1 opacity-90"
                  style={{ backgroundColor: seg.color }}
                  title={`${seg.label} (${seg.range})`}
                />
              ))}
              <div
                className="absolute -top-1.5 h-4 w-0.5 -translate-x-1/2 bg-[var(--text-primary)]"
                style={{ left: `${markerPositionPct}%` }}
                aria-hidden="true"
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] font-mono-tabular text-[var(--text-muted)]">
              <span>0</span>
              <span>100</span>
              <span>200</span>
              <span>300</span>
              <span>500</span>
            </div>
          </div>
        </div>

        {/* Right: Editorial Atmospheric Reading + Inline Weather Strip */}
        <div className="lg:col-span-7 lg:border-l lg:border-[var(--border-hairline)] lg:pl-10 space-y-6">
          <div>
            <p className="text-xs text-[var(--text-muted)]">
              {measurement.dataSource}
            </p>
            <h2 className="mt-2 font-display text-2xl sm:text-[27px] font-normal leading-snug text-[var(--text-primary)] text-balance">
              {measurement.interpretation}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)] max-w-2xl">
              {getHealthGuidance(measurement.category)}
            </p>
          </div>

          {/* Compact Inline Conditions Strip — avoids a separate heavy weather box */}
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-[var(--border-hairline)] pt-5 text-xs">
            <div>
              <dt className="text-[var(--text-muted)]">Temperature</dt>
              <dd className="mt-1 font-mono-tabular text-sm font-medium text-[var(--text-primary)]">
                {measurement.weather.temperatureC}°C{' '}
                <span className="text-[var(--text-muted)] font-normal">
                  ({measurement.weather.humidityPct}% RH)
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Surface Wind</dt>
              <dd className="mt-1 font-mono-tabular text-sm font-medium text-[var(--text-primary)]">
                {measurement.weather.windSpeedKmh} km/h {measurement.weather.windDirection}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Mixing Layer</dt>
              <dd className="mt-1 font-mono-tabular text-sm font-medium text-[var(--text-primary)]">
                {measurement.weather.boundaryLayerM} m
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Network Nodes</dt>
              <dd className="mt-1 font-mono-tabular text-sm font-medium text-[var(--text-primary)]">
                {measurement.activeStations}/{measurement.totalStations} online
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
