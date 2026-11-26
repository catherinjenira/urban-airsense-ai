import { Search } from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  Circle,
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import { CitySelector } from '../components/CitySelector';
import { HotspotPanel } from '../components/HotspotPanel';
import { CityComparisonTable } from '../components/hotspots/CityComparisonTable';
import { CITIES, CITY_MAP } from '../data/cities';
import { POLLUTION_HOTSPOTS } from '../data/hotspots';
import { ThemeMode } from '../hooks/useTheme';
import { CityId, PollutantKey, PollutionHotspot } from '../types';
import { AQI_COLORS } from '../utils/aqi';

interface HotspotsProps {
  selectedCity: CityId;
  onSelectCity: (city: CityId) => void;
  theme: ThemeMode;
}

const POLLUTANT_FILTERS: ('All' | PollutantKey)[] = [
  'All',
  'PM2.5',
  'PM10',
  'NO2',
  'SO2',
];

function HotspotMapFocus({
  center,
  zoom,
}: {
  center: [number, number];
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [map, center, zoom]);
  return null;
}

export function Hotspots({
  selectedCity,
  onSelectCity,
  theme,
}: HotspotsProps) {
  const [pollutantFilter, setPollutantFilter] = useState<'All' | PollutantKey>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [lowerTab, setLowerTab] = useState<'detail' | 'comparison'>('detail');

  const city = CITY_MAP[selectedCity];

  const cityHotspots = useMemo(() => {
    return POLLUTION_HOTSPOTS.filter((h) => h.cityId === selectedCity)
      .filter((h) =>
        pollutantFilter === 'All' ? true : h.dominantPollutant === pollutantFilter
      )
      .filter((h) => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return true;
        return (
          h.name.toLowerCase().includes(q) ||
          h.wardOrZone.toLowerCase().includes(q) ||
          h.primaryDrivers.some((d) => d.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => b.severityScore - a.severityScore);
  }, [selectedCity, pollutantFilter, searchQuery]);

  useEffect(() => {
    setSelectedHotspotId(cityHotspots[0]?.id ?? null);
  }, [selectedCity, cityHotspots]);

  const activeHotspot: PollutionHotspot | null =
    cityHotspots.find((h) => h.id === selectedHotspotId) ?? cityHotspots[0] ?? null;

  const cityComparisonRows = useMemo(() => {
    return CITIES.map((c) => {
      const list = POLLUTION_HOTSPOTS.filter((h) => h.cityId === c.id);
      const peak = list.reduce(
        (max, cur) => (cur.severityScore > max.severityScore ? cur : max),
        list[0]
      );
      const totalEpisodes = list.reduce((s, h) => s + h.annualEpisodeDays, 0);
      return {
        city: c,
        hotspotCount: list.length,
        peakHotspot: peak,
        avgEpisodeDays: Math.round(totalEpisodes / Math.max(1, list.length)),
      };
    }).sort((a, b) => b.peakHotspot.severityScore - a.peakHotspot.severityScore);
  }, []);

  return (
    <div className="space-y-7">
      {/* Header & Simulated Dataset Label */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 border-b border-[var(--border-hairline)] pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-normal tracking-tight text-[var(--text-primary)]">
            Pollution Hotspots — {city.name}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[var(--text-muted)]">
            Simulated hotspot intelligence · Recurring micro-basin clusters and emission drivers.
          </p>
        </div>

        <CitySelector
          selectedCity={selectedCity}
          onSelectCity={onSelectCity}
          compact
        />
      </div>

      {/* Compact Filter Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Filter hotspots by dominant pollutant"
          className="inline-flex flex-wrap items-center rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-0.5 gap-0.5"
        >
          {POLLUTANT_FILTERS.map((pol) => (
            <button
              key={pol}
              type="button"
              onClick={() => setPollutantFilter(pol)}
              className={`px-2.5 py-1 text-xs font-medium rounded-sm transition-colors whitespace-nowrap shrink-0 ${
                pollutantFilter === pol
                  ? 'bg-[#245C45] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {pol}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search zone or driver..."
            aria-label="Search hotspots"
            className="w-full rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] py-1.5 pl-9 pr-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-2 focus:outline-[#245C45]"
          />
        </div>
      </div>

      {/* Main Split: Hotspot Map + Compact Ranked List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 relative h-[360px] sm:h-[400px] w-full overflow-hidden rounded-md border border-[var(--border-hairline)] bg-[var(--bg-subtle)]">
          <MapContainer
            center={activeHotspot ? activeHotspot.coordinates : city.coordinates}
            zoom={city.defaultZoom}
            className="h-full w-full"
            scrollWheelZoom
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
              className={theme === 'dark' ? 'dark-map-tiles' : ''}
            />
            <HotspotMapFocus
              center={activeHotspot ? activeHotspot.coordinates : city.coordinates}
              zoom={city.defaultZoom}
            />

            {cityHotspots.map((hs) => {
              const color = AQI_COLORS[hs.severity];
              const isSelected = hs.id === activeHotspot?.id;
              return (
                <Fragment key={hs.id}>
                  <Circle
                    center={hs.coordinates}
                    radius={1800 + hs.severityScore * 16}
                    pathOptions={{
                      color: isSelected ? color : 'transparent',
                      weight: isSelected ? 1.5 : 0,
                      fillColor: color,
                      fillOpacity: isSelected ? 0.28 : 0.18,
                    }}
                    interactive={false}
                  />
                  <CircleMarker
                    center={hs.coordinates}
                    radius={isSelected ? 11 : 8}
                    pathOptions={{
                      color: isSelected ? '#173D30' : '#FFFFFF',
                      weight: isSelected ? 3 : 2,
                      fillColor: color,
                      fillOpacity: 0.95,
                    }}
                    eventHandlers={{
                      click: () => {
                        setSelectedHotspotId(hs.id);
                        setLowerTab('detail');
                      },
                    }}
                  >
                    <Popup>
                      <div className="p-3 text-xs">
                        <div className="text-[var(--text-muted)]">
                          Rank #{hs.rankInCity} · {hs.wardOrZone}
                        </div>
                        <div className="mt-0.5 font-semibold text-[var(--text-primary)]">
                          {hs.name}
                        </div>
                        <div className="mt-1.5 font-mono-tabular">
                          Severity {hs.severityScore}/100 ({hs.severity})
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                </Fragment>
              );
            })}
          </MapContainer>
        </div>

        <div className="lg:col-span-5 rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
          <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-3 mb-2">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Ranked Zones ({cityHotspots.length})
            </h2>
            <span className="text-xs text-[var(--text-muted)]">
              By severity score
            </span>
          </div>

          {cityHotspots.length === 0 ? (
            <div className="py-10 text-center text-xs text-[var(--text-muted)]">
              No hotspots match the current filter in {city.name}.
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-hairline)]">
              {cityHotspots.map((hs) => {
                const isSelected = hs.id === activeHotspot?.id;
                const color = AQI_COLORS[hs.severity];
                return (
                  <button
                    key={hs.id}
                    type="button"
                    onClick={() => {
                      setSelectedHotspotId(hs.id);
                      setLowerTab('detail');
                    }}
                    className={`w-full text-left py-3 px-2.5 transition-colors ${
                      isSelected
                        ? 'bg-[#245C45]/10 dark:bg-[#A7B9A1]/15'
                        : 'hover:bg-[var(--bg-subtle)]/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                          <span className="font-mono-tabular font-semibold text-[var(--text-primary)]">
                            #{hs.rankInCity}
                          </span>
                          <span>{hs.wardOrZone}</span>
                          <span aria-hidden="true">·</span>
                          <span>{hs.dominantPollutant}</span>
                        </div>
                        <div className="mt-1 text-sm font-medium text-[var(--text-primary)] truncate">
                          {hs.name}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
                          <span
                            className="h-2 w-2 rounded-xs"
                            style={{ backgroundColor: color }}
                          />
                          {hs.severity}
                        </span>
                        <span className="block font-mono-tabular text-[11px] text-[var(--text-muted)]">
                          {hs.annualEpisodeDays} d/yr
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Focused Lower Section: Selected Hotspot Detail OR 6-City Comparison */}
      <div className="border-t border-[var(--border-hairline)] pt-6">
        <div
          role="tablist"
          aria-label="Hotspot analysis views"
          className="inline-flex items-center gap-6 border-b border-[var(--border-hairline)] mb-5"
        >
          <button
            id="hotspot-tab-detail"
            type="button"
            role="tab"
            aria-selected={lowerTab === 'detail'}
            aria-controls="hotspot-panel-detail"
            onClick={() => setLowerTab('detail')}
            className={`pb-2.5 text-sm font-medium transition-colors relative focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245C45] ${
              lowerTab === 'detail'
                ? 'text-[var(--text-primary)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            Selected Zone Detail
            {lowerTab === 'detail' && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#245C45] dark:bg-[#A7B9A1]" />
            )}
          </button>
          <button
            id="hotspot-tab-comparison"
            type="button"
            role="tab"
            aria-selected={lowerTab === 'comparison'}
            aria-controls="hotspot-panel-comparison"
            onClick={() => setLowerTab('comparison')}
            className={`pb-2.5 text-sm font-medium transition-colors relative focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245C45] ${
              lowerTab === 'comparison'
                ? 'text-[var(--text-primary)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            6-City Comparison
            {lowerTab === 'comparison' && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#245C45] dark:bg-[#A7B9A1]" />
            )}
          </button>
        </div>

        {lowerTab === 'detail' ? (
          <div
            id="hotspot-panel-detail"
            role="tabpanel"
            aria-labelledby="hotspot-tab-detail"
          >
            <HotspotPanel hotspot={activeHotspot} />
          </div>
        ) : (
          <div
            id="hotspot-panel-comparison"
            role="tabpanel"
            aria-labelledby="hotspot-tab-comparison"
          >
            <CityComparisonTable
              rows={cityComparisonRows}
              selectedCity={selectedCity}
              onSelectCityRow={(cityId) => {
                onSelectCity(cityId);
                setLowerTab('detail');
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
