import { Database, Sparkles } from 'lucide-react';
import { ModelInfo } from '../../types';

interface AuthHeroPanelProps {
  modelInfo: ModelInfo | null;
}

export function AuthHeroPanel({ modelInfo }: AuthHeroPanelProps) {
  return (
    <section aria-label="Platform capabilities" className="lg:col-span-6 space-y-6">
      <div>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#245C45] dark:text-[#66BA86]">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          CPCB Air Quality Intelligence Platform
        </span>
        <h1 className="mt-3 font-display text-3xl sm:text-[42px] leading-[1.12] font-normal tracking-tight text-[var(--text-primary)]">
          Real-time AQI modeling powered by Random Forest.
        </h1>
        <p className="mt-3 text-sm sm:text-base leading-relaxed text-[var(--text-muted)]">
          Sign in or create an account stored in our SQL backend to run live
          Random Forest AQI &amp; PM2.5 predictions across Indian monitoring
          stations, track exposure logs, and review saved model runs.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 border-t border-[var(--border-hairline)] pt-6">
        <div>
          <div className="font-mono-tabular text-2xl font-medium text-[var(--text-primary)]">
            {modelInfo ? modelInfo.dataset.totalStations : 570}
          </div>
          <div className="mt-0.5 text-xs text-[var(--text-muted)]">
            Stations in SQL
          </div>
        </div>
        <div>
          <div className="font-mono-tabular text-2xl font-medium text-[var(--text-primary)]">
            {modelInfo ? modelInfo.dataset.citiesCount : 292}
          </div>
          <div className="mt-0.5 text-xs text-[var(--text-muted)]">
            Indian Cities
          </div>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <div className="font-mono-tabular text-2xl font-medium text-[#245C45] dark:text-[#66BA86]">
            {modelInfo
              ? `${Math.round(modelInfo.aqiMetrics.r2 * 1000) / 10}%`
              : '97.9%'}
          </div>
          <div className="mt-0.5 text-xs text-[var(--text-muted)]">
            RF Regressor R²
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 text-xs text-[var(--text-muted)] space-y-1.5">
        <div className="flex items-center gap-2 font-medium text-[var(--text-primary)]">
          <Database
            className="h-3.5 w-3.5 text-[#245C45] dark:text-[#66BA86]"
            aria-hidden="true"
          />
          <span>SQL Backend &amp; Trained Ensemble</span>
        </div>
        <p className="leading-relaxed">
          {modelInfo
            ? `${modelInfo.algorithm} (${modelInfo.modelVersion}) trained on ${modelInfo.dataset.labeledStations} labeled stations · Classifier accuracy ${(modelInfo.aqiMetrics.classifierAccuracy * 100).toFixed(1)}% · MAE ${modelInfo.aqiMetrics.mae} AQI.`
            : '250-tree Random Forest Regressor & Classifier trained on CPCB multi-pollutant station observations stored in SQL.'}
        </p>
      </div>
    </section>
  );
}
