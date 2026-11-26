import { ArrowRight, Trees } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AQIOverview } from '../components/AQIOverview';
import { CitySelector } from '../components/CitySelector';
import { PollutantGrid } from '../components/PollutantGrid';
import { TrendChart } from '../components/TrendChart';
import { CITY_MAP } from '../data/cities';
import { CITY_MEASUREMENTS } from '../data/measurements';
import { MONITORING_STATIONS } from '../data/stations';
import { fetchCityDatasetStats } from '../services/api';
import { CityAlert, CityDatasetStat, CityId, PageId } from '../types';
import { AQI_COLORS } from '../utils/aqi';

interface OverviewProps {
  selectedCity: CityId;
  onSelectCity: (city: CityId) => void;
  onNavigate: (page: PageId) => void;
  alerts: CityAlert[];
}

type OverviewTab = 'pollutants' | 'stations';

export function Overview({
  selectedCity,
  onSelectCity,
  onNavigate,
  alerts,
}: OverviewProps) {
  const [now, setNow] = useState(() => new Date());
  const [activeTab, setActiveTab] = useState<OverviewTab>('pollutants');
  const [cityStats, setCityStats] = useState<Record<string, CityDatasetStat>>({});

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchCityDatasetStats()
      .then((res) => {
        const mapped: Record<string, CityDatasetStat> = {};
        res.cities.forEach((c) => {
          mapped[c.cityId] = c;
        });
        setCityStats(mapped);
      })
      .catch(() => {});
  }, []);

  const city = CITY_MAP[selectedCity];
  const activeDatasetStat = cityStats[selectedCity];
  const measurement = CITY_MEASUREMENTS[selectedCity];
  const stations = MONITORING_STATIONS.filter((s) => s.cityId === selectedCity);
  const cityAlerts = alerts.filter((a) => a.cityId === selectedCity);

  const formattedDate = now.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div className="space-y-9">
      {/* Calm Editorial Masthead */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 border-b border-[var(--border-hairline)] pb-6">
        <div>
          <h1 className="font-display text-3xl sm:text-[38px] leading-tight font-normal tracking-tight text-[var(--text-primary)] text-balance">
            Understand the air around you.
          </h1>
          <p className="mt-1.5 text-sm sm:text-base text-[var(--text-muted)]">
            Environmental intelligence for the cities we live in.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 sm:gap-5">
          <CitySelector
            selectedCity={selectedCity}
            onSelectCity={onSelectCity}
          />
          <div className="border-l border-[var(--border-hairline)] pl-4 text-xs">
            <span className="block font-mono-tabular font-medium text-[var(--text-primary)]">
              {formattedTime}
            </span>
            <span className="block text-[var(--text-muted)]">
              {formattedDate}
            </span>
          </div>
        </div>
      </div>

      {/* Primary Focal AQI Stage + Inline Conditions */}
      <AQIOverview city={city} measurement={measurement} />

      {/* Live SQL Dataset & Random Forest Benchmark */}
      {activeDatasetStat && (
        <section className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#245C45]/10 text-[#245C45] dark:bg-[#66BA86]/15 dark:text-[#66BA86]">
              <Trees className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <div className="text-xs font-semibold text-[var(--text-primary)]">
                MySQL Dataset &amp; Random Forest City Benchmark — {city.name}
              </div>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                Across{' '}
                <span className="font-mono-tabular font-medium text-[var(--text-primary)]">
                  {activeDatasetStat.stationCount}
                </span>{' '}
                CPCB dataset stations in SQL: avg observed AQI{' '}
                <span className="font-mono-tabular font-medium text-[var(--text-primary)]">
                  {Math.round(activeDatasetStat.avgActualAqi)}
                </span>{' '}
                · Random Forest predicted AQI{' '}
                <span className="font-mono-tabular font-semibold text-[#245C45] dark:text-[#66BA86]">
                  {Math.round(activeDatasetStat.rfPredictedAqi)} (
                  {activeDatasetStat.rfCategory})
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('predictions')}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#245C45] hover:bg-[#173D30] px-3.5 py-2 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0"
          >
            <span>Use Random Forest Model</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </section>
      )}

      {/* Focused Sub-View Switcher (keeps page calm & uncluttered) */}
      <div className="border-t border-[var(--border-hairline)] pt-7">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div
            role="tablist"
            aria-label="Overview detail views"
            className="inline-flex items-center gap-6 border-b border-[var(--border-hairline)]"
          >
            <button
              id="overview-tab-pollutants"
              type="button"
              role="tab"
              aria-selected={activeTab === 'pollutants'}
              aria-controls="overview-panel-pollutants"
              onClick={() => setActiveTab('pollutants')}
              className={`pb-2.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 relative focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245C45] ${
                activeTab === 'pollutants'
                  ? 'text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Pollutants &amp; 24h Trend
              {activeTab === 'pollutants' && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#245C45] dark:bg-[#A7B9A1]" />
              )}
            </button>
            <button
              id="overview-tab-stations"
              type="button"
              role="tab"
              aria-selected={activeTab === 'stations'}
              aria-controls="overview-panel-stations"
              onClick={() => setActiveTab('stations')}
              className={`pb-2.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 relative focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245C45] ${
                activeTab === 'stations'
                  ? 'text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Stations, Brief &amp; Advisories
              {activeTab === 'stations' && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#245C45] dark:bg-[#A7B9A1]" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-5 text-xs">
            <button
              type="button"
              onClick={() => onNavigate('explore-map')}
              className="inline-flex items-center gap-1 font-medium text-[#245C45] dark:text-[#A7B9A1] hover:underline whitespace-nowrap shrink-0"
            >
              Open map
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('predictions')}
              className="inline-flex items-center gap-1 font-medium text-[#245C45] dark:text-[#A7B9A1] hover:underline whitespace-nowrap shrink-0"
            >
              View forecast
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {activeTab === 'pollutants' ? (
          <div
            id="overview-panel-pollutants"
            role="tabpanel"
            aria-labelledby="overview-tab-pollutants"
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
          >
            <div className="lg:col-span-5">
              <PollutantGrid pollutants={measurement.pollutants} />
            </div>
            <div className="lg:col-span-7">
              <TrendChart
                hourly24h={measurement.hourlyTrend24h}
                daily7d={measurement.dailyTrend7d}
                cityName={city.name}
              />
            </div>
          </div>
        ) : (
          <div
            id="overview-panel-stations"
            role="tabpanel"
            aria-labelledby="overview-tab-stations"
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
          >
            {/* Station Table */}
            <div className="lg:col-span-7">
              <div className="flex items-baseline justify-between pb-3 border-b border-[var(--border-hairline)]">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  Monitoring Nodes — {city.name}
                </h2>
                <span className="text-xs text-[var(--text-muted)]">
                  {measurement.activeStations} of {measurement.totalStations} active (simulated)
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-hairline)] text-[var(--text-muted)]">
                      <th scope="col" className="py-2.5 pr-4 font-medium">Station</th>
                      <th scope="col" className="py-2.5 px-3 font-medium">Zone</th>
                      <th scope="col" className="py-2.5 px-3 font-medium text-right">AQI</th>
                      <th scope="col" className="py-2.5 px-3 font-medium text-right">PM2.5</th>
                      <th scope="col" className="py-2.5 pl-3 font-medium text-right">State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-hairline)]">
                    {stations.map((st) => (
                      <tr key={st.id} className="hover:bg-[var(--bg-subtle)]/35">
                        <td className="py-3 pr-4 font-medium text-[var(--text-primary)]">
                          {st.name}
                        </td>
                        <td className="py-3 px-3 text-[var(--text-muted)]">
                          {st.zone}
                        </td>
                        <td className="py-3 px-3 text-right font-mono-tabular font-semibold text-[var(--text-primary)]">
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="h-2 w-2 rounded-xs"
                              style={{ backgroundColor: AQI_COLORS[st.category] }}
                              aria-hidden="true"
                            />
                            {st.aqi}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono-tabular text-[var(--text-muted)]">
                          {st.pm25} µg/m³
                        </td>
                        <td className="py-3 pl-3 text-right text-[var(--text-muted)]">
                          {st.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Atmospheric Brief & Regional Advisories */}
            <div className="lg:col-span-5 space-y-6 lg:border-l lg:border-[var(--border-hairline)] lg:pl-8">
              <div>
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <span className="font-semibold text-[var(--text-primary)]">
                    Atmospheric Field Note
                  </span>
                  <span>Simulated summary</span>
                </div>
                <p className="mt-2.5 text-sm leading-relaxed text-[var(--text-muted)]">
                  {measurement.aiSummary}
                </p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs font-mono-tabular text-[var(--text-muted)]">
                  <span>Visibility: {measurement.weather.visibilityKm} km</span>
                  <span>Pressure: {measurement.weather.pressureHpa} hPa</span>
                  <span>Feels like: {measurement.weather.feelsLikeC}°C</span>
                </div>
              </div>

              <div className="border-t border-[var(--border-hairline)] pt-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                    Local Advisories
                  </h3>
                  <button
                    type="button"
                    onClick={() => onNavigate('hotspots')}
                    className="text-xs font-medium text-[#245C45] dark:text-[#A7B9A1] hover:underline"
                  >
                    Hotspots
                  </button>
                </div>

                <div className="mt-3 divide-y divide-[var(--border-hairline)]">
                  {cityAlerts.length > 0 ? (
                    cityAlerts.map((alert) => (
                      <div key={alert.id} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                          <span>{alert.zone}</span>
                          <span className="tabular-nums">{alert.issuedAt}</span>
                        </div>
                        <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">
                          {alert.title}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                          {alert.summary}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[var(--text-muted)]">
                      No active advisories for {city.name}.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
