import { PollutantReading } from '../types';
import { AQI_COLORS } from '../utils/aqi';

interface PollutantGridProps {
  pollutants: PollutantReading[];
}

export function PollutantGrid({ pollutants }: PollutantGridProps) {
  return (
    <section aria-label="Measured Pollutant Concentrations">
      <div className="flex items-baseline justify-between gap-2 pb-3 border-b border-[var(--border-hairline)]">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          Criteria Pollutants
        </h2>
        <span className="text-xs text-[var(--text-muted)]">
          Simulated rolling averages · NAAQS share
        </span>
      </div>

      <div className="divide-y divide-[var(--border-hairline)]">
        {pollutants.map((item) => {
          const ratio = Math.min(100, Math.round((item.value / item.guidelineLimit) * 100));
          const color = AQI_COLORS[item.category];
          return (
            <div
              key={item.key}
              className="py-3.5 grid grid-cols-12 items-center gap-3 transition-colors hover:bg-[var(--bg-subtle)]/35 px-1"
            >
              <div className="col-span-5 sm:col-span-5 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-xs shrink-0"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  <span className="font-mono-tabular text-sm font-semibold text-[var(--text-primary)]">
                    {item.formula}
                  </span>
                </div>
                <span className="block text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                  {item.label}
                </span>
              </div>

              <div className="col-span-4 sm:col-span-4">
                <div
                  role="progressbar"
                  aria-label={`${item.label} concentration relative to NAAQS limit`}
                  aria-valuenow={ratio}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-1.5 w-full bg-[var(--bg-subtle)] overflow-hidden rounded-xs"
                >
                  <div
                    className="h-full transition-all duration-300"
                    style={{ width: `${ratio}%`, backgroundColor: color }}
                  />
                </div>
                <span className="mt-1 block text-[10px] font-mono-tabular text-[var(--text-muted)]">
                  {ratio}% of {item.guidelineLimit} {item.unit}
                </span>
              </div>

              <div className="col-span-3 sm:col-span-3 text-right">
                <span className="font-mono-tabular text-base font-semibold text-[var(--text-primary)]">
                  {item.value}
                </span>
                <span className="ml-1 font-mono-tabular text-[11px] text-[var(--text-muted)]">
                  {item.unit}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
