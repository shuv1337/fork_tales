import { useMemo, useState } from "react";
import type {
  UIProjectionBundle,
  UIProjectionElement,
  UIProjectionElementState,
} from "../../types";

interface ProjectionLedgerPanelProps {
  projection: UIProjectionBundle | null;
}

interface FieldLeader {
  id: string;
  title: string;
  binding: number;
  weight: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pct(value: number): string {
  return `${Math.round(clamp(value, 0, 1) * 100)}%`;
}

function rectLabel(rect: { x: number; y: number; w: number; h: number } | undefined): string {
  if (!rect) {
    return "auto";
  }
  const col = Math.floor(rect.x * 12) + 1;
  const row = Math.floor(rect.y * 24) + 1;
  const colSpan = Math.max(1, Math.round(rect.w * 12));
  const rowSpan = Math.max(1, Math.round(rect.h * 24));
  return `c${col}/r${row} span ${colSpan}x${rowSpan}`;
}

function SignalBar({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div>
      <p className="text-[12px] text-muted font-mono">{label}</p>
      <div className="mt-1 h-1.5 rounded-full bg-[#131414]">
        <div
          className={`h-1.5 rounded-full bg-gradient-to-r ${tone}`}
          style={{ width: pct(value) }}
        />
      </div>
    </div>
  );
}

export function ProjectionLedgerPanel({ projection }: ProjectionLedgerPanelProps) {
  const projectionElements = Array.isArray(projection?.elements)
    ? projection.elements
    : [];
  const projectionStates = Array.isArray(projection?.states)
    ? projection.states
    : [];
  const projectionFieldSchemas = Array.isArray(projection?.field_schemas)
    ? projection.field_schemas
    : [];

  const elementsById = useMemo(() => {
    const map = new Map<string, UIProjectionElement>();
    projectionElements.forEach((element) => {
      map.set(element.id, element);
    });
    return map;
  }, [projectionElements]);

  const statesById = useMemo(() => {
    const map = new Map<string, UIProjectionElementState>();
    projectionStates.forEach((state) => {
      map.set(state.element_id, state);
    });
    return map;
  }, [projectionStates]);

  const states = useMemo(() => {
    if (!projection) {
      return [];
    }
    return [...projectionStates].sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return b.mass - a.mass;
    });
  }, [projection, projectionStates]);

  const laneCards = useMemo(() => {
    const laneMap = new Map<string, UIProjectionElementState[]>();
    states.forEach((state) => {
      const lane = elementsById.get(state.element_id)?.lane || "unassigned";
      const rows = laneMap.get(lane) ?? [];
      rows.push(state);
      laneMap.set(lane, rows);
    });

    return [...laneMap.entries()]
      .map(([lane, rows]) => {
        const sortedRows = [...rows].sort((a, b) => b.priority - a.priority);
        const avgPriority =
          sortedRows.length > 0
            ? sortedRows.reduce((sum, row) => sum + row.priority, 0) / sortedRows.length
            : 0;
        return {
          lane,
          avgPriority,
          rows: sortedRows,
        };
      })
      .sort((a, b) => b.avgPriority - a.avgPriority);
  }, [elementsById, states]);

  const fieldLeaders = useMemo(() => {
    if (!projection) {
      return [];
    }
    return projectionFieldSchemas.map((schema) => {
      const leaders: FieldLeader[] = states
        .map((state) => {
          const binding = Number(state.explain.field_bindings?.[schema.field] ?? 0);
          if (binding <= 0) {
            return null;
          }
          const title = elementsById.get(state.element_id)?.title ?? state.element_id;
          const weight = clamp((binding * state.explain.field_signal) + (state.priority * 0.15), 0, 1);
          return {
            id: state.element_id,
            title,
            binding,
            weight,
          };
        })
        .filter((row): row is FieldLeader => row !== null)
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 3);

      return {
        field: schema.field,
        name: schema.name,
        interpretation: schema.interpretation.en,
        leaders,
      };
    });
  }, [elementsById, projection, projectionFieldSchemas, states]);

  const layoutRects = projection?.layout?.rects ?? {};
  const routedBoxCount = states.filter((state) => layoutRects[state.element_id]).length;

  const uniquePresenceCount = useMemo(() => {
    const set = new Set<string>();
    projectionElements.forEach((element) => {
      if (element.presence) {
        set.add(element.presence);
      }
    });
    return set.size;
  }, [projectionElements]);

  const [focusedElementId, setFocusedElementId] = useState("");

  if (!projection || states.length === 0) {
    return <p className="text-xs text-muted">Projection feed is not available yet.</p>;
  }

  const resolvedFocusedElementId =
    focusedElementId && statesById.has(focusedElementId)
      ? focusedElementId
      : states[0]?.element_id ?? "";
  const focusedState = statesById.get(resolvedFocusedElementId) ?? states[0] ?? null;
  const focusedElement = focusedState ? elementsById.get(focusedState.element_id) ?? null : null;
  const focusedRect = focusedState ? layoutRects[focusedState.element_id] : undefined;

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-4">
        <div className="rounded-lg border border-[#335a6f] bg-[#131727] px-3 py-2">
          <p className="text-[12px] uppercase tracking-[0.16em] text-[#9dd1e4]">Perspective</p>
          <p className="text-sm font-semibold text-[#e7f6ff]">{projection.perspective}</p>
          <p className="text-[12px] text-[#a5c8d8]">default {projection.default_perspective}</p>
        </div>
        <div className="rounded-lg border border-[#2f4f64] bg-[#191c2b] px-3 py-2">
          <p className="text-[12px] uppercase tracking-[0.16em] text-[#9dd1e4]">Coherence</p>
          <p className="text-sm font-semibold text-[#e7f6ff]">tension {pct(projection.coherence.tension)}</p>
          <p className="text-[12px] text-[#a5c8d8]">
            drift {pct(projection.coherence.drift)} | entropy {pct(projection.coherence.entropy)}
          </p>
        </div>
        <div className="rounded-lg border border-[#44562d] bg-[#1c1e1f] px-3 py-2">
          <p className="text-[12px] uppercase tracking-[0.16em] text-[#bfdb73]">Coverage</p>
          <p className="text-sm font-semibold text-[#ebffd0]">
            {routedBoxCount} / {states.length} boxes routed
          </p>
          <p className="text-[12px] text-[#cde3a0]">presences linked {uniquePresenceCount}</p>
        </div>
        <div className="rounded-lg border border-[#624229] bg-[#211a1d] px-3 py-2">
          <p className="text-[12px] uppercase tracking-[0.16em] text-[#f2b77b]">Queue Pressure</p>
          <p className="text-sm font-semibold text-[#ffe6cd]">pending {projection.queue.pending_count}</p>
          <p className="text-[12px] text-[#ffd8b5]">events {projection.queue.event_count}</p>
        </div>
      </div>

      <div className="grid gap-2 xl:grid-cols-12">
        <section className="rounded-lg border border-[#41475d] bg-[#151621] p-3 xl:col-span-4">
          <p className="text-[12px] uppercase tracking-[0.14em] text-[#a8c3d8]">Lane Router</p>
          <p className="text-[12px] text-muted mt-1">Presences pick lane pressure, then boxes reorder.</p>
          <div className="mt-2 space-y-2">
            {laneCards.map((lane) => (
              <div key={lane.lane} className="rounded-md border border-[#3c4057] bg-[#20212a] p-2">
                <p className="text-xs font-semibold text-ink">
                  <code>{lane.lane}</code> lane
                </p>
                <p className="text-[12px] text-muted font-mono">
                  boxes {lane.rows.length} | avg priority {lane.avgPriority.toFixed(2)}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {lane.rows.slice(0, 5).map((state) => (
                    <button
                      type="button"
                      key={`${lane.lane}-${state.element_id}`}
                      className="rounded border border-[#3f4861] bg-[#151822] px-1.5 py-0.5 text-[12px] text-[#dcecff]"
                      onClick={() => setFocusedElementId(state.element_id)}
                    >
                      {elementsById.get(state.element_id)?.title ?? state.element_id}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-[#41475d] bg-[#151620] p-3 xl:col-span-8">
          <p className="text-[12px] uppercase tracking-[0.14em] text-[#a8c3d8]">Field Leadership</p>
          <p className="text-[12px] text-muted mt-1">Each field nominates the strongest boxes.</p>
          <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {fieldLeaders.map((field) => (
              <div key={field.field} className="rounded-md border border-[#3c4057] bg-[#1f2029] p-2">
                <p className="text-xs font-semibold text-ink">
                  <code>{field.field}</code> {field.name}
                </p>
                <p className="text-[12px] text-muted">{field.interpretation}</p>
                <div className="mt-2 space-y-1.5">
                  {field.leaders.length === 0 ? (
                    <p className="text-[12px] text-muted">No bound boxes</p>
                  ) : (
                    field.leaders.map((leader) => (
                      <button
                        type="button"
                        key={`${field.field}-${leader.id}`}
                        className="w-full rounded border border-[#3b435b] bg-[#13161f] px-2 py-1 text-left"
                        onClick={() => setFocusedElementId(leader.id)}
                      >
                        <p className="text-[12px] font-semibold text-[#e6f2ff]">{leader.title}</p>
                        <p className="text-[12px] text-[#a7c4e0] font-mono">
                          binding {leader.binding.toFixed(2)} | weight {leader.weight.toFixed(2)}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-2 xl:grid-cols-12">
        <section className="rounded-lg border border-[#2f4f64] bg-[#111623] p-3 xl:col-span-4">
          <p className="text-[12px] uppercase tracking-[0.14em] text-[#9dcadf]">Box Inspector</p>
          {focusedState ? (
            <div className="mt-2 space-y-2">
              <div>
                <p className="text-sm font-semibold text-[#e8f5ff]">
                  {focusedElement?.title ?? focusedState.element_id}
                </p>
                <p className="text-[12px] text-[#9fc0d6] font-mono">
                  id <code>{focusedState.element_id}</code>
                </p>
                <p className="text-[12px] text-[#9fc0d6] font-mono">
                  presence <code>{focusedElement?.presence || "(none)"}</code> | lane
                  <code>{focusedElement?.lane || "unassigned"}</code>
                </p>
                <p className="text-[12px] text-[#9fc0d6] font-mono">
                  layout <code>{rectLabel(focusedRect)}</code>
                </p>
              </div>
              <SignalBar label="mass" value={focusedState.mass} tone="from-[#66d9ef] to-[#2ca9c8]" />
              <SignalBar
                label="priority"
                value={focusedState.priority}
                tone="from-[#a6e22e] to-[#5f9a1f]"
              />
              <SignalBar label="area" value={focusedState.area} tone="from-[#fd971f] to-[#cb6216]" />
              <SignalBar label="pulse" value={focusedState.pulse} tone="from-[#f92672] to-[#8b1742]" />
              <p className="text-[12px] text-[#c4d8e6]">{focusedState.explain.reason_en}</p>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted">No box selected.</p>
          )}
        </section>

        <section className="rounded-lg border border-[#2f4f64] bg-[#121521] p-3 xl:col-span-8">
          <p className="text-[12px] uppercase tracking-[0.14em] text-[#9dcadf]">Every Box Control Cards</p>
          <p className="text-[12px] text-muted mt-1">One card per box. Presence pressure, field pressure, and placement are visible here.</p>
          <div className="mt-2 grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
            {states.map((state) => {
              const element = elementsById.get(state.element_id);
              const isFocused = resolvedFocusedElementId === state.element_id;
              const rect = layoutRects[state.element_id];
              return (
                <button
                  type="button"
                  key={state.element_id}
                  onClick={() => setFocusedElementId(state.element_id)}
                  className={`rounded-lg border p-2 text-left transition-colors ${
                    isFocused
                      ? "border-[#50a3b8] bg-[#102132]"
                      : "border-[#3a4057] bg-[#1a1a23] hover:border-[#586a88]"
                  }`}
                >
                  <p className="text-xs font-semibold text-[#e8f4ff]">{element?.title ?? state.element_id}</p>
                  <p className="text-[12px] text-[#adc6da] font-mono">
                    lane <code>{element?.lane || "unassigned"}</code> | slot <code>{rectLabel(rect)}</code>
                  </p>
                  <p className="text-[12px] text-[#adc6da] font-mono">
                    m {state.mass.toFixed(2)} | p {state.priority.toFixed(2)} | a {state.area.toFixed(2)}
                  </p>
                  <p className="text-[12px] text-[#adc6da] font-mono">
                    field {state.explain.field_signal.toFixed(2)} | presence {state.explain.presence_signal.toFixed(2)}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
