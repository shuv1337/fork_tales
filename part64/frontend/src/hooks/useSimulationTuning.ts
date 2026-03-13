// SPDX-License-Identifier: GPL-3.0-or-later
// This file is part of Fork Tales.
// Copyright (C) 2024-2025 Fork Tales Contributors

import { useState, useCallback, useDeferredValue, useMemo } from "react";
import type { MouseParticleTuning } from "../components/App/CoreControlPanel";
import {
  CORE_LAYER_OPTIONS,
  CORE_SIM_GRAPH_NODE_SMOOTHING_MAX,
  CORE_SIM_GRAPH_NODE_SMOOTHING_MIN,
  CORE_SIM_GRAPH_NODE_STEP_SCALE_MAX,
  CORE_SIM_GRAPH_NODE_STEP_SCALE_MIN,
  CORE_SIM_LAYER_DEPTH_MAX,
  CORE_SIM_LAYER_DEPTH_MIN,
  CORE_SIM_MOTION_SPEED_MAX,
  CORE_SIM_MOTION_SPEED_MIN,
  CORE_SIM_MOUSE_INFLUENCE_MAX,
  CORE_SIM_MOUSE_INFLUENCE_MIN,
  CORE_SIM_PARTICLE_DENSITY_MAX,
  CORE_SIM_PARTICLE_DENSITY_MIN,
  CORE_SIM_PARTICLE_SCALE_MAX,
  CORE_SIM_PARTICLE_SCALE_MIN,
  CORE_VISUAL_BRIGHTNESS_MAX,
  CORE_VISUAL_BRIGHTNESS_MIN,
  CORE_VISUAL_CONTRAST_MAX,
  CORE_VISUAL_CONTRAST_MIN,
  CORE_VISUAL_HUE_MAX,
  CORE_VISUAL_HUE_MIN,
  CORE_VISUAL_SATURATION_MAX,
  CORE_VISUAL_SATURATION_MIN,
  CORE_VISUAL_EDGE_DARKENING_MAX,
  CORE_VISUAL_EDGE_DARKENING_MIN,
  CORE_VISUAL_WASH_MAX,
  CORE_VISUAL_WASH_MIN,
  DEFAULT_CORE_LAYER_VISIBILITY,
  DEFAULT_CORE_SIMULATION_TUNING,
  DEFAULT_CORE_VISUAL_TUNING,
  HIGH_VISIBILITY_CORE_VISUAL_TUNING,
  type CoreLayerId,
  type CoreSimulationTuning,
  type CoreVisualTuning,
} from "../app/coreSimulationConfig";
import {
  DEFAULT_INTERFACE_OPACITY,
  INTERFACE_OPACITY_MAX,
  INTERFACE_OPACITY_MIN,
  INTERFACE_OPACITY_STORAGE_KEY,
} from "../app/appShellConstants";
import { clamp } from "../app/appShellUtils";
import type { OverlayViewId } from "../components/Simulation/Canvas";

export interface SimulationTuningState {
  coreSimulationTuning: CoreSimulationTuning;
  deferredCoreSimulationTuning: CoreSimulationTuning;
  coreVisualTuning: CoreVisualTuning;
  coreSimulationFilter: string;
  mouseParticleTuning: MouseParticleTuning;
  coreLayerVisibility: Record<CoreLayerId, boolean>;
  coreLayerManagerOpen: boolean;
  coreOverlayView: OverlayViewId;
  activeCoreLayerCount: number;
  interfaceOpacity: number;
}

export interface SimulationTuningActions {
  setCoreSimulationDial: (dial: keyof CoreSimulationTuning, value: number) => void;
  resetCoreSimulationTuning: () => void;
  updateMouseParticleTuning: (partial: Partial<MouseParticleTuning>) => void;
  setCoreVisualDial: (dial: keyof CoreVisualTuning, value: number) => void;
  resetCoreVisualTuning: () => void;
  boostCoreVisibility: () => void;
  setCoreLayerEnabled: (layerId: CoreLayerId, enabled: boolean) => void;
  setAllCoreLayers: (enabled: boolean) => void;
  setCoreLayerManagerOpen: (open: boolean) => void;
  applyCoreLayerPreset: (nextView: OverlayViewId) => void;
  setInterfaceOpacityDial: (value: number) => void;
  resetInterfaceOpacity: () => void;
}

export function useSimulationTuning(): SimulationTuningState & SimulationTuningActions {
  const [coreSimulationTuning, setCoreSimulationTuning] = useState<CoreSimulationTuning>(DEFAULT_CORE_SIMULATION_TUNING);
  const deferredCoreSimulationTuning = useDeferredValue(coreSimulationTuning);
  const [coreVisualTuning, setCoreVisualTuning] = useState<CoreVisualTuning>(DEFAULT_CORE_VISUAL_TUNING);
  const [mouseParticleTuning, setMouseParticleTuning] = useState<MouseParticleTuning>({
    enabled: true, message: "witness", mode: "push", radius: 0.18, strength: 0.42,
  });
  const [coreLayerVisibility, setCoreLayerVisibility] = useState<Record<CoreLayerId, boolean>>(DEFAULT_CORE_LAYER_VISIBILITY);
  const [coreLayerManagerOpen, setCoreLayerManagerOpen] = useState(true);
  const [coreOverlayView, setCoreOverlayView] = useState<OverlayViewId>("omni");
  const [interfaceOpacity, setInterfaceOpacity] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_INTERFACE_OPACITY;
    const stored = window.localStorage.getItem(INTERFACE_OPACITY_STORAGE_KEY);
    if (stored === null) return DEFAULT_INTERFACE_OPACITY;
    const raw = Number(stored);
    if (!Number.isFinite(raw)) return DEFAULT_INTERFACE_OPACITY;
    return clamp(raw, INTERFACE_OPACITY_MIN, INTERFACE_OPACITY_MAX);
  });

  // Persist interface opacity
  // Note: moved inline effect to a stable pattern
  // The effect for persisting interfaceOpacity is kept in App.tsx since it's simple

  const coreSimulationFilter = useMemo(
    () =>
      `saturate(${coreVisualTuning.saturation.toFixed(3)}) contrast(${coreVisualTuning.contrast.toFixed(3)}) brightness(${coreVisualTuning.brightness.toFixed(3)}) hue-rotate(${coreVisualTuning.hueRotate.toFixed(1)}deg)`,
    [coreVisualTuning],
  );

  const activeCoreLayerCount = useMemo(
    () => CORE_LAYER_OPTIONS.reduce((count, option) => count + (coreLayerVisibility[option.id] ? 1 : 0), 0),
    [coreLayerVisibility],
  );

  const setCoreSimulationDial = useCallback((dial: keyof CoreSimulationTuning, value: number) => {
    setCoreSimulationTuning((prev) => {
      const clampMap: Record<string, [number, number]> = {
        particleDensity: [CORE_SIM_PARTICLE_DENSITY_MIN, CORE_SIM_PARTICLE_DENSITY_MAX],
        particleScale: [CORE_SIM_PARTICLE_SCALE_MIN, CORE_SIM_PARTICLE_SCALE_MAX],
        mouseInfluence: [CORE_SIM_MOUSE_INFLUENCE_MIN, CORE_SIM_MOUSE_INFLUENCE_MAX],
        layerDepth: [CORE_SIM_LAYER_DEPTH_MIN, CORE_SIM_LAYER_DEPTH_MAX],
        graphNodeSmoothness: [CORE_SIM_GRAPH_NODE_SMOOTHING_MIN, CORE_SIM_GRAPH_NODE_SMOOTHING_MAX],
        graphNodeStepScale: [CORE_SIM_GRAPH_NODE_STEP_SCALE_MIN, CORE_SIM_GRAPH_NODE_STEP_SCALE_MAX],
        motionSpeed: [CORE_SIM_MOTION_SPEED_MIN, CORE_SIM_MOTION_SPEED_MAX],
      };
      const range = clampMap[dial];
      if (!range) return { ...prev };
      return { ...prev, [dial]: clamp(value, range[0], range[1]) };
    });
  }, []);

  const resetCoreSimulationTuning = useCallback(() => {
    setCoreSimulationTuning(DEFAULT_CORE_SIMULATION_TUNING);
  }, []);

  const updateMouseParticleTuning = useCallback((partial: Partial<MouseParticleTuning>) => {
    setMouseParticleTuning((prev) => ({ ...prev, ...partial }));
  }, []);

  const setCoreVisualDial = useCallback((dial: keyof CoreVisualTuning, value: number) => {
    setCoreVisualTuning((prev) => {
      const clampMap: Record<string, [number, number]> = {
        brightness: [CORE_VISUAL_BRIGHTNESS_MIN, CORE_VISUAL_BRIGHTNESS_MAX],
        contrast: [CORE_VISUAL_CONTRAST_MIN, CORE_VISUAL_CONTRAST_MAX],
        saturation: [CORE_VISUAL_SATURATION_MIN, CORE_VISUAL_SATURATION_MAX],
        hueRotate: [CORE_VISUAL_HUE_MIN, CORE_VISUAL_HUE_MAX],
        backgroundWash: [CORE_VISUAL_WASH_MIN, CORE_VISUAL_WASH_MAX],
        edgeDarkening: [CORE_VISUAL_EDGE_DARKENING_MIN, CORE_VISUAL_EDGE_DARKENING_MAX],
      };
      const range = clampMap[dial];
      if (!range) return { ...prev, edgeDarkening: clamp(value, CORE_VISUAL_EDGE_DARKENING_MIN, CORE_VISUAL_EDGE_DARKENING_MAX) };
      return { ...prev, [dial]: clamp(value, range[0], range[1]) };
    });
  }, []);

  const resetCoreVisualTuning = useCallback(() => {
    setCoreVisualTuning(DEFAULT_CORE_VISUAL_TUNING);
  }, []);

  const boostCoreVisibility = useCallback(() => {
    setCoreVisualTuning(HIGH_VISIBILITY_CORE_VISUAL_TUNING);
  }, []);

  const applyCoreLayerPreset = useCallback((nextView: OverlayViewId) => {
    const normalizedView: OverlayViewId = nextView === "crawler-graph" ? "file-graph" : nextView;
    const nexusGraphView = normalizedView === "file-graph";
    setCoreOverlayView(normalizedView);
    if (nextView === "omni") {
      setCoreLayerVisibility({ ...DEFAULT_CORE_LAYER_VISIBILITY });
      return;
    }
    setCoreLayerVisibility({
      presence: normalizedView === "presence" || nexusGraphView,
      "file-impact": normalizedView === "file-impact",
      "file-graph": nexusGraphView,
      "true-graph": normalizedView === "true-graph" || nexusGraphView,
      "truth-gate": normalizedView === "truth-gate",
      logic: normalizedView === "logic",
      "pain-field": normalizedView === "pain-field",
    });
  }, []);

  const setCoreLayerEnabled = useCallback((layerId: CoreLayerId, enabled: boolean) => {
    setCoreLayerVisibility((prev) => ({ ...prev, [layerId]: enabled }));
  }, []);

  const setAllCoreLayers = useCallback((enabled: boolean) => {
    setCoreLayerVisibility({
      presence: enabled, "file-impact": enabled, "file-graph": enabled,
      "true-graph": enabled, "truth-gate": enabled, logic: enabled, "pain-field": enabled,
    });
    setCoreOverlayView(enabled ? "omni" : "presence");
  }, []);

  const setInterfaceOpacityDial = useCallback((value: number) => {
    setInterfaceOpacity(clamp(value, INTERFACE_OPACITY_MIN, INTERFACE_OPACITY_MAX));
  }, []);

  const resetInterfaceOpacity = useCallback(() => {
    setInterfaceOpacity(DEFAULT_INTERFACE_OPACITY);
  }, []);

  return {
    coreSimulationTuning, deferredCoreSimulationTuning,
    coreVisualTuning, coreSimulationFilter,
    mouseParticleTuning, coreLayerVisibility,
    coreLayerManagerOpen, coreOverlayView,
    activeCoreLayerCount, interfaceOpacity,
    setCoreSimulationDial, resetCoreSimulationTuning,
    updateMouseParticleTuning,
    setCoreVisualDial, resetCoreVisualTuning,
    boostCoreVisibility,
    setCoreLayerEnabled, setAllCoreLayers,
    setCoreLayerManagerOpen,
    applyCoreLayerPreset,
    setInterfaceOpacityDial, resetInterfaceOpacity,
  };
}
