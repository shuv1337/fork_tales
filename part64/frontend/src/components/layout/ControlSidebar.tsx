// SPDX-License-Identifier: GPL-3.0-or-later
// This file is part of eta-mu.
// Copyright (C) 2024-2025 eta-mu Contributors

import type { ReactNode } from "react";
import { CoreControlPanel, type MouseParticleTuning } from "../App/CoreControlPanel";
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
  mouseParticleTuning: MouseParticleTuning;
  activeCoreLayerCount: number;
  coreLayerManagerOpen: boolean;
  coreLayerVisibility: Record<CoreLayerId, boolean>;
  agentRuntimeSnapshot: { muse_count?: number; event_seq?: number } | null;
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
  onSetMouseParticleTuning: (partial: Partial<MouseParticleTuning>) => void;
  onOpenRuntimeConfig: () => void;
  onToggleCoreLayerManagerOpen: () => void;
  onSetAllLayers: (enabled: boolean) => void;
  onSetLayerEnabled: (layerId: CoreLayerId, enabled: boolean) => void;
  onAgentForgeLabelChange: (value: string) => void;
  onCreateAgent: () => void;
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
    mouseParticleTuning,
    activeCoreLayerCount,
    coreLayerManagerOpen,
    coreLayerVisibility,
    agentRuntimeSnapshot,
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
    onSetMouseParticleTuning,
    onOpenRuntimeConfig,
    onToggleCoreLayerManagerOpen,
    onSetAllLayers,
    onSetLayerEnabled,
    onAgentForgeLabelChange,
    onCreateAgent,
  } = props;

  return (
    <aside
      data-core-wheel="block"
      className="fixed inset-x-2 bottom-20 z-[74] max-h-[46vh] overflow-y-auto rounded-xl border border-[#415772] bg-[linear-gradient(180deg,#07111b,#060f18)] p-3 shadow-[0_12px_30px_#111323] pointer-events-auto lg:inset-x-auto lg:bottom-4 lg:right-2 lg:top-24 lg:w-[23rem] lg:max-h-[calc(100vh-8rem)]"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[12px] uppercase tracking-[0.12em] text-[#a3d3ef]">Simulation Controls</p>
        <p className="text-[12px] text-[#beddf0]">ui opacity <code>{Math.round(interfaceOpacity * 100)}%</code></p>
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
        mouseParticleTuning={mouseParticleTuning}
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
        onSetMouseParticleTuning={onSetMouseParticleTuning}
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

      <div className="mt-3 rounded-lg border border-[#324f68] bg-[#131727] px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] uppercase tracking-[0.12em] text-[#9ec7dd]">Agent Creator</p>
          <p className="text-[12px] text-[#b8d9ef]">
            runtime: <code>{agentRuntimeSnapshot?.muse_count ?? 0}</code> agents | seq <code>{agentRuntimeSnapshot?.event_seq ?? 0}</code>
          </p>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={agentForgeLabel}
            onChange={(event) => onAgentForgeLabelChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onCreateAgent();
              }
            }}
            placeholder="create agent label (e.g. Archive Observer)"
            className="min-w-[220px] flex-1 rounded-md border border-[#355670] bg-[#0c1723] px-3 py-1.5 text-xs text-[#e6f5ff]"
          />
          <button
            type="button"
            disabled={agentForgeBusy || !agentForgePreviewId}
            onClick={onCreateAgent}
            className="rounded-md border border-[#59742e] bg-[#303a2e] px-3 py-1.5 text-xs font-semibold text-[#e9ffd3] disabled:opacity-45"
          >
            {agentForgeBusy ? "creating..." : "Create Agent"}
          </button>
        </div>
        <p className="mt-1 text-[12px] text-[#9fc4dd]">
          next id: <code>{agentForgePreviewId || "(type label)"}</code>
        </p>
      </div>
    </aside>
  );
}
