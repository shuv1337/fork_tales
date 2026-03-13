// SPDX-License-Identifier: GPL-3.0-or-later
// This file is part of Fork Tales.
// Copyright (C) 2024-2025 Fork Tales Contributors

import { useCallback, useEffect, useRef } from "react";
import {
  USER_PRESENCE_BATCH_IDLE_FLUSH_MS,
  USER_PRESENCE_BATCH_MAX_EVENTS,
  USER_PRESENCE_BATCH_MAX_WINDOW_MS,
} from "../app/appShellConstants";
import type { UserPresenceInputPayload } from "../app/appShellTypes";
import { runtimeBaseUrl } from "../runtime/endpoints";

export interface UserPresenceInputApi {
  handleUserPresenceInput: (payload: UserPresenceInputPayload) => void;
}

export function useUserPresenceInput(): UserPresenceInputApi {
  const userPresenceHoverThrottleRef = useRef<Record<string, number>>({});
  const userPresenceGenericEmitMsRef = useRef(0);
  const userPresenceInputBatchRef = useRef<Record<string, unknown>[]>([]);
  const userPresenceInputBatchStartedMsRef = useRef(0);
  const userPresenceInputBatchLastMsRef = useRef(0);
  const userPresenceInputBatchIdleTimerRef = useRef<number | null>(null);
  const userPresenceInputBatchWindowTimerRef = useRef<number | null>(null);

  const clearUserPresenceInputBatchTimers = useCallback(() => {
    if (userPresenceInputBatchIdleTimerRef.current !== null) {
      window.clearTimeout(userPresenceInputBatchIdleTimerRef.current);
      userPresenceInputBatchIdleTimerRef.current = null;
    }
    if (userPresenceInputBatchWindowTimerRef.current !== null) {
      window.clearTimeout(userPresenceInputBatchWindowTimerRef.current);
      userPresenceInputBatchWindowTimerRef.current = null;
    }
  }, []);

  const flushUserPresenceInputBatch = useCallback((reason: string) => {
    if (userPresenceInputBatchRef.current.length <= 0) {
      clearUserPresenceInputBatchTimers();
      return;
    }

    const events = userPresenceInputBatchRef.current.slice(0, USER_PRESENCE_BATCH_MAX_EVENTS);
    userPresenceInputBatchRef.current = [];
    userPresenceInputBatchStartedMsRef.current = 0;
    userPresenceInputBatchLastMsRef.current = 0;
    clearUserPresenceInputBatchTimers();

    const baseUrl = runtimeBaseUrl();
    void fetch(`${baseUrl}/api/presence/user/input`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        events,
        flush_reason: reason,
        flushed_at_ms: Date.now(),
      }),
      keepalive: true,
    }).catch(() => undefined);
  }, [clearUserPresenceInputBatchTimers]);

  const scheduleUserPresenceInputBatchFlush = useCallback(() => {
    if (userPresenceInputBatchRef.current.length <= 0) {
      clearUserPresenceInputBatchTimers();
      return;
    }

    const nowMs = Date.now();
    const startedMs = userPresenceInputBatchStartedMsRef.current || nowMs;
    const lastMs = userPresenceInputBatchLastMsRef.current || nowMs;
    const idleDelayMs = Math.max(0, USER_PRESENCE_BATCH_IDLE_FLUSH_MS - (nowMs - lastMs));
    const maxWindowDelayMs = Math.max(0, USER_PRESENCE_BATCH_MAX_WINDOW_MS - (nowMs - startedMs));

    clearUserPresenceInputBatchTimers();
    userPresenceInputBatchIdleTimerRef.current = window.setTimeout(() => {
      flushUserPresenceInputBatch("idle_window");
    }, idleDelayMs);
    userPresenceInputBatchWindowTimerRef.current = window.setTimeout(() => {
      flushUserPresenceInputBatch("max_window");
    }, maxWindowDelayMs);
  }, [clearUserPresenceInputBatchTimers, flushUserPresenceInputBatch]);

  const emitUserPresenceInput = useCallback((payload: UserPresenceInputPayload) => {
    const kind = String(payload.kind || "input").trim().toLowerCase() || "input";
    const target = String(payload.target || "simulation").trim() || "simulation";
    const nowMs = Date.now();
    const eventRow: Record<string, unknown> = {
      kind,
      target,
      message: String(payload.message || "").trim(),
      embed_particle: Boolean(payload.embedParticle),
      meta: payload.meta && typeof payload.meta === "object" ? payload.meta : {},
      ts_client_ms: nowMs,
    };
    if (typeof payload.xRatio === "number" && Number.isFinite(payload.xRatio)) {
      eventRow.x_ratio = Math.max(0, Math.min(1, payload.xRatio));
    }
    if (typeof payload.yRatio === "number" && Number.isFinite(payload.yRatio)) {
      eventRow.y_ratio = Math.max(0, Math.min(1, payload.yRatio));
    }

    if (userPresenceInputBatchRef.current.length <= 0) {
      userPresenceInputBatchStartedMsRef.current = nowMs;
    }
    userPresenceInputBatchRef.current.push(eventRow);
    userPresenceInputBatchLastMsRef.current = nowMs;

    if (userPresenceInputBatchRef.current.length >= USER_PRESENCE_BATCH_MAX_EVENTS) {
      flushUserPresenceInputBatch("max_events");
      return;
    }
    scheduleUserPresenceInputBatchFlush();
  }, [flushUserPresenceInputBatch, scheduleUserPresenceInputBatchFlush]);

  const handleUserPresenceInput = useCallback((payload: UserPresenceInputPayload) => {
    emitUserPresenceInput(payload);
  }, [emitUserPresenceInput]);

  // Flush on page hide / visibility change / unmount
  useEffect(() => {
    const onPageHide = () => {
      flushUserPresenceInputBatch("pagehide");
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushUserPresenceInputBatch("hidden");
      }
    };

    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      flushUserPresenceInputBatch("unmount");
      clearUserPresenceInputBatchTimers();
    };
  }, [clearUserPresenceInputBatchTimers, flushUserPresenceInputBatch]);

  // UI interaction event listeners (hover, click, input, keydown)
  useEffect(() => {
    const describeInteractiveTarget = (element: Element): string => {
      const target = element as HTMLElement;
      const aria = (target.getAttribute("aria-label") || "").trim();
      const title = (target.getAttribute("title") || "").trim();
      const id = target.id.trim();
      const dataPanel = (target.getAttribute("data-panel-id") || "").trim();
      const text = (target.textContent || "").trim().replace(/\s+/g, " ").slice(0, 64);
      const tag = target.tagName.toLowerCase();
      const identity = aria || title || text || dataPanel || id || tag;
      return `${tag}:${identity}`;
    };

    const onPointerOver = (event: Event) => {
      const element = (event.target as Element | null)?.closest(
        "button, [role='button'], input, select, textarea, a",
      );
      if (!element) {
        return;
      }
      const target = describeInteractiveTarget(element);
      const nowMs = Date.now();
      const lastMs = userPresenceHoverThrottleRef.current[target] ?? 0;
      if ((nowMs - lastMs) < 500) {
        return;
      }
      userPresenceHoverThrottleRef.current[target] = nowMs;
      emitUserPresenceInput({
        kind: "hover",
        target,
        message: `mouse hover over ${target}`,
        embedParticle: true,
        meta: {
          source: "ui-control",
        },
      });
    };

    const onClick = (event: Event) => {
      const element = (event.target as Element | null)?.closest(
        "button, [role='button'], input, select, textarea, a",
      );
      if (!element) {
        return;
      }
      const target = describeInteractiveTarget(element);
      emitUserPresenceInput({
        kind: "click",
        target,
        message: `click ${target}`,
        embedParticle: true,
        meta: {
          source: "ui-control",
        },
      });
    };

    const onInput = (event: Event) => {
      const element = (event.target as Element | null)?.closest("input, textarea, select");
      if (!element) {
        return;
      }
      const target = describeInteractiveTarget(element);
      emitUserPresenceInput({
        kind: "input",
        target,
        message: `input change on ${target}`,
        embedParticle: true,
        meta: {
          source: "ui-control",
        },
      });
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const nowMs = Date.now();
      if ((nowMs - userPresenceGenericEmitMsRef.current) < 120) {
        return;
      }
      userPresenceGenericEmitMsRef.current = nowMs;
      const active = document.activeElement as HTMLElement | null;
      const target = active ? describeInteractiveTarget(active) : "keyboard:window";
      emitUserPresenceInput({
        kind: "keydown",
        target,
        message: `key ${event.key} on ${target}`,
        embedParticle: true,
        meta: {
          source: "keyboard",
          key: event.key,
        },
      });
    };

    window.addEventListener("pointerover", onPointerOver, true);
    window.addEventListener("click", onClick, true);
    window.addEventListener("input", onInput, true);
    window.addEventListener("keydown", onKeyDown, true);

    return () => {
      window.removeEventListener("pointerover", onPointerOver, true);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("input", onInput, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [emitUserPresenceInput]);

  return { handleUserPresenceInput };
}
