// SPDX-License-Identifier: GPL-3.0-or-later
// This file is part of Fork Tales.
// Copyright (C) 2024-2025 Fork Tales Contributors

import { useState, useCallback, useEffect, useRef } from "react";
import type { UiToast } from "../app/appShellTypes";

export interface ToastManager {
  uiToasts: UiToast[];
  dismissToast: (id: number) => void;
  emitUiToast: (title: string, body: string) => void;
}

export function useToastManager(): ToastManager {
  const [uiToasts, setUiToasts] = useState<UiToast[]>([]);
  const toastSeqRef = useRef(0);
  const toastTimeoutsRef = useRef<Map<number, number>>(new Map());

  const dismissToast = useCallback((id: number) => {
    const timeoutId = toastTimeoutsRef.current.get(id);
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      toastTimeoutsRef.current.delete(id);
    }
    setUiToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    const toastTimeouts = toastTimeoutsRef.current;
    const handler: EventListener = (event) => {
      const customEvent = event as CustomEvent<{ title?: unknown; body?: unknown }>;
      const title =
        typeof customEvent.detail?.title === "string" ? customEvent.detail.title.trim() : "Notice";
      const body =
        typeof customEvent.detail?.body === "string" ? customEvent.detail.body.trim() : "";
      if (!body) {
        return;
      }

      const id = Date.now() + toastSeqRef.current;
      toastSeqRef.current += 1;
      setUiToasts((prev) => [{ id, title: title || "Notice", body }, ...prev].slice(0, 4));

      const timeoutId = window.setTimeout(() => {
        setUiToasts((prev) => prev.filter((toast) => toast.id !== id));
        toastTimeouts.delete(id);
      }, 5200);
      toastTimeouts.set(id, timeoutId);
    };

    window.addEventListener("ui:toast", handler);
    return () => {
      window.removeEventListener("ui:toast", handler);
      toastTimeouts.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      toastTimeouts.clear();
    };
  }, []);

  const emitUiToast = useCallback((title: string, body: string) => {
    const cleanTitle = String(title || "Notice").trim() || "Notice";
    const cleanBody = String(body || "").trim();
    if (!cleanBody) {
      return;
    }
    window.dispatchEvent(
      new CustomEvent("ui:toast", {
        detail: {
          title: cleanTitle,
          body: cleanBody,
        },
      }),
    );
  }, []);

  return { uiToasts, dismissToast, emitUiToast };
}
