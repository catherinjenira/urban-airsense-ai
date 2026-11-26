import { Circle, CircleMarker, Popup } from 'react-leaflet';
import { MonitoringStation } from '../types';
import {
  AQI_COLORS,
  getCategoryFromAqi,
  getCategoryFromPm25,
} from '../utils/aqi';

export type MapViewMode = 'station' | 'intensity' | 'pm25' | 'pm10';
export type MapMetricKey = 'aqi' | 'pm25' | 'pm10' | 'no2' | 'o3';

interface StationMarkerProps {
  station: MonitoringStation;
  viewMode: MapViewMode;
  selectedMetric: MapMetricKey;
  isSelected: boolean;
  onSelect: (station: MonitoringStation) => void;
}

function getDisplayValue(station: MonitoringStation, viewMode: MapViewMode, metric: MapMetricKey): number {
  if (viewMode === 'pm25') return station.pm25;
  if (viewMode === 'pm10') return station.pm10;
  switch (metric) {
    case 'pm25':
      return station.pm25;
    case 'pm10':
      return station.pm10;
    case 'no2':
      return station.no2;
    case 'o3':
      return station.o3;
    case 'aqi':
    default:
      return station.aqi;
  }
}

function getMarkerColor(station: MonitoringStation, viewMode: MapViewMode, metric: MapMetricKey): string {
  if (viewMode === 'pm25' || metric === 'pm25') {
    return AQI_COLORS[getCategoryFromPm25(station.pm25)];
  }
  if (viewMode === 'pm10' || metric === 'pm10') {
    const pm10Aqi = Math.round(station.pm10 * 0.95);
    return AQI_COLORS[getCategoryFromAqi(pm10Aqi)];
  }
  return AQI_COLORS[station.category];
}

export function StationMarker({
  station,
  viewMode,
  selectedMetric,
  isSelected,
  onSelect,
}: StationMarkerProps) {
  const color = getMarkerColor(station, viewMode, selectedMetric);
  const displayValue = getDisplayValue(station, viewMode, selectedMetric);
  const showIntensityOverlay = viewMode === 'intensity' || viewMode === 'pm25' || viewMode === 'pm10';

  const baseRadius =
    viewMode === 'pm25'
      ? Math.max(1100, station.pm25 * 28)
      : viewMode === 'pm10'
      ? Math.max(1200, station.pm10 * 16)
      : station.radiusMeters;

  return (
    <>
      {showIntensityOverlay && (
        <>
          <Circle
            center={station.coordinates}
            radius={baseRadius * 1.45}
            pathOptions={{
              color: 'transparent',
              fillColor: color,
              fillOpacity: viewMode === 'intensity' ? 0.18 : 0.14,
            }}
            interactive={false}
          />
          <Circle
            center={station.coordinates}
            radius={baseRadius * 0.8}
            pathOptions={{
              color: color,
              weight: 1,
              opacity: 0.45,
              fillColor: color,
              fillOpacity: viewMode === 'intensity' ? 0.34 : 0.26,
            }}
            interactive={false}
          />
        </>
      )}

      <CircleMarker
        center={station.coordinates}
        radius={isSelected ? 12 : 9}
        pathOptions={{
          color: isSelected ? '#173D30' : '#FFFFFF',
          weight: isSelected ? 3 : 2,
          fillColor: color,
          fillOpacity: station.status === 'Offline' ? 0.45 : 0.95,
        }}
        eventHandlers={{
          click: () => onSelect(station),
        }}
      >
        <Popup>
          <div className="p-3.5 text-left">
            <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
              <span>{station.zone}</span>
              <span>{station.status}</span>
            </div>
            <div className="mt-1 text-sm font-semibold text-[var(--text-primary)] leading-snug">
              {station.name}
            </div>

            <div className="mt-2.5 flex items-baseline justify-between border-t border-b border-[var(--border-hairline)] py-2">
              <div>
                <span className="text-[11px] text-[var(--text-muted)] block">
                  {viewMode === 'pm25'
                    ? 'PM2.5'
                    : viewMode === 'pm10'
                    ? 'PM10'
                    : selectedMetric.toUpperCase()}
                </span>
                <span className="font-mono-tabular text-xl font-semibold text-[var(--text-primary)]">
                  {displayValue}
                </span>
                {(viewMode === 'pm25' || viewMode === 'pm10' || selectedMetric !== 'aqi') && (
                  <span className="ml-1 text-[11px] font-mono-tabular text-[var(--text-muted)]">
                    µg/m³
                  </span>
                )}
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: color }}
                />
                {station.category}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <span className="text-[var(--text-muted)] block">PM2.5</span>
                <span className="font-mono-tabular font-medium">{station.pm25}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block">PM10</span>
                <span className="font-mono-tabular font-medium">{station.pm10}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block">NO2</span>
                <span className="font-mono-tabular font-medium">{station.no2}</span>
              </div>
            </div>

            <p className="mt-2 text-[10px] text-[var(--text-muted)]">
              {station.lastReading} · Demonstration data
            </p>
          </div>
        </Popup>
      </CircleMarker>
    </>
  );
}
