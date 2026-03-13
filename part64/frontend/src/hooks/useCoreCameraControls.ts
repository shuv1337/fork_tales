// SPDX-License-Identifier: GPL-3.0-or-later
// This file is part of eta-mu.
// Copyright (C) 2024-2025 eta-mu Contributors

import {
  useState,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import {
  CORE_CAMERA_PITCH_MAX,
  CORE_CAMERA_PITCH_MIN,
  CORE_CAMERA_X_LIMIT,
  CORE_CAMERA_YAW_MAX,
  CORE_CAMERA_YAW_MIN,
  CORE_CAMERA_Y_LIMIT,
  CORE_CAMERA_Z_MAX,
  CORE_CAMERA_Z_MIN,
  CORE_CAMERA_ZOOM_MAX,
  CORE_CAMERA_ZOOM_MIN,
  CORE_FLIGHT_BASE_SPEED,
  CORE_FLIGHT_SPEED_MAX,
  CORE_FLIGHT_SPEED_MIN,
  CORE_ORBIT_PERIOD_SECONDS,
  CORE_ORBIT_RADIUS_X,
  CORE_ORBIT_RADIUS_Y,
  CORE_ORBIT_RADIUS_Z,
  CORE_ORBIT_SPEED_MAX,
  CORE_ORBIT_SPEED_MIN,
} from "../app/coreSimulationConfig";
import type { OverlayApi } from "../app/appShellTypes";
import type { WorldAnchorTarget } from "../app/worldPanelLayout";
import {
  clamp,
  isCorePointerBlockedTarget,
  isTextEntryTarget,
  shouldRouteWheelToCore,
} from "../app/appShellUtils";

export interface CoreCameraState {
  coreCameraZoom: number;
  coreCameraPitch: number;
  coreCameraYaw: number;
  deferredCoreCameraZoom: number;
  deferredCoreCameraPitch: number;
  deferredCoreCameraYaw: number;
  coreCameraPosition: { x: number; y: number; z: number };
  coreFlightEnabled: boolean;
  coreFlightSpeed: number;
  coreOrbitEnabled: boolean;
  coreOrbitSpeed: number;
  coreRenderedCameraPosition: { x: number; y: number; z: number };
  deferredCoreRenderedCameraPosition: { x: number; y: number; z: number };
  coreCameraTransform: string;
  coreFlightVelocityRef: React.RefObject<{ x: number; y: number; z: number }>;
}

export interface CoreCameraActions {
  nudgeCoreZoom: (delta: number) => void;
  toggleCoreFlight: () => void;
  nudgeCoreFlightSpeed: (delta: number) => void;
  toggleCoreOrbit: () => void;
  nudgeCoreOrbitSpeed: (delta: number) => void;
  setCoreOrbitSpeed: (value: number) => void;
  resetCoreCamera: () => void;
  nudgeCameraPan: (xRatioDelta: number, yRatioDelta: number, sourcePanelId?: string) => void;
  flyCameraToAnchor: (anchor: WorldAnchorTarget) => void;
  flyCameraToRatios: (
    anchorX: number,
    anchorY: number,
    anchorKind: WorldAnchorTarget["kind"],
    focusCenterX?: number,
    focusCenterY?: number,
  ) => void;
  resolveOverlayAnchorRatio: (
    anchor: WorldAnchorTarget,
    panelAnchorId?: string,
  ) => { x: number; y: number; label?: string } | null;
  handleCorePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handleCorePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handleCorePointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handleCoreWheel: (event: ReactWheelEvent<HTMLDivElement>) => void;
}

export function useCoreCameraControls(
  overlayApi: OverlayApi | null,
): CoreCameraState & CoreCameraActions {
  const [coreCameraZoom, setCoreCameraZoom] = useState(1);
  const [coreCameraPitch, setCoreCameraPitch] = useState(0);
  const [coreCameraYaw, setCoreCameraYaw] = useState(0);
  const deferredCoreCameraZoom = useDeferredValue(coreCameraZoom);
  const deferredCoreCameraPitch = useDeferredValue(coreCameraPitch);
  const deferredCoreCameraYaw = useDeferredValue(coreCameraYaw);
  const [coreCameraPosition, setCoreCameraPosition] = useState({ x: 0, y: 0, z: 0 });
  const [coreFlightEnabled, setCoreFlightEnabled] = useState(true);
  const [coreFlightSpeed, setCoreFlightSpeed] = useState(1);
  const [coreOrbitEnabled, setCoreOrbitEnabled] = useState(false);
  const [coreOrbitSpeed, setCoreOrbitSpeed] = useState(0.58);
  const [coreOrbitPhase, setCoreOrbitPhase] = useState(0);

  const cameraFlightRef = useRef<number | null>(null);
  const coreDragRef = useRef<{
    active: boolean;
    pointerId: number;
    mode: "orbit" | "pan";
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    startPitch: number;
    startYaw: number;
    startCamX: number;
    startCamY: number;
  } | null>(null);
  const coreFlightKeysRef = useRef<Record<string, boolean>>({
    w: false, a: false, s: false, d: false, r: false, f: false, shift: false,
  });
  const coreFlightVelocityRef = useRef({ x: 0, y: 0, z: 0 });
  const corePointerFrameRef = useRef<number | null>(null);
  const corePointerPendingRef = useRef({ dx: 0, dy: 0 });
  const lastNudgePulseTsRef = useRef(0);

  // --- Camera orbit ---
  useEffect(() => {
    if (!coreOrbitEnabled) {
      setCoreOrbitPhase(0);
      return;
    }
    let rafId = 0;
    const startTs = performance.now();
    let lastEmitTs = startTs;
    const frameIntervalMs = 1000 / 30;
    const angularVelocity = ((Math.PI * 2) / CORE_ORBIT_PERIOD_SECONDS) * coreOrbitSpeed;
    const tick = (ts: number) => {
      if (ts - lastEmitTs >= frameIntervalMs) {
        const elapsedSeconds = (ts - startTs) / 1000;
        setCoreOrbitPhase(elapsedSeconds * angularVelocity);
        lastEmitTs = ts;
      }
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => { window.cancelAnimationFrame(rafId); };
  }, [coreOrbitEnabled, coreOrbitSpeed]);

  const coreOrbitOffset = useMemo(() => {
    if (!coreOrbitEnabled) return { x: 0, y: 0, z: 0 };
    return {
      x: Math.cos(coreOrbitPhase) * CORE_ORBIT_RADIUS_X,
      y: Math.sin((coreOrbitPhase * 0.63) + 0.42) * CORE_ORBIT_RADIUS_Y,
      z: Math.sin(coreOrbitPhase) * CORE_ORBIT_RADIUS_Z,
    };
  }, [coreOrbitEnabled, coreOrbitPhase]);

  const coreRenderedCameraPosition = useMemo(
    () => ({
      x: clamp(coreCameraPosition.x + coreOrbitOffset.x, -CORE_CAMERA_X_LIMIT, CORE_CAMERA_X_LIMIT),
      y: clamp(coreCameraPosition.y + coreOrbitOffset.y, -CORE_CAMERA_Y_LIMIT, CORE_CAMERA_Y_LIMIT),
      z: clamp(coreCameraPosition.z + coreOrbitOffset.z, CORE_CAMERA_Z_MIN, CORE_CAMERA_Z_MAX),
    }),
    [coreCameraPosition, coreOrbitOffset],
  );
  const deferredCoreRenderedCameraPosition = useDeferredValue(coreRenderedCameraPosition);

  const coreCameraTransform = useMemo(
    () =>
      `perspective(1800px) translate3d(${coreRenderedCameraPosition.x.toFixed(1)}px, ${coreRenderedCameraPosition.y.toFixed(1)}px, ${coreRenderedCameraPosition.z.toFixed(1)}px) rotateX(${coreCameraPitch.toFixed(2)}deg) rotateY(${coreCameraYaw.toFixed(2)}deg) scale(${coreCameraZoom.toFixed(3)})`,
    [coreCameraPitch, coreCameraYaw, coreCameraZoom, coreRenderedCameraPosition],
  );

  // --- Simple actions ---
  const nudgeCoreZoom = useCallback((delta: number) => {
    setCoreCameraZoom((prev) => clamp(prev + delta, CORE_CAMERA_ZOOM_MIN, CORE_CAMERA_ZOOM_MAX));
  }, []);

  const toggleCoreFlight = useCallback(() => { setCoreFlightEnabled((prev) => !prev); }, []);

  const nudgeCoreFlightSpeed = useCallback((delta: number) => {
    setCoreFlightSpeed((prev) => clamp(prev + delta, CORE_FLIGHT_SPEED_MIN, CORE_FLIGHT_SPEED_MAX));
  }, []);

  const toggleCoreOrbit = useCallback(() => { setCoreOrbitEnabled((prev) => !prev); }, []);

  const nudgeCoreOrbitSpeed = useCallback((delta: number) => {
    setCoreOrbitSpeed((prev) => clamp(prev + delta, CORE_ORBIT_SPEED_MIN, CORE_ORBIT_SPEED_MAX));
  }, []);

  const setCoreOrbitSpeedClamped = useCallback((value: number) => {
    setCoreOrbitSpeed(clamp(value, CORE_ORBIT_SPEED_MIN, CORE_ORBIT_SPEED_MAX));
  }, []);

  // --- Stop flight ---
  const stopCameraFlight = useCallback(() => {
    if (cameraFlightRef.current !== null) {
      window.cancelAnimationFrame(cameraFlightRef.current);
      cameraFlightRef.current = null;
    }
  }, []);

  const resetCoreCamera = useCallback(() => {
    stopCameraFlight();
    if (corePointerFrameRef.current !== null) {
      window.cancelAnimationFrame(corePointerFrameRef.current);
      corePointerFrameRef.current = null;
    }
    corePointerPendingRef.current = { dx: 0, dy: 0 };
    setCoreCameraZoom(1);
    setCoreCameraPitch(0);
    setCoreCameraYaw(0);
    setCoreCameraPosition({ x: 0, y: 0, z: 0 });
    coreFlightVelocityRef.current = { x: 0, y: 0, z: 0 };
  }, [stopCameraFlight]);

  const nudgeCameraPan = useCallback((
    xRatioDelta: number,
    yRatioDelta: number,
    sourcePanelId?: string,
  ) => {
    stopCameraFlight();
    const dx = clamp(Number.isFinite(xRatioDelta) ? xRatioDelta : 0, -0.28, 0.28);
    const dy = clamp(Number.isFinite(yRatioDelta) ? yRatioDelta : 0, -0.28, 0.28);
    if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return;

    setCoreCameraPosition((prev) => ({
      x: clamp(prev.x + (dx * 228), -CORE_CAMERA_X_LIMIT, CORE_CAMERA_X_LIMIT),
      y: clamp(prev.y + (dy * 176), -CORE_CAMERA_Y_LIMIT, CORE_CAMERA_Y_LIMIT),
      z: prev.z,
    }));
    setCoreCameraYaw((prev) =>
      clamp(prev + (dx * 7.2), CORE_CAMERA_YAW_MIN, CORE_CAMERA_YAW_MAX),
    );
    setCoreCameraPitch((prev) =>
      clamp(prev + (dy * 6.4), CORE_CAMERA_PITCH_MIN, CORE_CAMERA_PITCH_MAX),
    );

    const now = performance.now();
    if (now - lastNudgePulseTsRef.current >= 48) {
      const pulseX = clamp(0.5 + (dx * 0.92), 0.08, 0.92);
      const pulseY = clamp(0.5 + (dy * 0.92), 0.08, 0.92);
      overlayApi?.pulseAt?.(pulseX, pulseY, 0.74, sourcePanelId ?? "view_lens_keeper");
      lastNudgePulseTsRef.current = now;
    }
  }, [overlayApi, stopCameraFlight]);

  // --- Overlay anchor resolution ---
  const resolveOverlayAnchorRatio = useCallback(
    (anchor: WorldAnchorTarget, panelAnchorId?: string): { x: number; y: number; label?: string } | null => {
      const getAnchorRatio = overlayApi?.getAnchorRatio;
      if (!getAnchorRatio) return null;

      const candidateIds = Array.from(
        new Set([
          String(panelAnchorId ?? "").trim(),
          String(anchor.id ?? "").trim(),
          String(anchor.label ?? "").trim(),
        ].filter((value) => value.length > 0)),
      );
      if (candidateIds.length === 0) return null;

      const candidateKinds = Array.from(new Set([anchor.kind, "presence", "region", "cluster", "node"]));
      for (const candidateId of candidateIds) {
        for (const kind of candidateKinds) {
          const found = getAnchorRatio(kind, candidateId);
          if (!found) continue;
          return {
            x: clamp(Number(found.x ?? 0.5), 0, 1),
            y: clamp(Number(found.y ?? 0.5), 0, 1),
            label: typeof found.label === "string" ? found.label : undefined,
          };
        }
      }
      return null;
    },
    [overlayApi],
  );

  // --- Fly camera ---
  const flyCameraToRatios = useCallback((
    anchorX: number,
    anchorY: number,
    anchorKind: WorldAnchorTarget["kind"],
    focusCenterX = 0.5,
    focusCenterY = 0.5,
  ) => {
    stopCameraFlight();
    const normalizedAnchorX = clamp(anchorX, 0, 1);
    const normalizedAnchorY = clamp(anchorY, 0, 1);
    const normalizedFocusX = clamp(focusCenterX, 0.04, 0.96);
    const normalizedFocusY = clamp(focusCenterY, 0.04, 0.96);
    const start = {
      x: coreCameraPosition.x, y: coreCameraPosition.y, z: coreCameraPosition.z,
      yaw: coreCameraYaw, pitch: coreCameraPitch, zoom: coreCameraZoom,
    };
    const target = {
      x: clamp((normalizedFocusX - normalizedAnchorX) * 640, -CORE_CAMERA_X_LIMIT, CORE_CAMERA_X_LIMIT),
      y: clamp((normalizedFocusY - normalizedAnchorY) * 520, -CORE_CAMERA_Y_LIMIT, CORE_CAMERA_Y_LIMIT),
      z: clamp(
        anchorKind === "node" ? 180 : anchorKind === "cluster" ? 40 : -120,
        CORE_CAMERA_Z_MIN, CORE_CAMERA_Z_MAX,
      ),
      yaw: clamp((normalizedAnchorX - normalizedFocusX) * 68, CORE_CAMERA_YAW_MIN, CORE_CAMERA_YAW_MAX),
      pitch: clamp((normalizedFocusY - normalizedAnchorY) * 52, CORE_CAMERA_PITCH_MIN, CORE_CAMERA_PITCH_MAX),
      zoom: clamp(anchorKind === "node" ? 1.18 : anchorKind === "cluster" ? 1.06 : 0.94, CORE_CAMERA_ZOOM_MIN, CORE_CAMERA_ZOOM_MAX),
    };

    const startTs = performance.now();
    const durationMs = 760;
    const ease = (t: number) => 1 - ((1 - t) ** 3);
    const tick = (ts: number) => {
      const elapsed = ts - startTs;
      const t = clamp(elapsed / durationMs, 0, 1);
      const mix = ease(t);
      setCoreCameraPosition({
        x: start.x + ((target.x - start.x) * mix),
        y: start.y + ((target.y - start.y) * mix),
        z: start.z + ((target.z - start.z) * mix),
      });
      setCoreCameraYaw(start.yaw + ((target.yaw - start.yaw) * mix));
      setCoreCameraPitch(start.pitch + ((target.pitch - start.pitch) * mix));
      setCoreCameraZoom(start.zoom + ((target.zoom - start.zoom) * mix));
      if (t >= 1) { cameraFlightRef.current = null; return; }
      cameraFlightRef.current = window.requestAnimationFrame(tick);
    };
    cameraFlightRef.current = window.requestAnimationFrame(tick);
  }, [coreCameraPitch, coreCameraPosition.x, coreCameraPosition.y, coreCameraPosition.z, coreCameraYaw, coreCameraZoom, stopCameraFlight]);

  const flyCameraToAnchor = useCallback((anchor: WorldAnchorTarget) => {
    const overlayAnchor = resolveOverlayAnchorRatio(anchor);
    const anchorX = overlayAnchor?.x ?? anchor.x;
    const anchorY = overlayAnchor?.y ?? anchor.y;
    if (overlayAnchor) {
      overlayApi?.pulseAt?.(overlayAnchor.x, overlayAnchor.y, 1.12, anchor.id);
    }
    flyCameraToRatios(anchorX, anchorY, anchor.kind);
  }, [flyCameraToRatios, overlayApi, resolveOverlayAnchorRatio]);

  // --- Cleanup effects ---
  useEffect(() => { return () => { stopCameraFlight(); }; }, [stopCameraFlight]);
  useEffect(() => { return () => { if (corePointerFrameRef.current !== null) window.cancelAnimationFrame(corePointerFrameRef.current); }; }, []);

  // --- Pointer drag ---
  const flushCorePointerPending = useCallback(() => {
    const pending = corePointerPendingRef.current;
    corePointerPendingRef.current = { dx: 0, dy: 0 };
    const activeDrag = coreDragRef.current;
    if (!activeDrag || !activeDrag.active) return;
    if (Math.abs(pending.dx) < 0.01 && Math.abs(pending.dy) < 0.01) return;
    if (activeDrag.mode === "pan") {
      setCoreCameraPosition((prev) => ({
        x: clamp(prev.x + (pending.dx * 1.45), -CORE_CAMERA_X_LIMIT, CORE_CAMERA_X_LIMIT),
        y: clamp(prev.y + (pending.dy * 1.45), -CORE_CAMERA_Y_LIMIT, CORE_CAMERA_Y_LIMIT),
        z: prev.z,
      }));
      return;
    }
    setCoreCameraYaw((prev) =>
      clamp(prev + (pending.dx * 0.08), CORE_CAMERA_YAW_MIN, CORE_CAMERA_YAW_MAX),
    );
    setCoreCameraPitch((prev) =>
      clamp(prev + (pending.dy * 0.08), CORE_CAMERA_PITCH_MIN, CORE_CAMERA_PITCH_MAX),
    );
  }, []);

  const scheduleCorePointerFlush = useCallback(() => {
    if (corePointerFrameRef.current !== null) return;
    corePointerFrameRef.current = window.requestAnimationFrame(() => {
      corePointerFrameRef.current = null;
      flushCorePointerPending();
    });
  }, [flushCorePointerPending]);

  const handleCorePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (isCorePointerBlockedTarget(event.target)) return;
      event.preventDefault();
      stopCameraFlight();
      const mode = "pan";
      coreDragRef.current = {
        active: true, pointerId: event.pointerId, mode,
        startX: event.clientX, startY: event.clientY,
        lastX: event.clientX, lastY: event.clientY,
        startPitch: coreCameraPitch, startYaw: coreCameraYaw,
        startCamX: coreCameraPosition.x, startCamY: coreCameraPosition.y,
      };
      corePointerPendingRef.current = { dx: 0, dy: 0 };
      if (corePointerFrameRef.current !== null) {
        window.cancelAnimationFrame(corePointerFrameRef.current);
        corePointerFrameRef.current = null;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [coreCameraPitch, coreCameraPosition.x, coreCameraPosition.y, coreCameraYaw, stopCameraFlight],
  );

  const handleCorePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = coreDragRef.current;
    if (!drag || !drag.active || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const dx = event.clientX - drag.lastX;
    const dy = event.clientY - drag.lastY;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) return;
    corePointerPendingRef.current.dx += dx;
    corePointerPendingRef.current.dy += dy;
    if (corePointerFrameRef.current !== null) return;
    flushCorePointerPending();
    scheduleCorePointerFlush();
  }, [flushCorePointerPending, scheduleCorePointerFlush]);

  const handleCorePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = coreDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (corePointerFrameRef.current !== null) {
      window.cancelAnimationFrame(corePointerFrameRef.current);
      corePointerFrameRef.current = null;
    }
    flushCorePointerPending();
    corePointerPendingRef.current = { dx: 0, dy: 0 };
    coreDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, [flushCorePointerPending]);

  // --- Wheel ---
  const applyCoreWheelDelta = useCallback((deltaY: number, shiftKey: boolean) => {
    if (shiftKey) {
      const speedDelta = deltaY < 0 ? 0.08 : -0.08;
      setCoreFlightSpeed((prev) => clamp(prev + speedDelta, CORE_FLIGHT_SPEED_MIN, CORE_FLIGHT_SPEED_MAX));
      return;
    }
    const delta = deltaY < 0 ? 0.06 : -0.06;
    setCoreCameraZoom((prev) => clamp(prev + delta, CORE_CAMERA_ZOOM_MIN, CORE_CAMERA_ZOOM_MAX));
  }, []);

  const handleCoreWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) return;
    if (!shouldRouteWheelToCore(event.target, event.deltaY)) return;
    event.preventDefault();
    applyCoreWheelDelta(event.deltaY, event.shiftKey);
  }, [applyCoreWheelDelta]);

  useEffect(() => {
    const onGlobalWheel = (event: WheelEvent) => {
      if (event.defaultPrevented) return;
      if (!shouldRouteWheelToCore(event.target, event.deltaY)) return;
      event.preventDefault();
      applyCoreWheelDelta(event.deltaY, event.shiftKey);
    };
    window.addEventListener("wheel", onGlobalWheel, { passive: false, capture: true });
    return () => { window.removeEventListener("wheel", onGlobalWheel, true); };
  }, [applyCoreWheelDelta]);

  // --- Keyboard flight ---
  useEffect(() => {
    const keyFromEvent = (event: KeyboardEvent): string | null => {
      const key = event.key.toLowerCase();
      if (key === "w" || key === "a" || key === "s" || key === "d" || key === "r" || key === "f") return key;
      if (key === "shift") return "shift";
      return null;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextEntryTarget(event.target)) return;
      const mapped = keyFromEvent(event);
      if (!mapped) return;
      coreFlightKeysRef.current[mapped] = true;
      if (coreFlightEnabled) event.preventDefault();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const mapped = keyFromEvent(event);
      if (!mapped) return;
      coreFlightKeysRef.current[mapped] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [coreFlightEnabled]);

  useEffect(() => {
    if (!coreFlightEnabled) {
      coreFlightKeysRef.current = {
        w: false, a: false, s: false, d: false, r: false, f: false, shift: false,
      };
      coreFlightVelocityRef.current = { x: 0, y: 0, z: 0 };
      return;
    }
    let rafId = 0;
    let lastTs = performance.now();
    let lastEmitTs = lastTs;
    let pendingX = 0;
    let pendingY = 0;
    let pendingZ = 0;
    const emitIntervalMs = 1000 / 45;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;
      const keys = coreFlightKeysRef.current;
      const yawRadians = (coreCameraYaw * Math.PI) / 180;
      const boost = keys.shift ? 2.2 : 1;
      const accel = CORE_FLIGHT_BASE_SPEED * coreFlightSpeed * boost;
      const strafe = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
      const climb = (keys.f ? 1 : 0) - (keys.r ? 1 : 0);
      const thrust = (keys.w ? 1 : 0) - (keys.s ? 1 : 0);
      const forwardX = Math.sin(yawRadians);
      const forwardZ = Math.cos(yawRadians);
      const rightX = Math.cos(yawRadians);
      const rightZ = -Math.sin(yawRadians);
      const velocity = coreFlightVelocityRef.current;
      velocity.x = (velocity.x * 0.88) + ((forwardX * thrust + rightX * strafe) * accel * dt);
      velocity.y = (velocity.y * 0.88) + (climb * accel * dt);
      velocity.z = (velocity.z * 0.88) + ((forwardZ * thrust + rightZ * strafe) * accel * dt);
      pendingX += velocity.x;
      pendingY += velocity.y;
      pendingZ += velocity.z;
      if (now - lastEmitTs >= emitIntervalMs) {
        setCoreCameraPosition((prev) => ({
          x: clamp(prev.x + pendingX, -CORE_CAMERA_X_LIMIT, CORE_CAMERA_X_LIMIT),
          y: clamp(prev.y + pendingY, -CORE_CAMERA_Y_LIMIT, CORE_CAMERA_Y_LIMIT),
          z: clamp(prev.z + pendingZ, CORE_CAMERA_Z_MIN, CORE_CAMERA_Z_MAX),
        }));
        pendingX = 0; pendingY = 0; pendingZ = 0;
        lastEmitTs = now;
      }
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => { window.cancelAnimationFrame(rafId); };
  }, [coreCameraYaw, coreFlightEnabled, coreFlightSpeed]);

  return {
    coreCameraZoom,
    coreCameraPitch,
    coreCameraYaw,
    deferredCoreCameraZoom,
    deferredCoreCameraPitch,
    deferredCoreCameraYaw,
    coreCameraPosition,
    coreFlightEnabled,
    coreFlightSpeed,
    coreOrbitEnabled,
    coreOrbitSpeed,
    coreRenderedCameraPosition,
    deferredCoreRenderedCameraPosition,
    coreCameraTransform,
    coreFlightVelocityRef,
    nudgeCoreZoom,
    toggleCoreFlight,
    nudgeCoreFlightSpeed,
    toggleCoreOrbit,
    nudgeCoreOrbitSpeed,
    setCoreOrbitSpeed: setCoreOrbitSpeedClamped,
    resetCoreCamera,
    nudgeCameraPan,
    flyCameraToAnchor,
    flyCameraToRatios,
    resolveOverlayAnchorRatio,
    handleCorePointerDown,
    handleCorePointerMove,
    handleCorePointerUp,
    handleCoreWheel,
  };
}
