# SPDX-License-Identifier: GPL-3.0-or-later
# This file is part of Fork Tales.
# Copyright (C) 2024-2025 Fork Tales Contributors
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

from __future__ import annotations

import math
import threading
from datetime import datetime, timezone
from hashlib import sha1
from typing import Any


def _seed_value(text: str) -> int:
    return int(sha1(text.encode("utf-8")).hexdigest()[:8], 16)


def _make_actors() -> list[dict[str, Any]]:
    return [
        {
            "id": "logger_aya",
            "name": {"en": "Aya the Logger", "ja": "書記アヤ"},
            "role": {"en": "Logger", "ja": "書記"},
            "instrument": "glass-bell",
            "linked_presence": "observer_thread",
            "base_weight": 0.64,
        },
        {
            "id": "synth_ren",
            "name": {"en": "Ren the Synthesizer", "ja": "詠唱者レン"},
            "role": {"en": "Synthesizer", "ja": "聖歌手"},
            "instrument": "sub-bass drum",
            "linked_presence": "fork_cost_metric",
            "base_weight": 0.58,
        },
        {
            "id": "guardian_mio",
            "name": {"en": "Mio of the Registry", "ja": "台帳のミオ"},
            "role": {"en": "Guardian", "ja": "番人"},
            "instrument": "reed-organ",
            "linked_presence": "anchor_registry",
            "base_weight": 0.72,
        },
        {
            "id": "observer_kai",
            "name": {"en": "Kai the Observer", "ja": "証人カイ"},
            "role": {"en": "Observer", "ja": "証人"},
            "instrument": "hollow-choir",
            "linked_presence": "compliance_gate",
            "base_weight": 0.67,
        },
        {
            "id": "integrator_noa",
            "name": {"en": "Noa the Weaver", "ja": "織り手ノア"},
            "role": {"en": "Integrator", "ja": "場の織り手"},
            "instrument": "tape-piano",
            "linked_presence": "log_stream",
            "base_weight": 0.61,
        },
    ]


def build_interaction_response(
    world_summary: dict[str, Any], person_id: str, action: str = "speak"
) -> dict[str, Any]:
    actors = world_summary.get("actors", [])
    if not isinstance(actors, list) or not actors:
        return {
            "ok": False,
            "error": "world_has_no_actors",
            "line_en": "The field is still gathering voices.",
            "line_ja": "場はまだ声を集めている。",
        }

    person = next(
        (item for item in actors if str(item.get("id", "")) == person_id), actors[0]
    )
    action_key = str(action or "speak").strip().lower()
    activity = float(person.get("activity_level", 0.0))
    engagement = float(person.get("engagement", 0.0))
    bpm = int(person.get("bpm", 78))

    presences = world_summary.get("presences", [])
    presence_id = str(person.get("linked_presence", "unknown"))
    presence = next(
        (item for item in presences if str(item.get("id", "")) == presence_id),
        {
            "id": presence_id,
            "name": {
                "en": presence_id.replace("_", " ").title(),
                "ja": "場の名",
            },
            "type": "unknown",
        },
    )
    presence_name = presence.get("name", {"en": "Unknown", "ja": "未知"})

    if action_key == "boost":
        line_en = (
            f"{person['name']['en']} focuses on {presence_name['en']}, "
            f"offering a {int(activity * 100)}% pulse of living proof."
        )
        line_ja = (
            f"{person['name']['ja']}は{presence_name['ja']}へ集中し、"
            f"{int(activity * 100)}%の証明の脈を捧げる。"
        )
    elif action_key == "sing":
        line_en = (
            f"{person['name']['en']} sings at {bpm} BPM; "
            f"{presence_name['en']} answers in signal-light."
        )
        line_ja = (
            f"{person['name']['ja']}は{bpm} BPMで歌い、"
            f"{presence_name['ja']}は信号の光で応える。"
        )
    else:
        line_en = (
            f"{person['name']['en']} says: We keep the ledger warm; "
            f"{presence_name['en']} keeps the path true."
        )
        line_ja = (
            f"{person['name']['ja']}は言う。台帳を温め、"
            f"{presence_name['ja']}が道を正す。"
        )

    return {
        "ok": True,
        "action": action_key,
        "tick": int(world_summary.get("tick", 0)),
        "speaker": person.get("name", {}),
        "presence": {
            "id": presence.get("id", presence_id),
            "name": presence_name,
            "type": presence.get("type", "unknown"),
        },
        "line_en": line_en,
        "line_ja": line_ja,
        "voice_text_en": line_en,
        "voice_text_ja": line_ja,
        "activity_level": round(activity, 4),
        "engagement": round(engagement, 4),
    }


class LifeStateTracker:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._tick = 0
        self._actors = _make_actors()
        self._reports: list[dict[str, Any]] = []

    def snapshot(
        self,
        catalog: dict[str, Any],
        attribution_summary: dict[str, Any],
        entity_manifest: list[dict[str, Any]],
    ) -> dict[str, Any]:
        with self._lock:
            self._tick += 1

            audio_count = int(catalog.get("counts", {}).get("audio", 0))
            attribution_weight = float(attribution_summary.get("top_cover_weight", 0.0))
            top_claim = str(attribution_summary.get("top_cover_claim", ""))

            actors_out: list[dict[str, Any]] = []
            tracks: list[dict[str, Any]] = []
            activity_total = 0.0

            for person in self._actors:
                seed = _seed_value(person["id"])
                phase = (seed % 360) / 180.0 * math.pi
                pulse = 0.5 + 0.5 * math.sin((self._tick * 0.16) + phase)
                engagement = max(0.0, min(1.0, person["base_weight"] * 0.65 + pulse * 0.35))
                activity = max(
                    0.0,
                    min(
                        1.0,
                        engagement * 0.6 + attribution_weight * 0.3 + min(audio_count, 9) / 30.0,
                    ),
                )
                activity_total += activity

                mood = max(0.0, min(1.0, 0.42 + 0.4 * pulse + 0.2 * attribution_weight))
                track_bpm = 72 + int((seed % 16) + pulse * 8)

                actors_out.append(
                    {
                        "id": person["id"],
                        "name": person["name"],
                        "role": person["role"],
                        "instrument": person["instrument"],
                        "linked_presence": person["linked_presence"],
                        "engagement": round(engagement, 4),
                        "activity_level": round(activity, 4),
                        "mood": round(mood, 4),
                        "bpm": track_bpm,
                    }
                )

                tracks.append(
                    {
                        "id": f"track_{person['id']}",
                        "leader": person["name"],
                        "title": {
                            "en": f"Track of {person['linked_presence'].replace('_', ' ').title()}",
                            "ja": "演奏トラック",
                        },
                        "bpm": track_bpm,
                        "energy": round(0.3 + activity * 0.7, 4),
                    }
                )

            if self._tick % 9 == 0:
                report_id = f"report_{self._tick}"
                claim_text = (
                    top_claim.replace("_", " ").title() if top_claim else "Quiet Field"
                )
                self._reports.append(
                    {
                        "id": report_id,
                        "title": {
                            "en": f"Chronicle of {claim_text}",
                            "ja": "場の年代記",
                        },
                        "author": actors_out[self._tick % len(actors_out)]["name"],
                        "excerpt": {
                            "en": "The actors signaled the Presences, and the ledger answered in light.",
                            "ja": "アクターがプレゼンスへ信号を送り、台帳は光で応えた。",
                        },
                        "written_at_tick": self._tick,
                    }
                )
                if len(self._reports) > 12:
                    self._reports = self._reports[-12:]

            presences = [
                {
                    "id": entry.get("id", ""),
                    "name": {"en": entry.get("en", ""), "ja": entry.get("ja", "")},
                    "type": entry.get("type", "unknown"),
                }
                for entry in entity_manifest
                if entry.get("id") and entry.get("id") != "core_heartbeat"
            ]

            return {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "tick": self._tick,
                "presences": presences,
                "actors": actors_out,
                "tracks": tracks,
                "reports": list(self._reports),
                "activity_level": round(activity_total / max(len(actors_out), 1), 4),
            }
