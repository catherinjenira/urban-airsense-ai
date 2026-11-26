import type { AQICategory } from '../types';

export const AQI_COLORS: Record<AQICategory, string> = {
  Good: '#54A875',
  Satisfactory: '#A7BE57',
  Moderate: '#E7B64F',
  Poor: '#E58B45',
  'Very Poor': '#D65C50',
  Severe: '#8F3440',
};

export const AQI_TEXT_CLASSES: Record<AQICategory, string> = {
  Good: 'text-[#2F7D4E] dark:text-[#66BA86]',
  Satisfactory: 'text-[#6D8223] dark:text-[#B5CD66]',
  Moderate: 'text-[#A67B17] dark:text-[#EBBF5E]',
  Poor: 'text-[#B45E1A] dark:text-[#EE9B59]',
  'Very Poor': 'text-[#B43D32] dark:text-[#E57368]',
  Severe: 'text-[#7F2430] dark:text-[#D55E6E]',
};

export function getCategoryFromAqi(aqi: number): AQICategory {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Satisfactory';
  if (aqi <= 200) return 'Moderate';
  if (aqi <= 300) return 'Poor';
  if (aqi <= 400) return 'Very Poor';
  return 'Severe';
}

export function getCategoryFromPm25(pm25: number): AQICategory {
  if (pm25 <= 30) return 'Good';
  if (pm25 <= 60) return 'Satisfactory';
  if (pm25 <= 90) return 'Moderate';
  if (pm25 <= 120) return 'Poor';
  if (pm25 <= 250) return 'Very Poor';
  return 'Severe';
}

export function getCategoryRangeLabel(category: AQICategory): string {
  switch (category) {
    case 'Good':
      return '0–50 AQI';
    case 'Satisfactory':
      return '51–100 AQI';
    case 'Moderate':
      return '101–200 AQI';
    case 'Poor':
      return '201–300 AQI';
    case 'Very Poor':
      return '301–400 AQI';
    case 'Severe':
      return '401–500 AQI';
  }
}

export function getHealthGuidance(category: AQICategory): string {
  switch (category) {
    case 'Good':
      return 'Minimal air quality impact. Ideal conditions for sustained outdoor activity across all age groups.';
    case 'Satisfactory':
      return 'Acceptable ambient air for most residents; unusually sensitive individuals may notice minor respiratory discomfort near heavy traffic.';
    case 'Moderate':
      return 'Sensitive groups—including children, older adults, and people with asthma—should moderate prolonged vigorous exertion outdoors.';
    case 'Poor':
      return 'Elevated fine particulate load. Consider shifting outdoor workouts indoors and wearing a well-fitted N95/FFP2 respirator along arterial roads.';
    case 'Very Poor':
      return 'Widespread respiratory strain expected on sustained exposure. Avoid strenuous outdoor activity and keep indoor ventilation filtered.';
    case 'Severe':
      return 'Acute pollution episode. Minimize outdoor movement, seal indoor drafts where practical, and follow local health advisories.';
  }
}
