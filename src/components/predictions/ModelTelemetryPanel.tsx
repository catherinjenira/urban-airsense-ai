import { Database } from 'lucide-react';
import { ModelInfo } from '../../types';

interface ModelTelemetryPanelProps {
  modelInfo: ModelInfo;
}

export function ModelTelemetryPanel({ modelInfo }: ModelTelemetryPanelProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <div className="lg:col-span-6 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          Model Evaluation on CPCB Dataset (80/20 Holdout + 5-Fold CV)
        </h3>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
          <div>
            <dt className="text-[11px] text-[var(--text-muted)]">Test R²</dt>
            <dd className="mt-1 font-mono-tabular text-xl font-medium text-[var(--text-primary)]">
              {modelInfo.aqiMetrics.r2}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-[var(--text-muted)]">5-Fold CV R²</dt>
            <dd className="mt-1 font-mono-tabular text-xl font-medium text-[var(--text-primary)]">
              {modelInfo.aqiMetrics.cvR2Mean}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-[var(--text-muted)]">Test MAE</dt>
            <dd className="mt-1 font-mono-tabular text-xl font-medium text-[var(--text-primary)]">
              {modelInfo.aqiMetrics.mae}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-[var(--text-muted)]">Classifier Acc.</dt>
            <dd className="mt-1 font-mono-tabular text-xl font-medium text-[#245C45] dark:text-[#66BA86]">
              {(modelInfo.aqiMetrics.classifierAccuracy * 100).toFixed(1)}%
            </dd>
          </div>
        </dl>

        <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 text-xs text-[var(--text-muted)] space-y-1.5">
          <div className="flex items-center gap-2 font-medium text-[var(--text-primary)]">
            <Database className="h-3.5 w-3.5 text-[#245C45] dark:text-[#66BA86]" aria-hidden="true" />
            <span>SQL Dataset &amp; Co-Pollutant PM2.5 Model</span>
          </div>
          <p>
            {modelInfo.databaseStats.observationRows.toLocaleString()} raw
            pollutant rows · {modelInfo.dataset.totalStations} stations ·{' '}
            {modelInfo.dataset.citiesCount} cities ·{' '}
            {modelInfo.databaseStats.predictionLogsCount} predictions logged.
          </p>
          <p>
            Co-pollutant Random Forest PM2.5 estimator: R²{' '}
            <span className="font-mono-tabular text-[var(--text-primary)]">
              {modelInfo.pm25Metrics.r2}
            </span>{' '}
            · MAE{' '}
            <span className="font-mono-tabular text-[var(--text-primary)]">
              {modelInfo.pm25Metrics.mae}
            </span>
          </p>
        </div>
      </div>

      <div className="lg:col-span-6 space-y-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          Co-Pollutant PM2.5 Feature Importances (Gini Importance)
        </h3>
        <div className="space-y-2.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
          {modelInfo.pm25FeatureImportances.map((item) => {
            const pct = Math.round(item.importance * 1000) / 10;
            return (
              <div key={item.feature} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-primary)]">{item.label}</span>
                  <span className="font-mono-tabular text-[var(--text-muted)]">
                    {pct}%
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={`${item.label} importance`}
                  aria-valuenow={Math.round(pct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-1.5 w-full rounded-full bg-[var(--bg-subtle)] overflow-hidden"
                >
                  <div
                    className="h-full rounded-full bg-[#245C45] dark:bg-[#66BA86]"
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
