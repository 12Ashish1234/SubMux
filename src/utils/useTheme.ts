import { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    // Clear legacy key from v0.1.0/v0.1.1 that may have pinned user to manual dark mode
    try {
      localStorage.removeItem('submux-theme');
    } catch {
      // Ignore
    }

    const saved = localStorage.getItem('submux-theme-preference');
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved as ThemePreference;
    }
    return 'system'; // Default to following macOS system settings
  });

  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Listen to live macOS system appearance changes using Tauri native window events + matchMedia
  useEffect(() => {
    let unlistenTauri: (() => void) | undefined;

    // 1. Native macOS Tauri window theme detection
    try {
      const win = getCurrentWindow();
      win.theme()
        .then((t) => {
          if (t) setSystemIsDark(t === 'dark');
        })
        .catch(() => {});

      win.onThemeChanged(({ payload: theme }) => {
        setSystemIsDark(theme === 'dark');
      })
        .then((unlisten) => {
          unlistenTauri = unlisten;
        })
        .catch(() => {});
    } catch {
      // Fallback if not running in Tauri window context
    }

    // 2. WebKit media query listener
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => {
        setSystemIsDark(e.matches);
      };
      mediaQuery.addEventListener('change', handler);
      return () => {
        mediaQuery.removeEventListener('change', handler);
        if (unlistenTauri) unlistenTauri();
      };
    }

    return () => {
      if (unlistenTauri) unlistenTauri();
    };
  }, []);

  const resolvedTheme: ResolvedTheme =
    preference === 'system' ? (systemIsDark ? 'dark' : 'light') : preference;

  // Apply to DOM and Tauri native window appearance
  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }

    // Inform native macOS window of preference
    try {
      const win = getCurrentWindow();
      if (preference === 'system') {
        win.setTheme(null).catch(() => {});
      } else {
        win.setTheme(preference).catch(() => {});
      }
    } catch {
      // Ignore
    }

    if (preference === 'system') {
      localStorage.removeItem('submux-theme-preference');
    } else {
      localStorage.setItem('submux-theme-preference', preference);
    }
  }, [resolvedTheme, preference]);

  // Cycle: System (Auto) -> Light -> Dark -> System
  const toggleTheme = () => {
    setPreference((prev) => {
      if (prev === 'system') return 'light';
      if (prev === 'light') return 'dark';
      return 'system';
    });
  };

  return {
    theme: resolvedTheme,
    preference,
    toggleTheme,
    setPreference,
  };
}
