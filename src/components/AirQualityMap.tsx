import { LocateFixed, Minus, Plus } from 'lucide-react';
import { useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { ThemeMode } from '../hooks/useTheme';
import { CityInfo, MonitoringStation } from '../types';
import { MapMetricKey, MapViewMode, StationMarker } from './StationMarker';

export type BaseTileStyle = 'standard' | 'topo';

interface AirQualityMapProps {
  city: CityInfo;
  stations: MonitoringStation[];
  viewMode: MapViewMode;
  selectedMetric: MapMetricKey;
  tileStyle: BaseTileStyle;
  selectedStationId: string | null;
  onSelectStation: (station: MonitoringStation) => void;
  theme: ThemeMode;
}

function MapViewportController({
  center,
  zoom,
  focusCoords,
}: {
  center: [number, number];
  zoom: number;
  focusCoords: [number, number] | null;
}) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [map, center, zoom]);

  useEffect(() => {
    if (focusCoords) {
      map.panTo(focusCoords, { animate: true });
    }
  }, [map, focusCoords]);

  return null;
}

function CustomZoomControls({
  cityCenter,
  cityZoom,
}: {
  cityCenter: [number, number];
  cityZoom: number;
}) {
  const map = useMap();

  return (
    <div className="absolute right-3 top-3 z-[400] flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => map.zoomIn()}
        aria-label="Zoom in map"
        title="Zoom in"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm transition-colors hover:bg-[var(--bg-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245C45]"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => map.zoomOut()}
        aria-label="Zoom out map"
        title="Zoom out"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm transition-colors hover:bg-[var(--bg-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245C45]"
      >
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => map.setView(cityCenter, cityZoom, { animate: true })}
        aria-label="Reset map view to city center"
        title="Reset city view"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm transition-colors hover:bg-[var(--bg-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245C45]"
      >
        <LocateFixed className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function AirQualityMap({
  city,
  stations,
  viewMode,
  selectedMetric,
  tileStyle,
  selectedStationId,
  onSelectStation,
  theme,
}: AirQualityMapProps) {
  const selectedStation = stations.find((s) => s.id === selectedStationId) ?? null;

  const tileUrl =
    tileStyle === 'topo'
      ? 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  const tileAttribution =
    tileStyle === 'topo'
      ? '&copy; OpenStreetMap contributors, SRTM | &copy; OpenTopoMap'
      : '&copy; OpenStreetMap contributors';

  return (
    <div
      role="region"
      aria-label={`Interactive air quality map for ${city.name}`}
      className="relative h-[460px] sm:h-[520px] w-full overflow-hidden rounded-md border border-[var(--border-hairline)] bg-[var(--bg-subtle)]"
    >
      <MapContainer
        center={city.coordinates}
        zoom={city.defaultZoom}
        zoomControl={false}
        className="h-full w-full"
        scrollWheelZoom
      >
        <TileLayer
          url={tileUrl}
          attribution={tileAttribution}
          className={theme === 'dark' ? 'dark-map-tiles' : ''}
        />
        <MapViewportController
          center={city.coordinates}
          zoom={city.defaultZoom}
          focusCoords={selectedStation ? selectedStation.coordinates : null}
        />
        <CustomZoomControls
          cityCenter={city.coordinates}
          cityZoom={city.defaultZoom}
        />

        {stations.map((station) => (
          <StationMarker
            key={station.id}
            station={station}
            viewMode={viewMode}
            selectedMetric={selectedMetric}
            isSelected={station.id === selectedStationId}
            onSelect={onSelectStation}
          />
        ))}
      </MapContainer>

      {/* Bottom-left Legend Overlay */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-[400] max-w-xs rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]/95 px-3 py-2 backdrop-blur-xs shadow-sm">
        <div className="text-[11px] font-medium text-[var(--text-primary)]">
          {viewMode === 'station'
            ? 'Station Node View'
            : viewMode === 'intensity'
            ? 'Illustrative Dispersion Overlay'
            : viewMode === 'pm25'
            ? 'Simulated PM2.5 Spatial Layer'
            : 'Simulated PM10 Spatial Layer'}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-xs bg-[#54A875]" /> Good
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-xs bg-[#A7BE57]" /> Satisfactory
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-xs bg-[#E7B64F]" /> Moderate
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-xs bg-[#E58B45]" /> Poor
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-xs bg-[#D65C50]" /> Very Poor
          </span>
        </div>
      </div>
    </div>
  );
}
