# Naming Map

Comprehensive mapping of narrative terms to neutral/technical replacements.

**What belongs here:** The authoritative naming map for the de-narrativization refactor. Workers MUST follow this map.

---

## Rules
- "eta-mu" and "ημ" are KEPT everywhere
- "Fork Tales" is REMOVED from all user-visible text and code references
- Terms marked KEEP below are already technical enough

## Core Terms

| Old | New | Notes |
|---|---|---|
| daimoi (plural) | particles | Confirmed by user |
| daimon (singular) | particle | Confirmed by user |
| muse / muses | agent / agents | AI chat agents |
| myth | attribution | Influence/attribution tracking |
| lore (module) | catalog_data | Static entity config module |
| witness | observer | Monitoring/verification role |
| ghost | auto_agent | Background file-change agent |
| prayer / prayer_intensity | activity / activity_level | Engagement metric |
| devotion | engagement | Computed engagement scalar |
| faith | base_weight | Static per-actor weight |
| hymn_bpm | bpm | Audio tempo |
| prays_to | linked_presence | Entity binding reference |
| people | actors | Simulated personas |
| songs | tracks | Audio entries |
| books | reports | Periodic log entries |
| canticle (delivery mode) | sustained | Voice delivery mode |
| Fork Tales | (remove) | Project narrative name |

## File Renames

| Old | New |
|---|---|
| lore.py | catalog_data.py |
| myth_bridge.py | attribution.py |

## Class/Type Renames

| Old | New |
|---|---|
| MythStateTracker | AttributionTracker |
| MythSummary | AttributionSummary |
| WorldPerson | WorldActor |
| WorldSong | WorldTrack |
| WorldBook | WorldReport |
| GhostRoleState | AutoAgentState |
| DaimoiPacket | ParticlePacket |
| DaimoiProbabilisticSummary | ParticleProbabilisticSummary |
| ForkTaxState | ForkCostState |
| WitnessThreadState | ContinuityState |
| BraidThread | DiagnosticThread |
| BraidDiagnostics | DiagnosticBundle |
| Echo | TextOverlay |
| LifeStateTracker | ActorStateTracker |

## API Endpoint Renames

| Old | New |
|---|---|
| /api/myth | /api/attribution |
| /api/muse/* | /api/agent/* |
| /api/witness | /api/continuity |

Important: the checked-in backend has already renamed the route paths, but some `/api/agent/*` handlers still accept legacy payload keys such as `muse_id` and still route through internal `muse` manager methods. Treat path renames and payload-field renames as separate verification surfaces.

## Record Type String Renames

| Old | New |
|---|---|
| ημ.daimon.v1 | ημ.particle.v1 |
| ημ.daimoi-packet.v1 | ημ.particle-packet.v1 |
| eta-mu.muse-*.v1 | eta-mu.agent-*.v1 |
| eta-mu.resource-daimoi-*.v1 | eta-mu.resource-particle-*.v1 |

## CSS Class Prefix

| Old | New |
|---|---|
| mindfuck-* | dashboard-* |

## Panel Names

| Old | New |
|---|---|
| Myth Commons | World Simulation |
| Glass Viewport | Simulation Viewport |
| Daimoi Presence Deck | Particle Deck |
| Muse Forge | Agent Creator |
| Inspiration Atlas | System Overview |

## Entity Names (in ENTITY_MANIFEST)

| Old | New |
|---|---|
| receipt_river | log_stream |
| witness_thread | observer_thread |
| fork_tax_canticle | fork_cost_metric |
| mage_of_receipts | log_writer |
| keeper_of_receipts | log_guardian |
| gates_of_truth | compliance_gate |
| file_sentinel | file_monitor |
| change_fog | change_buffer |
| path_ward | path_guard |
| manifest_lith | manifest_anchor |
| core_pulse | core_heartbeat |
| chaos_butterfly | entropy_source |
| resolution_weaver | resolution_engine |

## Constants to Remove or Neutralize

| Constant | Action |
|---|---|
| PANTHEON_DIALOG | Remove or replace with neutral system dialog |
| MYTHIC_GLITCH_EPIC | Remove |
| COLLECTIVE_RESONANCE | Remove |
| RECEIPT_OF_SURVIVAL | Remove |
| SYSTEM_PROMPT_TEMPLATE | Rewrite to remove narrative framing |

## Terms KEPT (already technical)

- Presence, Nexus, Anchor Registry, Fork Tax (→ fork_cost optional), Receipt, Ledger, Field, Weaver (web graph weaver)
- health_sentinel_* entity IDs (already descriptive)
- presence.core.* entity IDs (already descriptive)
