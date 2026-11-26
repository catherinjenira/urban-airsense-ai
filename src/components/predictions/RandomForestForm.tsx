import { Search, Sparkles } from 'lucide-react';
import { FormEvent } from 'react';
import { DatasetStation } from '../../types';

export interface RandomForestFormValues {
  pm25: string;
  pm10: string;
  no2: string;
  so2: string;
  co: string;
  ozone: string;
  nh3: string;
  latitude: string;
  longitude: string;
}

interface RandomForestFormProps {
  values: RandomForestFormValues;
  onChangeField: (field: keyof RandomForestFormValues, value: string) => void;
  stations: DatasetStation[];
  stationSearch: string;
  onStationSearchChange: (value: string) => void;
  selectedStationName: string;
  onSelectStation: (station: DatasetStation) => void;
  selectedStationObj: DatasetStation | null;
  estimatePm25Mode: boolean;
  onToggleEstimatePm25: (enabled: boolean) => void;
  predicting: boolean;
  predictError: string | null;
  onSubmit: (e: FormEvent) => void;
}

interface NumericFieldConfig {
  id: string;
  field: keyof RandomForestFormValues;
  label: string;
  min?: string;
  max?: string;
  step: string;
}

const NUMERIC_FIELDS: NumericFieldConfig[] = [
  { id: 'rf-pm10', field: 'pm10', label: 'PM10', min: '0', max: '1000', step: '0.1' },
  { id: 'rf-no2', field: 'no2', label: 'NO2', min: '0', max: '500', step: '0.1' },
  { id: 'rf-so2', field: 'so2', label: 'SO2', min: '0', max: '500', step: '0.1' },
  { id: 'rf-co', field: 'co', label: 'CO', min: '0', max: '500', step: '0.1' },
  { id: 'rf-ozone', field: 'ozone', label: 'Ozone (O3)', min: '0', max: '500', step: '0.1' },
  { id: 'rf-nh3', field: 'nh3', label: 'NH3', min: '0', max: '500', step: '0.1' },
  { id: 'rf-lat', field: 'latitude', label: 'Latitude', min: '-90', max: '90', step: '0.0001' },
  { id: 'rf-lon', field: 'longitude', label: 'Longitude', min: '-180', max: '180', step: '0.0001' },
];

export function RandomForestForm({
  values,
  onChangeField,
  stations,
  stationSearch,
  onStationSearchChange,
  selectedStationName,
  onSelectStation,
  selectedStationObj,
  estimatePm25Mode,
  onToggleEstimatePm25,
  predicting,
  predictError,
  onSubmit,
}: RandomForestFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      aria-label="Random Forest AQI input parameters"
      className="lg:col-span-7 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6 space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            1. Load Dataset Station or Enter Readings
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            Pull real pollutant observations from SQL{' '}
            <code className="font-mono-tabular">station_profiles</code>
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-xs font-medium text-[var(--text-primary)] cursor-pointer">
          <input
            type="checkbox"
            checked={estimatePm25Mode}
            onChange={(e) => onToggleEstimatePm25(e.target.checked)}
            className="rounded border-[var(--border-strong)] accent-[#245C45]"
          />
          <span>Estimate PM2.5 via RF</span>
        </label>
      </div>

      {/* Station Search & Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-5 relative">
          <label htmlFor="rf-station-search" className="sr-only">
            Search any Indian city or station
          </label>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]"
            aria-hidden="true"
          />
          <input
            id="rf-station-search"
            type="text"
            value={stationSearch}
            onChange={(e) => onStationSearchChange(e.target.value)}
            placeholder="Search any Indian city/station..."
            className="w-full rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] pl-8 pr-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#245C45]"
          />
        </div>

        <div className="sm:col-span-7">
          <label htmlFor="rf-station-select" className="sr-only">
            Select monitoring station from SQL dataset
          </label>
          <select
            id="rf-station-select"
            value={selectedStationName}
            onChange={(e) => {
              const found = stations.find((s) => s.station === e.target.value);
              if (found) onSelectStation(found);
            }}
            className="w-full rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#245C45]"
          >
            {stations.length === 0 && (
              <option value="">Loading SQL stations...</option>
            )}
            {stations.map((s) => (
              <option key={s.id} value={s.station}>
                {s.city} — {s.station} (AQI {Math.round(s.actualAqi ?? 0)})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Pollutant & Coordinate Inputs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
        <div>
          <label
            htmlFor="rf-pm25"
            className="block text-[11px] font-medium text-[var(--text-muted)] mb-1"
          >
            PM2.5 {estimatePm25Mode ? '(RF Predicted)' : '(sub-index)'}
          </label>
          <input
            id="rf-pm25"
            type="number"
            step="0.1"
            min="0"
            max="1000"
            disabled={estimatePm25Mode}
            required={!estimatePm25Mode}
            value={estimatePm25Mode ? '' : values.pm25}
            placeholder={estimatePm25Mode ? 'Auto via RF' : '82'}
            onChange={(e) => onChangeField('pm25', e.target.value)}
            className="w-full rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-sm font-mono-tabular text-[var(--text-primary)] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#245C45]"
          />
        </div>

        {NUMERIC_FIELDS.map((item) => (
          <div key={item.id}>
            <label
              htmlFor={item.id}
              className="block text-[11px] font-medium text-[var(--text-muted)] mb-1"
            >
              {item.label}
            </label>
            <input
              id={item.id}
              type="number"
              step={item.step}
              min={item.min}
              max={item.max}
              required
              value={values[item.field]}
              onChange={(e) => onChangeField(item.field, e.target.value)}
              className="w-full rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-sm font-mono-tabular text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#245C45]"
            />
          </div>
        ))}
      </div>

      {predictError && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-md border border-[#D65C50]/40 bg-[#D65C50]/10 px-3 py-2 text-xs text-[#B43D32] dark:text-[#E57368]"
        >
          {predictError}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <span className="text-[11px] text-[var(--text-muted)]">
          {selectedStationObj?.actualAqi != null && (
            <>
              Dataset ground-truth AQI:{' '}
              <strong className="font-mono-tabular text-[var(--text-primary)]">
                {Math.round(selectedStationObj.actualAqi)} (
                {selectedStationObj.aqiCategory})
              </strong>
            </>
          )}
        </span>

        <button
          type="submit"
          disabled={predicting}
          className="inline-flex items-center gap-2 rounded-md bg-[#245C45] hover:bg-[#173D30] disabled:opacity-60 px-4 py-2 text-xs sm:text-sm font-medium text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245C45]"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          <span>
            {predicting
              ? 'Running 250-tree Random Forest...'
              : 'Run Random Forest Prediction'}
          </span>
        </button>
      </div>
    </form>
  );
}
