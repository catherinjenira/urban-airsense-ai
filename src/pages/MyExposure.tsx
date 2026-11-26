import { Plus } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ExposureChart, WeeklyExposureBar } from '../components/ExposureChart';
import { ExposureLogTable } from '../components/exposure/ExposureLogTable';
import { CITIES, CITY_MAP } from '../data/cities';
import {
  INITIAL_EXPOSURE_ENTRIES,
  WEEKLY_EXPOSURE_BASELINE,
} from '../data/hotspots';
import { CITY_MEASUREMENTS } from '../data/measurements';
import {
  createExposureLog,
  deleteExposureLog,
  fetchCityDatasetStats,
  fetchExposureLogs,
} from '../services/api';
import { CityId, ExposureActivityType, ExposureEntry } from '../types';

interface MyExposureProps {
  selectedCity: CityId;
}

const ACTIVITY_VENTILATION_FACTOR: Record<ExposureActivityType, number> = {
  Walking: 1.0,
  Jogging: 1.62,
  Cycling: 1.38,
  Commuting: 0.74,
};

const ACTIVITY_OPTIONS: ExposureActivityType[] = [
  'Walking',
  'Jogging',
  'Cycling',
  'Commuting',
];

export function MyExposure({ selectedCity }: MyExposureProps) {
  const [entries, setEntries] = useState<ExposureEntry[]>(INITIAL_EXPOSURE_ENTRIES);
  const [activity, setActivity] = useState<ExposureActivityType>('Walking');
  const [durationMinutes, setDurationMinutes] = useState<string>('30');
  const [entryCity, setEntryCity] = useState<CityId>(selectedCity);
  const [formError, setFormError] = useState<string | null>(null);
  const [lowerTab, setLowerTab] = useState<'log' | 'breakdown'>('log');
  const [sqlCityPm25, setSqlCityPm25] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchExposureLogs()
      .then((res) => {
        if (res.entries.length > 0) {
          const normalized = res.entries.map((item) => ({
            ...item,
            id: String(item.id),
          }));
          setEntries([...normalized, ...INITIAL_EXPOSURE_ENTRIES]);
        }
      })
      .catch(() => {});

    fetchCityDatasetStats()
      .then((res) => {
        const pmMap: Record<string, number> = {};
        res.cities.forEach((c) => {
          if (typeof c.avgPm25 === 'number') {
            pmMap[c.cityId] = c.avgPm25;
          }
        });
        setSqlCityPm25(pmMap);
      })
      .catch(() => {});
  }, []);

  const todayEntries = useMemo(
    () => entries.filter((e) => e.date.startsWith('Today')),
    [entries]
  );

  const dailyDoseUg = useMemo(
    () => todayEntries.reduce((sum, item) => sum + item.inhaledDoseUg, 0),
    [todayEntries]
  );

  const dailyMinutesOutdoors = useMemo(
    () => todayEntries.reduce((sum, item) => sum + item.durationMinutes, 0),
    [todayEntries]
  );

  const weeklyChartData: WeeklyExposureBar[] = useMemo(() => {
    return [
      ...WEEKLY_EXPOSURE_BASELINE,
      {
        day: 'Today',
        doseUg: Number(dailyDoseUg.toFixed(1)),
        outdoorHrs: Number((dailyMinutesOutdoors / 60).toFixed(2)),
        isToday: true,
      },
    ];
  }, [dailyDoseUg, dailyMinutesOutdoors]);

  const weeklyTotalDose = useMemo(
    () => weeklyChartData.reduce((sum, d) => sum + d.doseUg, 0),
    [weeklyChartData]
  );

  const activityBreakdown = useMemo(() => {
    const totals: Record<ExposureActivityType, { minutes: number; dose: number }> = {
      Walking: { minutes: 0, dose: 0 },
      Jogging: { minutes: 0, dose: 0 },
      Cycling: { minutes: 0, dose: 0 },
      Commuting: { minutes: 0, dose: 0 },
    };

    entries.forEach((e) => {
      totals[e.activity].minutes += e.durationMinutes;
      totals[e.activity].dose += e.inhaledDoseUg;
    });

    const grandDose = Object.values(totals).reduce((s, t) => s + t.dose, 0);

    return ACTIVITY_OPTIONS.map((act) => ({
      activity: act,
      minutes: totals[act].minutes,
      dose: totals[act].dose,
      sharePct: grandDose > 0 ? Math.round((totals[act].dose / grandDose) * 100) : 0,
    }));
  }, [entries]);

  const handleAddEntry = async (e: FormEvent) => {
    e.preventDefault();
    const mins = Number(durationMinutes);
    if (!Number.isFinite(mins) || mins < 5 || mins > 480) {
      setFormError('Enter a duration between 5 and 480 minutes.');
      return;
    }
    setFormError(null);

    const cityPm25 =
      sqlCityPm25[entryCity] ??
      CITY_MEASUREMENTS[entryCity].pollutants.find((p) => p.key === 'PM2.5')
        ?.value ??
      35;
    const factor = ACTIVITY_VENTILATION_FACTOR[activity];
    const doseUg = Number((cityPm25 * (mins / 60) * factor * 1.15).toFixed(1));

    const now = new Date();
    const timeLabel = now.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const entryDate = `Today · ${timeLabel}`;

    try {
      const res = await createExposureLog({
        entryDate,
        cityId: entryCity,
        activity,
        durationMinutes: Math.round(mins),
        estimatedPm25: cityPm25,
        inhaledDoseUg: doseUg,
      });
      setEntries((prev) => [res.entry, ...prev]);
    } catch {
      const fallbackEntry: ExposureEntry = {
        id: `exp-${Date.now()}`,
        date: entryDate,
        cityId: entryCity,
        activity,
        durationMinutes: Math.round(mins),
        estimatedPm25: cityPm25,
        inhaledDoseUg: doseUg,
      };
      setEntries((prev) => [fallbackEntry, ...prev]);
    }
    setLowerTab('log');
  };

  const handleDeleteEntry = async (id: string) => {
    setEntries((prev) => prev.filter((item) => item.id !== id));
    if (/^\d+$/.test(id)) {
      deleteExposureLog(id).catch(() => {});
    }
  };

  const activeCityMeasurement = CITY_MEASUREMENTS[selectedCity];
  const personalRecommendations = useMemo(() => {
    const recs: string[] = [];
    if (dailyDoseUg > 110) {
      recs.push(
        'Today’s simulated intake exceeds the 110 µg illustrative benchmark. Consider shifting vigorous outdoor workouts indoors.'
      );
    } else {
      recs.push(
        'Today’s simulated outdoor intake remains within the illustrative daily advisory range.'
      );
    }
    if (activeCityMeasurement.aqi > 150) {
      recs.push(
        `${CITY_MAP[selectedCity].name} is currently in the ${activeCityMeasurement.category} range—limit prolonged roadside exertion and prefer tree-lined residential lanes.`
      );
    } else {
      recs.push(
        `In ${CITY_MAP[selectedCity].name}, early morning or post-breeze afternoon windows generally offer cleaner dispersion for outdoor exercise.`
      );
    }
    return recs;
  }, [dailyDoseUg, activeCityMeasurement, selectedCity]);

  return (
    <div className="space-y-8">
      {/* Header & Non-Medical Disclaimer */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 border-b border-[var(--border-hairline)] pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-normal tracking-tight text-[var(--text-primary)]">
            My Exposure
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[var(--text-muted)]">
            Illustrative PM2.5 inhalation estimates from simulated local data — not medical measurements or diagnoses.
          </p>
        </div>

        <div className="flex items-baseline gap-6 text-xs">
          <div>
            <span className="text-[var(--text-muted)] block">Today&apos;s Dose</span>
            <span className="font-mono-tabular text-lg font-semibold text-[var(--text-primary)]">
              {dailyDoseUg.toFixed(1)} µg
            </span>
          </div>
          <div className="border-l border-[var(--border-hairline)] pl-6">
            <span className="text-[var(--text-muted)] block">Outdoors Today</span>
            <span className="font-mono-tabular text-lg font-semibold text-[var(--text-primary)]">
              {(dailyMinutesOutdoors / 60).toFixed(1)} hrs
            </span>
          </div>
          <div className="border-l border-[var(--border-hairline)] pl-6 hidden sm:block">
            <span className="text-[var(--text-muted)] block">7-Day Total</span>
            <span className="font-mono-tabular text-lg font-semibold text-[var(--text-primary)]">
              {weeklyTotalDose.toFixed(0)} µg
            </span>
          </div>
        </div>
      </div>

      {/* Main Split: Activity Form + Weekly Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        <form
          onSubmit={handleAddEntry}
          className="lg:col-span-4 rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-4"
        >
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Log Outdoor Activity
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Recalculates daily and 7-day simulated exposure immediately.
            </p>
          </div>

          <div
            role="group"
            aria-label="Outdoor activity type"
            className="grid grid-cols-2 gap-1.5"
          >
            {ACTIVITY_OPTIONS.map((act) => (
              <button
                key={act}
                type="button"
                aria-pressed={activity === act}
                onClick={() => setActivity(act)}
                className={`rounded-sm border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#245C45] ${
                  activity === act
                    ? 'border-[#245C45] bg-[#245C45] text-white'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
                }`}
              >
                {act}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="exp-duration"
                className="block text-xs text-[var(--text-muted)] mb-1"
              >
                Duration (min)
              </label>
              <input
                id="exp-duration"
                type="number"
                min={5}
                max={480}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="w-full rounded-sm border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-1.5 font-mono-tabular text-sm text-[var(--text-primary)] focus:outline-2 focus:outline-[#245C45]"
              />
            </div>

            <div>
              <label
                htmlFor="exp-city"
                className="block text-xs text-[var(--text-muted)] mb-1"
              >
                City
              </label>
              <select
                id="exp-city"
                value={entryCity}
                onChange={(e) => setEntryCity(e.target.value as CityId)}
                className="w-full rounded-sm border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 py-1.5 text-sm text-[var(--text-primary)] focus:outline-2 focus:outline-[#245C45]"
              >
                {CITIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {formError && (
            <p role="alert" className="text-xs font-medium text-[#D65C50]">
              {formError}
            </p>
          )}

          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-sm bg-[#245C45] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#173D30] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245C45]"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add exposure record
          </button>
        </form>

        <div className="lg:col-span-8">
          <ExposureChart data={weeklyChartData} />
        </div>
      </div>

      {/* Focused Lower Section: Activity Log OR Breakdown & Guidance */}
      <div className="border-t border-[var(--border-hairline)] pt-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div
            role="tablist"
            aria-label="Exposure details"
            className="inline-flex items-center gap-6 border-b border-[var(--border-hairline)]"
          >
            <button
              id="exp-tab-log"
              type="button"
              role="tab"
              aria-selected={lowerTab === 'log'}
              aria-controls="exp-panel-log"
              onClick={() => setLowerTab('log')}
              className={`pb-2.5 text-sm font-medium transition-colors relative focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245C45] ${
                lowerTab === 'log'
                  ? 'text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Activity Log ({entries.length})
              {lowerTab === 'log' && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#245C45] dark:bg-[#A7B9A1]" />
              )}
            </button>
            <button
              id="exp-tab-breakdown"
              type="button"
              role="tab"
              aria-selected={lowerTab === 'breakdown'}
              aria-controls="exp-panel-breakdown"
              onClick={() => setLowerTab('breakdown')}
              className={`pb-2.5 text-sm font-medium transition-colors relative focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245C45] ${
                lowerTab === 'breakdown'
                  ? 'text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Activity Breakdown &amp; Guidance
              {lowerTab === 'breakdown' && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#245C45] dark:bg-[#A7B9A1]" />
              )}
            </button>
          </div>

          {lowerTab === 'log' && entries.length > 0 && (
            <button
              type="button"
              onClick={() => setEntries(INITIAL_EXPOSURE_ENTRIES)}
              className="text-xs font-medium text-[#245C45] dark:text-[#A7B9A1] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245C45]"
            >
              Reset sample log
            </button>
          )}
        </div>

        {lowerTab === 'log' ? (
          <div id="exp-panel-log" role="tabpanel" aria-labelledby="exp-tab-log">
            <ExposureLogTable entries={entries} onDeleteEntry={handleDeleteEntry} />
          </div>
        ) : (
          <div
            id="exp-panel-breakdown"
            role="tabpanel"
            aria-labelledby="exp-tab-breakdown"
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
          >
            <div className="lg:col-span-7 space-y-4">
              {activityBreakdown.map((item) => (
                <div key={item.activity}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-[var(--text-primary)]">
                      {item.activity}
                    </span>
                    <span className="font-mono-tabular text-[var(--text-muted)]">
                      {item.minutes} min · {item.dose.toFixed(1)} µg ({item.sharePct}%)
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`${item.activity} share of exposure`}
                    aria-valuenow={item.sharePct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-1.5 w-full bg-[var(--bg-subtle)] overflow-hidden rounded-xs"
                  >
                    <div
                      className="h-full bg-[#245C45] dark:bg-[#A7B9A1] transition-all duration-300"
                      style={{ width: `${item.sharePct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="lg:col-span-5 lg:border-l lg:border-[var(--border-hairline)] lg:pl-8 space-y-2.5">
              <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                Personal Guidance
              </h3>
              <ul className="space-y-2.5 text-xs leading-relaxed text-[var(--text-muted)]">
                {personalRecommendations.map((rec) => (
                  <li key={rec} className="flex items-start gap-2">
                    <span className="text-[#245C45] dark:text-[#A7B9A1]" aria-hidden="true">
                      ·
                    </span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
