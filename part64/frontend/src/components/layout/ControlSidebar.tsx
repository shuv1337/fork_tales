// SPDX-License-Identifier: GPL-3.0-or-later
// This file is part of Fork Tales.
// Copyright (C) 2024-2025 Fork Tales Contributors

import type { ReactNode } from "react";
import { CoreControlPanel, type MouseDaimonTuning } from "../App/CoreControlPanel";
import { CoreLayerManagerOverlay } from "../App/CoreLayerManagerOverlay";
import type { CoreLayerId, CoreSimulationTuning, CoreVisualTuning } from "../../app/coreSimulationConfig";
import type { OverlayViewId } from "../Simulation/Canvas";
import type { UIPerspective } from "../../types";

interface ProjectionOption {
  id: string;
  name: string;
  description: string;
}

interface ControlSidebarProps {
  interfaceOpacity: number;
  projectionPerspective: string;
  autopilotEnabled: boolean;
  autopilotStatus: "running" | "waiting" | "stopped";
  autopilotSummary: string;
  coreCameraZoom: number;
  coreCameraPitch: number;
  coreCameraYaw: number;
  coreRenderedCameraPosition: { x: number; y: number; z: number };
  coreFlightEnabled: boolean;
  coreFlightSpeed: number;
  coreOrbitEnabled: boolean;
  coreOrbitSpeed: number;
  coreSimulationTuning: CoreSimulationTuning;
  coreVisualTuning: CoreVisualTuning;
  coreOverlayView: OverlayViewId;
  activeChatLens: { presence: string; status: string } | null;
  latestAutopilotEvent: { actionId: string; result: string } | null;
  projectionOptions: ProjectionOption[];
  mouseDaimonTuning: MouseDaimonTuning;
  activeCoreLayerCount: number;
  coreLayerManagerOpen: boolean;
  coreLayerVisibility: Record<CoreLayerId, boolean>;
  museRuntimeSnapshot: { muse_count?: number; event_seq?: number } | null;
  agentForgeLabel: string;
  agentForgeBusy: boolean;
  agentForgePreviewId: string;
  onToggleAutopilot: () => void;
  onToggleCoreFlight: () => void;
  onToggleCoreOrbit: () => void;
  onNudgeCoreFlightSpeed: (delta: number) => void;
  onNudgeCoreOrbitSpeed: (delta: number) => void;
  onApplyCoreLayerPreset: (view: OverlayViewId) => void;
  onNudgeCoreZoom: (delta: number) => void;
  onResetCoreCamera: () => void;
  onSelectPerspective: (perspective: UIPerspective) => void;
  onSetInterfaceOpacity: (value: number) => void;
  onResetInterfaceOpacity: () => void;
  onBoostCoreVisibility: () => void;
  onResetCoreVisualTuning: () => void;
  onSetCoreVisualDial: (dial: keyof CoreVisualTuning, value: number) => void;
  onResetCoreSimulationTuning: () => void;
  onSetCoreSimulationDial: (dial: keyof CoreSimulationTuning, value: number) => void;
  onSetCoreOrbitSpeed: (value: number) => void;
  onSetMouseDaimonTuning: (partial: Partial<MouseDaimonTuning>) => void;
  onOpenRuntimeConfig: () => void;
  onToggleCoreLayerManagerOpen: () => void;
  onSetAllLayers: (enabled: boolean) => void;
  onSetLayerEnabled: (layerId: CoreLayerId, enabled: boolean) => void;
  onMuseForgeLabelChange: (value: string) => void;
  onCreateMuse: () => void;
  children?: ReactNode;
}

export function ControlSidebar(props: ControlSidebarProps) {
  const {
    interfaceOpacity,
    projectionPerspective,
    autopilotEnabled,
    autopilotStatus,
    autopilotSummary,
    coreCameraZoom,
    coreCameraPitch,
    coreCameraYaw,
    coreRenderedCameraPosition,
    coreFlightEnabled,
    coreFlightSpeed,
    coreOrbitEnabled,
    coreOrbitSpeed,
    coreSimulationTuning,
    coreVisualTuning,
    coreOverlayView,
    activeChatLens,
    latestAutopilotEvent,
    projectionOptions,
    mouseDaimonTuning,
    activeCoreLayerCount,
    coreLayerManagerOpen,
    coreLayerVisibility,
    museRuntimeSnapshot,
    agentForgeLabel,
    agentForgeBusy,
    agentForgePreviewId,
    onToggleAutopilot,
    onToggleCoreFlight,
    onToggleCoreOrbit,
    onNudgeCoreFlightSpeed,
    onNudgeCoreOrbitSpeed,
    onApplyCoreLayerPreset,
    onNudgeCoreZoom,
    onResetCoreCamera,
    onSelectPerspective,
    onSetInterfaceOpacity,
    onResetInterfaceOpacity,
    onBoostCoreVisibility,
    onResetCoreVisualTuning,
    onSetCoreVisualDial,
    onResetCoreSimulationTuning,
    onSetCoreSimulationDial,
    onSetCoreOrbitSpeed,
    onSetMouseDaimonTuning,
    onOpenRuntimeConfig,
    onToggleCoreLayerManagerOpen,
    onSetAllLayers,
    onSetLayerEnabled,
    onMuseForgeLabelChange,
    onCreateMuse,
  } = props;

  return (
    <aside
      data-core-wheel="block"
      className="fixed inset-x-2 bottom-20 z-[74] max-h-[46vh] overflow-y-auto rounded-xl border border-[rgba(137,198,235,0.36)] bg-[linear-gradient(180deg,rgba(7,17,27,0.92),rgba(6,15,24,0.96))] p-3 shadow-[0_12px_30px_rgba(2,8,14,0.34)] pointer-events-auto lg:inset-x-auto lg:bottom-4 lg:right-2 lg:top-24 lg:w-[23rem] lg:max-h-[calc(100vh-8rem)]"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.12em] text-[#a3d3ef]">Simulation Controls</p>
        <p className="text-[10px] text-[#beddf0]">ui opacity <code>{Math.round(interfaceOpacity * 100)}%</code></p>
      </div>

      <CoreControlPanel
        projectionPerspective={projectionPerspective}
        autopilotEnabled={autopilotEnabled}
        autopilotStatus={autopilotStatus}
        autopilotSummary={autopilotSummary}
        interfaceOpacity={interfaceOpacity}
        coreCameraZoom={coreCameraZoom}
        coreCameraPitch={coreCameraPitch}
        coreCameraYaw={coreCameraYaw}
        coreRenderedCameraPosition={coreRenderedCameraPosition}
        coreFlightEnabled={coreFlightEnabled}
        coreFlightSpeed={coreFlightSpeed}
        coreOrbitEnabled={coreOrbitEnabled}
        coreOrbitSpeed={coreOrbitSpeed}
        coreSimulationTuning={coreSimulationTuning}
        coreVisualTuning={coreVisualTuning}
        coreOverlayView={coreOverlayView}
        activeChatLens={activeChatLens}
        latestAutopilotEvent={latestAutopilotEvent}
        projectionOptions={projectionOptions}
        mouseDaimonTuning={mouseDaimonTuning}
        onToggleAutopilot={onToggleAutopilot}
        onToggleCoreFlight={onToggleCoreFlight}
        onToggleCoreOrbit={onToggleCoreOrbit}
        onNudgeCoreFlightSpeed={onNudgeCoreFlightSpeed}
        onNudgeCoreOrbitSpeed={onNudgeCoreOrbitSpeed}
        onApplyCoreLayerPreset={onApplyCoreLayerPreset}
        onNudgeCoreZoom={onNudgeCoreZoom}
        onResetCoreCamera={onResetCoreCamera}
        onSelectPerspective={onSelectPerspective}
        onSetInterfaceOpacity={onSetInterfaceOpacity}
        onResetInterfaceOpacity={onResetInterfaceOpacity}
        onBoostCoreVisibility={onBoostCoreVisibility}
        onResetCoreVisualTuning={onResetCoreVisualTuning}
        onSetCoreVisualDial={onSetCoreVisualDial}
        onResetCoreSimulationTuning={onResetCoreSimulationTuning}
        onSetCoreSimulationDial={onSetCoreSimulationDial}
        onSetCoreOrbitSpeed={onSetCoreOrbitSpeed}
        onSetMouseDaimonTuning={onSetMouseDaimonTuning}
        onOpenRuntimeConfig={onOpenRuntimeConfig}
      />

      <div className="mt-3">
        <CoreLayerManagerOverlay
          inline
          activeLayerCount={activeCoreLayerCount}
          isOpen={coreLayerManagerOpen}
          layerVisibility={coreLayerVisibility}
          onToggleOpen={onToggleCoreLayerManagerOpen}
          onSetAllLayers={onSetAllLayers}
          onSetLayerEnabled={onSetLayerEnabled}
        />
      </div>

      <div className="mt-3 rounded-lg border border-[rgba(106,203,242,0.3)] bg-[rgba(8,19,29,0.38)] px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#9ec7dd]">Muse Forge</p>
          <p className="text-[10px] text-[#b8d9ef]">
            runtime: <code>{museRuntimeSnapshot?.muse_count ?? 0}</code> muses | seq <code>{museRuntimeSnapshot?.event_seq ?? 0}</code>
          </p>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={agentForgeLabel}
            onChange={(event) => onMuseForgeLabelChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onCreateMuse();
              }
            }}
            placeholder="create muse label (e.g. Archive Witness)"
            className="min-w-[220px] flex-1 rounded-md border border-[rgba(106,203,242,0.34)] bg-[rgba(10,23,34,0.86)] px-3 py-1.5 text-xs text-[#e6f5ff]"
          />
          <button
            type="button"
            disabled={agentForgeBusy || !agentForgePreviewId}
            onClick={onCreateMuse}
            className="rounded-md border border-[rgba(166,226,46,0.45)] bg-[rgba(166,226,46,0.16)] px-3 py-1.5 text-xs font-semibold text-[#e9ffd3] disabled:opacity-45"
          >
            {agentForgeBusy ? "creating..." : "Create Muse"}
          </button>
        </div>
        <p className="mt-1 text-[10px] text-[#9fc4dd]">
          next id: <code>{agentForgePreviewId || "(type label)"}</code>
        </p>
      </div>
    </aside>
  );
}
