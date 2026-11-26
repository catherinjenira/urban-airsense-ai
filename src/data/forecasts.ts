import { CityForecast, CityId, ForecastHorizon, ForecastPoint } from '../types';
import { getCategoryFromAqi } from '../utils/aqi';

function generateHorizonData(
  basePm25: number,
  basePm10: number,
  baseAqi: number,
  horizon: ForecastHorizon,
  trendBias: number
) {
  const histLabels =
    horizon === '1h'
      ? ['-3h', '-2h', '-1h', 'Now']
      : horizon === '3h'
      ? ['-6h', '-4h', '-2h', 'Now']
      : horizon === '6h'
      ? ['-12h', '-8h', '-4h', 'Now']
      : ['-24h', '-18h', '-12h', '-6h', 'Now'];

  const futLabels =
    horizon === '1h'
      ? ['+20m', '+40m', '+1h']
      : horizon === '3h'
      ? ['+1h', '+2h', '+3h']
      : horizon === '6h'
      ? ['+2h', '+4h', '+6h']
      : ['+6h', '+12h', '+18h', '+24h'];

  const histFactors =
    histLabels.length === 4 ? [0.95, 1.03, 1.01, 1.0] : [0.91, 1.04, 0.96, 1.06, 1.0];

  const futFactors =
    futLabels.length === 3
      ? [1.0 + trendBias * 0.4, 1.0 + trendBias * 0.75, 1.0 + trendBias]
      : [
          1.0 + trendBias * 0.5,
          1.0 + trendBias * 1.1,
          1.0 + trendBias * 0.65,
          1.0 + trendBias * 0.3,
        ];

  const points: ForecastPoint[] = [];

  histLabels.forEach((label, i) => {
    const f = histFactors[i];
    points.push({
      label,
      type: 'historical',
      pm25: Math.round(basePm25 * f),
      pm10: Math.round(basePm10 * f),
      aqi: Math.round(baseAqi * f),
    });
  });

  futLabels.forEach((label, i) => {
    const f = futFactors[i];
    const spread = 0.08 + i * 0.035;
    const pm25 = Math.round(basePm25 * f);
    const pm10 = Math.round(basePm10 * f);
    points.push({
      label,
      type: 'forecast',
      pm25,
      pm10,
      pm25Lower: Math.max(5, Math.round(pm25 * (1 - spread))),
      pm25Upper: Math.round(pm25 * (1 + spread)),
      pm10Lower: Math.max(10, Math.round(pm10 * (1 - spread))),
      pm10Upper: Math.round(pm10 * (1 + spread)),
      aqi: Math.round(baseAqi * f),
    });
  });

  const histPts = points.filter((p) => p.type === 'historical');
  const futPts = points.filter((p) => p.type === 'forecast');

  const predictedPeakAqi = Math.max(...futPts.map((p) => p.aqi));
  const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);

  return {
    points,
    predictedPeakAqi,
    predictedCategory: getCategoryFromAqi(predictedPeakAqi),
    historicalAvgPm25: avg(histPts.map((p) => p.pm25)),
    predictedAvgPm25: avg(futPts.map((p) => p.pm25)),
    historicalAvgPm10: avg(histPts.map((p) => p.pm10)),
    predictedAvgPm10: avg(futPts.map((p) => p.pm10)),
  };
}

export const CITY_FORECASTS: Record<CityId, CityForecast> = {
  chennai: {
    cityId: 'chennai',
    modelName: 'AirSense Spatio-Temporal Ensemble (Simulated)',
    confidencePct: 87,
    lastRunLabel: 'Simulated cycle · Updated on local clock',
    factors: [
      {
        factor: 'Bay of Bengal Sea Breeze (16 km/h ESE)',
        impact: 'Dispersion relief',
        detail: 'Onshore advection keeps evening particulate accumulation bounded across coastal wards.',
      },
      {
        factor: 'Evening Arterial Traffic Window',
        impact: 'Upward pressure',
        detail: 'Peak commuter density along Anna Salai and OMR adds short-lived NO2 and PM2.5.',
      },
      {
        factor: 'Coastal Boundary Layer (~940m)',
        impact: 'Neutral',
        detail: 'Adequate vertical mixing prevents sharp overnight stagnation.',
      },
    ],
    horizons: {
      '1h': generateHorizonData(34, 68, 78, '1h', 0.06),
      '3h': generateHorizonData(34, 68, 78, '3h', 0.12),
      '6h': generateHorizonData(34, 68, 78, '6h', 0.08),
      '24h': generateHorizonData(34, 68, 78, '24h', -0.05),
    },
  },
  bengaluru: {
    cityId: 'bengaluru',
    modelName: 'AirSense Spatio-Temporal Ensemble (Simulated)',
    confidencePct: 89,
    lastRunLabel: 'Simulated cycle · Updated on local clock',
    factors: [
      {
        factor: 'Plateau Crosswinds (14 km/h SE)',
        impact: 'Dispersion relief',
        detail: 'Sustained crosswinds disperse fine exhaust quickly after junction peaks.',
      },
      {
        factor: 'IT Corridor Resuspended Road Dust',
        impact: 'Upward pressure',
        detail: 'Dry afternoon traffic elevates coarse PM10 along Outer Ring Road approaches.',
      },
      {
        factor: 'Moderate Relative Humidity (54%)',
        impact: 'Neutral',
        detail: 'Low hygroscopic growth keeps visibility high across residential zones.',
      },
    ],
    horizons: {
      '1h': generateHorizonData(26, 64, 64, '1h', 0.04),
      '3h': generateHorizonData(26, 64, 64, '3h', 0.09),
      '6h': generateHorizonData(26, 64, 64, '6h', -0.04),
      '24h': generateHorizonData(26, 64, 64, '24h', -0.08),
    },
  },
  hyderabad: {
    cityId: 'hyderabad',
    modelName: 'AirSense Spatio-Temporal Ensemble (Simulated)',
    confidencePct: 84,
    lastRunLabel: 'Simulated cycle · Updated on local clock',
    factors: [
      {
        factor: 'Gentle Nocturnal Wind Drop (<9 km/h)',
        impact: 'Upward pressure',
        detail: 'Reduced wind shear after sunset allows northwestern industrial plumes to linger.',
      },
      {
        factor: 'Midday Solar Thermal Mixing',
        impact: 'Dispersion relief',
        detail: 'Afternoon heating lifts mixing height above 1,000m, diluting surface PM2.5.',
      },
      {
        factor: 'Dry Plateau Air Mass (42% RH)',
        impact: 'Upward pressure',
        detail: 'Dry soil conditions increase background coarse mineral dust during road transit.',
      },
    ],
    horizons: {
      '1h': generateHorizonData(65, 112, 118, '1h', 0.07),
      '3h': generateHorizonData(65, 112, 118, '3h', 0.14),
      '6h': generateHorizonData(65, 112, 118, '6h', 0.16),
      '24h': generateHorizonData(65, 112, 118, '24h', 0.05),
    },
  },
  delhi: {
    cityId: 'delhi',
    modelName: 'AirSense Spatio-Temporal Ensemble (Simulated)',
    confidencePct: 81,
    lastRunLabel: 'Simulated cycle · Updated on local clock',
    factors: [
      {
        factor: 'Shallow Nocturnal Inversion (~320m)',
        impact: 'Upward pressure',
        detail: 'Cooler surface layer caps vertical dispersion, trapping local emissions near ground.',
      },
      {
        factor: 'Calm WNW Surface Winds (5 km/h)',
        impact: 'Upward pressure',
        detail: 'Minimal horizontal flushing allows eastern and central pockets to intensify overnight.',
      },
      {
        factor: 'Midday Solar Breakup Window',
        impact: 'Dispersion relief',
        detail: 'Brief afternoon warming offers modest 15–20% dip before evening re-accumulation.',
      },
    ],
    horizons: {
      '1h': generateHorizonData(146, 268, 318, '1h', 0.05),
      '3h': generateHorizonData(146, 268, 318, '3h', 0.11),
      '6h': generateHorizonData(146, 268, 318, '6h', 0.15),
      '24h': generateHorizonData(146, 268, 318, '24h', 0.08),
    },
  },
  mumbai: {
    cityId: 'mumbai',
    modelName: 'AirSense Spatio-Temporal Ensemble (Simulated)',
    confidencePct: 85,
    lastRunLabel: 'Simulated cycle · Updated on local clock',
    factors: [
      {
        factor: 'High Coastal Humidity (76% RH)',
        impact: 'Upward pressure',
        detail: 'Moisture encourages secondary aerosol swelling near port and eastern highway zones.',
      },
      {
        factor: 'Arabian Sea Afternoon Breeze (11 km/h)',
        impact: 'Dispersion relief',
        detail: 'Westerly gusts flush western seafront wards more effectively than inland basins.',
      },
      {
        factor: 'Metro & Civil Dust Resuspension',
        impact: 'Upward pressure',
        detail: 'Sustained PM10 contribution from active corridor excavation and freight movement.',
      },
    ],
    horizons: {
      '1h': generateHorizonData(68, 154, 136, '1h', 0.04),
      '3h': generateHorizonData(68, 154, 136, '3h', 0.10),
      '6h': generateHorizonData(68, 154, 136, '6h', 0.06),
      '24h': generateHorizonData(68, 154, 136, '24h', -0.04),
    },
  },
  coimbatore: {
    cityId: 'coimbatore',
    modelName: 'AirSense Spatio-Temporal Ensemble (Simulated)',
    confidencePct: 91,
    lastRunLabel: 'Simulated cycle · Updated on local clock',
    factors: [
      {
        factor: 'Palghat Gap Westerly Flow (19 km/h)',
        impact: 'Dispersion relief',
        detail: 'Consistent gap winds maintain high ventilation efficiency across residential wards.',
      },
      {
        factor: 'Southern Foundry Perimeter Activity',
        impact: 'Neutral',
        detail: 'Localized Kurichi particulate plumes remain contained south of city center.',
      },
      {
        factor: 'Deep Mixing Layer (~1,240m)',
        impact: 'Dispersion relief',
        detail: 'Strong atmospheric dilution keeps 24h forecast comfortably within Good thresholds.',
      },
    ],
    horizons: {
      '1h': generateHorizonData(21, 46, 46, '1h', -0.02),
      '3h': generateHorizonData(21, 46, 46, '3h', 0.04),
      '6h': generateHorizonData(21, 46, 46, '6h', -0.06),
      '24h': generateHorizonData(21, 46, 46, '24h', -0.08),
    },
  },
};
