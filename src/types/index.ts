export type PageId =
  | 'overview'
  | 'explore-map'
  | 'predictions'
  | 'my-exposure'
  | 'hotspots';

export type CityId =
  | 'chennai'
  | 'bengaluru'
  | 'hyderabad'
  | 'delhi'
  | 'mumbai'
  | 'coimbatore';

export type AQICategory =
  | 'Good'
  | 'Satisfactory'
  | 'Moderate'
  | 'Poor'
  | 'Very Poor'
  | 'Severe';

export type PollutantKey = 'PM2.5' | 'PM10' | 'NO2' | 'SO2' | 'CO' | 'O3';

export type ExposureActivityType =
  | 'Walking'
  | 'Jogging'
  | 'Cycling'
  | 'Commuting';

export interface CityInfo {
  id: CityId;
  name: string;
  state: string;
  regionLabel: string;
  coordinates: [number, number];
  defaultZoom: number;
  elevationM: number;
  coastal: boolean;
  populationNote: string;
}

export interface PollutantReading {
  key: PollutantKey;
  label: string;
  formula: string;
  value: number;
  unit: 'µg/m³' | 'mg/m³';
  guidelineLimit: number;
  subIndex: number;
  category: AQICategory;
  sourceNote: string;
}

export interface TrendPoint {
  time: string;
  hourOffset: number;
  pm25: number;
  pm10: number;
  aqi: number;
}

export interface WeatherConditions {
  temperatureC: number;
  feelsLikeC: number;
  humidityPct: number;
  windSpeedKmh: number;
  windDirection: string;
  boundaryLayerM: number;
  visibilityKm: number;
  pressureHpa: number;
}

export interface CityAlert {
  id: string;
  cityId: CityId;
  title: string;
  summary: string;
  severity: AQICategory;
  issuedAt: string;
  zone: string;
  read?: boolean;
}

export interface CityMeasurement {
  cityId: CityId;
  aqi: number;
  category: AQICategory;
  dominantPollutant: PollutantKey;
  lastUpdated: string;
  dataSource: string;
  interpretation: string;
  aiSummary: string;
  activeStations: number;
  totalStations: number;
  pollutants: PollutantReading[];
  weather: WeatherConditions;
  hourlyTrend24h: TrendPoint[];
  dailyTrend7d: TrendPoint[];
}

export interface MonitoringStation {
  id: string;
  cityId: CityId;
  name: string;
  zone: string;
  coordinates: [number, number];
  status: 'Active' | 'Calibrating' | 'Offline';
  aqi: number;
  category: AQICategory;
  pm25: number;
  pm10: number;
  no2: number;
  o3: number;
  so2: number;
  lastReading: string;
  radiusMeters: number;
}

export type ForecastHorizon = '1h' | '3h' | '6h' | '24h';

export interface ForecastPoint {
  label: string;
  type: 'historical' | 'forecast';
  pm25: number;
  pm10: number;
  pm25Lower?: number;
  pm25Upper?: number;
  pm10Lower?: number;
  pm10Upper?: number;
  aqi: number;
}

export interface CityForecast {
  cityId: CityId;
  modelName: string;
  confidencePct: number;
  lastRunLabel: string;
  factors: {
    factor: string;
    impact: 'Upward pressure' | 'Dispersion relief' | 'Neutral';
    detail: string;
  }[];
  horizons: Record<
    ForecastHorizon,
    {
      points: ForecastPoint[];
      predictedPeakAqi: number;
      predictedCategory: AQICategory;
      historicalAvgPm25: number;
      predictedAvgPm25: number;
      historicalAvgPm10: number;
      predictedAvgPm10: number;
    }
  >;
}

export interface ExposureEntry {
  id: string;
  date: string;
  cityId: CityId;
  activity: ExposureActivityType;
  durationMinutes: number;
  estimatedPm25: number;
  inhaledDoseUg: number;
}

export interface HotspotEpisodeMonth {
  month: string;
  episodes: number;
  avgPeakAqi: number;
}

export interface PollutionHotspot {
  id: string;
  cityId: CityId;
  name: string;
  wardOrZone: string;
  coordinates: [number, number];
  rankInCity: number;
  severity: AQICategory;
  severityScore: number;
  dominantPollutant: PollutantKey;
  pm25Avg: number;
  pm10Avg: number;
  no2Avg: number;
  so2Avg: number;
  annualEpisodeDays: number;
  peakWindow: string;
  primaryDrivers: string[];
  mitigationBrief: string;
  monthlyEpisodes: HotspotEpisodeMonth[];
}

export interface UserProfile {
  id: number;
  fullName: string;
  email: string;
  preferredCity: CityId | string;
  createdAt?: string | null;
}

export interface FeatureImportanceItem {
  feature: string;
  label: string;
  importance: number;
}

export interface ModelInfo {
  modelVersion: string;
  algorithm: string;
  trainedAt: string;
  dataset: {
    totalStations: number;
    labeledStations: number;
    citiesCount: number;
    statesCount: number;
    categoryDistribution: Record<string, number>;
  };
  aqiMetrics: {
    r2: number;
    cvR2Mean: number;
    mae: number;
    rmse: number;
    classifierAccuracy: number;
    testSamples: number;
    trainSamples: number;
  };
  pm25Metrics: {
    r2: number;
    mae: number;
    rmse: number;
    samples: number;
  };
  aqiFeatureImportances: FeatureImportanceItem[];
  pm25FeatureImportances: FeatureImportanceItem[];
  databaseStats: {
    observationRows: number;
    predictionLogsCount: number;
    registeredUsers: number;
  };
}

export interface DatasetStation {
  id: number;
  state: string;
  city: string;
  station: string;
  latitude: number;
  longitude: number;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  so2: number | null;
  co: number | null;
  ozone: number | null;
  nh3: number | null;
  actualAqi: number | null;
  aqiCategory: AQICategory | null;
}

export interface CityDatasetStat {
  city: string;
  cityId: string;
  stationCount: number;
  avgPm25: number | null;
  avgPm10: number | null;
  avgNo2: number | null;
  avgSo2: number | null;
  avgCo: number | null;
  avgOzone: number | null;
  avgNh3: number | null;
  avgLat: number;
  avgLon: number;
  avgActualAqi: number;
  maxActualAqi: number;
  rfPredictedAqi: number;
  rfCategory: AQICategory;
}

export interface PredictionResult {
  logId: number;
  effectivePm25: number;
  estimatedPm25FromCoPollutants: number;
  pm25WasEstimated: boolean;
  predictedAqi: number;
  intervalLow: number;
  intervalHigh: number;
  treeStd: number;
  predictedCategory: AQICategory;
  aqiCategoryFromScore: AQICategory;
  categoryProbabilities: Record<string, number>;
  confidencePct: number;
  healthGuidance: string;
  modelVersion: string;
  algorithm: string;
}

export interface PredictionLogEntry {
  id: number;
  city: string;
  station: string | null;
  pm25: number;
  pm10: number;
  no2: number;
  so2: number;
  co: number;
  ozone: number;
  nh3: number;
  latitude: number;
  longitude: number;
  predictedAqi: number;
  predictedPm25: number | null;
  predictedCategory: AQICategory;
  confidencePct: number;
  modelVersion: string;
  createdAt: string;
}
