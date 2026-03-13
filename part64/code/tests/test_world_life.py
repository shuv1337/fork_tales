from __future__ import annotations

import importlib


world_life = importlib.import_module("code.world_life")
LifeStateTracker = world_life.LifeStateTracker
build_interaction_response = world_life.build_interaction_response


def test_world_life_snapshot_contains_actors_tracks_and_reports() -> None:
    tracker = LifeStateTracker()
    catalog = {
        "counts": {"audio": 3, "image": 1, "video": 0},
        "cover_fields": [{"id": "log_stream", "part": "64"}],
    }
    myth = {"top_cover_claim": "log_stream", "top_cover_weight": 0.7}
    entities = [
        {
            "id": "log_stream",
            "en": "Log Stream",
            "ja": "領収書の川",
            "type": "flow",
        },
        {
            "id": "compliance_gate",
            "en": "Compliance Gate",
            "ja": "真理の門",
            "type": "portal",
        },
    ]

    snapshot = tracker.snapshot(catalog, myth, entities)

    assert snapshot["tick"] >= 1
    assert isinstance(snapshot["actors"], list)
    assert len(snapshot["actors"]) >= 3
    assert isinstance(snapshot["tracks"], list)
    assert len(snapshot["tracks"]) == len(snapshot["actors"])
    assert isinstance(snapshot["presences"], list)
    assert len(snapshot["presences"]) == 2


def test_world_life_writes_reports_over_time() -> None:
    tracker = LifeStateTracker()
    catalog = {"counts": {"audio": 1, "image": 0, "video": 0}, "cover_fields": []}
    myth = {"top_cover_claim": "observer_thread", "top_cover_weight": 0.4}
    entities: list[dict[str, str]] = []

    last = {}
    for _ in range(9):
        last = tracker.snapshot(catalog, myth, entities)

    assert len(last["reports"]) >= 1
    assert last["reports"][-1]["title"]["en"].startswith("Chronicle of")


def test_world_life_interaction_response_uses_presence_and_action() -> None:
    tracker = LifeStateTracker()
    catalog = {"counts": {"audio": 2, "image": 0, "video": 0}, "cover_fields": []}
    myth = {"top_cover_claim": "compliance_gate", "top_cover_weight": 0.55}
    entities = [
        {
            "id": "observer_thread",
            "en": "Observer Thread",
            "ja": "観測者の糸",
            "type": "network",
        }
    ]
    snapshot = tracker.snapshot(catalog, myth, entities)

    response = build_interaction_response(snapshot, "logger_aya", "boost")

    assert response["ok"] is True
    assert response["action"] == "boost"
    assert "Observer Thread" in response["line_en"]
    assert "観測者の糸" in response["line_ja"]


def test_world_life_interaction_handles_empty_world() -> None:
    response = build_interaction_response({}, "unknown", "speak")
    assert response["ok"] is False
    assert response["error"] == "world_has_no_actors"
