// SPDX-License-Identifier: GPL-3.0-or-later
// This file is part of Fork Tales.
// Copyright (C) 2024-2025 Fork Tales Contributors

interface AppHeaderProps {
  isConnected: boolean;
  partRoot: string | undefined;
}

export function AppHeader({ isConnected, partRoot }: AppHeaderProps) {
  return (
    <header className="mb-4 border-b border-[rgba(166,205,235,0.28)] pb-3 flex flex-col gap-2 bg-[rgba(8,14,22,0.18)] rounded-xl px-3 shadow-[0_6px_16px_rgba(2,8,14,0.16)] pointer-events-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-3">
          <span className="opacity-50">ημ</span>
          <span>eta-mu world daemon</span>
        </h1>
        <div className="flex items-center gap-4">
          <p className="text-muted text-xs font-mono hidden md:block">
            Part <code>{partRoot || "?"}</code>
          </p>
          {!isConnected ? (
            <span className="text-[#f92672] font-bold text-xs animate-pulse">● Disconnected</span>
          ) : (
            <span className="text-[#a6e22e] font-bold text-xs flex items-center gap-2">● Connected</span>
          )}
        </div>
      </div>
    </header>
  );
}
