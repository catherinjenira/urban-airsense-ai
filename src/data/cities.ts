import type { CityId, CityInfo } from '../types';

export const CITIES: CityInfo[] = [
  {
    id: 'chennai',
    name: 'Chennai',
    state: 'Tamil Nadu',
    regionLabel: 'Coromandel Coast',
    coordinates: [13.0827, 80.2707],
    defaultZoom: 12,
    elevationM: 6,
    coastal: true,
    populationNote: 'Coastal metro · Bay of Bengal sea-breeze corridor',
  },
  {
    id: 'bengaluru',
    name: 'Bengaluru',
    state: 'Karnataka',
    regionLabel: 'Deccan Plateau',
    coordinates: [12.9716, 77.5946],
    defaultZoom: 12,
    elevationM: 920,
    coastal: false,
    populationNote: 'Elevated plateau · High-density arterial commuters',
  },
  {
    id: 'hyderabad',
    name: 'Hyderabad',
    state: 'Telangana',
    regionLabel: 'Telangana Plateau',
    coordinates: [17.3850, 78.4867],
    defaultZoom: 12,
    elevationM: 542,
    coastal: false,
    populationNote: 'Inland basin · Mixed industrial & peri-urban dust',
  },
  {
    id: 'delhi',
    name: 'Delhi',
    state: 'NCT Delhi',
    regionLabel: 'Indo-Gangetic Plain',
    coordinates: [28.6139, 77.2090],
    defaultZoom: 11,
    elevationM: 216,
    coastal: false,
    populationNote: 'Landlocked basin · Seasonal boundary-layer inversion',
  },
  {
    id: 'mumbai',
    name: 'Mumbai',
    state: 'Maharashtra',
    regionLabel: 'Konkan Coast',
    coordinates: [19.0760, 72.8777],
    defaultZoom: 12,
    elevationM: 14,
    coastal: true,
    populationNote: 'Peninsular coast · Arabian Sea moisture & port corridors',
  },
  {
    id: 'coimbatore',
    name: 'Coimbatore',
    state: 'Tamil Nadu',
    regionLabel: 'Western Ghats Foothills',
    coordinates: [11.0168, 76.9558],
    defaultZoom: 12,
    elevationM: 411,
    coastal: false,
    populationNote: 'Palghat Gap wind corridor · Textile & foundry clusters',
  },
];

export const CITY_MAP: Record<CityId, CityInfo> = CITIES.reduce(
  (acc, city) => {
    acc[city.id] = city;
    return acc;
  },
  {} as Record<CityId, CityInfo>
);
