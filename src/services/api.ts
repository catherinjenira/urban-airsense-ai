import type {
  CityDatasetStat,
  CityId,
  DatasetStation,
  ExposureActivityType,
  ExposureEntry,
  ModelInfo,
  PredictionLogEntry,
  PredictionResult,
  UserProfile,
} from '../types';

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...(options.headers as Record<string, string> | undefined),
  };

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  });

  const text = await res.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { detail: text };
    }
  }

  if (!res.ok) {
    const msg =
      typeof data.detail === 'string'
        ? data.detail
        : `Request failed with status ${res.status}`;
    throw new Error(msg);
  }

  return data as T;
}

export async function signupUser(payload: {
  fullName: string;
  email: string;
  password: string;
  preferredCity: CityId;
}): Promise<{ user: UserProfile }> {
  return apiRequest<{ user: UserProfile }>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function loginUser(payload: {
  email: string;
  password: string;
}): Promise<{ user: UserProfile }> {
  return apiRequest<{ user: UserProfile }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function logoutUser(): Promise<void> {
  await apiRequest('/api/auth/logout', { method: 'POST' });
}

export async function fetchCurrentUser(): Promise<UserProfile> {
  const res = await apiRequest<{ user: UserProfile }>('/api/auth/me', {
    method: 'GET',
  });
  return res.user;
}

export async function fetchModelInfo(): Promise<ModelInfo> {
  return apiRequest<ModelInfo>('/api/model/info');
}

export async function fetchDatasetStations(params?: {
  city?: string;
  search?: string;
  limit?: number;
}): Promise<{ stations: DatasetStation[]; count: number }> {
  const qs = new URLSearchParams();
  if (params?.city) qs.set('city', params.city);
  if (params?.search) qs.set('search', params.search);
  if (params?.limit) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiRequest<{ stations: DatasetStation[]; count: number }>(
    `/api/dataset/stations${suffix}`
  );
}

export async function fetchCityDatasetStats(): Promise<{
  cities: CityDatasetStat[];
}> {
  return apiRequest<{ cities: CityDatasetStat[] }>('/api/dataset/city-stats');
}

export async function runRandomForestPrediction(payload: {
  city: string;
  station?: string | null;
  pm25?: number | null;
  pm10: number;
  no2: number;
  so2: number;
  co: number;
  ozone: number;
  nh3: number;
  latitude: number;
  longitude: number;
  estimatePm25?: boolean;
}): Promise<PredictionResult> {
  return apiRequest<PredictionResult>('/api/predict', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchPredictionHistory(
  limit = 20
): Promise<{ history: PredictionLogEntry[] }> {
  return apiRequest<{ history: PredictionLogEntry[] }>(
    `/api/predictions/history?limit=${limit}`,
    { method: 'GET' }
  );
}

export async function fetchExposureLogs(): Promise<{ entries: ExposureEntry[] }> {
  return apiRequest<{ entries: ExposureEntry[] }>('/api/exposure', {
    method: 'GET',
  });
}

export async function createExposureLog(payload: {
  entryDate: string;
  cityId: CityId;
  activity: ExposureActivityType;
  durationMinutes: number;
  estimatedPm25: number;
  inhaledDoseUg: number;
}): Promise<{ entry: ExposureEntry }> {
  return apiRequest<{ entry: ExposureEntry }>('/api/exposure', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteExposureLog(id: string): Promise<void> {
  await apiRequest(`/api/exposure/${id}`, { method: 'DELETE' });
}
