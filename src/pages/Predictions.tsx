import { ArrowDownRight, ArrowUpRight, Minus, Trees } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { CitySelector } from '../components/CitySelector';
import { ForecastChart } from '../components/ForecastChart';
import { ModelTelemetryPanel } from '../components/predictions/ModelTelemetryPanel';
import { PredictionHistoryTable } from '../components/predictions/PredictionHistoryTable';
import { PredictionOutputCard } from '../components/predictions/PredictionOutputCard';
import {
  RandomForestForm,
  RandomForestFormValues,
} from '../components/predictions/RandomForestForm';
import { CITY_MAP } from '../data/cities';
import { CITY_FORECASTS } from '../data/forecasts';
import {
  fetchDatasetStations,
  fetchModelInfo,
  fetchPredictionHistory,
  runRandomForestPrediction,
} from '../services/api';
import {
  CityId,
  DatasetStation,
  ForecastHorizon,
  ModelInfo,
  PredictionLogEntry,
  PredictionResult,
} from '../types';

interface PredictionsProps {
  selectedCity: CityId;
  onSelectCity: (city: CityId) => void;
}

const HORIZONS: { id: ForecastHorizon; label: string }[] = [
  { id: '1h', label: '1h' },
  { id: '3h', label: '3h' },
  { id: '6h', label: '6h' },
  { id: '24h', label: '24h' },
];

type DetailTab = 'telemetry' | 'history' | 'drivers' | 'intervals';

export function Predictions({ selectedCity, onSelectCity }: PredictionsProps) {
  const [horizon, setHorizon] = useState<ForecastHorizon>('6h');
  const [pollutant, setPollutant] = useState<'pm25' | 'pm10'>('pm25');
  const [detailTab, setDetailTab] = useState<DetailTab>('telemetry');

  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [stations, setStations] = useState<DatasetStation[]>([]);
  const [stationSearch, setStationSearch] = useState('');
  const [selectedStationName, setSelectedStationName] = useState('');
  const [estimatePm25Mode, setEstimatePm25Mode] = useState(false);

  const [formValues, setFormValues] = useState<RandomForestFormValues>({
    pm25: '82',
    pm10: '118',
    no2: '34',
    so2: '14',
    co: '38',
    ozone: '28',
    nh3: '6',
    latitude: '13.0827',
    longitude: '80.2707',
  });

  const [predicting, setPredicting] = useState(false);
  const [predictError, setPredictError] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [history, setHistory] = useState<PredictionLogEntry[]>([]);

  const city = CITY_MAP[selectedCity];
  const forecast = CITY_FORECASTS[selectedCity];
  const horizonData = forecast.horizons[horizon];

  const histAvg =
    pollutant === 'pm25'
      ? horizonData.historicalAvgPm25
      : horizonData.historicalAvgPm10;
  const predAvg =
    pollutant === 'pm25'
      ? horizonData.predictedAvgPm25
      : horizonData.predictedAvgPm10;
  const deltaPct = Math.round(((predAvg - histAvg) / Math.max(1, histAvg)) * 100);

  const applyStation = useCallback((st: DatasetStation) => {
    setSelectedStationName(st.station);
    setFormValues({
      pm25: String(Math.round(st.pm25 ?? 65)),
      pm10: String(Math.round(st.pm10 ?? 100)),
      no2: String(Math.round(st.no2 ?? 28)),
      so2: String(Math.round(st.so2 ?? 12)),
      co: String(Math.round(st.co ?? 32)),
      ozone: String(Math.round(st.ozone ?? 24)),
      nh3: String(Math.round(st.nh3 ?? 5)),
      latitude: String(Number(st.latitude.toFixed(4))),
      longitude: String(Number(st.longitude.toFixed(4))),
    });
  }, []);

  useEffect(() => {
    fetchModelInfo()
      .then(setModelInfo)
      .catch(() => {});
    fetchPredictionHistory(15)
      .then((res) => setHistory(res.history))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const cityFilter = stationSearch.trim() ? undefined : city.name;
    fetchDatasetStations({
      city: cityFilter,
      search: stationSearch.trim() || undefined,
      limit: 60,
    })
      .then((res) => {
        setStations(res.stations);
        if (res.stations.length > 0 && !stationSearch.trim()) {
          applyStation(res.stations[0]);
        }
      })
      .catch(() => {});
  }, [city.name, stationSearch, applyStation]);

  const selectedStationObj = useMemo(
    () => stations.find((s) => s.station === selectedStationName) ?? null,
    [stations, selectedStationName]
  );

  const handleFieldChange = (
    field: keyof RandomForestFormValues,
    value: string
  ) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleRunPrediction = async (e: FormEvent) => {
    e.preventDefault();
    setPredictError(null);
    setPredicting(true);
    try {
      const result = await runRandomForestPrediction({
        city: selectedStationObj?.city || city.name,
        station: selectedStationName || `${city.name} Custom Input`,
        pm25: estimatePm25Mode ? null : Number(formValues.pm25),
        pm10: Number(formValues.pm10),
        no2: Number(formValues.no2),
        so2: Number(formValues.so2),
        co: Number(formValues.co),
        ozone: Number(formValues.ozone),
        nh3: Number(formValues.nh3),
        latitude: Number(formValues.latitude),
        longitude: Number(formValues.longitude),
        estimatePm25: estimatePm25Mode,
      });
      setPrediction(result);
      const histRes = await fetchPredictionHistory(15);
      setHistory(histRes.history);
    } catch (err) {
      setPredictError(
        err instanceof Error ? err.message : 'Prediction request failed.'
      );
    } finally {
      setPredicting(false);
    }
  };

  const detailTabs: { id: DetailTab; label: string }[] = [
    { id: 'telemetry', label: 'Random Forest Telemetry' },
    { id: 'history', label: `SQL Prediction History (${history.length})` },
    { id: 'drivers', label: 'City Trend Drivers' },
    { id: 'intervals', label: 'Horizon Chart & Intervals' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[var(--border-hairline)] pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#245C45] dark:text-[#66BA86] mb-1">
            <Trees className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {modelInfo
                ? `${modelInfo.algorithm} · ${modelInfo.modelVersion}`
                : 'Random Forest Regressor & Classifier (250 trees)'}
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-normal tracking-tight text-[var(--text-primary)]">
            Random Forest AQI Predictor — {city.name}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[var(--text-muted)]">
            Trained on {modelInfo?.dataset.labeledStations ?? 547} CPCB monitoring
            stations stored in SQL. Select a station or adjust pollutants to
            predict AQI and save runs to SQL.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <CitySelector
            selectedCity={selectedCity}
            onSelectCity={onSelectCity}
            compact
          />
        </div>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        <RandomForestForm
          values={formValues}
          onChangeField={handleFieldChange}
          stations={stations}
          stationSearch={stationSearch}
          onStationSearchChange={setStationSearch}
          selectedStationName={selectedStationName}
          onSelectStation={applyStation}
          selectedStationObj={selectedStationObj}
          estimatePm25Mode={estimatePm25Mode}
          onToggleEstimatePm25={setEstimatePm25Mode}
          predicting={predicting}
          predictError={predictError}
          onSubmit={handleRunPrediction}
        />

        <PredictionOutputCard prediction={prediction} />
      </section>

      <div className="border-t border-[var(--border-hairline)] pt-6">
        <div
          role="tablist"
          aria-label="Random Forest model details and forecast"
          className="flex flex-wrap items-center gap-6 border-b border-[var(--border-hairline)] mb-6"
        >
          {detailTabs.map((tab) => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={detailTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              onClick={() => setDetailTab(tab.id)}
              className={`pb-2.5 text-sm font-medium transition-colors relative whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245C45] ${
                detailTab === tab.id
                  ? 'text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab.label}
              {detailTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#245C45] dark:bg-[#A7B9A1]" />
              )}
            </button>
          ))}
        </div>

        <div
          id={`panel-${detailTab}`}
          role="tabpanel"
          aria-labelledby={`tab-${detailTab}`}
        >
          {detailTab === 'telemetry' && modelInfo && (
            <ModelTelemetryPanel modelInfo={modelInfo} />
          )}

          {detailTab === 'history' && (
            <PredictionHistoryTable history={history} />
          )}

          {detailTab === 'drivers' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {forecast.factors.map((f) => (
                <div
                  key={f.factor}
                  className="border-t border-[var(--border-hairline)] pt-3.5"
                >
                  <span
                    className={`text-[11px] font-semibold ${
                      f.impact === 'Upward pressure'
                        ? 'text-[#B45E1A] dark:text-[#EE9B59]'
                        : f.impact === 'Dispersion relief'
                        ? 'text-[#2F7D4E] dark:text-[#66BA86]'
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {f.impact}
                  </span>
                  <h3 className="mt-1 text-sm font-medium text-[var(--text-primary)]">
                    {f.factor}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                    {f.detail}
                  </p>
                </div>
              ))}
            </div>
          )}

          {detailTab === 'intervals' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div
                  role="group"
                  aria-label="Forecast pollutant selector"
                  className="inline-flex items-center rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-0.5"
                >
                  <button
                    type="button"
                    onClick={() => setPollutant('pm25')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-sm transition-colors ${
                      pollutant === 'pm25'
                        ? 'bg-[var(--bg-subtle)] text-[var(--text-primary)]'
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    PM2.5
                  </button>
                  <button
                    type="button"
                    onClick={() => setPollutant('pm10')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-sm transition-colors ${
                      pollutant === 'pm10'
                        ? 'bg-[var(--bg-subtle)] text-[var(--text-primary)]'
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    PM10
                  </button>
                </div>

                <div className="flex items-center gap-3 text-xs font-mono-tabular">
                  <span>
                    {histAvg} → {predAvg} µg/m³
                  </span>
                  <span
                    className={`inline-flex items-center gap-0.5 font-semibold ${
                      deltaPct > 0
                        ? 'text-[#D65C50]'
                        : deltaPct < 0
                        ? 'text-[#54A875]'
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {deltaPct > 0 ? (
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : deltaPct < 0 ? (
                      <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {deltaPct > 0 ? `+${deltaPct}%` : `${deltaPct}%`}
                  </span>
                </div>

                <div
                  role="group"
                  aria-label="Forecast horizon selector"
                  className="inline-flex items-center rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-0.5"
                >
                  {HORIZONS.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => setHorizon(h.id)}
                      className={`px-2.5 py-1 text-xs font-mono-tabular font-medium rounded-sm transition-colors ${
                        horizon === h.id
                          ? 'bg-[#245C45] text-white'
                          : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {h.label}
                    </button>
                  ))}
                </div>
              </div>

              <ForecastChart
                points={horizonData.points}
                pollutant={pollutant}
                horizon={horizon}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
