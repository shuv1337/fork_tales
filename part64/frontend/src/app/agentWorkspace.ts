import type { AgentWorkspaceContext } from "../types";

interface AgentWorkspaceNormalizeOptions {
  maxPinnedFileNodeIds?: number;
  maxSearchQueryLength?: number;
  maxPinnedNexusSummaries?: number;
}

export function normalizeAgentPresenceId(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function sameStringArray(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

export function normalizeAgentWorkspaceContext(
  raw: AgentWorkspaceContext | Partial<AgentWorkspaceContext> | null | undefined,
  options: AgentWorkspaceNormalizeOptions = {},
): AgentWorkspaceContext {
  const maxPinnedFileNodeIds = options.maxPinnedFileNodeIds ?? 24;
  const maxSearchQueryLength = options.maxSearchQueryLength ?? 180;
  const maxPinnedNexusSummaries = options.maxPinnedNexusSummaries ?? 24;

  const pinnedFileNodeIds = Array.isArray(raw?.pinnedFileNodeIds)
    ? raw.pinnedFileNodeIds
      .map((item) => String(item || "").trim())
      .filter((item, index, all) => item.length > 0 && all.indexOf(item) === index)
      .slice(0, maxPinnedFileNodeIds)
    : [];
  const searchQuery = String(raw?.searchQuery ?? "").slice(0, maxSearchQueryLength);
  const pinnedNexusSummaries = Array.isArray(raw?.pinnedNexusSummaries)
    ? raw.pinnedNexusSummaries
      .map((item) => String(item || "").trim())
      .filter((item, index, all) => item.length > 0 && all.indexOf(item) === index)
      .slice(0, maxPinnedNexusSummaries)
    : [];

  return {
    pinnedFileNodeIds,
    searchQuery,
    pinnedNexusSummaries,
  };
}
