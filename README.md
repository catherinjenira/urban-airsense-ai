# Urban AirSense AI

Full-stack environmental intelligence platform for Indian cities combining a **MySQL / SQL backend**, **HttpOnly cookie & CSRF-protected authentication (Login & Sign Up)**, and a **250-tree Random Forest Regressor & Classifier** trained on real CPCB monitoring station data (`3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69.csv`).

---

## 1. Chosen Vertical

**Urban Environmental Intelligence & Public Health (Air Quality Monitoring & Personal Exposure Analytics)**

Urban residents, commuters, and city planners in India face sharp micro-climate AQI variations across neighborhoods and lack accessible tools that turn multi-pollutant sensor data into actionable, personalized respiratory guidance. **Urban AirSense AI** serves daily commuters, runners, and families by pairing city-level CPCB monitoring data with machine-learning AQI forecasting and personal inhaled-dose tracking.

---

## 2. Approach and Logic

1. **Relational SQL Data Layer (`backend/db.py`, `backend/init_db.py`)**:
   - Ingests `3,990` raw CPCB pollutant observations across `570` monitoring stations, `292` cities, and `31` states into normalized SQL tables (`air_quality_observations` and pivoted `station_profiles`).
   - Persists user accounts (`users`), SHA-256 hashed session tokens (`user_sessions`), user Random Forest predictions (`prediction_logs`), and personal activity logs (`exposure_logs`).
   - Supports **MySQL** (`pymysql`) as the primary backend and automatically falls back to **SQLite** in serverless cloud environments (`VERCEL=1`) when no remote `DB_HOST` is attached.

2. **Random Forest Modeling (`backend/train_model.py`)**:
   - **Composite AQI Regressor**: 250-tree `RandomForestRegressor` (`max_depth=16`, `min_samples_leaf=2`) with median imputation trained on `[pm25, pm10, no2, so2, co, ozone, nh3, latitude, longitude]` (`R² = 0.9786`, 5-fold CV `R² = 0.984`, `MAE = 4.73`, `RMSE = 10.71`).
   - **AQI Category Classifier**: 250-tree balanced `RandomForestClassifier` predicting CPCB categories (`Good` through `Severe`, holdout accuracy `94.55%`).
   - **Co-Pollutant PM2.5 Estimator**: 250-tree `RandomForestRegressor` trained on `[pm10, no2, so2, co, ozone, nh3, latitude, longitude]` (`R² = 0.7535`, `MAE = 27.06`) to estimate PM2.5 whenever a PM2.5 sensor reading is missing.
   - **Zero-Bloat Serverless Inference**: Exports all 250 trained CART trees per model into a compact `1.11 MB` gzipped artifact (`backend/models/rf_inference_trees.json.gz`), keeping the repository well under `10 MB` and the Vercel Python serverless bundle fast and lightweight while matching `scikit-learn` predictions to `< 1e-3`.

3. **Contextual Decision-Making**:
   - User signup captures a `preferredCity` so the dashboard opens directly to the user's home city (`Chennai`, `Bengaluru`, `Hyderabad`, `Delhi`, `Mumbai`, or `Coimbatore`).
   - Prediction results compute **90% tree-ensemble uncertainty intervals (`p05`–`p95`)**, **ensemble confidence %**, **category probabilities**, and **CPCB health guidance** tailored to the predicted category.
   - `MyExposure` adjusts personal inhaled PM2.5 dose using activity ventilation multipliers (`Walking`, `Jogging`, `Cycling`, `Commuting`) and real SQL city PM2.5 averages.

---

## 3. How the Solution Works

1. **Authentication Flow (`src/pages/AuthPage.tsx`, `/api/auth/*`)**:
   - Users register or sign in; passwords are salted and hashed with PBKDF2-HMAC-SHA256 (`200,000` iterations).
   - The backend issues an `HttpOnly`, `SameSite=Lax` cookie (`airsense_session`) storing only a SHA-256 hash in `user_sessions`, guarded by sliding-window rate limiting and `X-Requested-With` CSRF validation.
2. **Overview & Spatial Explorer (`src/pages/Overview.tsx`, `src/pages/ExploreMap.tsx`)**:
   - Displays current city AQI benchmarks computed from SQL `station_profiles` + Random Forest inference (`/api/dataset/city-stats`) and plots real CPCB SQL stations on an interactive Leaflet map.
3. **Random Forest Prediction Studio (`src/pages/Predictions.tsx`, `/api/predict`)**:
   - Users search/load any station from SQL or enter custom readings, optionally toggle **Estimate PM2.5 via RF**, run 250-tree inference, inspect Gini feature importances, and review their saved SQL prediction history.
4. **Personal Exposure Tracker (`src/pages/MyExposure.tsx`, `/api/exposure`)**:
   - Calculates inhaled PM2.5 dose (`µg`) and persists user activity logs in SQL with strict per-user isolation.

---

## 4. Assumptions Made

- **CPCB Composite AQI Labeling**: Consistent with CPCB/NAQI guidelines, station-level ground truth AQI is computed for stations reporting at least 3 pollutants (including `PM2.5` or `PM10`) as the maximum sub-index across reported pollutants.
- **Missing Sensor Readings**: Stations lacking one or more co-pollutants are imputed using training-set medians (`SimpleImputer(strategy="median")`).
- **Diurnal & Multi-Horizon Trends**: Because the source CSV provides a single synoptic snapshot (`3,990` rows across `570` stations), 24-hour/7-day trend curves and 1h–24h trajectory envelopes use calibrated diurnal coastal/inland factors anchored to city baselines.
- **Cloud Database Fallback**: Local development connects to MySQL (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` in `.env`); on Vercel without external MySQL env vars configured, the backend falls back to ephemeral `/tmp` SQLite so all features remain testable out of the box.

---

## 5. Local Setup, Testing & Deployment

### Local Development
```bash
# 1. Configure .env from .env.example with your MySQL credentials
# 2. Initialize MySQL tables, ingest CSV, and train the Random Forest models
npm run train

# 3. Install frontend dependencies and start backend + frontend
npm install
npm run backend   # FastAPI on http://127.0.0.1:8000
npm run dev       # Vite on http://localhost:3000
```

### Verification Commands
```bash
npm run lint          # Strict TypeScript check (tsc --noEmit)
npm test              # Frontend unit tests (node --test)
npm run test:backend  # Backend API, SQL, security, CSRF & ML tests (pytest)
npm run build         # Production Vite bundle with route/vendor code-splitting
```

### Vercel Deployment
- `vercel.json` builds `dist/` via `npm run build`, sets security headers across static routes, and routes `/api/*` to `api/index.py`.
- Configure `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL`, and `ALLOWED_ORIGINS` in Vercel Project Settings for persistent cloud MySQL.
