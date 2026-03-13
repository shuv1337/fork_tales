// SPDX-License-Identifier: GPL-3.0-or-later
// This file is part of Fork Tales.
// Copyright (C) 2024-2025 Fork Tales Contributors

import { useState, useCallback, useEffect, useRef } from "react";
import type { OverlayApi } from "../app/appShellTypes";
import type { AgentWorkspaceContext } from "../types";
import {
  normalizeAgentPresenceId,
  normalizeAgentWorkspaceContext,
  sameStringArray,
} from "../app/agentWorkspace";
import {
  APP_WORKSPACE_NORMALIZE_OPTIONS,
  AGENT_WORKSPACE_STORAGE_KEY,
} from "../app/appShellConstants";
import {
  buildDeviceSurroundingNodes,
  clamp,
  resolveRuntimeMediaUrl,
  stableUnitHash,
  toAgentSlug,
} from "../app/appShellUtils";
import { runtimeBaseUrl } from "../runtime/endpoints";
import type {
  ChatMessage,
  EntityManifestItem,
  FileGraphNode,
  AgentEvent,
  WorldInteractionResponse,
} from "../types";

export interface AgentHandlersState {
  activeAgentPresenceId: string;
  setActiveAgentPresenceId: (id: string) => void;
  agentForgeLabel: string;
  setAgentForgeLabel: (label: string) => void;
  agentForgeBusy: boolean;
  agentForgePreviewId: string;
  agentWorkspaceContexts: Record<string, AgentWorkspaceContext>;
  agentWorkspaceBindings: Record<string, string[]>;
  isRecording: boolean;
  isThinking: boolean;
  setIsThinking: (val: boolean) => void;
  voiceInputMeta: string;
  recordedBlob: Blob | null;
  worldInteraction: WorldInteractionResponse | null;
  interactingPersonId: string | null;
}

// WorldInteractionResponse is imported from ../types

export interface AgentHandlersActions {
  emitChatMessage: (message: ChatMessage) => void;
  emitSystemMessage: (text: string) => void;
  playAgentAudio: (rawUrl: string, label: string) => Promise<boolean>;
  openAgentImage: (rawUrl: string, label: string) => boolean;
  handleCreateAgent: () => Promise<void>;
  buildAgentSurroundingNodes: (
    musePresenceId: string,
    workspace?: AgentWorkspaceContext | null,
  ) => Array<Record<string, unknown>>;
  emitWitnessChatReply: (
    payload: Record<string, unknown>,
    source: string,
    requestedMusePresenceId?: string,
  ) => void;
  handleRecord: () => Promise<void>;
  handleTranscribe: () => Promise<string | undefined>;
  handleSendVoice: (musePresenceId: string, workspace: AgentWorkspaceContext) => Promise<void>;
  handleAgentWorkspaceBindingsChange: (presenceId: string, fileNodeIds: string[]) => void;
  handleAgentWorkspaceContextChange: (presenceId: string, workspace: AgentWorkspaceContext) => void;
  handleAgentWorkspaceSend: (text: string, musePresenceId: string, workspace: AgentWorkspaceContext) => void;
  handleWorldInteract: (personId: string, action: "speak" | "pray" | "sing") => Promise<void>;
  handleOverlayInit: (api: unknown) => void;
}

interface UseAgentHandlersParams {
  overlayApi: OverlayApi | null;
  setOverlayApi: (api: OverlayApi | null) => void;
  emitUiToast: (title: string, body: string) => void;
  catalog: {
    file_graph?: { file_nodes?: FileGraphNode[] };
    entity_manifest?: EntityManifestItem[];
    generated_at?: string;
  } | null;
  simulation: {
    file_graph?: { file_nodes?: FileGraphNode[] };
    timestamp?: string;
    presence_dynamics?: {
      resource_heartbeat?: {
        devices?: Record<string, { utilization?: number } | undefined>;
      };
    };
  } | null;
  agentEvents: AgentEvent[] | undefined;
  handleAutopilotUserInput: (text: string) => boolean;
  handleChatCommand: (text: string, musePresenceId: string) => Promise<boolean>;
}

export function useAgentHandlers(params: UseAgentHandlersParams): AgentHandlersState & AgentHandlersActions {
  const {
    overlayApi,
    setOverlayApi,
    emitUiToast,
    catalog,
    simulation,
    agentEvents,
    handleAutopilotUserInput,
    handleChatCommand,
  } = params;

  const [activeAgentPresenceId, setActiveAgentPresenceId] = useState("witness_thread");
  const [agentForgeLabel, setAgentForgeLabel] = useState("");
  const [agentForgeBusy, setAgentForgeBusy] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [voiceInputMeta, setVoiceInputMeta] = useState("voice input idle / 音声入力待機");
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [worldInteraction, setWorldInteraction] = useState<WorldInteractionResponse | null>(null);
  const [interactingPersonId, setInteractingPersonId] = useState<string | null>(null);

  const [agentWorkspaceContexts, setAgentWorkspaceContexts] = useState<Record<string, AgentWorkspaceContext>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(AGENT_WORKSPACE_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const normalized: Record<string, AgentWorkspaceContext> = {};
      Object.entries(parsed).forEach(([presenceId, value]) => {
        const normalizedPresence = normalizeAgentPresenceId(String(presenceId || ""));
        if (!normalizedPresence || !value || typeof value !== "object") return;
        const workspace = normalizeAgentWorkspaceContext(
          value as Partial<AgentWorkspaceContext>,
          APP_WORKSPACE_NORMALIZE_OPTIONS,
        );
        if (workspace.pinnedFileNodeIds.length <= 0 && workspace.searchQuery.trim().length <= 0) return;
        normalized[normalizedPresence] = workspace;
      });
      return normalized;
    } catch { return {}; }
  });

  const [agentWorkspaceBindings, setAgentWorkspaceBindings] = useState<Record<string, string[]>>(() => {
    const seeded: Record<string, string[]> = {};
    Object.entries(agentWorkspaceContexts).forEach(([presenceId, workspace]) => {
      if (workspace.pinnedFileNodeIds.length > 0) seeded[presenceId] = workspace.pinnedFileNodeIds;
    });
    return seeded;
  });

  const processedAgentEventSeqRef = useRef(0);
  const agentAudioElementRef = useRef<HTMLAudioElement | null>(null);

  const agentForgePreviewId = toAgentSlug(agentForgeLabel);

  // Persist workspace contexts to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: Record<string, AgentWorkspaceContext> = {};
    Object.entries(agentWorkspaceContexts).forEach(([presenceId, workspace]) => {
      const normalizedPresence = normalizeAgentPresenceId(presenceId);
      if (!normalizedPresence) return;
      const normalizedWorkspace = normalizeAgentWorkspaceContext(workspace, APP_WORKSPACE_NORMALIZE_OPTIONS);
      if (normalizedWorkspace.pinnedFileNodeIds.length <= 0 && normalizedWorkspace.searchQuery.trim().length <= 0) return;
      payload[normalizedPresence] = normalizedWorkspace;
    });
    if (Object.keys(payload).length <= 0) {
      window.localStorage.removeItem(AGENT_WORKSPACE_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(AGENT_WORKSPACE_STORAGE_KEY, JSON.stringify(payload));
  }, [agentWorkspaceContexts]);

  // --- Chat / toast ---
  const emitChatMessage = useCallback((message: ChatMessage) => {
    window.dispatchEvent(new CustomEvent("chat-message", { detail: message }));
  }, []);

  const emitSystemMessage = useCallback((text: string) => {
    emitChatMessage({
      role: "assistant",
      text,
      meta: { channel: "command", source: "muse:system", presenceId: activeAgentPresenceId },
    });
  }, [activeAgentPresenceId, emitChatMessage]);

  // --- Audio/image ---
  const playAgentAudio = useCallback(async (rawUrl: string, label: string): Promise<boolean> => {
    const resolvedUrl = resolveRuntimeMediaUrl(rawUrl);
    if (!resolvedUrl) return false;
    try {
      const audio = agentAudioElementRef.current ?? new Audio();
      agentAudioElementRef.current = audio;
      audio.src = resolvedUrl;
      audio.currentTime = 0;
      await audio.play();
      emitUiToast("Muse Audio", `playing ${label || "selected track"}`);
      return true;
    } catch {
      emitUiToast("Muse Audio Ready", `queued ${label || "track"} (${resolvedUrl})`);
      return false;
    }
  }, [emitUiToast]);

  const openAgentImage = useCallback((rawUrl: string, label: string): boolean => {
    const resolvedUrl = resolveRuntimeMediaUrl(rawUrl);
    if (!resolvedUrl) return false;
    try {
      const opened = window.open(resolvedUrl, "_blank", "noopener,noreferrer");
      if (opened) {
        emitUiToast("Muse Image", `opened ${label || "selected image"}`);
        return true;
      }
      emitUiToast("Muse Image Ready", `image selected: ${resolvedUrl}`);
      return false;
    } catch {
      emitUiToast("Muse Image Ready", `image selected: ${resolvedUrl}`);
      return false;
    }
  }, [emitUiToast]);

  // --- Create muse ---
  const handleCreateAgent = useCallback(async () => {
    const label = String(agentForgeLabel || "").trim();
    if (!label || agentForgeBusy) return;
    const agentId = toAgentSlug(label);
    if (!agentId) {
      emitUiToast("Muse Create Failed", "Provide a valid muse label.");
      return;
    }
    const anchor = {
      x: clamp(0.14 + (stableUnitHash(`${agentId}|x`) * 0.72), 0.08, 0.92),
      y: clamp(0.16 + (stableUnitHash(`${agentId}|y`) * 0.68), 0.08, 0.92),
      zoom: 1,
      kind: "ui-meta-create",
    };
    setAgentForgeBusy(true);
    try {
      const baseUrl = runtimeBaseUrl();
      const response = await fetch(`${baseUrl}/api/muse/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ muse_id: agentId, label, anchor, user_intent_id: `ui-create:${agentId}` }),
      });
      const payload = (await response.json()) as {
        ok?: boolean; error?: string; muse?: { id?: string; label?: string };
      };
      if (!response.ok || !payload?.ok) throw new Error(String(payload?.error || `http_${response.status}`));
      const createdId = String(payload?.muse?.id || agentId).trim() || agentId;
      const createdLabel = String(payload?.muse?.label || label).trim() || label;
      setActiveAgentPresenceId(createdId);
      setAgentForgeLabel("");
      emitUiToast("Muse Created", `${createdLabel} is online as ${createdId}`);
      emitChatMessage({
        role: "assistant",
        text: `muse created\nid=${createdId}\nlabel=${createdLabel}`,
        meta: { channel: "command", source: "meta:/api/muse/create", presenceId: createdId, presenceName: createdLabel },
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown_error";
      emitUiToast("Muse Create Failed", reason);
      emitChatMessage({
        role: "assistant",
        text: `muse create failed\nreason=${reason}`,
        meta: { channel: "command", source: "meta:/api/muse/create", presenceId: activeAgentPresenceId },
      });
    } finally {
      setAgentForgeBusy(false);
    }
  }, [activeAgentPresenceId, emitChatMessage, emitUiToast, agentForgeBusy, agentForgeLabel]);

  // --- Build surrounding nodes ---
  const buildAgentSurroundingNodes = useCallback((
    musePresenceId: string,
    workspace: AgentWorkspaceContext | null = null,
  ): Array<Record<string, unknown>> => {
    const normalizedAgent = normalizeAgentPresenceId(musePresenceId || "witness_thread") || "witness_thread";
    const graphNodes = (
      simulation?.file_graph?.file_nodes ?? catalog?.file_graph?.file_nodes ?? []
    ).filter((row): row is FileGraphNode => Boolean(row));

    const nodeById = new Map<string, FileGraphNode>();
    graphNodes.forEach((row) => {
      const id = String(row.id || "").trim();
      if (id && !nodeById.has(id)) nodeById.set(id, row);
      const nodeId = String(row.node_id || "").trim();
      if (nodeId && !nodeById.has(nodeId)) nodeById.set(nodeId, row);
    });

    const pinnedIds = (
      workspace?.pinnedFileNodeIds ?? agentWorkspaceBindings[normalizedAgent] ?? []
    )
      .map((item) => String(item || "").trim())
      .filter((item, index, all) => item.length > 0 && all.indexOf(item) === index)
      .slice(0, 16);

    const buildLibraryUrl = (relativePath: string): string | undefined => {
      const cleanPath = String(relativePath || "").trim().replace(/^\/+/, "");
      if (!cleanPath) return undefined;
      const encodedPath = cleanPath.split("/").map((segment) => encodeURIComponent(segment)).join("/");
      return `/library/${encodedPath}`;
    };

    const resolveNodeUrl = (row: FileGraphNode | undefined): string | undefined => {
      const nodeUrl = String(row?.url ?? "").trim();
      if (nodeUrl) return nodeUrl;
      const archiveUrl = String(row?.archive_url ?? "").trim();
      if (archiveUrl) return archiveUrl;
      const archiveRelPath = String(row?.archive_rel_path ?? row?.archived_rel_path ?? "").trim();
      const archiveRelUrl = buildLibraryUrl(archiveRelPath);
      if (archiveRelUrl) return archiveRelUrl;
      const sourceRelPath = String(row?.source_rel_path ?? "").trim();
      return buildLibraryUrl(sourceRelPath);
    };

    const pinnedRows = pinnedIds.map((nodeId) => {
      const row = nodeById.get(nodeId);
      const baseSeed = stableUnitHash(`${normalizedAgent}|${nodeId}`);
      const x = clamp(Number(row?.x ?? (0.22 + (baseSeed * 0.56))), 0, 1);
      const y = clamp(Number(row?.y ?? (0.24 + (stableUnitHash(`${normalizedAgent}|${nodeId}|y`) * 0.52))), 0, 1);
      const label = String(row?.source_rel_path ?? row?.label ?? row?.name ?? nodeId).trim() || nodeId;
      const text = String(row?.summary ?? row?.text_excerpt ?? label).trim() || label;
      const sourceRelPath = String(row?.source_rel_path ?? "").trim();
      return {
        id: nodeId, kind: String(row?.kind ?? "resource"), label, text, x, y,
        visibility: "private", tags: [normalizedAgent, "workspace-pin"],
        source_rel_path: sourceRelPath || undefined, url: resolveNodeUrl(row),
      };
    });

    const nearbyRows = graphNodes
      .filter((row) => {
        const dominantPresence = normalizeAgentPresenceId(String(row.dominant_presence ?? ""));
        const conceptPresence = normalizeAgentPresenceId(String(row.concept_presence_id ?? ""));
        if (pinnedIds.includes(String(row.id || row.node_id || "").trim())) return false;
        return dominantPresence === normalizedAgent || conceptPresence === normalizedAgent;
      })
      .sort((left, right) => {
        const rightScore = Number(right.importance ?? 0) + Number(right.embed_layer_count ?? 0) * 0.18;
        const leftScore = Number(left.importance ?? 0) + Number(left.embed_layer_count ?? 0) * 0.18;
        return rightScore - leftScore;
      })
      .slice(0, 8)
      .map((row) => {
        const sourceRelPath = String(row.source_rel_path ?? "").trim();
        return {
          id: String(row.id ?? row.node_id ?? "").trim(),
          kind: String(row.kind ?? "resource"),
          label: String(row.source_rel_path ?? row.label ?? row.id ?? "resource").trim(),
          text: String(row.summary ?? row.text_excerpt ?? row.label ?? row.id ?? "").trim(),
          x: clamp(Number(row.x ?? 0.5), 0, 1), y: clamp(Number(row.y ?? 0.5), 0, 1),
          visibility: "public", tags: [normalizedAgent, String(row.dominant_field ?? "field")],
          source_rel_path: sourceRelPath || undefined, url: resolveNodeUrl(row),
        };
      })
      .filter((row) => row.id.length > 0);

    return [...pinnedRows, ...nearbyRows, ...buildDeviceSurroundingNodes(simulation)].slice(0, 36);
  }, [catalog?.file_graph?.file_nodes, agentWorkspaceBindings, simulation]);

  // --- Witness chat reply ---
  const emitWitnessChatReply = useCallback((
    payload: Record<string, unknown>,
    source: string,
    requestedMusePresenceId?: string,
  ) => {
    const reply = String(payload.reply ?? "").trim();
    const mode = String(payload.mode ?? "canonical").trim() || "canonical";
    const model = String(payload.model ?? "").trim() || undefined;
    const trace = payload.trace && typeof payload.trace === "object"
      ? (payload.trace as Record<string, unknown>) : null;
    const overlayTags = Array.isArray(trace?.overlay_tags)
      ? trace.overlay_tags.map((item) => String(item || "").trim()).filter((item) => item.length > 0) : [];
    const failures = Array.isArray(trace?.failures)
      ? trace.failures.filter((row) => row && typeof row === "object") as Array<Record<string, unknown>> : [];
    const entities = Array.isArray(trace?.entities)
      ? trace.entities.filter((row) => row && typeof row === "object") as Array<Record<string, unknown>> : [];
    const muse = payload.muse && typeof payload.muse === "object"
      ? payload.muse as Record<string, unknown> : null;
    const tracePresenceId = String(
      muse?.id ?? entities[0]?.presence_id ?? requestedMusePresenceId ?? activeAgentPresenceId ?? "witness_thread",
    ).trim() || "witness_thread";
    const tracePresenceName = String(
      muse?.label ?? entities[0]?.presence_en ?? tracePresenceId,
    ).trim() || tracePresenceId;
    const manifest = payload.manifest && typeof payload.manifest === "object"
      ? payload.manifest as Record<string, unknown> : null;
    const explicitSelected = Array.isArray(manifest?.explicit_selected) ? manifest.explicit_selected : [];
    const surroundSelected = Array.isArray(manifest?.surround_selected) ? manifest.surround_selected : [];
    const daimoiRows = Array.isArray(payload.daimoi)
      ? payload.daimoi.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object")) : [];
    const fieldDeltas = Array.isArray(payload.field_deltas)
      ? payload.field_deltas.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object")) : [];
    const toolRows = Array.isArray(payload.tool_results)
      ? payload.tool_results.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object")) : [];
    const explicitMediaActions = Array.isArray(payload.media_actions)
      ? payload.media_actions.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object")) : [];
    const audioActions = Array.isArray(payload.audio_actions)
      ? payload.audio_actions.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object")) : [];
    const mediaActions = explicitMediaActions.length > 0 ? explicitMediaActions : audioActions;
    const gpuClaim = payload.gpu_claim && typeof payload.gpu_claim === "object"
      ? payload.gpu_claim as Record<string, unknown> : null;
    const gpuStatus = String(gpuClaim?.status ?? "").trim();
    const fallback = typeof payload.fallback === "boolean"
      ? payload.fallback : (mode !== "ollama" || failures.length > 0);
    const safeReply = reply || "[empty witness reply]";

    emitChatMessage({
      role: "assistant", text: safeReply,
      meta: { channel: "llm", model, fallback, source, presenceId: tracePresenceId, presenceName: tracePresenceName },
    });

    if (fallback) {
      const failureCodes = failures.slice(0, 3).map((row) => {
        const presence = String(row.presence_id ?? "presence").trim() || "presence";
        const code = String(row.error_code ?? "fallback").trim() || "fallback";
        return `${presence}:${code}`;
      }).join(", ");
      emitChatMessage({
        role: "assistant",
        text: `muse fallback active (mode=${mode}${failureCodes ? `, failures=${failureCodes}` : ""}).`,
        meta: { channel: "command", source, presenceId: tracePresenceId, presenceName: tracePresenceName },
      });
    }

    if (manifest || daimoiRows.length > 0 || fieldDeltas.length > 0 || gpuStatus || toolRows.length > 0) {
      const turnId = String(payload.turn_id ?? "").trim() || "(none)";
      emitChatMessage({
        role: "assistant",
        text: [
          "muse turn signal", `turn_id=${turnId}`, `explicit=${explicitSelected.length}`,
          `surrounding=${surroundSelected.length}`, `daimoi=${daimoiRows.length}`,
          `field_deltas=${fieldDeltas.length}`, `gpu=${gpuStatus || "released"}`,
          `tools=${toolRows.length}`, `media=${mediaActions.length}`,
        ].join("\n"),
        meta: { channel: "command", source: `${source}:turn`, presenceId: tracePresenceId, presenceName: tracePresenceName },
      });
    }

    fieldDeltas.slice(0, 8).forEach((delta, index) => {
      const x = clamp(Number(delta.x ?? (0.18 + (stableUnitHash(`${tracePresenceId}|${index}`) * 0.64))), 0, 1);
      const y = clamp(Number(delta.y ?? (0.16 + (stableUnitHash(`${tracePresenceId}|${index}|y`) * 0.68))), 0, 1);
      const intensity = clamp(Number(delta.intensity ?? 0.48), 0, 1);
      overlayApi?.pulseAt?.(x, y, 0.32 + (intensity * 0.94), tracePresenceId);
    });

    if (fieldDeltas.length === 0) {
      daimoiRows.slice(0, 6).forEach((row, index) => {
        const x = clamp(Number(row.x ?? (0.2 + (stableUnitHash(`${tracePresenceId}|daimon|${index}`) * 0.6))), 0, 1);
        const y = clamp(Number(row.y ?? (0.18 + (stableUnitHash(`${tracePresenceId}|daimon|${index}|y`) * 0.62))), 0, 1);
        const energy = clamp(Number(row.energy ?? 0.44), 0, 1);
        overlayApi?.pulseAt?.(x, y, 0.3 + (energy * 0.82), tracePresenceId);
      });
    }

    if (gpuStatus === "granted") {
      overlayApi?.singAll?.();
      const device = String(gpuClaim?.device ?? "gpu").trim() || "gpu";
      emitUiToast("Muse GPU Claim", `${tracePresenceName} claimed ${device}`);
    }
    if (toolRows.length > 0) {
      const toolNames = toolRows.slice(0, 3).map((row) => String(row.tool ?? "tool").trim() || "tool").join(", ");
      emitUiToast("Muse Tools", `${tracePresenceName} ran ${toolNames}`);
    }
    if (mediaActions.length > 0) {
      const firstAction = mediaActions[0];
      const status = String(firstAction.status ?? "unknown").trim() || "unknown";
      const mediaKind = String(firstAction.media_kind ?? "media").trim() || "media";
      const selectedLabel = String(firstAction.selected_label ?? "media target").trim() || "media target";
      const selectedUrl = String(firstAction.selected_url ?? firstAction.url ?? "").trim();
      emitChatMessage({
        role: "assistant",
        text: ["muse media action", `kind=${mediaKind}`, `status=${status}`, `label=${selectedLabel}`, `url=${selectedUrl || "(none)"}`].join("\n"),
        meta: { channel: "command", source: `${source}:media`, presenceId: tracePresenceId, presenceName: tracePresenceName },
      });
    }
    const requestedMedia = mediaActions.find((row) => String(row.status ?? "").trim() === "requested");
    if (requestedMedia) {
      const mediaKind = String(requestedMedia.media_kind ?? "audio").trim().toLowerCase();
      const selectedUrl = String(requestedMedia.selected_url ?? requestedMedia.url ?? "").trim();
      const selectedLabel = String(requestedMedia.selected_label ?? "media target").trim() || "media target";
      if (selectedUrl) {
        if (mediaKind === "image") openAgentImage(selectedUrl, selectedLabel);
        else void playAgentAudio(selectedUrl, selectedLabel);
      }
    }
    if (safeReply.includes("[[PULSE]]") || overlayTags.includes("[[PULSE]]")) overlayApi?.pulseAt?.(0.5, 0.5, 1);
    if (safeReply.includes("[[TONE]]") || overlayTags.includes("[[TONE]]")) overlayApi?.singAll?.();
  }, [activeAgentPresenceId, emitChatMessage, emitUiToast, openAgentImage, overlayApi, playAgentAudio]);

  // --- Muse events effect ---
  useEffect(() => {
    if (!Array.isArray(agentEvents) || agentEvents.length <= 0) return;
    const freshEvents = agentEvents.filter(
      (row: AgentEvent) => Number(row.seq ?? 0) > processedAgentEventSeqRef.current,
    );
    if (freshEvents.length <= 0) return;
    let maxSeq = processedAgentEventSeqRef.current;
    freshEvents.forEach((eventRow: AgentEvent) => {
      const seq = Number(eventRow.seq ?? 0);
      if (Number.isFinite(seq)) maxSeq = Math.max(maxSeq, seq);
      const kind = String(eventRow.kind ?? "").trim();
      const agentId = String(eventRow.muse_id ?? "").trim() || "witness_thread";
      const eventPayload = eventRow.payload && typeof eventRow.payload === "object"
        ? eventRow.payload as Record<string, unknown> : {};
      if (kind === "field.delta.applied") {
        const x = clamp(0.16 + (stableUnitHash(`${agentId}|${eventRow.turn_id}|${eventRow.seq}`) * 0.68), 0, 1);
        const y = clamp(0.14 + (stableUnitHash(`${agentId}|${eventRow.turn_id}|${eventRow.seq}|y`) * 0.72), 0, 1);
        overlayApi?.pulseAt?.(x, y, 0.56, agentId);
      }
      if (kind === "muse.gpu.claim.granted") {
        overlayApi?.singAll?.();
        const device = String(eventPayload.device ?? "gpu").trim() || "gpu";
        emitUiToast("Muse GPU Claim", `${agentId} claimed ${device}`);
      }
      if (kind === "audio.play.requested") {
        const label = String(eventPayload.label ?? "audio track").trim() || "audio track";
        const target = String(eventPayload.target_node_id ?? "audio").trim() || "audio";
        emitUiToast("Muse Audio Request", `${agentId} requested ${label} (${target})`);
      }
      if (kind === "image.open.requested") {
        const label = String(eventPayload.label ?? "image").trim() || "image";
        const target = String(eventPayload.target_node_id ?? "image").trim() || "image";
        emitUiToast("Muse Image Request", `${agentId} requested ${label} (${target})`);
      }
      if (kind === "muse.turn.completed" && normalizeAgentPresenceId(agentId) === normalizeAgentPresenceId(activeAgentPresenceId)) {
        const deltaCount = Number(eventPayload.field_deltas ?? 0);
        const daimonCount = Number(eventPayload.daimoi ?? 0);
        emitUiToast("Muse Turn Complete", `${agentId} emitted ${daimonCount} daimoi and ${deltaCount} field deltas`);
      }
      if (kind === "muse.rate_limited" && normalizeAgentPresenceId(agentId) === normalizeAgentPresenceId(activeAgentPresenceId)) {
        emitUiToast("Muse Rate Limit", `${agentId} hit turn budget; wait a moment.`);
      }
      if (kind === "muse.rejected" && normalizeAgentPresenceId(agentId) === normalizeAgentPresenceId(activeAgentPresenceId)) {
        const reason = String(eventPayload.reason ?? "rejected").trim() || "rejected";
        emitUiToast("Muse Rejected", `${agentId} blocked turn (${reason})`);
      }
    });
    processedAgentEventSeqRef.current = maxSeq;
  }, [activeAgentPresenceId, emitUiToast, agentEvents, overlayApi]);

  // --- Recording ---
  const handleRecord = useCallback(async () => {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setRecordedBlob(blob);
        setVoiceInputMeta(`voice captured / 音声取得: ${Math.round(blob.size / 1024)}KB`);
        stream.getTracks().forEach((track) => { track.stop(); });
        setIsRecording(false);
      };
      mediaRecorder.start();
      setIsRecording(true);
      setVoiceInputMeta("recording voice / 録音中");
      window.setTimeout(() => { if (mediaRecorder.state === "recording") mediaRecorder.stop(); }, 8000);
    } catch { setVoiceInputMeta("mic permission denied / マイク許可なし"); }
  }, [isRecording]);

  const handleTranscribe = useCallback(async (): Promise<string | undefined> => {
    if (!recordedBlob) return undefined;
    const buffer = await recordedBlob.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i += 1) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    try {
      const baseUrl = runtimeBaseUrl();
      const response = await fetch(`${baseUrl}/api/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio_base64: base64, mime: recordedBlob.type }),
      });
      const payload = (await response.json()) as { ok?: boolean; text?: string; error?: string };
      if (payload.ok) {
        const text = String(payload.text ?? "");
        setVoiceInputMeta(`transcribed: ${text}`);
        return text;
      }
      setVoiceInputMeta(`error: ${String(payload.error ?? "unknown")}`);
      return undefined;
    } catch { setVoiceInputMeta("transcribe failed"); return undefined; }
  }, [recordedBlob]);

  const handleSendVoice = useCallback(async (musePresenceId: string, workspace: AgentWorkspaceContext) => {
    const text = await handleTranscribe();
    if (!text) return;
    const resolvedMusePresenceId = String(musePresenceId || activeAgentPresenceId || "witness_thread").trim() || "witness_thread";
    const surroundingNodes = buildAgentSurroundingNodes(resolvedMusePresenceId, workspace);
    emitChatMessage({ role: "user", text, meta: { channel: "llm", source: "voice", presenceId: resolvedMusePresenceId } });
    const baseUrl = runtimeBaseUrl();
    try {
      const response = await fetch(`${baseUrl}/api/muse/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          muse_id: resolvedMusePresenceId || "witness_thread", multi_entity: true,
          presence_ids: [resolvedMusePresenceId || "witness_thread"], text, mode: "stochastic",
          token_budget: 2048, graph_revision: simulation?.timestamp || catalog?.generated_at || "",
          surrounding_nodes: surroundingNodes,
        }),
      });
      if (!response.ok) throw new Error(`muse request failed (${response.status})`);
      const payload = (await response.json()) as { reply?: unknown; mode?: unknown; model?: unknown; trace?: unknown };
      emitWitnessChatReply(payload as Record<string, unknown>, "voice:/api/muse/message", resolvedMusePresenceId);
    } catch {
      emitChatMessage({
        role: "assistant", text: "voice chat request failed",
        meta: { channel: "command", source: "voice:/api/muse/message", presenceId: resolvedMusePresenceId },
      });
    }
  }, [activeAgentPresenceId, buildAgentSurroundingNodes, catalog, emitChatMessage, emitWitnessChatReply, handleTranscribe, simulation]);

  // --- Workspace ---
  const handleAgentWorkspaceBindingsChange = useCallback((presenceId: string, fileNodeIds: string[]) => {
    const normalizedPresence = normalizeAgentPresenceId(String(presenceId || "").trim() || "witness_thread");
    const normalizedIds = fileNodeIds
      .map((item) => String(item || "").trim())
      .filter((item, index, all) => item.length > 0 && all.indexOf(item) === index)
      .slice(0, 48);
    setAgentWorkspaceBindings((prev) => {
      const prevIds = prev[normalizedPresence] ?? [];
      if (prevIds.length === normalizedIds.length && prevIds.every((id, index) => id === normalizedIds[index])) return prev;
      return { ...prev, [normalizedPresence]: normalizedIds };
    });
    setAgentWorkspaceContexts((prev) => {
      const currentWorkspace = normalizeAgentWorkspaceContext(prev[normalizedPresence], APP_WORKSPACE_NORMALIZE_OPTIONS);
      if (sameStringArray(currentWorkspace.pinnedFileNodeIds, normalizedIds)) return prev;
      return { ...prev, [normalizedPresence]: { ...currentWorkspace, pinnedFileNodeIds: normalizedIds } };
    });
    const baseUrl = runtimeBaseUrl();
    void fetch(`${baseUrl}/api/muse/sync-pins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ muse_id: normalizedPresence, pinned_node_ids: normalizedIds, reason: "ui.workspace.sync" }),
    }).catch(() => {});
  }, []);

  const handleAgentWorkspaceContextChange = useCallback((presenceId: string, workspace: AgentWorkspaceContext) => {
    const normalizedPresence = normalizeAgentPresenceId(String(presenceId || "").trim() || "witness_thread");
    const normalizedWorkspace = normalizeAgentWorkspaceContext(workspace, APP_WORKSPACE_NORMALIZE_OPTIONS);
    setAgentWorkspaceContexts((prev) => {
      const currentWorkspace = normalizeAgentWorkspaceContext(prev[normalizedPresence], APP_WORKSPACE_NORMALIZE_OPTIONS);
      const pinnedUnchanged = sameStringArray(currentWorkspace.pinnedFileNodeIds, normalizedWorkspace.pinnedFileNodeIds);
      const searchUnchanged = currentWorkspace.searchQuery === normalizedWorkspace.searchQuery;
      const summariesUnchanged = sameStringArray(currentWorkspace.pinnedNexusSummaries, normalizedWorkspace.pinnedNexusSummaries);
      if (pinnedUnchanged && searchUnchanged && summariesUnchanged) return prev;
      return { ...prev, [normalizedPresence]: normalizedWorkspace };
    });
    setAgentWorkspaceBindings((prev) => {
      const prevIds = prev[normalizedPresence] ?? [];
      if (sameStringArray(prevIds, normalizedWorkspace.pinnedFileNodeIds)) return prev;
      return { ...prev, [normalizedPresence]: normalizedWorkspace.pinnedFileNodeIds };
    });
  }, []);

  // --- Workspace send ---
  const handleAgentWorkspaceSend = useCallback((text: string, musePresenceId: string, workspace: AgentWorkspaceContext) => {
    const resolvedMusePresenceId = String(musePresenceId || activeAgentPresenceId || "witness_thread").trim() || "witness_thread";
    setActiveAgentPresenceId(resolvedMusePresenceId);
    if (handleAutopilotUserInput(text)) return;
    setIsThinking(true);
    (async () => {
      const consumed = await handleChatCommand(text, resolvedMusePresenceId);
      if (consumed) return;
      const baseUrl = runtimeBaseUrl();
      const surroundingNodes = buildAgentSurroundingNodes(resolvedMusePresenceId, workspace);
      const response = await fetch(`${baseUrl}/api/muse/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          muse_id: resolvedMusePresenceId || "witness_thread", multi_entity: true,
          presence_ids: [resolvedMusePresenceId || "witness_thread"], text, mode: "stochastic",
          token_budget: 2048, graph_revision: simulation?.timestamp || catalog?.generated_at || "",
          surrounding_nodes: surroundingNodes,
        }),
      });
      if (!response.ok) throw new Error(`muse request failed (${response.status})`);
      const payload = (await response.json()) as { reply?: unknown; mode?: unknown; model?: unknown; trace?: unknown };
      emitWitnessChatReply(payload as Record<string, unknown>, "chat:/api/muse/message", resolvedMusePresenceId);
    })()
      .catch(() => {
        emitChatMessage({
          role: "assistant", text: "muse request failed",
          meta: { channel: "command", source: "chat:/api/muse/message", presenceId: resolvedMusePresenceId },
        });
      })
      .finally(() => { setIsThinking(false); });
  }, [activeAgentPresenceId, catalog, emitChatMessage, emitWitnessChatReply, handleAutopilotUserInput, buildAgentSurroundingNodes, handleChatCommand, simulation]);

  // --- World interaction ---
  const handleWorldInteract = useCallback(async (personId: string, action: "speak" | "pray" | "sing") => {
    setInteractingPersonId(personId);
    try {
      const baseUrl = runtimeBaseUrl();
      const response = await fetch(`${baseUrl}/api/world/interact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person_id: personId, action }),
      });
      const payload = (await response.json()) as WorldInteractionResponse;
      setWorldInteraction(payload);
      if (payload?.ok) {
        window.dispatchEvent(
          new CustomEvent("chat-message", {
            detail: { role: "assistant", text: `${payload.line_en}\n${payload.line_ja}` },
          }),
        );
      }
    } catch {
      setWorldInteraction({
        ok: false,
        line_en: "Interaction failed. The field is unstable.",
        line_ja: "対話に失敗。場が不安定です。",
      });
    } finally { setInteractingPersonId(null); }
  }, []);

  const handleOverlayInit = useCallback((api: unknown) => {
    setOverlayApi(api as OverlayApi);
  }, [setOverlayApi]);

  return {
    activeAgentPresenceId, setActiveAgentPresenceId,
    agentForgeLabel, setAgentForgeLabel,
    agentForgeBusy, agentForgePreviewId,
    agentWorkspaceContexts, agentWorkspaceBindings,
    isRecording, isThinking, setIsThinking,
    voiceInputMeta, recordedBlob,
    worldInteraction, interactingPersonId,
    emitChatMessage, emitSystemMessage,
    playAgentAudio, openAgentImage,
    handleCreateAgent, buildAgentSurroundingNodes,
    emitWitnessChatReply,
    handleRecord, handleTranscribe, handleSendVoice,
    handleAgentWorkspaceBindingsChange,
    handleAgentWorkspaceContextChange,
    handleAgentWorkspaceSend,
    handleWorldInteract,
    handleOverlayInit,
  };
}
