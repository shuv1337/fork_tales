// SPDX-License-Identifier: GPL-3.0-or-later
// This file is part of Fork Tales.
// Copyright (C) 2024-2025 Fork Tales Contributors
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { NexusInteractionEvent } from "./components/Simulation/Canvas";
import { CoreBackdrop } from "./components/App/CoreBackdrop";
import { WorldPanelsViewport } from "./components/App/WorldPanelsViewport";
import { AppHeader } from "./components/layout/AppHeader";
import { ControlSidebar } from "./components/layout/ControlSidebar";
import { ToastOverlay } from "./components/layout/ToastOverlay";
import {
  DEFAULT_INTERFACE_OPACITY,
  INTERFACE_OPACITY_STORAGE_KEY,
} from "./app/appShellConstants";
import type { OverlayApi } from "./app/appShellTypes";
import { clamp } from "./app/appShellUtils";
import { useAppPanelConfigs } from "./app/useAppPanelConfigs";
import { useChatCommandHandlers } from "./app/useChatCommandHandlers";
import { useAutopilotController } from "./hooks/useAutopilotController";
import { useCoreCameraControls } from "./hooks/useCoreCameraControls";
import { useAgentHandlers } from "./hooks/useAgentHandlers";
import { useSimulationTuning } from "./hooks/useSimulationTuning";
import { useToastManager } from "./hooks/useToastManager";
import { useUserPresenceInput } from "./hooks/useUserPresenceInput";
import { useWorldPanelManager } from "./hooks/useWorldPanelManager";
import { useWorldState } from "./hooks/useWorldState";
import type { UIPerspective, UIProjectionBundle, UIProjectionElementState } from "./types";

export default function App() {
  // --- Core world data ---
  const [uiPerspective, setUiPerspective] = useState<UIPerspective>("hybrid");
  const { catalog, simulation, projection, agentEvents, isConnected } = useWorldState(uiPerspective);

  // --- Overlay API ---
  const [overlayApi, setOverlayApi] = useState<OverlayApi | null>(null);

  // --- Viewport ---
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);
  const [deferredPanelsReady, setDeferredPanelsReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => { setDeferredPanelsReady(true); }, 220);
    return () => { window.clearTimeout(timer); };
  }, []);

  useEffect(() => {
    const handleResize = () => { setViewportWidth(window.innerWidth); setViewportHeight(window.innerHeight); };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => { window.removeEventListener("resize", handleResize); };
  }, []);

  // --- Extracted hooks ---
  const { uiToasts, dismissToast, emitUiToast } = useToastManager();
  const { handleUserPresenceInput } = useUserPresenceInput();

  const camera = useCoreCameraControls(overlayApi);

  const simTuning = useSimulationTuning();

  // Persist interface opacity to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (Math.abs(simTuning.interfaceOpacity - DEFAULT_INTERFACE_OPACITY) < 0.0001) {
      window.localStorage.removeItem(INTERFACE_OPACITY_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(INTERFACE_OPACITY_STORAGE_KEY, simTuning.interfaceOpacity.toFixed(3));
  }, [simTuning.interfaceOpacity]);

  // Initial agent handlers (without autopilot wiring, for bootstrapping).
  // processEvents is false so only the final instance runs event side-effects.
  const agentBootstrap = useAgentHandlers({
    overlayApi,
    setOverlayApi,
    emitUiToast,
    catalog,
    simulation,
    agentEvents,
    handleAutopilotUserInput: () => false,
    handleChatCommand: async () => false,
    processEvents: false,
  });

  const {
    autopilotEnabled,
    autopilotStatus,
    autopilotSummary,
    autopilotEvents,
    handleAutopilotUserInput,
    toggleAutopilot,
  } = useAutopilotController({ catalog, simulation, isConnected, emitSystemMessage: agentBootstrap.emitSystemMessage });

  const { handleChatCommand } = useChatCommandHandlers({
    activeAgentPresenceId: agentBootstrap.activeAgentPresenceId,
    catalogGeneratedAt: catalog?.generated_at,
    catalogTruthGateBlocked: catalog?.truth_state?.gate?.blocked,
    simulationTimestamp: simulation?.timestamp,
    simulationTruthGateBlocked: simulation?.truth_state?.gate?.blocked,
    buildAgentSurroundingNodes: agentBootstrap.buildAgentSurroundingNodes,
    emitSystemMessage: agentBootstrap.emitSystemMessage,
    emitAgentChatReply: agentBootstrap.emitAgentChatReply,
  });

  // Final agent handlers with all real dependencies
  const agentWithDeps = useAgentHandlers({
    overlayApi,
    setOverlayApi,
    emitUiToast,
    catalog,
    simulation,
    agentEvents,
    handleAutopilotUserInput,
    handleChatCommand,
  });

  const activeProjection: UIProjectionBundle | null =
    projection ?? simulation?.projection ?? catalog?.ui_projection ?? null;

  // Compute projectionStateByElement for panel configs
  const projectionStateByElement = useMemo(() => {
    const map = new Map<string, UIProjectionElementState>();
    if (!activeProjection) return map;
    const states = Array.isArray(activeProjection.states) ? activeProjection.states : [];
    states.forEach((state) => { map.set(state.element_id, state); });
    return map;
  }, [activeProjection]);

  // --- Panel configs ---
  const panelConfigs = useAppPanelConfigs({
    activeAgentPresenceId: agentWithDeps.activeAgentPresenceId,
    activeProjection: projection ?? simulation?.projection ?? catalog?.ui_projection ?? null,
    autopilotEvents,
    catalog,
    deferredCoreSimulationTuning: simTuning.deferredCoreSimulationTuning,
    deferredPanelsReady,
    flyCameraToAnchor: camera.flyCameraToAnchor,
    handleAgentWorkspaceBindingsChange: agentWithDeps.handleAgentWorkspaceBindingsChange,
    handleAgentWorkspaceContextChange: agentWithDeps.handleAgentWorkspaceContextChange,
    handleAgentWorkspaceSend: agentWithDeps.handleAgentWorkspaceSend,
    handleRecord: agentWithDeps.handleRecord,
    handleSendVoice: agentWithDeps.handleSendVoice,
    handleTranscribe: agentWithDeps.handleTranscribe,
    handleUserPresenceInput,
    handleWorldInteract: agentWithDeps.handleWorldInteract,
    interactingPersonId: agentWithDeps.interactingPersonId,
    isRecording: agentWithDeps.isRecording,
    isThinking: agentWithDeps.isThinking,
    agentWorkspaceBindings: agentWithDeps.agentWorkspaceBindings,
    agentWorkspaceContexts: agentWithDeps.agentWorkspaceContexts,
    projectionStateByElement,
    setActiveAgentPresenceId: agentWithDeps.setActiveAgentPresenceId,
    simulation,
    voiceInputMeta: agentWithDeps.voiceInputMeta,
    worldInteraction: agentWithDeps.worldInteraction,
  });

  // --- Panel manager ---
  const panelManager = useWorldPanelManager({
    viewportWidth,
    viewportHeight,
    panelConfigs,
    activeProjection,
    catalog,
    simulation,
    deferredCoreCameraZoom: camera.deferredCoreCameraZoom,
    deferredCoreCameraPitch: camera.deferredCoreCameraPitch,
    deferredCoreCameraYaw: camera.deferredCoreCameraYaw,
    deferredCoreRenderedCameraPosition: camera.deferredCoreRenderedCameraPosition,
    coreFlightVelocityRef: camera.coreFlightVelocityRef,
    resolveOverlayAnchorRatio: camera.resolveOverlayAnchorRatio,
  });

  // --- Glass and nexus interaction ---
  const lastGlassClickRef = useRef<{ ts: number; x: number; y: number } | null>(null);

  const handleGlassInteractAt = useCallback((payload: {
    panelId: string; xRatio: number; yRatio: number; clientX?: number; clientY?: number;
  }) => {
    const anchorX = clamp(Number(payload.xRatio ?? 0.5), 0, 1);
    const anchorY = clamp(Number(payload.yRatio ?? 0.5), 0, 1);
    const hasClientPoint = Number.isFinite(payload.clientX) && Number.isFinite(payload.clientY);
    const result = hasClientPoint && overlayApi?.interactClientAt
      ? overlayApi.interactClientAt(Number(payload.clientX), Number(payload.clientY), { openWorldscreen: true })
      : overlayApi?.interactAt?.(anchorX, anchorY, { openWorldscreen: true });
    const resolvedX = clamp(Number(result?.xRatio ?? anchorX), 0, 1);
    const resolvedY = clamp(Number(result?.yRatio ?? anchorY), 0, 1);
    if (result?.hitNode) return;
    const now = performance.now();
    const last = lastGlassClickRef.current;
    if (last && (now - last.ts) < 320 && Math.abs(last.x - resolvedX) < 0.05 && Math.abs(last.y - resolvedY) < 0.05) {
      camera.flyCameraToRatios(resolvedX, resolvedY, "node", panelManager.glassCenterRatio.x, panelManager.glassCenterRatio.y);
      lastGlassClickRef.current = null;
      return;
    }
    lastGlassClickRef.current = { ts: now, x: resolvedX, y: resolvedY };
    overlayApi?.pulseAt?.(resolvedX, resolvedY, 0.88, result?.target ?? payload.panelId ?? "glass_click");
  }, [camera, overlayApi, panelManager.glassCenterRatio.x, panelManager.glassCenterRatio.y]);

  const handleNexusInteraction = useCallback((event: NexusInteractionEvent) => {
    const anchorX = clamp(Number(event.xRatio ?? 0.5), 0, 1);
    const anchorY = clamp(Number(event.yRatio ?? 0.5), 0, 1);
    if (event.isDoubleTap) {
      camera.flyCameraToRatios(anchorX, anchorY, "node", panelManager.glassCenterRatio.x, panelManager.glassCenterRatio.y);
    }
    overlayApi?.pulseAt?.(anchorX, anchorY, event.openWorldscreen ? 1.06 : 0.78, event.nodeId || event.label || "nexus");
  }, [camera, overlayApi, panelManager.glassCenterRatio.x, panelManager.glassCenterRatio.y]);

  // --- Derived UI data ---
  const projectionPerspective = activeProjection?.perspective ?? uiPerspective;
  const projectionOptions = activeProjection?.perspectives ?? catalog?.ui_perspectives ?? [
    { id: "hybrid", symbol: "perspective.hybrid", name: "Hybrid", merge: "hybrid", description: "Wallclock ordering with causal overlays.", default: true },
    { id: "causal-time", symbol: "perspective.causal-time", name: "Causal Time", merge: "causal-time", description: "Prioritize causal links over wallclock sequence.", default: false },
    { id: "swimlanes", symbol: "perspective.swimlanes", name: "Swimlanes", merge: "swimlanes", description: "Parallel lanes with threaded causality.", default: false },
  ];
  const activeChatLens = activeProjection?.chat_sessions?.[0] ?? null;
  const latestAutopilotEvent = autopilotEvents[0] ?? null;
  const agentRuntimeSnapshot = catalog?.muse_runtime ?? null;

  return (
    <>
      <CoreBackdrop
        simulation={simulation}
        catalog={catalog}
        viewportHeight={viewportHeight}
        coreCameraTransform={camera.coreCameraTransform}
        coreSimulationFilter={simTuning.coreSimulationFilter}
        coreOverlayView={simTuning.coreOverlayView}
        coreSimulationTuning={simTuning.coreSimulationTuning}
        coreVisualTuning={simTuning.coreVisualTuning}
        coreLayerVisibility={simTuning.coreLayerVisibility}
        agentWorkspaceBindings={agentWithDeps.agentWorkspaceBindings}
        mouseParticleTuning={simTuning.mouseParticleTuning}
        onUserPresenceInput={handleUserPresenceInput}
        onOverlayInit={agentWithDeps.handleOverlayInit}
        onNexusInteraction={handleNexusInteraction}
        glassCenterRatio={panelManager.glassCenterRatio}
        onPointerDown={camera.handleCorePointerDown}
        onPointerMove={camera.handleCorePointerMove}
        onPointerUp={camera.handleCorePointerUp}
        onWheel={camera.handleCoreWheel}
      />

      <main
        className="relative z-20 w-full px-1 py-2 md:px-2 md:py-4 pb-20 lg:pr-[24rem] transition-colors pointer-events-none"
        style={{ opacity: simTuning.interfaceOpacity }}
      >
        <AppHeader
          isConnected={isConnected}
          partRoot={catalog?.part_roots?.[0]?.split("/").pop()}
        />

        <ControlSidebar
          interfaceOpacity={simTuning.interfaceOpacity}
          projectionPerspective={projectionPerspective}
          autopilotEnabled={autopilotEnabled}
          autopilotStatus={autopilotStatus}
          autopilotSummary={autopilotSummary}
          coreCameraZoom={camera.coreCameraZoom}
          coreCameraPitch={camera.coreCameraPitch}
          coreCameraYaw={camera.coreCameraYaw}
          coreRenderedCameraPosition={camera.coreRenderedCameraPosition}
          coreFlightEnabled={camera.coreFlightEnabled}
          coreFlightSpeed={camera.coreFlightSpeed}
          coreOrbitEnabled={camera.coreOrbitEnabled}
          coreOrbitSpeed={camera.coreOrbitSpeed}
          coreSimulationTuning={simTuning.coreSimulationTuning}
          coreVisualTuning={simTuning.coreVisualTuning}
          coreOverlayView={simTuning.coreOverlayView}
          activeChatLens={activeChatLens}
          latestAutopilotEvent={latestAutopilotEvent}
          projectionOptions={projectionOptions}
          mouseParticleTuning={simTuning.mouseParticleTuning}
          activeCoreLayerCount={simTuning.activeCoreLayerCount}
          coreLayerManagerOpen={simTuning.coreLayerManagerOpen}
          coreLayerVisibility={simTuning.coreLayerVisibility}
          agentRuntimeSnapshot={agentRuntimeSnapshot}
          agentForgeLabel={agentWithDeps.agentForgeLabel}
          agentForgeBusy={agentWithDeps.agentForgeBusy}
          agentForgePreviewId={agentWithDeps.agentForgePreviewId}
          onToggleAutopilot={toggleAutopilot}
          onToggleCoreFlight={camera.toggleCoreFlight}
          onToggleCoreOrbit={camera.toggleCoreOrbit}
          onNudgeCoreFlightSpeed={camera.nudgeCoreFlightSpeed}
          onNudgeCoreOrbitSpeed={camera.nudgeCoreOrbitSpeed}
          onApplyCoreLayerPreset={simTuning.applyCoreLayerPreset}
          onNudgeCoreZoom={camera.nudgeCoreZoom}
          onResetCoreCamera={camera.resetCoreCamera}
          onSelectPerspective={setUiPerspective}
          onSetInterfaceOpacity={simTuning.setInterfaceOpacityDial}
          onResetInterfaceOpacity={simTuning.resetInterfaceOpacity}
          onBoostCoreVisibility={simTuning.boostCoreVisibility}
          onResetCoreVisualTuning={simTuning.resetCoreVisualTuning}
          onSetCoreVisualDial={simTuning.setCoreVisualDial}
          onResetCoreSimulationTuning={simTuning.resetCoreSimulationTuning}
          onSetCoreSimulationDial={simTuning.setCoreSimulationDial}
          onSetCoreOrbitSpeed={camera.setCoreOrbitSpeed}
          onSetMouseParticleTuning={simTuning.updateMouseParticleTuning}
          onOpenRuntimeConfig={panelManager.openRuntimeConfigPanel}
          onToggleCoreLayerManagerOpen={() => simTuning.setCoreLayerManagerOpen(!simTuning.coreLayerManagerOpen)}
          onSetAllLayers={simTuning.setAllCoreLayers}
          onSetLayerEnabled={simTuning.setCoreLayerEnabled}
          onAgentForgeLabelChange={agentWithDeps.setAgentForgeLabel}
          onCreateAgent={() => { void agentWithDeps.handleCreateAgent(); }}
        />

        <WorldPanelsViewport
          viewportWidth={viewportWidth}
          viewportHeight={viewportHeight}
          worldPanelLayout={panelManager.worldPanelLayout}
          panelNexusLayout={panelManager.panelNexusLayout}
          sortedPanels={panelManager.sortedPanels}
          panelWindowStateById={panelManager.panelWindowStateById}
          tertiaryPinnedPanelId={panelManager.tertiaryPinnedPanelId}
          pinnedPanels={panelManager.pinnedPanels}
          selectedPanelId={panelManager.selectedPanelId}
          isEditMode={panelManager.isEditMode}
          coreFlightSpeed={camera.coreFlightSpeed}
          onToggleEditMode={() => panelManager.setIsEditMode(!panelManager.isEditMode)}
          onHoverPanel={panelManager.setHoveredPanelId}
          onSelectPanel={panelManager.activatePanelWindow}
          onTogglePanelPin={panelManager.togglePanelPin}
          onActivatePanel={panelManager.activatePanelWindow}
          onMinimizePanel={panelManager.minimizePanelWindow}
          onClosePanel={panelManager.closePanelWindow}
          onAdjustPanelCouncilRank={panelManager.adjustPanelCouncilRank}
          onPinPanelToTertiary={panelManager.pinPanelToTertiary}
          onFlyCameraToAnchor={camera.flyCameraToAnchor}
          onGlassInteractAt={handleGlassInteractAt}
          onNudgeCameraPan={camera.nudgeCameraPan}
          onWorldPanelDragEnd={panelManager.handleWorldPanelDragEnd}
        />

        <ToastOverlay toasts={uiToasts} onDismiss={dismissToast} />
      </main>
    </>
  );
}
