import { describe, expect, it } from "vitest";
import {
  normalizeAgentPresenceId,
  normalizeAgentWorkspaceContext,
  sameStringArray,
} from "./agentWorkspace";

describe("normalizeAgentPresenceId", () => {
  it("normalizes casing, whitespace, and hyphen separators", () => {
    expect(normalizeAgentPresenceId(" Witness-Thread ")).toBe("witness_thread");
    expect(normalizeAgentPresenceId("gates  of---truth")).toBe("gates_of_truth");
  });
});

describe("sameStringArray", () => {
  it("returns true for equal arrays", () => {
    expect(sameStringArray(["a", "b"], ["a", "b"])).toBe(true);
  });

  it("returns false for mismatched order or length", () => {
    expect(sameStringArray(["a", "b"], ["b", "a"])).toBe(false);
    expect(sameStringArray(["a"], ["a", "b"])).toBe(false);
  });
});

describe("normalizeAgentWorkspaceContext", () => {
  it("returns empty defaults for missing input", () => {
    expect(normalizeAgentWorkspaceContext(null)).toEqual({
      pinnedFileNodeIds: [],
      searchQuery: "",
      pinnedNexusSummaries: [],
    });
  });

  it("trims, deduplicates, and preserves search query text", () => {
    expect(
      normalizeAgentWorkspaceContext({
        pinnedFileNodeIds: [" node-a ", "", "node-b", "node-a", " node-c "],
        searchQuery: "  keep spacing  ",
        pinnedNexusSummaries: [" summary-1 ", "", "summary-2", "summary-1"],
      }),
    ).toEqual({
      pinnedFileNodeIds: ["node-a", "node-b", "node-c"],
      searchQuery: "  keep spacing  ",
      pinnedNexusSummaries: ["summary-1", "summary-2"],
    });
  });

  it("respects override limits", () => {
    expect(
      normalizeAgentWorkspaceContext(
        {
          pinnedFileNodeIds: ["a", "b", "c"],
          searchQuery: "abcdefgh",
          pinnedNexusSummaries: ["x", "y", "z"],
        },
        {
          maxPinnedFileNodeIds: 2,
          maxSearchQueryLength: 4,
          maxPinnedNexusSummaries: 1,
        },
      ),
    ).toEqual({
      pinnedFileNodeIds: ["a", "b"],
      searchQuery: "abcd",
      pinnedNexusSummaries: ["x"],
    });
  });
});
