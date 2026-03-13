// SPDX-License-Identifier: GPL-3.0-or-later
// This file is part of Fork Tales.
// Copyright (C) 2024-2025 Fork Tales Contributors
//
// Panel state management: window states, pinning, council boosts,
// panel sorting/ranking, and panel layout computation.

import { useState, useCallback, useMemo, useEffect } from "react";
import { type PanInfo } from "framer-motion";
import type { ParticleDisposition, RankedPanel } from "../app/appShellTypes";
import {
  COUNCIL_BOOST_STORAGE_KEY,
  GLASS_VIEWPORT_PANEL_ID,
  isGlassPrimaryPanelId,
  PANEL_TOOL_HINTS,
  PRESENCE_OPERATIONAL_ROLE_BY_ID,
  RUNTIME_CONFIG_PANEL_ID,
  TERTIARY_PIN_STORAGE_KEY,
} from "../app/appShellConstants";
import { PANEL_ANCHOR_PRESETS } from "../app/worldPanelLayout";
import {
  containsAnchorNoCoverZone,
  defaultPinnedPanelMap,
  normalizeUnit,
  overlapAmount,
  panelSizeForWorld,
  preferredSideForAnchor,
  WORLD_PANEL_MARGIN,
  type PanelConfig,
  type PanelPreferredSide,
  type PanelWindowState,
  type WorldAnchorTarget,
  type WorldPanelLayoutEntry,
  type WorldPanelNexusEntry,
} from "../app/worldPanelLayout";
import { clamp, stableUnitHash } from "../app/appShellUtils";
import type {
  EntityManifestItem,
  FileGraphConceptPresence,
  FileGraphNode,
  NamedFieldItem,
  UIProjectionBundle,
  UIProjectionElementState,
} from "../types";

export interface WorldPanelManagerState {
  sortedPanels: RankedPanel[];
  panelWindowStateById: Record<string, PanelWindowState>;
  tertiaryPinnedPanelId: string | null;
  pinnedPanels: Record<string, boolean>;
  selectedPanelId: string | null;
  isEditMode: boolean;
  worldPanelLayout: WorldPanelLayoutEntry[];
  panelNexusLayout: WorldPanelNexusEntry[];
  glassCenterRatio: { x: number; y: number };
}

export interface WorldPanelManagerActions {
  activatePanelWindow: (panelId: string) => void;
  minimizePanelWindow: (panelId: string) => void;
  closePanelWindow: (panelId: string) => void;
  togglePanelPin: (panelId: string) => void;
  adjustPanelCouncilRank: (panelId: string, delta: number) => void;
  pinPanelToTertiary: (panelId: string) => void;
  openRuntimeConfigPanel: () => void;
  setIsEditMode: (value: boolean) => void;
  setHoveredPanelId: (id: string | null) => void;
  handleWorldPanelDragEnd: (panelId: string, info: PanInfo) => void;
}

interface UseWorldPanelManagerParams {
  viewportWidth: number;
  viewportHeight: number;
  panelConfigs: PanelConfig[];
  activeProjection: UIProjectionBundle | null;
  catalog: {
    entity_manifest?: EntityManifestItem[];
    file_graph?: { file_nodes?: FileGraphNode[]; field_nodes?: Array<{ id?: string; field?: string; label?: string; x?: number; y?: number; hue?: number }>; concept_presences?: FileGraphConceptPresence[] };
    crawler_graph?: { field_nodes?: Array<{ id?: string; field?: string; label?: string; x?: number; y?: number; hue?: number }> };
    named_fields?: NamedFieldItem[];
  } | null;
  simulation: {
    file_graph?: { file_nodes?: FileGraphNode[]; concept_presences?: FileGraphConceptPresence[] };
    presence_dynamics?: {
      field_particles?: Array<{ presence_id?: string }>;
      presence_impacts?: Array<{ id?: string; affected_by?: Record<string, unknown>; affects?: Record<string, unknown> }>;
      river_flow?: { rate?: number; turbulence?: number };
      click_events?: number;
      file_events?: number;
    };
    field_particles?: Array<{ presence_id?: string }>;
    timestamp?: string;
    world?: { tick?: number };
  } | null;
  deferredCoreCameraZoom: number;
  deferredCoreCameraPitch: number;
  deferredCoreCameraYaw: number;
  deferredCoreRenderedCameraPosition: { x: number; y: number; z: number };
  coreFlightVelocityRef: React.RefObject<{ x: number; y: number; z: number }>;
  resolveOverlayAnchorRatio: (anchor: WorldAnchorTarget, panelAnchorId?: string) => { x: number; y: number; label?: string } | null;
}

export function useWorldPanelManager(params: UseWorldPanelManagerParams): WorldPanelManagerState & WorldPanelManagerActions {
  const {
    viewportWidth,
    viewportHeight,
    panelConfigs,
    activeProjection,
    catalog,
    simulation,
    deferredCoreCameraZoom,
    deferredCoreCameraPitch,
    deferredCoreCameraYaw,
    deferredCoreRenderedCameraPosition,
    coreFlightVelocityRef,
    resolveOverlayAnchorRatio,
  } = params;

  // Stable mutable Maps (created once via useState lazy init; never updated via setter).
  // Using useState instead of useRef avoids react-hooks/refs lint violations in useMemo.
  const [panelSideMap] = useState(() => new Map<string, PanelPreferredSide>());
  const [panelScreenMap] = useState(() => new Map<string, { x: number; y: number }>());
  const [panelWorldScaleMap] = useState(() => new Map<string, { x: number; y: number }>());

  const [panelWorldBiases, setPanelWorldBiases] = useState<Record<string, { x: number; y: number }>>({});
  const [panelWindowStates, setPanelWindowStates] = useState<Record<string, PanelWindowState>>({});
  const [panelCouncilBoosts, setPanelCouncilBoosts] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(COUNCIL_BOOST_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const normalized: Record<string, number> = {};
      Object.entries(parsed).forEach(([key, value]) => {
        const score = Number(value);
        if (!Number.isFinite(score) || score === 0) return;
        normalized[key] = clamp(score, -6, 8);
      });
      return normalized;
    } catch { return {}; }
  });
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [hoveredPanelId, setHoveredPanelId] = useState<string | null>(null);
  const [tertiaryPinnedPanelId, setTertiaryPinnedPanelId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(TERTIARY_PIN_STORAGE_KEY);
    if (!raw) return null;
    const clean = raw.trim();
    return clean.length > 0 ? clean : null;
  });
  const [pinnedPanels, setPinnedPanels] = useState<Record<string, boolean>>(() =>
    defaultPinnedPanelMap(Object.keys(PANEL_ANCHOR_PRESETS)),
  );
  const [isEditMode, setIsEditMode] = useState(false);

  // Persist council boosts
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (Object.keys(panelCouncilBoosts).length <= 0) {
      window.localStorage.removeItem(COUNCIL_BOOST_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(COUNCIL_BOOST_STORAGE_KEY, JSON.stringify(panelCouncilBoosts));
  }, [panelCouncilBoosts]);

  // Persist tertiary pin
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!tertiaryPinnedPanelId) {
      window.localStorage.removeItem(TERTIARY_PIN_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(TERTIARY_PIN_STORAGE_KEY, tertiaryPinnedPanelId);
  }, [tertiaryPinnedPanelId]);

  // --- Derived projection data ---
  const projectionElementById = useMemo(() => {
    const map = new Map<string, { presence?: string; binds_to?: string[]; kind?: string }>();
    const elements = Array.isArray(activeProjection?.elements) ? activeProjection.elements : [];
    elements.forEach((element) => {
      map.set(element.id, { presence: element.presence, binds_to: element.binds_to, kind: element.kind });
    });
    return map;
  }, [activeProjection?.elements]);

  const projectionStateByElement = useMemo(() => {
    const map = new Map<string, UIProjectionElementState>();
    if (!activeProjection) return map;
    const states = Array.isArray(activeProjection.states) ? activeProjection.states : [];
    states.forEach((state) => { map.set(state.element_id, state); });
    return map;
  }, [activeProjection]);

  const presenceManifestById = useMemo(() => {
    const map = new Map<string, { en: string; ja: string }>();
    (catalog?.entity_manifest ?? []).forEach((entry) => {
      const id = String(entry?.id ?? "").trim();
      if (!id) return;
      const en = String(entry?.en ?? id).trim() || id;
      const ja = String(entry?.ja ?? "").trim();
      map.set(id, { en, ja });
    });
    return map;
  }, [catalog?.entity_manifest]);

  const particleCountsByPresence = useMemo(() => {
    const byPresence: Record<string, number> = {};
    const rows = simulation?.presence_dynamics?.field_particles ?? simulation?.field_particles ?? [];
    for (const row of rows) {
      const presenceId = String(row?.presence_id ?? "").trim();
      if (!presenceId) continue;
      byPresence[presenceId] = (byPresence[presenceId] ?? 0) + 1;
    }
    return byPresence;
  }, [simulation?.field_particles, simulation?.presence_dynamics?.field_particles]);

  // --- Anchor computation ---
  const presenceAnchors = useMemo(() => {
    const map = new Map<string, WorldAnchorTarget>();
    (catalog?.entity_manifest ?? []).forEach((item: EntityManifestItem) => {
      const id = String(item.id || "").trim();
      if (!id) return;
      const x = normalizeUnit(item.x, Number.NaN);
      const y = normalizeUnit(item.y, Number.NaN);
      if (Number.isNaN(x) || Number.isNaN(y)) return;
      map.set(id, {
        kind: "node", id, label: item.en || id, x, y,
        hue: Number(item.hue ?? 210), radius: 0.08, confidence: 1,
        presenceSignature: { [id]: 1 },
      });
    });
    if (!map.has("anchor_registry")) {
      map.set("anchor_registry", {
        kind: "node", id: "anchor_registry", label: "Anchor Registry",
        x: 0.5, y: 0.5, hue: 184, radius: 0.08, confidence: 0.6,
        presenceSignature: { anchor_registry: 1 },
      });
    }
    map.set("particle_field", {
      kind: "node", id: "particle_field", label: "Particle Field",
      x: 0.5, y: 0.5, hue: 204, radius: 0.08, confidence: 0.52,
      presenceSignature: { particle_field: 1 },
    });
    return map;
  }, [catalog?.entity_manifest]);

  const fieldRegionAnchors = useMemo(() => {
    const map = new Map<string, WorldAnchorTarget>();
    const pushNode = (node: { id?: string; field?: string; label?: string; x?: number; y?: number; hue?: number }) => {
      const fieldKey = String(node.field || "").trim();
      const nodeId = String(node.id || "").trim();
      const regionKey = fieldKey || nodeId.replace(/^field:/, "");
      if (!regionKey) return;
      const x = normalizeUnit(node.x, Number.NaN);
      const y = normalizeUnit(node.y, Number.NaN);
      if (Number.isNaN(x) || Number.isNaN(y)) return;
      const region: WorldAnchorTarget = {
        kind: "region", id: regionKey, label: String(node.label || regionKey),
        x, y, radius: 0.16, hue: Number(node.hue ?? 196), confidence: 0.72,
        presenceSignature: { [regionKey]: 1, ...(fieldKey ? { [`field:${fieldKey}`]: 1 } : {}) },
      };
      map.set(regionKey, region);
      if (fieldKey) map.set(fieldKey, region);
    };
    (catalog?.file_graph?.field_nodes ?? []).forEach(pushNode);
    (catalog?.crawler_graph?.field_nodes ?? []).forEach(pushNode);
    return map;
  }, [catalog?.crawler_graph?.field_nodes, catalog?.file_graph?.field_nodes]);

  const namedRegionAnchors = useMemo(() => {
    const map = new Map<string, WorldAnchorTarget>();
    (catalog?.named_fields ?? []).forEach((field: NamedFieldItem) => {
      const id = String(field.id || "").trim();
      if (!id) return;
      const x = normalizeUnit(field.x, Number.NaN);
      const y = normalizeUnit(field.y, Number.NaN);
      if (Number.isNaN(x) || Number.isNaN(y)) return;
      map.set(id, {
        kind: "region", id, label: String(field.en || field.ja || id),
        x, y, radius: 0.2, hue: Number(field.hue ?? 202), confidence: 0.8,
        presenceSignature: { [id]: 1 },
      });
    });
    return map;
  }, [catalog?.named_fields]);

  const fileNodeById = useMemo(() => {
    const map = new Map<string, FileGraphNode>();
    const nodes = simulation?.file_graph?.file_nodes ?? catalog?.file_graph?.file_nodes ?? [];
    nodes.forEach((node) => {
      const id = String(node.id || "").trim();
      if (!id) return;
      map.set(id, node);
    });
    return map;
  }, [catalog?.file_graph?.file_nodes, simulation?.file_graph?.file_nodes]);

  const clusterAnchors = useMemo(() => {
    const map = new Map<string, WorldAnchorTarget>();
    const clusters: FileGraphConceptPresence[] =
      simulation?.file_graph?.concept_presences ?? catalog?.file_graph?.concept_presences ?? [];
    clusters.forEach((cluster) => {
      const clusterId = String(cluster.id || cluster.cluster_id || "").trim();
      if (!clusterId) return;
      const x = normalizeUnit(cluster.x, Number.NaN);
      const y = normalizeUnit(cluster.y, Number.NaN);
      if (Number.isNaN(x) || Number.isNaN(y)) return;
      const signature: Record<string, number> = {};
      const createdBy = String(cluster.created_by || "").trim();
      if (createdBy) signature[createdBy] = clamp(Number(cluster.cohesion ?? 0.52), 0.12, 1);
      const fieldScores = new Map<string, number>();
      (cluster.members ?? []).forEach((memberId) => {
        const node = fileNodeById.get(String(memberId));
        const dominantField = String(node?.dominant_field ?? "").trim();
        if (!dominantField) return;
        fieldScores.set(dominantField, (fieldScores.get(dominantField) ?? 0) + 1);
      });
      fieldScores.forEach((value, key) => { signature[`field:${key}`] = value; });
      let signatureTotal = 0;
      Object.values(signature).forEach((value) => { signatureTotal += value; });
      if (signatureTotal > 0) Object.keys(signature).forEach((key) => { signature[key] = signature[key] / signatureTotal; });
      const clusterAnchor: WorldAnchorTarget = {
        kind: "cluster", id: clusterId,
        label: String(cluster.label || cluster.label_ja || clusterId),
        x, y,
        radius: clamp(0.08 + (Number(cluster.file_count ?? 0) * 0.0028) + (Number(cluster.cohesion ?? 0.2) * 0.14), 0.1, 0.24),
        hue: Number(cluster.hue ?? 276),
        confidence: clamp(Number(cluster.cohesion ?? 0.5), 0.16, 1),
        presenceSignature: signature,
      };
      map.set(clusterId, clusterAnchor);
      const legacyClusterId = String(cluster.cluster_id || "").trim();
      if (legacyClusterId) map.set(legacyClusterId, clusterAnchor);
    });
    return map;
  }, [catalog?.file_graph?.concept_presences, fileNodeById, simulation?.file_graph?.concept_presences]);

  // --- Panel sorting ---
  const sortedPanels = useMemo<RankedPanel[]>(() => {
    const panelDrafts = panelConfigs
      .filter((config) => config.id !== "nexus.ui.simulation_map")
      .map((config) => {
        const state = projectionStateByElement.get(config.id);
        const element = projectionElementById.get(config.id);
        const preset = PANEL_ANCHOR_PRESETS[config.id];
        const priority = state?.priority ?? 0.1;
        return { config, state, element, preset, priority };
      });
    const topOperationalPriority = panelDrafts.reduce((max, draft) => {
      if (isGlassPrimaryPanelId(draft.config.id)) return max;
      return Math.max(max, draft.priority);
    }, 0);
    const lowPriorityCycle = topOperationalPriority < 0.62;
    return panelDrafts
      .map((draft) => {
        const { config, state, element, preset, priority } = draft;
        const councilBoost = panelCouncilBoosts[config.id] ?? 0;
        const rawPresenceId = String(element?.presence ?? config.anchorId ?? preset?.anchorId ?? "particle_field").trim();
        const presenceId = rawPresenceId || "particle_field";
        const presenceMeta = presenceManifestById.get(presenceId);
        const presenceLabel = presenceMeta?.en ?? presenceId.replace(/[_-]+/g, " ");
        const presenceLabelJa = presenceMeta?.ja ?? "";
        const presenceRole = PRESENCE_OPERATIONAL_ROLE_BY_ID[presenceId] ?? "neutral";
        const particleDisposition: ParticleDisposition = presenceRole === "neutral" ? "neutral" : "role-bound";
        const particleCount = particleCountsByPresence[presenceId] ?? 0;
        const glassPanel = isGlassPrimaryPanelId(config.id);
        const glassPreferenceBoost = glassPanel
          ? (presenceRole === "camera-guidance" ? 0.14 : 0.08) + (lowPriorityCycle ? 0.19 : 0) + (particleCount <= 2 ? 0.03 : 0)
          : 0;
        const threatRadarBoost = config.id === "nexus.ui.threat_radar" ? 0.62 + (lowPriorityCycle ? 0.14 : 0) : 0;
        const councilScore = clamp(priority + glassPreferenceBoost + threatRadarBoost + (councilBoost * 0.11), 0, 2);
        const depth = Math.round(clamp(councilScore, 0, 1) * 160) + 24;
        const toolHints = PANEL_TOOL_HINTS[config.id] ?? ["inspect", "focus", "act"];
        const baseCouncilReason = String(state?.explain?.reason_en ?? "Council rank follows live field and presence signal.");
        const councilReason = glassPanel && glassPreferenceBoost > 0
          ? `${baseCouncilReason} Main lane preferred${lowPriorityCycle ? " during low-priority cycle." : "."}`
          : baseCouncilReason;
        return {
          ...config, anchorKind: config.anchorKind ?? preset?.kind ?? "node",
          anchorId: config.anchorId ?? preset?.anchorId,
          worldSize: config.worldSize ?? preset?.worldSize ?? "m",
          pinnedByDefault: config.pinnedByDefault ?? preset?.pinnedByDefault ?? false,
          priority, depth, councilScore, councilBoost, councilReason,
          presenceId, presenceLabel, presenceLabelJa, presenceRole,
          particleDisposition, particleCount, toolHints,
        };
      })
      .sort((left, right) => {
        if (right.councilScore !== left.councilScore) return right.councilScore - left.councilScore;
        if (isGlassPrimaryPanelId(right.id) !== isGlassPrimaryPanelId(left.id))
          return Number(isGlassPrimaryPanelId(right.id)) - Number(isGlassPrimaryPanelId(left.id));
        return right.priority - left.priority;
      });
  }, [panelConfigs, panelCouncilBoosts, particleCountsByPresence, presenceManifestById, projectionElementById, projectionStateByElement]);

  // --- Panel window state ---
  const panelWindowStateById = useMemo<Record<string, PanelWindowState>>(() => {
    const stateById: Record<string, PanelWindowState> = {};
    sortedPanels.forEach((panel, index) => {
      const existing = panelWindowStates[panel.id];
      if (existing) { stateById[panel.id] = existing; return; }
      stateById[panel.id] = { open: Boolean(panel.pinnedByDefault || index < 3), minimized: false };
    });
    return stateById;
  }, [panelWindowStates, sortedPanels]);

  // --- Panel actions ---
  const activatePanelWindow = useCallback((panelId: string) => {
    const current = panelWindowStateById[panelId] ?? { open: true, minimized: false };
    if (!current.open || current.minimized) {
      setPanelWindowStates((prev) => ({ ...prev, [panelId]: { open: true, minimized: false } }));
    }
    setSelectedPanelId(panelId);
  }, [panelWindowStateById]);

  const minimizePanelWindow = useCallback((panelId: string) => {
    if (panelId === GLASS_VIEWPORT_PANEL_ID) {
      setPanelWindowStates((prev) => ({ ...prev, [panelId]: { open: true, minimized: false } }));
      return;
    }
    setPanelWindowStates((prev) => ({ ...prev, [panelId]: { open: true, minimized: true } }));
    setSelectedPanelId((prev) => (prev === panelId ? null : prev));
    setHoveredPanelId((prev) => (prev === panelId ? null : prev));
  }, []);

  const closePanelWindow = useCallback((panelId: string) => {
    if (panelId === GLASS_VIEWPORT_PANEL_ID) {
      setPanelWindowStates((prev) => ({ ...prev, [panelId]: { open: true, minimized: false } }));
      setPinnedPanels((prev) => ({ ...prev, [panelId]: true }));
      return;
    }
    setPanelWindowStates((prev) => ({ ...prev, [panelId]: { open: false, minimized: false } }));
    setSelectedPanelId((prev) => (prev === panelId ? null : prev));
    setHoveredPanelId((prev) => (prev === panelId ? null : prev));
  }, []);

  const togglePanelPin = useCallback((panelId: string) => {
    if (panelId === GLASS_VIEWPORT_PANEL_ID) {
      setPinnedPanels((prev) => ({ ...prev, [panelId]: true }));
      return;
    }
    setPinnedPanels((prev) => ({ ...prev, [panelId]: !prev[panelId] }));
  }, []);

  const adjustPanelCouncilRank = useCallback((panelId: string, delta: number) => {
    if (!panelId || !Number.isFinite(delta) || delta === 0) return;
    setPanelCouncilBoosts((prev) => {
      const current = prev[panelId] ?? 0;
      const next = clamp(current + delta, -6, 8);
      if (next === 0) {
        if (current === 0) return prev;
        const nextState = { ...prev };
        delete nextState[panelId];
        return nextState;
      }
      return { ...prev, [panelId]: next };
    });
    setSelectedPanelId(panelId);
    setPanelWindowStates((prev) => ({ ...prev, [panelId]: { open: true, minimized: false } }));
  }, []);

  const pinPanelToTertiary = useCallback((panelId: string) => {
    const id = panelId.trim();
    if (!id) return;
    setTertiaryPinnedPanelId((prev) => (prev === id ? null : id));
    setPanelWindowStates((prev) => ({ ...prev, [id]: { open: true, minimized: false } }));
  }, []);

  const openRuntimeConfigPanel = useCallback(() => {
    setPanelWindowStates((prev) => ({ ...prev, [RUNTIME_CONFIG_PANEL_ID]: { open: true, minimized: false } }));
    setPinnedPanels((prev) => ({ ...prev, [RUNTIME_CONFIG_PANEL_ID]: true }));
    setSelectedPanelId(RUNTIME_CONFIG_PANEL_ID);
    setHoveredPanelId(null);
  }, []);

  // --- Panel anchor resolution ---
  const panelAnchorById = useMemo(() => {
    const map = new Map<string, WorldAnchorTarget>();
    const uniqueClusters = Array.from(clusterAnchors.values()).filter(
      (anchor, index, list) => list.findIndex((entry) => entry.id === anchor.id) === index,
    );
    const regionSource = new Map<string, WorldAnchorTarget>();
    namedRegionAnchors.forEach((anchor, key) => { regionSource.set(key, anchor); });
    fieldRegionAnchors.forEach((anchor, key) => { if (!regionSource.has(key)) regionSource.set(key, anchor); });
    const uniqueRegions = Array.from(regionSource.values()).filter(
      (anchor, index, list) => list.findIndex((entry) => entry.id === anchor.id) === index,
    );
    const nearestTo = (x: number, y: number, pool: WorldAnchorTarget[]) => {
      if (pool.length === 0) return null;
      let best = pool[0];
      let bestDistance = Number.POSITIVE_INFINITY;
      pool.forEach((anchor) => {
        const distance = Math.hypot(anchor.x - x, anchor.y - y);
        if (distance < bestDistance) { best = anchor; bestDistance = distance; }
      });
      return best;
    };
    sortedPanels.forEach((panel) => {
      const element = projectionElementById.get(panel.id);
      const state = projectionStateByElement.get(panel.id);
      const dominantField = String(state?.explain?.dominant_field ?? "").trim();
      const preferredPresence = panel.anchorId ?? element?.presence ?? (panel.id === "nexus.ui.dedicated_views" ? "anchor_registry" : "particle_field");
      const nodeAnchor = presenceAnchors.get(preferredPresence) ?? presenceAnchors.get("anchor_registry") ?? {
        kind: "node" as const, id: "anchor_registry", label: "Anchor Registry",
        x: 0.5, y: 0.5, radius: 0.08, hue: 188, confidence: 0.4, presenceSignature: { anchor_registry: 1 },
      };
      const regionAnchorByField = dominantField ? fieldRegionAnchors.get(dominantField) : null;
      const regionAnchorByPresence = namedRegionAnchors.get(preferredPresence) ?? fieldRegionAnchors.get(preferredPresence);
      const nearestRegion = nearestTo(nodeAnchor.x, nodeAnchor.y, uniqueRegions);
      const regionAnchor = (panel.anchorId ? namedRegionAnchors.get(panel.anchorId) ?? fieldRegionAnchors.get(panel.anchorId) : null) ?? regionAnchorByField ?? regionAnchorByPresence ?? nearestRegion ?? nodeAnchor;
      const nearestCluster = (() => {
        if (uniqueClusters.length === 0) return null;
        let best: WorldAnchorTarget | null = null;
        let bestScore = Number.NEGATIVE_INFINITY;
        uniqueClusters.forEach((cluster) => {
          const distance = Math.hypot(cluster.x - nodeAnchor.x, cluster.y - nodeAnchor.y);
          const distanceScore = 1 - clamp(distance / 0.88, 0, 1);
          const presenceScore = cluster.presenceSignature[preferredPresence] ?? 0;
          const fieldScore = dominantField ? (cluster.presenceSignature[`field:${dominantField}`] ?? 0) : 0;
          const score = (distanceScore * 0.62) + (presenceScore * 0.26) + (fieldScore * 0.12);
          if (score > bestScore) { best = cluster; bestScore = score; }
        });
        return best;
      })();
      let resolvedAnchor: WorldAnchorTarget;
      if (panel.anchorKind === "cluster") resolvedAnchor = (panel.anchorId ? clusterAnchors.get(panel.anchorId) : null) ?? nearestCluster ?? regionAnchor ?? nodeAnchor;
      else if (panel.anchorKind === "region") resolvedAnchor = regionAnchor ?? nodeAnchor;
      else resolvedAnchor = nodeAnchor;
      map.set(panel.id, { ...resolvedAnchor, confidence: clamp((resolvedAnchor.confidence * 0.78) + (panel.priority * 0.22), 0.1, 1) });
    });
    return map;
  }, [clusterAnchors, fieldRegionAnchors, namedRegionAnchors, presenceAnchors, projectionElementById, projectionStateByElement, sortedPanels]);

  // --- State-space biases ---
  const panelStateSpaceBiases = useMemo(() => {
    const byPanel: Record<string, { x: number; y: number }> = {};
    const dynamics = simulation?.presence_dynamics;
    const impactRows = Array.isArray(dynamics?.presence_impacts) ? dynamics.presence_impacts : [];
    if (impactRows.length === 0) return byPanel;
    const anchorLookup = new Map<string, WorldAnchorTarget>();
    const indexAnchor = (id: string, anchor: WorldAnchorTarget) => { if (!id || anchorLookup.has(id)) return; anchorLookup.set(id, anchor); };
    presenceAnchors.forEach((anchor, id) => { indexAnchor(id, anchor); });
    namedRegionAnchors.forEach((anchor, id) => { indexAnchor(id, anchor); });
    fieldRegionAnchors.forEach((anchor, id) => { indexAnchor(id, anchor); });
    clusterAnchors.forEach((anchor, id) => { indexAnchor(id, anchor); });
    const impactById = new Map<string, number>();
    let centroidX = 0; let centroidY = 0; let centroidWeight = 0;
    impactRows.forEach((row) => {
      const impactId = String(row.id ?? "").trim();
      if (!impactId) return;
      const affectedBy = row.affected_by ?? {};
      const affects = row.affects ?? {};
      const intensity = clamp(
        (clamp(Number((affectedBy as Record<string, unknown>).clicks ?? 0), 0, 1) * 0.44)
        + (clamp(Number((affectedBy as Record<string, unknown>).files ?? 0), 0, 1) * 0.31)
        + (clamp(Number((affects as Record<string, unknown>).world ?? 0), 0, 1) * 0.25), 0, 1,
      );
      if (intensity <= 0.02) return;
      impactById.set(impactId, intensity);
      const anchor = anchorLookup.get(impactId);
      if (!anchor) return;
      centroidX += anchor.x * intensity; centroidY += anchor.y * intensity; centroidWeight += intensity;
    });
    if (impactById.size === 0) return byPanel;
    const centroid = centroidWeight > 0 ? { x: centroidX / centroidWeight, y: centroidY / centroidWeight } : { x: 0.5, y: 0.5 };
    const flowRate = clamp(Number(dynamics?.river_flow?.rate ?? 0), 0, 1);
    const turbulence = clamp(Number(dynamics?.river_flow?.turbulence ?? 0), 0, 1);
    const clickPressure = clamp(Number(dynamics?.click_events ?? 0) / 16, 0, 1);
    const filePressure = clamp(Number(dynamics?.file_events ?? 0) / 18, 0, 1);
    const timestampMillis = Date.parse(String(simulation?.timestamp ?? ""));
    const timeSeed = Number.isFinite(timestampMillis) ? timestampMillis / 1000 : Number(simulation?.world?.tick ?? 0);
    sortedPanels.forEach((panel) => {
      const anchor = panelAnchorById.get(panel.id);
      if (!anchor) return;
      let coupling = 0;
      Object.entries(anchor.presenceSignature ?? {}).forEach(([signatureId, rawWeight]) => {
        const weight = clamp(Number(rawWeight), 0, 1);
        if (weight <= 0) return;
        const normalizedId = signatureId.replace(/^field:/, "");
        const impact = impactById.get(signatureId) ?? impactById.get(normalizedId) ?? 0;
        coupling += weight * impact;
      });
      coupling += (impactById.get(anchor.id) ?? 0) * 0.35;
      const projectionState = projectionStateByElement.get(panel.id);
      const projectionPresenceSignal = clamp(Number(projectionState?.explain?.presence_signal ?? 0), 0, 1);
      const pulseSignal = clamp(Number(projectionState?.pulse ?? 0), 0, 1);
      const magnitude = clamp((coupling * (0.12 + (projectionPresenceSignal * 0.18))) + (pulseSignal * 0.03) + ((clickPressure + filePressure) * 0.02), 0, 0.28);
      if (magnitude <= 0.0006) return;
      const driftX = centroid.x - anchor.x; const driftY = centroid.y - anchor.y;
      const phase = timeSeed * (0.46 + (flowRate * 0.34)) + (stableUnitHash(panel.id) * Math.PI * 2);
      const swirl = 0.008 + (turbulence * 0.022);
      byPanel[panel.id] = {
        x: clamp((driftX * magnitude * 0.92) + (Math.cos(phase) * swirl), -0.34, 0.34),
        y: clamp((driftY * magnitude * 0.92) + (Math.sin(phase * 1.1) * swirl), -0.28, 0.28),
      };
    });
    return byPanel;
  }, [clusterAnchors, fieldRegionAnchors, namedRegionAnchors, panelAnchorById, presenceAnchors, projectionStateByElement, simulation?.presence_dynamics, simulation?.timestamp, simulation?.world?.tick, sortedPanels]);

  // --- Visible panels ---
  const openPanelIds = useMemo(() => {
    return sortedPanels
      .filter((panel) => { const ws = panelWindowStateById[panel.id] ?? { open: true, minimized: false }; return ws.open && !ws.minimized; })
      .map((panel) => panel.id);
  }, [panelWindowStateById, sortedPanels]);

  const visiblePanelIds = useMemo(() => {
    const ordered = [...openPanelIds];
    const bringToFront = (panelId: string | null | undefined) => {
      if (!panelId) return;
      const index = ordered.indexOf(panelId);
      if (index <= 0) return;
      ordered.splice(index, 1); ordered.unshift(panelId);
    };
    bringToFront(selectedPanelId);
    bringToFront(hoveredPanelId);
    sortedPanels.forEach((panel) => { if (pinnedPanels[panel.id]) bringToFront(panel.id); });
    return ordered;
  }, [hoveredPanelId, openPanelIds, pinnedPanels, selectedPanelId, sortedPanels]);

  // --- World panel layout ---
  const worldPanelLayout = useMemo<WorldPanelLayoutEntry[]>(() => {
    const panelsById = new Map(sortedPanels.map((panel) => [panel.id, panel]));
    /* eslint-disable react-hooks/refs -- velocity ref read is intentional for smooth layout animation */
    const velocity = coreFlightVelocityRef.current;
    const speedNorm = clamp(Math.hypot(velocity.x, velocity.y, velocity.z) / 26, 0, 1);
    /* eslint-enable react-hooks/refs */
    const stageTop = viewportHeight < 860 ? 104 : 118;
    const stageBottom = Math.max(stageTop + 132, viewportHeight - 14);
    const stageHeight = Math.max(120, stageBottom - stageTop);
    const centerX = viewportWidth / 2; const centerY = stageTop + (stageHeight / 2);
    const yaw = (deferredCoreCameraYaw * Math.PI / 180) * 0.72;
    const pitch = (deferredCoreCameraPitch * Math.PI / 180) * 0.68;
    const cosYaw = Math.cos(yaw); const sinYaw = Math.sin(yaw);
    const cosPitch = Math.cos(pitch); const sinPitch = Math.sin(pitch);
    const cameraOffsetX = deferredCoreRenderedCameraPosition.x / 660;
    const cameraOffsetY = deferredCoreRenderedCameraPosition.y / 560;
    const cameraOffsetZ = deferredCoreRenderedCameraPosition.z / 920;
    const anchorToWorldPoint = (anchor: WorldAnchorTarget) => ({ x: (anchor.x - 0.5) * 2.25, y: (anchor.y - 0.5) * 1.86, z: anchor.kind === "node" ? 0.62 : anchor.kind === "cluster" ? 0.24 : -0.14 });
    const projectWorldPoint = (worldX: number, worldY: number, worldZ: number) => {
      const wx = worldX - cameraOffsetX; const wy = worldY - cameraOffsetY; const wz = worldZ - cameraOffsetZ;
      const x1 = (wx * cosYaw) - (wz * sinYaw); const z1 = (wx * sinYaw) + (wz * cosYaw);
      const y1 = (wy * cosPitch) - (z1 * sinPitch); const z2 = (wy * sinPitch) + (z1 * cosPitch);
      const perspective = clamp(1 / (1 + (z2 * 0.7)), 0.46, 1.9);
      return { x: centerX + (x1 * viewportWidth * 0.34 * perspective * deferredCoreCameraZoom), y: centerY + (y1 * stageHeight * 0.47 * perspective * deferredCoreCameraZoom), perspective };
    };
    const entries: WorldPanelLayoutEntry[] = [];
    const trackedScaleIds = new Set<string>();
    visiblePanelIds.forEach((panelId) => {
      const panel = panelsById.get(panelId);
      if (!panel) return;
      const anchor = panelAnchorById.get(panelId);
      if (!anchor) return;
      const overlayAnchor = resolveOverlayAnchorRatio(anchor, panel.anchorId);
      const anchorWorld = overlayAnchor ? { x: (overlayAnchor.x - 0.5) * 2.25, y: (overlayAnchor.y - 0.5) * 1.86, z: anchor.kind === "node" ? 0.62 : anchor.kind === "cluster" ? 0.24 : -0.14 } : anchorToWorldPoint(anchor);
      const projected = overlayAnchor
        ? { x: overlayAnchor.x * viewportWidth, y: stageTop + (overlayAnchor.y * stageHeight), perspective: clamp(0.96 + ((deferredCoreCameraZoom - 1) * 0.18), 0.72, 1.34) }
        : projectWorldPoint(anchorWorld.x, anchorWorld.y, anchorWorld.z);
      const side = preferredSideForAnchor(panelId, projected.x, projected.y, viewportWidth, viewportHeight, panelSideMap);
      const baseSize = panelSizeForWorld(panel.worldSize ?? "m", panel.priority, deferredCoreCameraZoom, speedNorm);
      const size = { width: Math.round(Math.min(baseSize.width, Math.max(176, viewportWidth - (WORLD_PANEL_MARGIN * 2)))), height: Math.round(Math.min(baseSize.height, Math.max(120, stageBottom - stageTop - 8))), collapse: baseSize.collapse };
      const pixelsPerWorldX = Math.max(90, viewportWidth * 0.34 * projected.perspective * deferredCoreCameraZoom);
      const pixelsPerWorldY = Math.max(74, stageHeight * 0.47 * projected.perspective * deferredCoreCameraZoom);
      panelWorldScaleMap.set(panelId, { x: pixelsPerWorldX, y: pixelsPerWorldY });
      trackedScaleIds.add(panelId);
      const halfWorldWidth = (size.width / pixelsPerWorldX) * 0.5;
      const halfWorldHeight = (size.height / pixelsPerWorldY) * 0.5;
      const gapWorldX = Math.max(0.04, 22 / pixelsPerWorldX);
      const gapWorldY = Math.max(0.04, 18 / pixelsPerWorldY);
      let panelWorldX = anchorWorld.x; let panelWorldY = anchorWorld.y;
      if (side === "left") { panelWorldX -= halfWorldWidth + gapWorldX; panelWorldY -= gapWorldY * 0.34; }
      else if (side === "right") { panelWorldX += halfWorldWidth + gapWorldX; panelWorldY -= gapWorldY * 0.34; }
      else if (side === "top") { panelWorldY -= halfWorldHeight + gapWorldY; }
      else { panelWorldY += halfWorldHeight + gapWorldY; }
      const manualBias = panelWorldBiases[panelId] ?? { x: 0, y: 0 };
      const stateSpaceBias = panelStateSpaceBiases[panelId] ?? { x: 0, y: 0 };
      panelWorldX += manualBias.x + stateSpaceBias.x;
      panelWorldY += manualBias.y + stateSpaceBias.y;
      const panelScreen = projectWorldPoint(panelWorldX, panelWorldY, anchorWorld.z);
      const x = panelScreen.x - (size.width / 2); const y = panelScreen.y - (size.height / 2);
      const glow = selectedPanelId === panelId ? 0.96 : hoveredPanelId === panelId ? 0.88 : pinnedPanels[panelId] ? 0.72 : clamp(0.44 + (panel.priority * 0.38), 0.4, 0.78);
      entries.push({
        id: panel.id, panel, anchor, anchorScreenX: projected.x, anchorScreenY: projected.y,
        side, x, y, width: size.width, height: size.height,
        panelWorldX, panelWorldY, panelWorldZ: anchorWorld.z,
        pixelsPerWorldX, pixelsPerWorldY, tetherX: projected.x, tetherY: projected.y,
        glow, collapse: size.collapse,
      });
    });
    panelWorldScaleMap.forEach((_scale, panelId) => { if (!trackedScaleIds.has(panelId)) panelWorldScaleMap.delete(panelId); });
    const clampEntry = (entry: WorldPanelLayoutEntry) => {
      entry.x = clamp(entry.x, WORLD_PANEL_MARGIN, viewportWidth - entry.width - WORLD_PANEL_MARGIN);
      entry.y = clamp(entry.y, stageTop, stageBottom - entry.height);
    };
    const updateTether = (entry: WorldPanelLayoutEntry) => {
      if (entry.side === "left") { entry.tetherX = entry.x + entry.width; entry.tetherY = clamp(entry.anchorScreenY, entry.y + 14, entry.y + entry.height - 14); }
      else if (entry.side === "right") { entry.tetherX = entry.x; entry.tetherY = clamp(entry.anchorScreenY, entry.y + 14, entry.y + entry.height - 14); }
      else if (entry.side === "top") { entry.tetherX = clamp(entry.anchorScreenX, entry.x + 14, entry.x + entry.width - 14); entry.tetherY = entry.y + entry.height; }
      else { entry.tetherX = clamp(entry.anchorScreenX, entry.x + 14, entry.x + entry.width - 14); entry.tetherY = entry.y; }
    };
    for (let pass = 0; pass < 6; pass += 1) {
      for (let i = 0; i < entries.length; i += 1) {
        for (let j = i + 1; j < entries.length; j += 1) {
          const a = entries[i]; const b = entries[j];
          const overlap = overlapAmount(a, b);
          if (!overlap) continue;
          if (overlap.x < overlap.y) {
            const push = (overlap.x / 2) + 2;
            const direction = (a.x + (a.width / 2)) <= (b.x + (b.width / 2)) ? -1 : 1;
            a.x += direction * push; b.x -= direction * push;
          } else {
            const push = (overlap.y / 2) + 2;
            const direction = (a.y + (a.height / 2)) <= (b.y + (b.height / 2)) ? -1 : 1;
            a.y += direction * push; b.y -= direction * push;
          }
        }
      }
      entries.forEach((entry) => {
        if (containsAnchorNoCoverZone(entry, Math.max(20, entry.anchor.radius * Math.min(viewportWidth, stageHeight)))) {
          const centerRectX = entry.x + (entry.width / 2); const centerRectY = entry.y + (entry.height / 2);
          const dx = centerRectX - entry.anchorScreenX; const dy = centerRectY - entry.anchorScreenY;
          const distance = Math.hypot(dx, dy) || 0.0001;
          const push = 7 + (pass * 1.5);
          entry.x += (dx / distance) * push; entry.y += (dy / distance) * push;
        }
        clampEntry(entry);
      });
    }
    const smoothAlpha = clamp(0.26 - (speedNorm * 0.16), 0.09, 0.26);
    entries.forEach((entry) => {
      const previous = panelScreenMap.get(entry.id);
      if (previous) { entry.x = previous.x + ((entry.x - previous.x) * smoothAlpha); entry.y = previous.y + ((entry.y - previous.y) * smoothAlpha); }
      panelScreenMap.set(entry.id, { x: entry.x, y: entry.y });
      clampEntry(entry); updateTether(entry);
    });
    return entries;
  }, [coreFlightVelocityRef, deferredCoreCameraPitch, deferredCoreRenderedCameraPosition, deferredCoreCameraYaw, deferredCoreCameraZoom, hoveredPanelId, panelAnchorById, panelScreenMap, panelSideMap, panelStateSpaceBiases, panelWorldBiases, panelWorldScaleMap, pinnedPanels, resolveOverlayAnchorRatio, selectedPanelId, sortedPanels, viewportHeight, viewportWidth, visiblePanelIds]);

  // --- Nexus layout ---
  const panelNexusLayout = useMemo<WorldPanelNexusEntry[]>(() => {
    const visibleEntryById = new Map(worldPanelLayout.map((entry) => [entry.id, entry]));
    const stageTop = viewportHeight < 860 ? 104 : 118;
    const stageBottom = Math.max(stageTop + 132, viewportHeight - 14);
    const stageHeight = Math.max(120, stageBottom - stageTop);
    return sortedPanels.flatMap((panel) => {
      const anchor = panelAnchorById.get(panel.id);
      if (!anchor) return [];
      const windowState = panelWindowStateById[panel.id] ?? { open: true, minimized: false };
      const visibleEntry = visibleEntryById.get(panel.id);
      const overlayAnchor = resolveOverlayAnchorRatio(anchor, panel.anchorId);
      const x = visibleEntry?.anchorScreenX ?? (overlayAnchor ? overlayAnchor.x * viewportWidth : anchor.x * viewportWidth);
      const y = visibleEntry?.anchorScreenY ?? (overlayAnchor ? stageTop + (overlayAnchor.y * stageHeight) : stageTop + (anchor.y * stageHeight));
      return [{ panelId: panel.id, panelLabel: panel.id.split(".").slice(-1)[0].replace(/_/g, " "), anchor, x, y, hue: anchor.hue, confidence: anchor.confidence, open: windowState.open, minimized: windowState.minimized, selected: selectedPanelId === panel.id }];
    });
  }, [panelAnchorById, panelWindowStateById, resolveOverlayAnchorRatio, selectedPanelId, sortedPanels, viewportHeight, viewportWidth, worldPanelLayout]);

  const glassCenterRatio = useMemo(() => {
    const stageTop = viewportHeight < 860 ? 104 : 118;
    const stageBottom = Math.max(stageTop + 132, viewportHeight - 14);
    const stageHeight = Math.max(120, stageBottom - stageTop);
    const glassEntry = worldPanelLayout.find((entry) => entry.id === GLASS_VIEWPORT_PANEL_ID);
    if (!glassEntry) return { x: 0.5, y: 0.5 };
    return {
      x: clamp((glassEntry.x + (glassEntry.width / 2)) / Math.max(1, viewportWidth), 0.08, 0.92),
      y: clamp(((glassEntry.y + (glassEntry.height / 2)) - stageTop) / Math.max(1, stageHeight), 0.08, 0.92),
    };
  }, [viewportHeight, viewportWidth, worldPanelLayout]);

  const handleWorldPanelDragEnd = useCallback((panelId: string, info: PanInfo) => {
    const panelScale = panelWorldScaleMap.get(panelId);
    const fallbackPixelsPerWorldX = Math.max(140, viewportWidth * 0.34 * deferredCoreCameraZoom);
    const fallbackPixelsPerWorldY = Math.max(110, Math.max(160, viewportHeight - 126) * 0.47 * deferredCoreCameraZoom);
    const pixelsPerWorldX = Math.max(90, panelScale?.x ?? fallbackPixelsPerWorldX);
    const pixelsPerWorldY = Math.max(74, panelScale?.y ?? fallbackPixelsPerWorldY);
    const worldDeltaX = info.offset.x / pixelsPerWorldX;
    const worldDeltaY = info.offset.y / pixelsPerWorldY;
    setPanelWorldBiases((prev) => {
      const current = prev[panelId] ?? { x: 0, y: 0 };
      return { ...prev, [panelId]: { x: clamp(current.x + worldDeltaX, -1.24, 1.24), y: clamp(current.y + worldDeltaY, -1.02, 1.02) } };
    });
  }, [deferredCoreCameraZoom, viewportHeight, viewportWidth]);

  return {
    sortedPanels, panelWindowStateById,
    tertiaryPinnedPanelId, pinnedPanels,
    selectedPanelId, isEditMode,
    worldPanelLayout, panelNexusLayout,
    glassCenterRatio,
    activatePanelWindow, minimizePanelWindow, closePanelWindow,
    togglePanelPin, adjustPanelCouncilRank,
    pinPanelToTertiary, openRuntimeConfigPanel,
    setIsEditMode, setHoveredPanelId: setHoveredPanelId,
    handleWorldPanelDragEnd,
  };
}
