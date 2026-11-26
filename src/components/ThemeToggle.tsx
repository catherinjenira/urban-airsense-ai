import { Moon, Sun } from 'lucide-react';
import { ThemeMode } from '../hooks/useTheme';

interface ThemeToggleProps {
  theme: ThemeMode;
  onToggle: () => void;
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245C45]"
    >
      {theme === 'light' ? (
        <Moon className="h-4 w-4 text-[#242B27]" aria-hidden="true" />
      ) : (
        <Sun className="h-4 w-4 text-[#A7B9A1]" aria-hidden="true" />
      )}
    </button>
  );
}
