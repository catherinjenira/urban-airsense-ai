import { ChevronDown, MapPin } from 'lucide-react';
import { CITIES } from '../data/cities';
import { CityId } from '../types';

interface CitySelectorProps {
  selectedCity: CityId;
  onSelectCity: (city: CityId) => void;
  compact?: boolean;
}

export function CitySelector({
  selectedCity,
  onSelectCity,
  compact = false,
}: CitySelectorProps) {
  return (
    <div className="relative inline-flex items-center">
      <MapPin
        className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[#245C45] dark:text-[#A7B9A1]"
        aria-hidden="true"
      />
      <select
        aria-label="Select city"
        value={selectedCity}
        onChange={(e) => onSelectCity(e.target.value as CityId)}
        className={`appearance-none cursor-pointer rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] font-medium transition-colors hover:border-[#245C45]/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245C45] ${
          compact ? 'pl-8 pr-7 py-1.5 text-xs' : 'pl-8 pr-8 py-2 text-sm'
        }`}
      >
        {CITIES.map((city) => (
          <option key={city.id} value={city.id}>
            {city.name}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-[var(--text-muted)]"
        aria-hidden="true"
      />
    </div>
  );
}
