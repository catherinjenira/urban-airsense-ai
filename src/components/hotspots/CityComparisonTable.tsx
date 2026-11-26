import { CityId, CityInfo, PollutionHotspot } from '../../types';
import { AQI_COLORS } from '../../utils/aqi';

export interface CityComparisonRow {
  city: CityInfo;
  hotspotCount: number;
  peakHotspot: PollutionHotspot;
  avgEpisodeDays: number;
}

interface CityComparisonTableProps {
  rows: CityComparisonRow[];
  selectedCity: CityId;
  onSelectCityRow: (cityId: CityId) => void;
}

export function CityComparisonTable({
  rows,
  selectedCity,
  onSelectCityRow,
}: CityComparisonTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-[var(--border-hairline)] text-[var(--text-muted)]">
            <th scope="col" className="py-2.5 pr-4 font-medium">City</th>
            <th scope="col" className="py-2.5 px-3 font-medium">Primary Hotspot Zone</th>
            <th scope="col" className="py-2.5 px-3 font-medium">Driver</th>
            <th scope="col" className="py-2.5 px-3 font-medium text-right">Peak Severity</th>
            <th scope="col" className="py-2.5 px-3 font-medium text-right">Avg Episodes</th>
            <th scope="col" className="py-2.5 pl-3 font-medium text-right">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-hairline)]">
          {rows.map((row) => {
            const isCurrent = row.city.id === selectedCity;
            return (
              <tr
                key={row.city.id}
                className={`transition-colors ${
                  isCurrent
                    ? 'bg-[#245C45]/8 dark:bg-[#A7B9A1]/10'
                    : 'hover:bg-[var(--bg-subtle)]/40'
                }`}
              >
                <td className="py-3 pr-4 font-semibold text-[var(--text-primary)]">
                  <button
                    type="button"
                    onClick={() => onSelectCityRow(row.city.id)}
                    className="text-left hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245C45]"
                  >
                    {row.city.name}
                  </button>
                </td>
                <td className="py-3 px-3 text-[var(--text-muted)]">
                  {row.peakHotspot.name}
                </td>
                <td className="py-3 px-3 font-mono-tabular text-[var(--text-primary)]">
                  {row.peakHotspot.dominantPollutant}
                </td>
                <td className="py-3 px-3 text-right font-mono-tabular font-semibold text-[var(--text-primary)]">
                  {row.peakHotspot.severityScore}/100
                </td>
                <td className="py-3 px-3 text-right font-mono-tabular text-[var(--text-muted)]">
                  {row.avgEpisodeDays} days/yr
                </td>
                <td className="py-3 pl-3 text-right">
                  <span className="inline-flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
                    <span
                      className="h-2 w-2 rounded-xs"
                      aria-hidden="true"
                      style={{
                        backgroundColor: AQI_COLORS[row.peakHotspot.severity],
                      }}
                    />
                    {row.peakHotspot.severity}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
