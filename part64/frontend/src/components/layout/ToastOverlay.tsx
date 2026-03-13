// SPDX-License-Identifier: GPL-3.0-or-later
// This file is part of Fork Tales.
// Copyright (C) 2024-2025 Fork Tales Contributors

import type { UiToast } from "../../app/appShellTypes";

interface ToastOverlayProps {
  toasts: UiToast[];
  onDismiss: (id: number) => void;
}

export function ToastOverlay({ toasts, onDismiss }: ToastOverlayProps) {
  if (toasts.length <= 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[80] pointer-events-none flex w-[min(92vw,360px)] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto rounded-lg border border-[rgba(102,217,239,0.45)] bg-[rgba(12,23,31,0.94)] px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#9ec7dd]">
                {toast.title}
              </p>
              <p className="text-sm text-[#e9f6ff] mt-1">{toast.body}</p>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="text-xs text-[#9ec7dd] hover:text-white transition-colors"
            >
              dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
