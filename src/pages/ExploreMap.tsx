import { Layers, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AirQualityMap, BaseTileStyle } from '../components/AirQualityMap';
import { CitySelector } from '../components/CitySelector';
import { MapMetricKey, MapViewMode } from '../components/StationMarker';
import { CITY_MAP } from '../data/cities';
import { MONITORING_STATIONS } from '../data/stations';
import { ThemeMode } from '../hooks/useTheme';
import { fetchDatasetStations } from '../services/api';
import { CityId, MonitoringStation } from '../types';
import { AQI_COLORS, getCategoryFromAqi } from '../utils/aqi';

interface ExploreMapProps {
  selectedCity: CityId;
  onSelectCity: (city: CityId) => void;
  theme: ThemeMode;
}

const VIEW_MODES: { id: MapViewMode; label: string }[] = [
  { id: 'station', label: 'Stations' },
  { id: 'intensity', label: 'Intensity' },
  { id: 'pm25', label: 'PM2.5' },
  { id: 'pm10', label: 'PM10' },
];

const METRIC_OPTIONS: { id: MapMetricKey; label: string }[] = [
  { id: 'aqi', label: 'AQI' },
  { id: 'pm25', label: 'PM2.5' },
  { id: 'pm10', label: 'PM10' },
  { id: 'no2', label: 'NO2' },
  { id: 'o3', label: 'O3' },
];

export function ExploreMap({
  selectedCity,
  onSelectCity,
  theme,
}: ExploreMapProps) {
  const [viewMode, setViewMode] = useState<MapViewMode>('intensity');
  const [selectedMetric, setSelectedMetric] = useState<MapMetricKey>('aqi');
  const [tileStyle, setTileStyle] = useState<BaseTileStyle>('standard');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [railMode, setRailMode] = useState<'inspector' | 'list'>('inspector');
  const [dataSourceMode, setDataSourceMode] = useState<'curated' | 'sql'>('sql');
  const [sqlStations, setSqlStations] = useState<MonitoringStation[]>([]);

  const city = CITY_MAP[selectedCity];

  useEffect(() => {
    let active = true;
    fetchDatasetStations({ city: city.name, limit: 60 })
      .then((res) => {
        if (!active) return;
        const mapped: MonitoringStation[] = res.stations.map((s) => {
          const aqiVal = Math.round(s.actualAqi ?? s.pm25 ?? s.ozone ?? 55);
          return {
            id: `sql-${s.id}`,
            cityId: selectedCity,
            name: s.station,
            zone: `${s.city}, ${s.state} (CPCB SQL)`,
            coordinates: [s.latitude, s.longitude],
            status: 'Active',
            aqi: aqiVal,
            category: s.aqiCategory ?? getCategoryFromAqi(aqiVal),
            pm25: Math.round(s.pm25 ?? 35),
            pm10: Math.round(s.pm10 ?? 70),
            no2: Math.round(s.no2 ?? 25),
            o3: Math.round(s.ozone ?? 24),
            so2: Math.round(s.so2 ?? 10),
            lastReading: 'SQL CPCB Dataset',
            radiusMeters: 1600,
          };
        });
        setSqlStations(mapped);
      })
      .catch(() => {
        if (active) setSqlStations([]);
      });
    return () => {
      active = false;
    };
  }, [city.name, selectedCity]);

  const cityStations = useMemo(() => {
    if (dataSourceMode === 'sql' && sqlStations.length > 0) {
      return sqlStations;
    }
    return MONITORING_STATIONS.filter((s) => s.cityId === selectedCity);
  }, [dataSourceMode, sqlStations, selectedCity]);

  const filteredStations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return cityStations;
    return cityStations.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.zone.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
    );
  }, [cityStations, searchQuery]);

  useEffect(() => {
    setSelectedStationId(cityStations[0]?.id ?? null);
    setSearchQuery('');
  }, [selectedCity, cityStations]);

  const activeStation: MonitoringStation | null =
    cityStations.find((s) => s.id === selectedStationId) ?? cityStations[0] ?? null;

  return (
    <div className="space-y-6">
      {/* Quiet Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 border-b border-[var(--border-hairline)] pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-normal tracking-tight text-[var(--text-primary)]">
            Spatial Air Quality — {city.name}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[var(--text-muted)]">
            Demonstration data · Simulated coordinates and illustrative circular dispersion overlays across {cityStations.length} nodes.
          </p>
        </div>

        <CitySelector
          selectedCity={selectedCity}
          onSelectCity={onSelectCity}
          compact
        />
      </div>

      {/* Single Clean Control Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Map visualization mode"
          className="inline-flex flex-wrap items-center rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-0.5 gap-0.5"
        >
          {VIEW_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              aria-pressed={viewMode === mode.id}
              onClick={() => setViewMode(mode.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#245C45] ${
                viewMode === mode.id
                  ? 'bg-[#245C45] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div
            role="group"
            aria-label="Station data source"
            className="inline-flex items-center rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-0.5"
          >
            <button
              type="button"
              aria-pressed={dataSourceMode === 'sql'}
              onClick={() => setDataSourceMode('sql')}
              className={`px-2.5 py-1 text-xs font-medium rounded-sm transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#245C45] ${
                dataSourceMode === 'sql'
                  ? 'bg-[#245C45] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              SQL CPCB ({sqlStations.length})
            </button>
            <button
              type="button"
              aria-pressed={dataSourceMode === 'curated'}
              onClick={() => setDataSourceMode('curated')}
              className={`px-2.5 py-1 text-xs font-medium rounded-sm transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#245C45] ${
                dataSourceMode === 'curated'
                  ? 'bg-[#245C45] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              City Grid
            </button>
          </div>

          <div className="inline-flex items-center gap-1.5">
            <label
              htmlFor="map-metric-select"
              className="text-xs text-[var(--text-muted)] whitespace-nowrap"
            >
              Metric
            </label>
            <select
              id="map-metric-select"
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as MapMetricKey)}
              className="rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)]"
            >
              {METRIC_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div
            role="group"
            aria-label="Map base layer"
            className="inline-flex items-center rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-0.5"
          >
            <button
              type="button"
              onClick={() => setTileStyle('standard')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-sm transition-colors whitespace-nowrap shrink-0 ${
                tileStyle === 'standard'
                  ? 'bg-[var(--bg-subtle)] text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              <Layers className="h-3 w-3" aria-hidden="true" />
              Streets
            </button>
            <button
              type="button"
              onClick={() => setTileStyle('topo')}
              className={`px-2.5 py-1 text-xs font-medium rounded-sm transition-colors whitespace-nowrap shrink-0 ${
                tileStyle === 'topo'
                  ? 'bg-[var(--bg-subtle)] text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              Terrain
            </button>
          </div>
        </div>
      </div>

      {/* Main Split: Wide Map Stage + Calm Tabbed Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8">
          <AirQualityMap
            city={city}
            stations={filteredStations}
            viewMode={viewMode}
            selectedMetric={selectedMetric}
            tileStyle={tileStyle}
            selectedStationId={selectedStationId}
            onSelectStation={(st) => {
              setSelectedStationId(st.id);
              setRailMode('inspector');
            }}
            theme={theme}
          />
        </div>

        <aside className="lg:col-span-4 rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
          <div className="flex items-center gap-5 border-b border-[var(--border-hairline)] pb-3 mb-4">
            <button
              type="button"
              onClick={() => setRailMode('inspector')}
              className={`text-xs font-semibold transition-colors ${
                railMode === 'inspector'
                  ? 'text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Station Reading
            </button>
            <button
              type="button"
              onClick={() => setRailMode('list')}
              className={`text-xs font-semibold transition-colors ${
                railMode === 'list'
                  ? 'text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              All Nodes ({cityStations.length})
            </button>
          </div>

          {railMode === 'inspector' && activeStation ? (
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <span>{activeStation.zone}</span>
                  <span>{activeStation.status}</span>
                </div>
                <h2 className="mt-1 font-display text-xl font-normal text-[var(--text-primary)]">
                  {activeStation.name}
                </h2>
              </div>

              <div className="flex items-baseline justify-between border-y border-[var(--border-hairline)] py-4">
                <div>
                  <span className="text-xs text-[var(--text-muted)] block">
                    Simulated AQI
                  </span>
                  <span className="font-mono-tabular text-4xl font-medium text-[var(--text-primary)]">
                    {activeStation.aqi}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]">
                  <span
                    className="h-2.5 w-2.5 rounded-xs"
                    style={{ backgroundColor: AQI_COLORS[activeStation.category] }}
                  />
                  {activeStation.category}
                </span>
              </div>

              <dl className="grid grid-cols-2 gap-y-3.5 gap-x-4 text-xs">
                <div>
                  <dt className="text-[var(--text-muted)]">PM2.5</dt>
                  <dd className="mt-0.5 font-mono-tabular text-sm font-semibold text-[var(--text-primary)]">
                    {activeStation.pm25} µg/m³
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--text-muted)]">PM10</dt>
                  <dd className="mt-0.5 font-mono-tabular text-sm font-semibold text-[var(--text-primary)]">
                    {activeStation.pm10} µg/m³
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--text-muted)]">NO2</dt>
                  <dd className="mt-0.5 font-mono-tabular text-sm font-semibold text-[var(--text-primary)]">
                    {activeStation.no2} µg/m³
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--text-muted)]">O3</dt>
                  <dd className="mt-0.5 font-mono-tabular text-sm font-semibold text-[var(--text-primary)]">
                    {activeStation.o3} µg/m³
                  </dd>
                </div>
              </dl>

              <div className="border-t border-[var(--border-hairline)] pt-3 text-[11px] font-mono-tabular text-[var(--text-muted)]">
                {activeStation.coordinates[0].toFixed(4)}°N, {activeStation.coordinates[1].toFixed(4)}°E · {activeStation.lastReading}
              </div>
            </div>
          ) : (
            <div>
              <div className="relative mb-3">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Filter ${city.name} stations...`}
                  aria-label={`Filter monitoring stations in ${city.name}`}
                  className="w-full rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] py-1.5 pl-9 pr-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-2 focus:outline-[#245C45]"
                />
              </div>

              {filteredStations.length === 0 ? (
                <p className="py-8 text-center text-xs text-[var(--text-muted)]">
                  No stations match &ldquo;{searchQuery}&rdquo;.
                </p>
              ) : (
                <div className="divide-y divide-[var(--border-hairline)] max-h-[360px] overflow-y-auto">
                  {filteredStations.map((station) => {
                    const isSelected = station.id === selectedStationId;
                    return (
                      <button
                        key={station.id}
                        type="button"
                        onClick={() => {
                          setSelectedStationId(station.id);
                          setRailMode('inspector');
                        }}
                        className={`w-full flex items-center justify-between gap-3 px-2 py-2.5 text-left transition-colors ${
                          isSelected
                            ? 'bg-[#245C45]/10 dark:bg-[#A7B9A1]/15'
                            : 'hover:bg-[var(--bg-subtle)]/40'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-[var(--text-primary)] truncate">
                            {station.name}
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)]">
                            {station.zone} · {station.status}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 font-mono-tabular text-xs font-semibold text-[var(--text-primary)]">
                          <span
                            className="h-2 w-2 rounded-xs"
                            style={{ backgroundColor: AQI_COLORS[station.category] }}
                          />
                          {station.aqi}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
