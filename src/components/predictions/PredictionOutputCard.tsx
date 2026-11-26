import { Activity, CheckCircle2 } from 'lucide-react';
import { AQICategory, PredictionResult } from '../../types';
import { AQI_COLORS, AQI_TEXT_CLASSES } from '../../utils/aqi';

interface PredictionOutputCardProps {
  prediction: PredictionResult | null;
}

export function PredictionOutputCard({ prediction }: PredictionOutputCardProps) {
  return (
    <section
      aria-label="Random Forest prediction result"
      aria-live="polite"
      className="lg:col-span-5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6 space-y-5"
    >
      <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            2. Random Forest Output
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            Tree-ensemble inference saved to SQL
          </p>
        </div>
        {prediction && (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono-tabular text-[#245C45] dark:text-[#66BA86]">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Log #{prediction.logId}
          </span>
        )}
      </div>

      {!prediction ? (
        <div className="py-10 text-center space-y-2">
          <Activity
            className="h-8 w-8 mx-auto text-[var(--text-muted)]/60"
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-[var(--text-primary)]">
            Ready for Random Forest inference
          </p>
          <p className="text-xs text-[var(--text-muted)] max-w-xs mx-auto leading-relaxed">
            Click &ldquo;Run Random Forest Prediction&rdquo; to evaluate the
            250-tree regressor &amp; classifier and store the result in SQL.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <div className="text-xs text-[var(--text-muted)]">
                Predicted AQI
              </div>
              <div className="mt-1 flex items-baseline gap-2.5">
                <span className="font-mono-tabular text-4xl font-medium text-[var(--text-primary)]">
                  {Math.round(prediction.predictedAqi)}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                  <span
                    className="h-2.5 w-2.5 rounded-xs"
                    aria-hidden="true"
                    style={{
                      backgroundColor:
                        AQI_COLORS[prediction.predictedCategory as AQICategory] ??
                        '#E7B64F',
                    }}
                  />
                  <span
                    className={
                      AQI_TEXT_CLASSES[
                        prediction.predictedCategory as AQICategory
                      ] ?? 'text-[var(--text-primary)]'
                    }
                  >
                    {prediction.predictedCategory}
                  </span>
                </span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-[var(--text-muted)]">
                Ensemble Confidence
              </div>
              <div className="mt-1 font-mono-tabular text-2xl font-medium text-[#245C45] dark:text-[#66BA86]">
                {prediction.confidencePct}%
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3 text-xs">
            <div>
              <span className="block text-[var(--text-muted)]">
                90% Tree Interval
              </span>
              <span className="mt-0.5 block font-mono-tabular font-medium text-[var(--text-primary)]">
                {Math.round(prediction.intervalLow)} –{' '}
                {Math.round(prediction.intervalHigh)} AQI
              </span>
            </div>
            <div>
              <span className="block text-[var(--text-muted)]">
                RF PM2.5 Estimate
              </span>
              <span className="mt-0.5 block font-mono-tabular font-medium text-[var(--text-primary)]">
                {prediction.estimatedPm25FromCoPollutants}{' '}
                {prediction.pm25WasEstimated ? '(used)' : '(co-pollutant)'}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-[var(--text-primary)]">
              Classifier Category Probabilities
            </div>
            <div className="space-y-1.5">
              {Object.entries(prediction.categoryProbabilities)
                .slice(0, 4)
                .map(([cat, pct]) => (
                  <div key={cat} className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-[var(--text-muted)]">{cat}</span>
                      <span className="font-mono-tabular text-[var(--text-primary)]">
                        {pct}%
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={`${cat} probability`}
                      aria-valuenow={Math.round(pct)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="h-1.5 w-full rounded-full bg-[var(--bg-subtle)] overflow-hidden"
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, pct)}%`,
                          backgroundColor:
                            AQI_COLORS[cat as AQICategory] ?? '#245C45',
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <p className="text-xs leading-relaxed text-[var(--text-muted)] border-t border-[var(--border-hairline)] pt-3">
            {prediction.healthGuidance}
          </p>
        </div>
      )}
    </section>
  );
}
