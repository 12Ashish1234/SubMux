import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { CheckCircle2, AlertCircle, Sun, Moon } from 'lucide-react';
import { EnvironmentStatus } from '../types';
import { Theme } from '../utils/useTheme';

interface TitleBarProps {
  envStatus: EnvironmentStatus | null;
  onRefreshEnv: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  envStatus,
  onRefreshEnv,
  theme,
  onToggleTheme,
}) => {
  const isHealthy = envStatus?.ffmpeg_available && envStatus?.ffprobe_available;

  const handleMouseDown = (e: React.MouseEvent<HTMLElement>) => {
    // Prevent dragging when clicking interactive controls
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, a, [data-no-drag]')) {
      return;
    }
    // Primary mouse button
    if (e.button === 0) {
      // Invoke native Rust window drag command
      invoke('start_window_drag').catch(() => {
        // Fallback to JS API
        getCurrentWindow().startDragging().catch(console.error);
      });
    }
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, a, [data-no-drag]')) {
      return;
    }
    getCurrentWindow().toggleMaximize().catch(console.error);
  };

  return (
    <header
      data-tauri-drag-region
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      className="h-11 bg-zinc-100/90 dark:bg-zinc-900/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800/90 flex items-center justify-between px-4 select-none shrink-0 sticky top-0 z-30 cursor-default transition-colors"
    >
      {/* Left side: traffic light clearance (pl-[78px]) + precisely aligned brand header */}
      <div
        data-tauri-drag-region
        className="flex items-center space-x-3 pl-[78px] h-full pointer-events-auto -translate-y-[2px]"
      >
        <div data-tauri-drag-region className="flex items-center space-x-2">
          {/* Custom SubMux Logo Glyph */}
          <div
            data-tauri-drag-region
            className="w-5 h-5 rounded-md bg-gradient-to-br from-sky-400 via-blue-600 to-indigo-600 p-0.5 shadow-sm shadow-blue-500/20 flex items-center justify-center shrink-0"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-3.5 h-3.5 text-white pointer-events-none"
            >
              <rect x="2" y="4" width="20" height="16" rx="4" stroke="currentColor" strokeWidth="2" />
              <path d="M7 15h3M14 15h3M7 11h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>

          <span data-tauri-drag-region className="font-semibold text-xs tracking-tight text-zinc-800 dark:text-zinc-100 leading-none">
            SubMux
          </span>
          <span
            data-tauri-drag-region
            className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200/80 dark:bg-zinc-800/90 text-zinc-600 dark:text-zinc-400 font-mono border border-zinc-300 dark:border-zinc-700/60 leading-none"
          >
            v0.1.0
          </span>
        </div>
      </div>

      {/* Right side: Theme Toggle & FFmpeg Status Pill */}
      <div data-no-drag className="flex items-center space-x-2.5 -translate-y-[2px]">
        {/* Light / Dark Mode Toggle */}
        <button
          type="button"
          data-no-drag
          data-tauri-drag-region="false"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="p-1 rounded-lg bg-zinc-200/80 dark:bg-zinc-800/80 hover:bg-zinc-300/80 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 border border-zinc-300/80 dark:border-zinc-700/60 transition-colors"
        >
          {theme === 'dark' ? (
            <Sun className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-indigo-500" />
          )}
        </button>

        {envStatus && (
          <button
            type="button"
            data-no-drag
            data-tauri-drag-region="false"
            onClick={onRefreshEnv}
            title={
              isHealthy
                ? `FFmpeg: ${envStatus.ffmpeg_version || 'Ready'}\nFFprobe: ${envStatus.ffprobe_version || 'Ready'}`
                : 'Click to recheck FFmpeg installation'
            }
            className={`flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${
              isHealthy
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 hover:bg-rose-500/20 animate-pulse'
            }`}
          >
            {isHealthy ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>FFmpeg Ready</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                <span>FFmpeg Missing</span>
              </>
            )}
          </button>
        )}
      </div>
    </header>
  );
};
