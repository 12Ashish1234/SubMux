import { useState, useEffect } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    const saved = localStorage.getItem('submux-theme');
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved as ThemePreference;
    }
    return 'system'; // Default to following system settings
  });

  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  // Listen to live macOS system appearance changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const resolvedTheme: ResolvedTheme =
    preference === 'system' ? (systemIsDark ? 'dark' : 'light') : preference;

  // Apply to DOM whenever theme or preference updates
  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }

    if (preference === 'system') {
      localStorage.removeItem('submux-theme');
    } else {
      localStorage.setItem('submux-theme', preference);
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
