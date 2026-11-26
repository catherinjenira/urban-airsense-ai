import { lazy, Suspense, useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { CITY_MAP } from './data/cities';
import { INITIAL_ALERTS } from './data/measurements';
import { useTheme } from './hooks/useTheme';
import {
  fetchCurrentUser,
  logoutUser,
} from './services/api';
import { CityAlert, CityId, PageId, UserProfile } from './types';

const AuthPage = lazy(() =>
  import('./pages/AuthPage').then((m) => ({ default: m.AuthPage }))
);
const Overview = lazy(() =>
  import('./pages/Overview').then((m) => ({ default: m.Overview }))
);
const ExploreMap = lazy(() =>
  import('./pages/ExploreMap').then((m) => ({ default: m.ExploreMap }))
);
const Predictions = lazy(() =>
  import('./pages/Predictions').then((m) => ({ default: m.Predictions }))
);
const MyExposure = lazy(() =>
  import('./pages/MyExposure').then((m) => ({ default: m.MyExposure }))
);
const Hotspots = lazy(() =>
  import('./pages/Hotspots').then((m) => ({ default: m.Hotspots }))
);

function resolveCityId(candidate?: string): CityId {
  if (candidate && candidate in CITY_MAP) {
    return candidate as CityId;
  }
  return 'chennai';
}

function PageLoader({ label = 'Loading view...' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-[240px] flex items-center justify-center text-xs text-[var(--text-muted)] font-mono-tabular"
    >
      {label}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [activePage, setActivePage] = useState<PageId>('overview');
  const [selectedCity, setSelectedCity] = useState<CityId>('chennai');
  const [alerts, setAlerts] = useState<CityAlert[]>(INITIAL_ALERTS);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    fetchCurrentUser()
      .then((profile) => {
        setUser(profile);
        setSelectedCity(resolveCityId(profile.preferredCity));
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setAuthChecking(false);
      });
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activePage]);

  const handleAuthenticated = (profile: UserProfile) => {
    setUser(profile);
    setSelectedCity(resolveCityId(profile.preferredCity));
    setActivePage('overview');
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch {
      // Clear local session state even if network request fails
    } finally {
      setUser(null);
      setActivePage('overview');
    }
  };

  const handleMarkAlertRead = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, read: true } : a))
    );
  };

  const handleMarkAllAlertsRead = () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
  };

  if (authChecking) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="min-h-screen flex items-center justify-center bg-[var(--bg-canvas)] text-[var(--text-primary)]"
      >
        <div className="text-center space-y-2">
          <div className="font-display text-xl text-[#173D30] dark:text-[#ECF0EC]">
            Urban AirSense AI
          </div>
          <p className="text-xs text-[var(--text-muted)] font-mono-tabular">
            Verifying SQL session...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Suspense fallback={<PageLoader label="Loading sign in..." />}>
        <AuthPage
          theme={theme}
          onToggleTheme={toggleTheme}
          onAuthenticated={handleAuthenticated}
        />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)] transition-colors duration-200">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-[#245C45] focus:px-3.5 focus:py-2 focus:text-xs focus:font-medium focus:text-white focus:shadow-md"
      >
        Skip to main content
      </a>

      <Navbar
        activePage={activePage}
        onNavigate={setActivePage}
        selectedCity={selectedCity}
        onSelectCity={setSelectedCity}
        theme={theme}
        onToggleTheme={toggleTheme}
        alerts={alerts}
        onMarkAlertRead={handleMarkAlertRead}
        onMarkAllAlertsRead={handleMarkAllAlertsRead}
        user={user}
        onLogout={handleLogout}
      />

      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 mx-auto w-full max-w-[1220px] px-4 sm:px-6 lg:px-8 py-7 sm:py-10 focus:outline-none"
      >
        <Suspense fallback={<PageLoader />}>
          {activePage === 'overview' && (
            <Overview
              selectedCity={selectedCity}
              onSelectCity={setSelectedCity}
              onNavigate={setActivePage}
              alerts={alerts}
            />
          )}

          {activePage === 'explore-map' && (
            <ExploreMap
              selectedCity={selectedCity}
              onSelectCity={setSelectedCity}
              theme={theme}
            />
          )}

          {activePage === 'predictions' && (
            <Predictions
              selectedCity={selectedCity}
              onSelectCity={setSelectedCity}
            />
          )}

          {activePage === 'my-exposure' && (
            <MyExposure selectedCity={selectedCity} />
          )}

          {activePage === 'hotspots' && (
            <Hotspots
              selectedCity={selectedCity}
              onSelectCity={setSelectedCity}
              theme={theme}
            />
          )}
        </Suspense>
      </main>

      <footer className="border-t border-[var(--border-hairline)] bg-[var(--bg-canvas)]">
        <div className="mx-auto max-w-[1220px] px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[var(--text-muted)]">
          <div>
            <span className="font-medium text-[var(--text-primary)]">
              Urban AirSense AI
            </span>
            <span className="mx-2" aria-hidden="true">·</span>
            <span>
              SQL-backed environmental intelligence &amp; Random Forest modeling for Indian cities.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            {(
              [
                { id: 'overview', label: 'Overview' },
                { id: 'explore-map', label: 'Explore Map' },
                { id: 'predictions', label: 'Predictions' },
                { id: 'my-exposure', label: 'My Exposure' },
                { id: 'hotspots', label: 'Hotspots' },
              ] as const
            ).map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => setActivePage(link.id)}
                className="hover:text-[var(--text-primary)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245C45]"
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
