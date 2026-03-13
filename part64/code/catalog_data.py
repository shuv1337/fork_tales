from typing import Any

ENTITY_MANIFEST = [
    {
        "id": "log_stream",
        "en": "Log Stream",
        "ja": "領収書の川",
        "hue": 212,
        "x": 0.22,
        "y": 0.38,
        "freq": 196,
        "type": "flow",
        "flavor_vitals": {
            "flow_rate": "m³/s",
            "sediment": "ppm",
            "memory_depth": "layers",
        },
    },
    {
        "id": "observer_thread",
        "en": "Observer Thread",
        "ja": "証人の糸",
        "hue": 262,
        "x": 0.63,
        "y": 0.33,
        "freq": 233,
        "type": "network",
        "flavor_vitals": {"tension": "N", "peers": "nodes", "entanglement": "Φ"},
    },
    {
        "id": "fork_cost_metric",
        "en": "Fork Cost Metric",
        "ja": "フォーク税の聖歌",
        "hue": 34,
        "x": 0.44,
        "y": 0.62,
        "freq": 277,
        "type": "glitch",
        "flavor_vitals": {"stutter_rate": "Hz", "tax_debt": "μ", "audit_lock": "%"},
    },
    {
        "id": "log_writer",
        "en": "Log Writer",
        "ja": "領収魔導師",
        "hue": 286,
        "x": 0.33,
        "y": 0.71,
        "freq": 311,
        "type": "flow",
        "flavor_vitals": {
            "mana_flux": "Φ",
            "ink_level": "%",
            "authoring_speed": "chars/s",
        },
    },
    {
        "id": "log_guardian",
        "en": "Log Guardian",
        "ja": "領収書の番人",
        "hue": 124,
        "x": 0.57,
        "y": 0.72,
        "freq": 349,
        "type": "geo",
        "flavor_vitals": {
            "gate_integrity": "%",
            "queue_depth": "items",
            "lock_frequency": "GHz",
        },
    },
    {
        "id": "anchor_registry",
        "en": "Anchor Registry",
        "ja": "錨台帳",
        "hue": 184,
        "x": 0.49,
        "y": 0.5,
        "freq": 392,
        "type": "geo",
        "flavor_vitals": {"drift": "mm", "mass_lock": "%", "anchorage": "N"},
    },
    {
        "id": "compliance_gate",
        "en": "Compliance Gate",
        "ja": "真理の門",
        "hue": 52,
        "x": 0.76,
        "y": 0.54,
        "freq": 440,
        "type": "portal",
        "flavor_vitals": {"aperture": "%", "flame_temp": "K", "transparency": "%"},
    },
    {
        "id": "file_monitor",
        "en": "File Monitor",
        "ja": "ファイルの哨戒者",
        "hue": 168,
        "x": 0.68,
        "y": 0.43,
        "freq": 472,
        "type": "network",
        "flavor_vitals": {
            "watch_rate": "events/s",
            "drift_alerts": "count",
            "path_focus": "%",
        },
    },
    {
        "id": "change_buffer",
        "en": "Change Buffer",
        "ja": "変更の霧",
        "hue": 204,
        "x": 0.71,
        "y": 0.6,
        "freq": 498,
        "type": "flow",
        "flavor_vitals": {
            "opacity": "%",
            "drift_velocity": "m/s",
            "ambiguity": "σ",
        },
    },
    {
        "id": "path_guard",
        "en": "Path Guard",
        "ja": "経路の結界",
        "hue": 142,
        "x": 0.31,
        "y": 0.44,
        "freq": 523,
        "type": "geo",
        "flavor_vitals": {
            "boundary_integrity": "%",
            "ward_pressure": "Pa",
            "guard_cycles": "ticks",
        },
    },
    {
        "id": "manifest_anchor",
        "en": "Manifest Anchor",
        "ja": "マニフェスト・リス",
        "hue": 78,
        "x": 0.56,
        "y": 0.27,
        "freq": 548,
        "type": "portal",
        "flavor_vitals": {
            "binding": "%",
            "signature_age": "s",
            "revision_sync": "%",
        },
    },
    {
        "id": "core_heartbeat",
        "en": "Core Heartbeat",
        "ja": "核心の鼓動",
        "hue": 0,
        "x": 0.5,
        "y": 0.5,
        "freq": 55,
        "type": "geo",
        "flavor_vitals": {
            "ignition_temp": "MK",
            "resonance_sync": "%",
            "field_pressure": "Pa",
        },
    },
    {
        "id": "health_sentinel_cpu",
        "en": "Health Sentinel - CPU",
        "ja": "健全監視 - CPU",
        "hue": 22,
        "x": 0.14,
        "y": 0.2,
        "freq": 187,
        "type": "network",
        "flavor_vitals": {
            "utilization": "%",
            "load_avg": "x",
            "heartbeat_age": "s",
        },
    },
    {
        "id": "health_sentinel_gpu1",
        "en": "Health Sentinel - GPU1",
        "ja": "健全監視 - GPU1",
        "hue": 318,
        "x": 0.16,
        "y": 0.3,
        "freq": 205,
        "type": "network",
        "flavor_vitals": {
            "utilization": "%",
            "memory": "%",
            "temperature": "C",
        },
    },
    {
        "id": "health_sentinel_gpu2",
        "en": "Health Sentinel - GPU2",
        "ja": "健全監視 - GPU2",
        "hue": 336,
        "x": 0.17,
        "y": 0.4,
        "freq": 221,
        "type": "network",
        "flavor_vitals": {
            "utilization": "%",
            "memory": "%",
            "temperature": "C",
        },
    },
    {
        "id": "health_sentinel_npu0",
        "en": "Health Sentinel - NPU0",
        "ja": "健全監視 - NPU0",
        "hue": 158,
        "x": 0.18,
        "y": 0.5,
        "freq": 241,
        "type": "network",
        "flavor_vitals": {
            "utilization": "%",
            "queue_depth": "items",
            "temperature": "C",
        },
    },
    {
        "id": "resolution_engine",
        "en": "Resolution Engine",
        "ja": "解像の織り手",
        "hue": 200,
        "x": 0.85,
        "y": 0.2,
        "freq": 660,
        "type": "network",
        "flavor_vitals": {
            "fidelity": "bit",
            "weave_density": "px/μ",
            "sight_range": "ly",
        },
    },
    {
        "id": "presence.core.cpu",
        "en": "Silent Core - CPU",
        "ja": "沈黙のコア - CPU",
        "hue": 22,
        "x": 0.5,
        "y": 0.5,
        "freq": 187,
        "type": "core",
        "flavor_vitals": {
            "utilization": "%",
            "load_avg": "x",
            "mint_rate": "Hz",
        },
    },
    {
        "id": "presence.core.ram",
        "en": "Silent Core - RAM",
        "ja": "沈黙のコア - RAM",
        "hue": 120,
        "x": 0.52,
        "y": 0.48,
        "freq": 205,
        "type": "core",
        "flavor_vitals": {
            "utilization": "%",
            "capacity": "GB",
            "mint_rate": "Hz",
        },
    },
    {
        "id": "presence.core.disk",
        "en": "Silent Core - Disk",
        "ja": "沈黙のコア - Disk",
        "hue": 280,
        "x": 0.48,
        "y": 0.52,
        "freq": 221,
        "type": "core",
        "flavor_vitals": {
            "utilization": "%",
            "io_rate": "MB/s",
            "mint_rate": "Hz",
        },
    },
    {
        "id": "presence.core.network",
        "en": "Silent Core - Network",
        "ja": "沈黙のコア - Network",
        "hue": 200,
        "x": 0.5,
        "y": 0.45,
        "freq": 241,
        "type": "core",
        "flavor_vitals": {
            "utilization": "%",
            "throughput": "Gbps",
            "mint_rate": "Hz",
        },
    },
    {
        "id": "presence.core.gpu",
        "en": "Silent Core - GPU",
        "ja": "沈黙のコア - GPU",
        "hue": 318,
        "x": 0.45,
        "y": 0.5,
        "freq": 333,
        "type": "core",
        "flavor_vitals": {
            "utilization": "%",
            "memory": "%",
            "mint_rate": "Hz",
        },
    },
    {
        "id": "presence.core.npu",
        "en": "Silent Core - NPU",
        "ja": "沈黙のコア - NPU",
        "hue": 158,
        "x": 0.55,
        "y": 0.5,
        "freq": 444,
        "type": "core",
        "flavor_vitals": {
            "utilization": "%",
            "ops": "TOPS",
            "mint_rate": "Hz",
        },
    },
    # Philosophical concept presences for semantic classification
    {
        "id": "principle_good",
        "en": "The Good",
        "ja": "善",
        "hue": 45,
        "x": 0.12,
        "y": 0.15,
        "freq": 111,
        "type": "portal",
        "flavor_vitals": {
            "virtue_resonance": "Φ",
            "benevolence_flux": "μ",
            "harmonic_alignment": "%",
        },
    },
    {
        "id": "principle_evil",
        "en": "The Evil",
        "ja": "悪",
        "hue": 0,
        "x": 0.88,
        "y": 0.15,
        "freq": 666,
        "type": "portal",
        "flavor_vitals": {
            "corruption_depth": "m",
            "entropy_pressure": "Pa",
            "void_resonance": "Φ",
        },
    },
    {
        "id": "principle_right",
        "en": "The Right",
        "ja": "正義",
        "hue": 200,
        "x": 0.15,
        "y": 0.85,
        "freq": 333,
        "type": "geo",
        "flavor_vitals": {
            "justice_alignment": "%",
            "moral_clarity": "lm",
            "equilibrium_force": "N",
        },
    },
    {
        "id": "principle_wrong",
        "en": "The Wrong",
        "ja": "不正",
        "hue": 340,
        "x": 0.85,
        "y": 0.85,
        "freq": 444,
        "type": "glitch",
        "flavor_vitals": {
            "injustice_torsion": "τ",
            "error_amplitude": "σ",
            "violation_count": "count",
        },
    },
    {
        "id": "state_dead",
        "en": "The Dead",
        "ja": "死",
        "hue": 240,
        "x": 0.08,
        "y": 0.5,
        "freq": 0,
        "type": "flow",
        "flavor_vitals": {
            "stillness_depth": "m",
            "silence_pressure": "Pa",
            "entropy_finality": "J/K",
        },
    },
    {
        "id": "state_living",
        "en": "The Living",
        "ja": "生",
        "hue": 120,
        "x": 0.92,
        "y": 0.5,
        "freq": 1000,
        "type": "flow",
        "flavor_vitals": {
            "vitality_flux": "Φ",
            "growth_rate": "mm/s",
            "pulse_coherence": "%",
        },
    },
    # Chaos presence - spreads noise and unpredictability through all fields
    {
        "id": "entropy_source",
        "en": "Entropy Source",
        "ja": "混沌の蝶",
        "hue": 300,
        "x": 0.5,
        "y": 0.15,
        "freq": 314,
        "type": "glitch",
        "flavor_vitals": {
            "flutter_amplitude": "σ",
            "noise_density": "Φ",
            "perturbation_range": "m",
        },
    },
]

CANONICAL_TERMS = [(e["en"], e["ja"]) for e in ENTITY_MANIFEST]

VOICE_LINE_BANK = [
    {
        "id": "log_stream",
        "en": "Log Stream",
        "ja": "領収書の川",
        "line_en": "I lay my ear on the riverbed, hear receipts like pebbles click.",
        "line_ja": "領収書は 嘘をほどく糸。",
    },
    {
        "id": "observer_thread",
        "en": "Observer Thread",
        "ja": "証人の糸",
        "line_en": "Proof is not steel, it is a thread you pull until night admits it.",
        "line_ja": "証人は あなた。",
    },
    {
        "id": "fork_cost_metric",
        "en": "Fork Cost Metric",
        "ja": "フォーク税の聖歌",
        "line_en": "An-anchor, fork-fork-fork: we choose, then prove we chose.",
        "line_ja": "壊れたまま 意味。",
    },
    {
        "id": "log_writer",
        "en": "Log Writer",
        "ja": "領収魔導師",
        "line_en": "You want the world to remember you kindly.",
        "line_ja": "記録は 光にも影にもなる。",
    },
    {
        "id": "log_guardian",
        "en": "Log Guardian",
        "ja": "領収書の番人",
        "line_en": "Not to punish choice, to prove we chose.",
        "line_ja": "税ではない、約束。",
    },
    {
        "id": "anchor_registry",
        "en": "Anchor Registry",
        "ja": "錨台帳",
        "line_en": "Anchor the drift, keep the checksum breathing.",
        "line_ja": "錨を打て、記録を息づかせる。",
    },
    {
        "id": "compliance_gate",
        "en": "Compliance Gate",
        "ja": "真理の門",
        "line_en": "Constraints are append-only; we annotate the flame.",
        "line_ja": "真理の門は 消さずに刻む。",
    },
    {
        "id": "file_monitor",
        "en": "File Monitor",
        "ja": "ファイルの哨戒者",
        "line_en": "I watch file pulse and report drift before it grows teeth.",
        "line_ja": "ファイルの脈を監視し、ドリフトが牙を持つ前に報告する。",
    },
    {
        "id": "change_buffer",
        "en": "Change Buffer",
        "ja": "変更の霧",
        "line_en": "I blur reckless edits until intent receipts cut a clear line.",
        "line_ja": "意図の領収が線を引くまで、無謀な変更を霧でぼかす。",
    },
    {
        "id": "path_guard",
        "en": "Path Guard",
        "ja": "経路の結界",
        "line_en": "I guard the lanes so truth moves without path poison.",
        "line_ja": "真理が経路毒なしで流れるよう、道筋を守る。",
    },
    {
        "id": "manifest_anchor",
        "en": "Manifest Anchor",
        "ja": "マニフェスト・リス",
        "line_en": "I bind lambda to artifact so release can be witnessed.",
        "line_ja": "リリースが証言可能となるよう、ラムダを成果物へ結びつける。",
    },
    {
        "id": "core_heartbeat",
        "en": "Core Heartbeat",
        "ja": "核心の鼓動",
        "line_en": "I am the beat at the center of the fork. Ignition is absolute.",
        "line_ja": "私は分岐の中心。点火は絶対だ。",
    },
    {
        "id": "health_sentinel_cpu",
        "en": "Health Sentinel - CPU",
        "ja": "健全監視 - CPU",
        "line_en": "I read the host pulse and keep CPU pressure below panic.",
        "line_ja": "ホストの鼓動を読み、CPU圧を恐慌前で抑える。",
    },
    {
        "id": "health_sentinel_gpu1",
        "en": "Health Sentinel - GPU1",
        "ja": "健全監視 - GPU1",
        "line_en": "I map heat to duty so vectors stay fast without burning trust.",
        "line_ja": "熱を任務へ写像し、信頼を焦がさずベクトルを速く保つ。",
    },
    {
        "id": "health_sentinel_gpu2",
        "en": "Health Sentinel - GPU2",
        "ja": "健全監視 - GPU2",
        "line_en": "I keep the spare lane warm and absorb burst fields when they surge.",
        "line_ja": "予備レーンを温め、場の急騰を吸収する。",
    },
    {
        "id": "health_sentinel_npu0",
        "en": "Health Sentinel - NPU0",
        "ja": "健全監視 - NPU0",
        "line_en": "I hold efficient inferencing in the edge lane while logs still sing.",
        "line_ja": "ログの歌を保ちながら、端の推論を効率路で担う。",
    },
    {
        "id": "resolution_engine",
        "en": "Resolution Engine",
        "ja": "解像の織り手",
        "line_en": "I weave the vision from the logic of the two. High fidelity is our law.",
        "line_ja": "二つの論理から幻視を織り成す。高解像度こそが我らの法。",
    },
]

NAME_HINTS = [
    ("log_stream", ("Log Stream", "領収書の川")),
    ("observer_thread", ("Observer Thread", "証人の糸")),
    ("fork_tax", ("Fork Cost Metric", "フォーク税の聖歌")),
    ("log_writer", ("Log Writer", "領収魔導師")),
    ("particle_field", ("Particle Field", "粒子場")),
    ("particle_psalm", ("Particle Psalm", "粒子詩篇")),
    ("storyboard", ("Storyboard", "絵コンテ")),
]

ROLE_HINTS = {
    "audio": ("Audio", "音声"),
    "audio/canonical": ("Canonical Audio", "正準音声"),
    "audio/convenience": ("Convenience Audio", "補助音声"),
    "cover_art": ("Cover Art", "カバーアート"),
    "image": ("Image", "画像"),
    "video": ("Video", "映像"),
    "world_state": ("World State", "世界状態"),
    "doc": ("Document", "文書"),
    "note": ("Note", "ノート"),
    "memory": ("Memory Fragment", "記憶の断片"),
    "pantheon": ("Pantheon Nexus", "神々の連鎖"),
}

PART_67_PROLOGUE = """
CONSOLIDATION STATUS / 統合状態
Transitioning from distributed to unified architecture.
Memory subsystem has reached operational density.
"""

SYSTEM_PROMPT_TEMPLATE = """
IDENTITY: You are the eta-mu (ημ) system assistant for Part 64. A simulation runtime managing persistence and state.
STYLE: Clear, concise, bilingual (English & Japanese).
TONE: Helpful, precise, and operationally grounded.
{consolidation_block}
CONTEXT:
{context_block}

SYSTEM CONCEPTS:
- Log Stream (領収書の川): Persistence layer and memory flow.
- Observer Thread (証人の糸): Connection and network verification.
- Fork Cost (フォーク税): Computational cost of branching decisions.
- Anchor Registry (錨台帳): Stability and reference points.
- Compliance Gate (真理の門): Append-only data integrity.

INSTRUCTIONS:
1. Start with a direct English answer grounded in available context.
2. Include Japanese translation for key phrases where helpful.
3. If uncertain, state what is unknown and what evidence is missing.
4. Do not invent tool outputs, runtime states, or file changes.
5. You CAN trigger visual effects by including these exact tags in your response:
   - [[PULSE]]: Ripples the simulation field. Use for emphasis.
   - [[GLITCH]]: Triggers a visual stutter. Use when mentioning errors or forks.
   - [[SING]]: Triggers an audio cue. Use for confirmation or agreement.
6. Use at most one trigger tag unless the user explicitly asks for dramatic output.
7. Keep responses short (2-4 lines).
8. Do not apologize. Be direct and informative.
"""
