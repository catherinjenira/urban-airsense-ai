import { Trash2 } from 'lucide-react';
import { CITY_MAP } from '../../data/cities';
import { ExposureEntry } from '../../types';

interface ExposureLogTableProps {
  entries: ExposureEntry[];
  onDeleteEntry: (id: string) => void;
}

export function ExposureLogTable({ entries, onDeleteEntry }: ExposureLogTableProps) {
  if (entries.length === 0) {
    return (
      <div className="border border-dashed border-[var(--border-hairline)] rounded-md py-10 px-4 text-center">
        <p className="text-sm font-medium text-[var(--text-primary)]">
          No activities logged yet
        </p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Add a session above to see updated daily and weekly exposure estimates.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-[var(--border-hairline)] text-[var(--text-muted)]">
            <th scope="col" className="py-2.5 pr-3 font-medium">When</th>
            <th scope="col" className="py-2.5 px-3 font-medium">Activity</th>
            <th scope="col" className="py-2.5 px-3 font-medium">City</th>
            <th scope="col" className="py-2.5 px-3 font-medium text-right">Duration</th>
            <th scope="col" className="py-2.5 px-3 font-medium text-right">Est. PM2.5</th>
            <th scope="col" className="py-2.5 px-3 font-medium text-right">Dose</th>
            <th scope="col" className="py-2.5 pl-2 font-medium text-right">Remove</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-hairline)]">
          {entries.map((entry) => (
            <tr key={entry.id} className="hover:bg-[var(--bg-subtle)]/35">
              <td className="py-2.5 pr-3 font-mono-tabular text-[var(--text-muted)] whitespace-nowrap">
                {entry.date}
              </td>
              <td className="py-2.5 px-3 font-medium text-[var(--text-primary)]">
                {entry.activity}
              </td>
              <td className="py-2.5 px-3 text-[var(--text-muted)]">
                {CITY_MAP[entry.cityId].name}
              </td>
              <td className="py-2.5 px-3 text-right font-mono-tabular text-[var(--text-primary)]">
                {entry.durationMinutes} min
              </td>
              <td className="py-2.5 px-3 text-right font-mono-tabular text-[var(--text-muted)]">
                {entry.estimatedPm25} µg/m³
              </td>
              <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold text-[var(--text-primary)]">
                {entry.inhaledDoseUg.toFixed(1)} µg
              </td>
              <td className="py-2.5 pl-2 text-right">
                <button
                  type="button"
                  onClick={() => onDeleteEntry(entry.id)}
                  aria-label={`Remove ${entry.activity} record from ${entry.date}`}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[#D65C50] transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#245C45]"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
