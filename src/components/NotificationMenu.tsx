import { Bell, Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CITY_MAP } from '../data/cities';
import { CityAlert, CityId } from '../types';
import { AQI_COLORS } from '../utils/aqi';

interface NotificationMenuProps {
  alerts: CityAlert[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onSelectCityFromAlert: (cityId: CityId) => void;
}

export function NotificationMenu({
  alerts,
  onMarkRead,
  onMarkAllRead,
  onSelectCityFromAlert,
}: NotificationMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const unreadCount = alerts.filter((a) => !a.read).length;

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={`Environmental notifications (${unreadCount} unread)`}
        className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245C45]"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-xs bg-[#245C45] px-1 text-[10px] font-mono-tabular font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Simulated air quality advisories"
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-md border border-[var(--border-hairline)] bg-[var(--bg-elevated)] shadow-lg z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between border-b border-[var(--border-hairline)] px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Air Quality Advisories
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Simulated regional alerts · Demonstration feed
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#245C45] dark:text-[#A7B9A1] hover:underline whitespace-nowrap shrink-0"
              >
                <Check className="h-3 w-3" aria-hidden="true" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-[var(--border-hairline)]">
            {alerts.map((alert) => {
              const city = CITY_MAP[alert.cityId];
              const severityColor = AQI_COLORS[alert.severity];
              return (
                <div
                  key={alert.id}
                  className={`px-4 py-3 transition-colors ${
                    alert.read
                      ? 'opacity-75 hover:bg-[var(--bg-subtle)]/50'
                      : 'bg-[#245C45]/[0.04] dark:bg-[#A7B9A1]/[0.05] hover:bg-[var(--bg-subtle)]/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                    <span className="font-medium text-[var(--text-primary)]">
                      {city.name} · {alert.zone}
                    </span>
                    <span className="tabular-nums">{alert.issuedAt}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-[var(--text-primary)] leading-snug">
                    {alert.title}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">
                    {alert.summary}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-primary)]">
                      <span
                        className="inline-block h-2 w-2 rounded-sm"
                        style={{ backgroundColor: severityColor }}
                        aria-hidden="true"
                      />
                      {alert.severity}
                    </span>
                    <div className="flex items-center gap-3">
                      {!alert.read && (
                        <button
                          type="button"
                          onClick={() => onMarkRead(alert.id)}
                          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        >
                          Dismiss
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          onSelectCityFromAlert(alert.cityId);
                          onMarkRead(alert.id);
                          setOpen(false);
                        }}
                        className="text-xs font-medium text-[#245C45] dark:text-[#A7B9A1] hover:underline"
                      >
                        View {city.name}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
