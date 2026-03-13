import { type ReactNode, Suspense, lazy } from "react";

import { AgentPresencePanel } from "../components/Panels/AgentPresencePanel";
import { ProjectionLedgerPanel } from "../components/Panels/ProjectionLedgerPanel";
import {
  OVERLAY_VIEW_OPTIONS,
  SimulationCanvas,
} from "../components/Simulation/Canvas";
import { FIXED_AGENT_PRESENCES, GLASS_VIEWPORT_PANEL_ID } from "./appShellConstants";
import { type UseAppPanelConfigsArgs } from "./appPanelConfigTypes";
import { projectionOpacity } from "./appShellUtils";
import { normalizeAgentPresenceId } from "./agentWorkspace";
import { type PanelConfig } from "./worldPanelLayout";

const VitalsPanel = lazy(() =>
  import("../components/Panels/Vitals").then((module) => ({ default: module.VitalsPanel })),
);
const CatalogPanel = lazy(() =>
  import("../components/Panels/Catalog").then((module) => ({ default: module.CatalogPanel })),
);
const OmniPanel = lazy(() =>
  import("../components/Panels/Omni").then((module) => ({ default: module.OmniPanel })),
);
const WorldSimulationPanel = lazy(() =>
  import("../components/Panels/WorldSimulation").then((module) => ({ default: module.WorldSimulationPanel })),
);
const WebGraphWeaverPanel = lazy(() =>
  import("../components/Panels/WebGraphWeaverPanel").then((module) => ({
    default: module.WebGraphWeaverPanel,
  })),
);
const ThreatRadarPanel = lazy(() =>
  import("../components/Panels/ThreatRadarPanel").then((module) => ({
    default: module.ThreatRadarPanel,
  })),
);
const InspirationAtlasPanel = lazy(() =>
  import("../components/Panels/InspirationAtlasPanel").then((module) => ({
    default: module.InspirationAtlasPanel,
  })),
);
const StabilityObservatoryPanel = lazy(() =>
  import("../components/Panels/StabilityObservatoryPanel").then((module) => ({
    default: module.StabilityObservatoryPanel,
  })),
);
const RuntimeConfigPanel = lazy(() =>
  import("../components/Panels/RuntimeConfigPanel").then((module) => ({
    default: module.RuntimeConfigPanel,
  })),
);
const ParticleDeckPanel = lazy(() =>
  import("../components/Panels/ParticleDeckPanel").then((module) => ({
    default: module.ParticleDeckPanel,
  })),
);
const WorldLogPanel = lazy(() =>
  import("../components/Panels/WorldLogPanel").then((module) => ({
    default: module.WorldLogPanel,
  })),
);

type OverlayViewOption = (typeof OVERLAY_VIEW_OPTIONS)[number];

export interface BuildPanelConfigsArgs extends UseAppPanelConfigsArgs {
  dedicatedOverlayViews: OverlayViewOption[];
}

function renderDeferredPanelPlaceholder(title: string) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[#292a28] px-4 py-5">
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="text-xs text-muted mt-1">warming up panel...</p>
    </div>
  );
}

function renderDeferredPanel(ready: boolean, title: string, panel: ReactNode): ReactNode {
  return ready
    ? <Suspense fallback={renderDeferredPanelPlaceholder(title)}>{panel}</Suspense>
    : renderDeferredPanelPlaceholder(title);
}

function buildDedicatedViewsPanel(args: BuildPanelConfigsArgs): PanelConfig {
  return {
    id: "nexus.ui.dedicated_views",
    fallbackSpan: 12,
    render: () => (
      <div className="mt-0 rounded-xl border border-[var(--line)] bg-[#131723] p-3 h-full">
        <p className="text-[12px] uppercase tracking-[0.12em] text-[#9ec7dd]">Dedicated World Views</p>
        <p className="text-xs text-muted mt-1">Each overlay lane rendered as its own live viewport.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {args.dedicatedOverlayViews.map((view) => (
            <section
              key={view.id}
              className="rounded-lg border border-[#3a465c] bg-[#0e1421] p-2"
            >
              <div className="mb-2">
                <p className="text-sm font-semibold text-[#e5f3ff]">{view.label}</p>
                <p className="text-[12px] text-[#9fc4dd]">{view.description}</p>
              </div>
              <SimulationCanvas
                simulation={args.simulation}
                catalog={args.catalog}
                height={180}
                defaultOverlayView={view.id}
                overlayViewLocked
                compactHud
                interactive={false}
                particleDensity={args.deferredCoreSimulationTuning.particleDensity}
                particleScale={args.deferredCoreSimulationTuning.particleScale}
                motionSpeed={args.deferredCoreSimulationTuning.motionSpeed}
                mouseInfluence={args.deferredCoreSimulationTuning.mouseInfluence}
                layerDepth={args.deferredCoreSimulationTuning.layerDepth}
                graphNodeSmoothness={args.deferredCoreSimulationTuning.graphNodeSmoothness}
                graphNodeStepScale={args.deferredCoreSimulationTuning.graphNodeStepScale}
                agentWorkspaceBindings={args.agentWorkspaceBindings}
              />
            </section>
          ))}
        </div>
      </div>
    ),
  };
}

function buildGlassViewportPanel(): PanelConfig {
  return {
    id: GLASS_VIEWPORT_PANEL_ID,
    fallbackSpan: 12,
    anchorKind: "region",
    anchorId: "view_lens_keeper",
    worldSize: "xl",
    pinnedByDefault: true,
    render: () => (
      <div className="mt-0 rounded-xl border border-[#3d516b] bg-[#0d1523] p-3 h-full">
        <p className="text-[12px] uppercase tracking-[0.12em] text-[#a6d6f5]">Simulation Viewport</p>
        <p className="text-xs text-[#cfe6f7] mt-1">
          This lane provides camera guidance and smooth map panning for the simulation view.
        </p>
        <p className="text-[12px] text-[#9ec7dd] mt-2">
          Use the viewport controls to navigate and focus on different regions of the simulation.
        </p>
      </div>
    ),
  };
}

function buildAgentPresencePanels(args: BuildPanelConfigsArgs): PanelConfig[] {
  return FIXED_AGENT_PRESENCES.map((muse) => {
    const panelId = muse.id;
    const agentPresenceId = muse.presenceId;
    const panelState = args.projectionStateByElement.get(panelId) ?? null;
    const panelSession =
      args.activeProjection?.chat_sessions?.find(
        (session) => normalizeAgentPresenceId(String(session.presence ?? "")) === normalizeAgentPresenceId(agentPresenceId),
      )
      ?? null;
    const bindingKey = normalizeAgentPresenceId(agentPresenceId);
    const boundCount = args.agentWorkspaceBindings[bindingKey]?.length ?? 0;

    return {
      id: panelId,
      fallbackSpan: 4,
      anchorKind: "node" as const,
      anchorId: agentPresenceId,
      worldSize: "m" as const,
      render: () => (
        <div
          style={{
            opacity: panelState ? projectionOpacity(panelState.opacity, 0.92) : 1,
            transform: panelState
              ? `scale(${(1 + panelState.pulse * 0.01).toFixed(3)})`
              : undefined,
            transformOrigin: "center top",
            transition: "transform 200ms ease, opacity 200ms ease",
          }}
        >
          <AgentPresencePanel
            agentId={agentPresenceId}
            onSend={args.handleAgentWorkspaceSend}
            onRecord={args.handleRecord}
            onTranscribe={args.handleTranscribe}
            onSendVoice={args.handleSendVoice}
            isRecording={args.isRecording}
            isThinking={args.isThinking}
            voiceInputMeta={args.voiceInputMeta}
            catalog={args.catalog}
            simulation={args.simulation}
            workspaceContext={args.agentWorkspaceContexts[bindingKey] ?? null}
            onWorkspaceContextChange={args.handleAgentWorkspaceContextChange}
            onWorkspaceBindingsChange={args.handleAgentWorkspaceBindingsChange}
            chatLensState={panelState}
            activeChatSession={panelSession}
            activeAgentPresenceId={args.activeAgentPresenceId}
            onAgentPresenceChange={args.setActiveAgentPresenceId}
          />
          <p className="mt-2 text-[12px] text-[#8db3ca]">
            workspace binds <code>{boundCount}</code>
          </p>
        </div>
      ),
    } satisfies PanelConfig;
  });
}

function buildWebGraphWeaverPanel(args: BuildPanelConfigsArgs): PanelConfig {
  return {
    id: "nexus.ui.web_graph_weaver",
    fallbackSpan: 6,
    render: () => renderDeferredPanel(args.deferredPanelsReady, "Web Graph Weaver", <WebGraphWeaverPanel />),
  };
}

function buildThreatRadarPanel(args: BuildPanelConfigsArgs): PanelConfig {
  return {
    id: "nexus.ui.threat_radar",
    fallbackSpan: 6,
    anchorKind: "node",
    anchorId: "witness_thread",
    worldSize: "l",
    pinnedByDefault: true,
    render: () => renderDeferredPanel(args.deferredPanelsReady, "Threat Radar", <ThreatRadarPanel />),
  };
}

function buildInspirationAtlasPanel(args: BuildPanelConfigsArgs): PanelConfig {
  return {
    id: "nexus.ui.system_overview",
    fallbackSpan: 6,
    render: () => renderDeferredPanel(
      args.deferredPanelsReady,
      "System Overview",
      <InspirationAtlasPanel simulation={args.simulation} />,
    ),
  };
}

function buildEntityVitalsPanel(args: BuildPanelConfigsArgs): PanelConfig {
  const vitalsProps = {
    catalog: args.catalog,
    presenceDynamics: args.simulation?.presence_dynamics ?? null,
    ...(args.simulation?.entities ? { entities: args.simulation.entities } : {}),
  };

  return {
    id: "nexus.ui.entity_vitals",
    fallbackSpan: 6,
    className: "card relative overflow-hidden",
    render: () => (
      <>
        <div className="absolute top-0 left-0 w-1 h-full bg-[#a6e22e] opacity-60" />
        <h2 className="text-3xl font-bold mb-2">Entity Vitals / 実体バイタル</h2>
        <p className="text-muted mb-6">Live telemetry from the canonical named forms.</p>
        <div className="max-h-[62rem] overflow-y-auto pr-1">
          {renderDeferredPanel(args.deferredPanelsReady, "Entity Vitals", <VitalsPanel {...vitalsProps} />)}
        </div>
      </>
    ),
  };
}

function buildProjectionLedgerPanel(args: BuildPanelConfigsArgs): PanelConfig {
  return {
    id: "nexus.ui.projection_ledger",
    fallbackSpan: 6,
    className: "card relative overflow-hidden",
    render: () => (
      <>
        <div className="absolute top-0 left-0 w-1 h-full bg-[#66d9ef] opacity-70" />
        <h2 className="text-2xl font-bold mb-2">Projection Ledger / 映台帳</h2>
        <p className="text-muted mb-4">Sub-panels expose routing and control data for every known box.</p>
        <div className="max-h-[74rem] overflow-y-auto pr-1">
          <ProjectionLedgerPanel projection={args.activeProjection} />
        </div>
      </>
    ),
  };
}

function buildAutopilotLedgerPanel(args: BuildPanelConfigsArgs): PanelConfig {
  return {
    id: "nexus.ui.autopilot_ledger",
    fallbackSpan: 6,
    className: "card relative overflow-hidden",
    render: () => (
      <>
        <div className="absolute top-0 left-0 w-1 h-full bg-[#fd971f] opacity-70" />
        <h2 className="text-2xl font-bold mb-2">Autopilot Ledger / 自動操縦台帳</h2>
        <p className="text-muted mb-4">Replay stream of intent, confidence, risk, permissions, and result.</p>
        <div className="space-y-2 max-h-[26rem] overflow-y-auto pr-1">
          {args.autopilotEvents.length === 0 ? (
            <p className="text-xs text-muted">No autopilot events yet.</p>
          ) : (
            args.autopilotEvents.map((event, index) => (
              <div
                key={`${event.ts}-${event.actionId}-${index}`}
                className="border border-[var(--line)] rounded-lg bg-[#2a2b27] p-2"
              >
                <p className="text-xs font-semibold text-ink">
                  <code>{event.intent}</code>{" -> "}<code>{event.actionId}</code>
                </p>
                <p className="text-[12px] text-muted font-mono">
                  confidence {event.confidence.toFixed(2)} | risk {event.risk.toFixed(2)} | result
                  <code>{event.result}</code>
                  {event.gate ? (
                    <>
                      {" "}| gate <code>{event.gate}</code>
                    </>
                  ) : null}
                </p>
                <p className="text-[12px] text-muted font-mono">
                  perms {event.perms.length > 0 ? event.perms.join(", ") : "(none)"}
                </p>
                <p className="text-[12px] text-muted">{event.summary}</p>
              </div>
            ))
          )}
        </div>
      </>
    ),
  };
}

function buildWorldLogPanel(args: BuildPanelConfigsArgs): PanelConfig {
  return {
    id: "nexus.ui.world_log",
    fallbackSpan: 6,
    className: "card relative overflow-hidden",
    render: () => (
      <>
        <div className="absolute top-0 left-0 w-1 h-full bg-[#a6e22e] opacity-70" />
        <h2 className="text-2xl font-bold mb-2">World Log / 世界記録</h2>
        <p className="text-muted mb-4">
          Live timeline for receipts, eta-mu ingest, pending inbox files, presence account updates, and commentary events.
        </p>
        {renderDeferredPanel(args.deferredPanelsReady, "World Log", <WorldLogPanel catalog={args.catalog} />)}
      </>
    ),
  };
}

function buildStabilityObservatoryPanel(args: BuildPanelConfigsArgs): PanelConfig {
  return {
    id: "nexus.ui.stability_observatory",
    fallbackSpan: 6,
    className: "card relative overflow-hidden",
    render: () => (
      <>
        <div className="absolute top-0 left-0 w-1 h-full bg-[#66d9ef] opacity-70" />
        <h2 className="text-2xl font-bold mb-2">Stability Observatory / 安定観測</h2>
        <p className="text-muted mb-4">Evidence-first view for study mode: council, gates, queue, and drift movement.</p>
        {renderDeferredPanel(
          args.deferredPanelsReady,
          "Stability Observatory",
          <StabilityObservatoryPanel catalog={args.catalog} simulation={args.simulation} />,
        )}
      </>
    ),
  };
}

function buildRuntimeConfigPanel(args: BuildPanelConfigsArgs): PanelConfig {
  return {
    id: "nexus.ui.runtime_config",
    fallbackSpan: 6,
    className: "card relative overflow-hidden",
    render: () => (
      <>
        <div className="absolute top-0 left-0 w-1 h-full bg-[#ae81ff] opacity-70" />
        <h2 className="text-2xl font-bold mb-2">Runtime Config / 実行設定</h2>
        <p className="text-muted mb-4">
          Inspect live numeric constants exposed by <code>/api/config</code> for simulation and runtime tuning.
        </p>
        {renderDeferredPanel(args.deferredPanelsReady, "Runtime Config", <RuntimeConfigPanel />)}
      </>
    ),
  };
}

function buildParticleDeckPanel(args: BuildPanelConfigsArgs): PanelConfig {
  return {
    id: "nexus.ui.particle_deck",
    fallbackSpan: 6,
    className: "card relative overflow-hidden",
    render: () => (
      <>
        <div className="absolute top-0 left-0 w-1 h-full bg-[#89c6eb] opacity-70" />
        <h2 className="text-2xl font-bold mb-2">Particle Deck / 代網存在甲板</h2>
        <p className="text-muted mb-4">
          Probabilistic particle and presence distributions with direct camera focus controls.
        </p>
        {renderDeferredPanel(
          args.deferredPanelsReady,
          "Particle Deck",
          <ParticleDeckPanel
            catalog={args.catalog}
            simulation={args.simulation}
            onFocusAnchor={args.flyCameraToAnchor}
            onEmitUserInput={args.handleUserPresenceInput}
          />,
        )}
      </>
    ),
  };
}

function buildOmniArchivePanel(args: BuildPanelConfigsArgs): PanelConfig {
  return {
    id: "nexus.ui.omni_archive",
    fallbackSpan: 8,
    className: "card relative overflow-hidden",
    render: () => (
      <>
        <div className="absolute top-0 left-0 w-1 h-full bg-[#ae81ff] opacity-65" />
        <h2 className="text-3xl font-bold mb-2">Omni Panel / 全感覚パネル</h2>
        <p className="text-muted mb-6">Log Stream, Log Writer, and other system entities.</p>
        {renderDeferredPanel(args.deferredPanelsReady, "Omni Archive", <OmniPanel catalog={args.catalog} />)}
        <div className="mt-8">
          <h3 className="text-2xl font-bold mb-4">Vault Artifacts / 遺物録</h3>
          {renderDeferredPanel(args.deferredPanelsReady, "Vault Artifacts", <CatalogPanel catalog={args.catalog} />)}
        </div>
      </>
    ),
  };
}

function buildWorldSimulationPanel(args: BuildPanelConfigsArgs): PanelConfig {
  return {
    id: "nexus.ui.world_simulation",
    fallbackSpan: 4,
    className: "card relative overflow-hidden",
    render: () => (
      <>
        <div className="absolute top-0 left-0 w-1 h-full bg-[#fd971f] opacity-70" />
        <h2 className="text-3xl font-bold mb-2">World Simulation / 世界シミュレーション</h2>
        <p className="text-muted mb-6">Actors interact with presences, generate tracks, and produce reports.</p>
        {renderDeferredPanel(
          args.deferredPanelsReady,
          "World Simulation",
          <WorldSimulationPanel
            simulation={args.simulation}
            interaction={args.worldInteraction}
            interactingPersonId={args.interactingPersonId}
            onInteract={args.handleWorldInteract}
          />,
        )}
      </>
    ),
  };
}

export function buildPanelConfigs(args: BuildPanelConfigsArgs): PanelConfig[] {
  return [
    buildDedicatedViewsPanel(args),
    buildGlassViewportPanel(),
    ...buildAgentPresencePanels(args),
    buildWebGraphWeaverPanel(args),
    buildThreatRadarPanel(args),
    buildInspirationAtlasPanel(args),
    buildEntityVitalsPanel(args),
    buildProjectionLedgerPanel(args),
    buildAutopilotLedgerPanel(args),
    buildWorldLogPanel(args),
    buildStabilityObservatoryPanel(args),
    buildRuntimeConfigPanel(args),
    buildParticleDeckPanel(args),
    buildOmniArchivePanel(args),
    buildWorldSimulationPanel(args),
  ];
}
