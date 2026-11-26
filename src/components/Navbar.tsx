import { LogOut, Menu, User, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ThemeMode } from '../hooks/useTheme';
import { CityAlert, CityId, PageId, UserProfile } from '../types';
import { CitySelector } from './CitySelector';
import { NotificationMenu } from './NotificationMenu';
import { ThemeToggle } from './ThemeToggle';

interface NavbarProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  selectedCity: CityId;
  onSelectCity: (city: CityId) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  alerts: CityAlert[];
  onMarkAlertRead: (id: string) => void;
  onMarkAllAlertsRead: () => void;
  user: UserProfile;
  onLogout: () => void;
}

const NAV_ITEMS: { id: PageId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'explore-map', label: 'Explore Map' },
  { id: 'predictions', label: 'Predictions' },
  { id: 'my-exposure', label: 'My Exposure' },
  { id: 'hotspots', label: 'Hotspots' },
];

export function Navbar({
  activePage,
  onNavigate,
  selectedCity,
  onSelectCity,
  theme,
  onToggleTheme,
  alerts,
  onMarkAlertRead,
  onMarkAllAlertsRead,
  user,
  onLogout,
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen]);

  const handleNavClick = (page: PageId) => {
    onNavigate(page);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-hairline)] bg-[var(--bg-canvas)]/95 backdrop-blur-xs">
      <div className="mx-auto flex h-16 max-w-[1220px] items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Editorial Wordmark */}
        <button
          type="button"
          onClick={() => handleNavClick('overview')}
          className="font-display text-lg sm:text-[21px] font-medium tracking-tight text-[#173D30] dark:text-[#ECF0EC] whitespace-nowrap shrink-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245C45]"
        >
          Urban AirSense AI
        </button>

        {/* Zone 2: 5 Clean Single-Line Navigation Links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-7"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative py-5 text-[13.5px] font-medium tracking-[0.005em] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245C45] ${
                  isActive
                    ? 'text-[#173D30] dark:text-[#ECF0EC]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#245C45] dark:bg-[#A7B9A1]"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Compact Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:block">
            <CitySelector
              selectedCity={selectedCity}
              onSelectCity={onSelectCity}
              compact
            />
          </div>

          <NotificationMenu
            alerts={alerts}
            onMarkRead={onMarkAlertRead}
            onMarkAllRead={onMarkAllAlertsRead}
            onSelectCityFromAlert={(cityId) => {
              onSelectCity(cityId);
              onNavigate('overview');
            }}
          />

          <ThemeToggle theme={theme} onToggle={onToggleTheme} />

          <div className="hidden lg:flex items-center gap-2 pl-2 ml-1 border-l border-[var(--border-hairline)]">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-primary)] max-w-[140px] truncate">
              <User className="h-3.5 w-3.5 text-[#245C45] dark:text-[#66BA86] shrink-0" aria-hidden="true" />
              <span className="truncate">{user.fullName}</span>
            </span>
            <button
              type="button"
              onClick={onLogout}
              title="Log out"
              aria-label="Log out"
              className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245C45]"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Log out</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-drawer"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] md:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245C45]"
          >
            {mobileMenuOpen ? (
              <X className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Menu className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          id="mobile-nav-drawer"
          className="border-t border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-4 md:hidden"
        >
          <div className="mb-3 sm:hidden">
            <span className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">
              Active City
            </span>
            <CitySelector
              selectedCity={selectedCity}
              onSelectCity={onSelectCity}
            />
          </div>
          <nav aria-label="Mobile navigation" className="grid grid-cols-2 gap-1.5">
            {NAV_ITEMS.map((item) => {
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => handleNavClick(item.id)}
                  className={`flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245C45] ${
                    isActive
                      ? 'bg-[#245C45] text-white'
                      : 'text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
                  }`}
                >
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="mt-3 pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-primary)]">
              <User className="h-3.5 w-3.5 text-[#245C45] dark:text-[#66BA86]" aria-hidden="true" />
              {user.fullName} ({user.email})
            </span>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)]"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
