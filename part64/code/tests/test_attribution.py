from __future__ import annotations

import importlib
from unittest.mock import patch

attribution_module = importlib.import_module("code.attribution")
ATTRIBUTION_EVENT_TYPE = attribution_module.ATTRIBUTION_EVENT_TYPE
AttributionTracker = attribution_module.AttributionTracker
add_mention = attribution_module.add_mention
attribution = attribution_module.attribution
build_mentions_from_catalog = attribution_module.build_mentions_from_catalog
decay_ledger = attribution_module.decay_ledger
fetch_remote_attribution = attribution_module.fetch_remote_attribution


def approx(expected: float, actual: float) -> bool:
    return abs(float(expected) - float(actual)) <= 1.0e-9


def test_decay_and_addition_match_expected_coefficients() -> None:
    ledger = {("winter", "claim"): {"short_term_score": 10.0, "long_term_score": 5.0}}
    decayed = decay_ledger(ledger)
    assert approx(9.0, decayed[("winter", "claim")]["short_term_score"])
    assert approx(4.975, decayed[("winter", "claim")]["long_term_score"])

    updated = add_mention(
        {},
        {
            "event-type": "winter-pyre",
            "claim": "claim/one",
            "weight": 1.0,
            "event-instance": "evt-1",
        },
    )
    row = updated[("winter-pyre", "claim/one")]
    assert approx(1.0, row["short_term_score"])
    assert row["mentions"] == 1
    assert row["event-instances"] == {"evt-1"}


def test_attribution_normalizes_probabilities() -> None:
    ledger = {}
    ledger = add_mention(ledger, {"event-type": "winter", "claim": "a", "weight": 1.0})
    ledger = add_mention(ledger, {"event-type": "winter", "claim": "b", "weight": 3.0})
    probs = attribution(ledger, "winter")
    assert approx(1.0, probs["a"] + probs["b"])
    assert probs["b"] > probs["a"]


def test_mentions_builder_emits_cover_and_media_claims() -> None:
    catalog = {
        "cover_fields": [
            {"id": "receipt_river", "part": "64"},
            {"id": "witness_thread", "part": "64"},
        ],
        "counts": {"audio": 3, "image": 2, "video": 0},
    }
    mentions = build_mentions_from_catalog(catalog)
    cover_mentions = [m for m in mentions if m["event-type"] == ATTRIBUTION_EVENT_TYPE]
    media_mentions = [m for m in mentions if m["event-type"] == "media_presence"]
    assert len(cover_mentions) == 2
    assert {m["claim"] for m in media_mentions} == {"audio", "image"}


def test_remote_snapshot_is_optional() -> None:
    with patch("os.getenv", return_value=""):
        assert fetch_remote_attribution() is None


def test_tracker_snapshot_contains_stable_shape() -> None:
    tracker = AttributionTracker()
    catalog = {
        "cover_fields": [{"id": "receipt_river", "part": "64"}],
        "counts": {"audio": 1, "image": 1, "video": 0},
    }
    snapshot = tracker.snapshot(catalog)
    assert snapshot["event_type"] == ATTRIBUTION_EVENT_TYPE
    assert snapshot["ledger_size"] >= 1
    assert "cover_attribution" in snapshot
    assert "media_attribution" in snapshot
