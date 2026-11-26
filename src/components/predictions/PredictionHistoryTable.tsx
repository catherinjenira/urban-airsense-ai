import { History } from 'lucide-react';
import { PredictionLogEntry } from '../../types';
import { AQI_TEXT_CLASSES } from '../../utils/aqi';

interface PredictionHistoryTableProps {
  history: PredictionLogEntry[];
}

export function PredictionHistoryTable({ history }: PredictionHistoryTableProps) {
  return (
    <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-x-auto">
      {history.length === 0 ? (
        <div className="p-8 text-center text-xs text-[var(--text-muted)]">
          <History className="h-6 w-6 mx-auto mb-2 opacity-60" aria-hidden="true" />
          No predictions saved yet. Run the Random Forest model above to persist
          your first prediction in SQL.
        </div>
      ) : (
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-[var(--border-hairline)] text-[var(--text-muted)]">
              <th scope="col" className="py-2.5 px-4 font-medium">
                City / Station
              </th>
              <th scope="col" className="py-2.5 px-3 font-medium text-right">
                PM2.5
              </th>
              <th scope="col" className="py-2.5 px-3 font-medium text-right">
                PM10
              </th>
              <th scope="col" className="py-2.5 px-3 font-medium text-right">
                Predicted AQI
              </th>
              <th scope="col" className="py-2.5 px-3 font-medium">
                Category
              </th>
              <th scope="col" className="py-2.5 px-3 font-medium text-right">
                Confidence
              </th>
              <th scope="col" className="py-2.5 px-4 font-medium text-right">
                Timestamp
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-hairline)]">
            {history.map((row) => (
              <tr key={row.id}>
                <td className="py-2.5 px-4">
                  <div className="font-medium text-[var(--text-primary)]">
                    {row.city}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] truncate max-w-[260px]">
                    {row.station || 'Custom coordinates'}
                  </div>
                </td>
                <td className="py-2.5 px-3 text-right font-mono-tabular text-[var(--text-primary)]">
                  {row.pm25}
                </td>
                <td className="py-2.5 px-3 text-right font-mono-tabular text-[var(--text-muted)]">
                  {row.pm10}
                </td>
                <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold text-[var(--text-primary)]">
                  {Math.round(row.predictedAqi)}
                </td>
                <td className="py-2.5 px-3">
                  <span
                    className={
                      AQI_TEXT_CLASSES[row.predictedCategory] ??
                      'text-[var(--text-primary)]'
                    }
                  >
                    {row.predictedCategory}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right font-mono-tabular text-[var(--text-muted)]">
                  {row.confidencePct}%
                </td>
                <td className="py-2.5 px-4 text-right font-mono-tabular text-[var(--text-muted)]">
                  {new Date(row.createdAt).toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
