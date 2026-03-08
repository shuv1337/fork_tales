"""Tests for OpenAI chat response extraction with reasoning-model fallback.

Covers _extract_openai_chat_response_text and _sanitize_reasoning_fallback
helpers added for Qwen 3.5 / DeepSeek-R1 compatibility.
"""

from __future__ import annotations

import os
import sys

# Ensure the parent code package is importable when running from repo root.
_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _root not in sys.path:
    sys.path.insert(0, _root)

from code.world_web.ai import (  # type: ignore[import-untyped]
    _extract_openai_chat_response_text,
    _sanitize_reasoning_fallback,
)


# ---------------------------------------------------------------------------
# _extract_openai_chat_response_text
# ---------------------------------------------------------------------------


class TestExtractOpenaiChatResponseText:
    """Extraction with content / text / reasoning fallback precedence."""

    def test_normal_content_string(self) -> None:
        raw = {"choices": [{"message": {"content": "Hello world"}}]}
        assert _extract_openai_chat_response_text(raw) == "Hello world"

    def test_normal_content_list(self) -> None:
        raw = {
            "choices": [
                {
                    "message": {
                        "content": [{"type": "text", "text": "Hello from list"}]
                    }
                }
            ]
        }
        assert _extract_openai_chat_response_text(raw) == "Hello from list"

    def test_text_field_fallback(self) -> None:
        raw = {"choices": [{"text": "plain text response"}]}
        assert _extract_openai_chat_response_text(raw) == "plain text response"

    def test_content_wins_over_reasoning(self) -> None:
        """When both content and reasoning are present, content takes precedence."""
        raw = {
            "choices": [
                {
                    "message": {
                        "content": "Actual answer",
                        "reasoning": "Thinking Process:\n\n1. Analysis...\n\nOutput: Actual answer",
                    }
                }
            ]
        }
        assert _extract_openai_chat_response_text(raw) == "Actual answer"

    def test_reasoning_only_with_conclusion(self) -> None:
        """Qwen 3.5 shape: content empty, reasoning populated with conclusion."""
        raw = {
            "choices": [
                {
                    "message": {
                        "content": "",
                        "reasoning": (
                            "Thinking Process:\n\n1. Analyze the request.\n"
                            "2. Determine greeting.\n\n"
                            "Output: Hello!"
                        ),
                    }
                }
            ]
        }
        result = _extract_openai_chat_response_text(raw)
        assert result == "Hello!"

    def test_reasoning_only_no_conclusion_uses_last_paragraph(self) -> None:
        """When no conclusion marker, extracts last paragraph."""
        raw = {
            "choices": [
                {
                    "message": {
                        "content": "",
                        "reasoning": (
                            "Thinking Process:\n\n"
                            "Step 1: Consider the options.\n\n"
                            "The best greeting is Hello."
                        ),
                    }
                }
            ]
        }
        result = _extract_openai_chat_response_text(raw)
        assert "Hello" in result

    def test_thinking_field_native_ollama(self) -> None:
        """Native Ollama /api/chat uses 'thinking' instead of 'reasoning'."""
        raw = {
            "choices": [
                {
                    "message": {
                        "content": "",
                        "thinking": "Some chain of thought.\n\nAnswer: Yes",
                    }
                }
            ]
        }
        result = _extract_openai_chat_response_text(raw)
        assert result == "Yes"

    def test_reasoning_content_field(self) -> None:
        """OpenAI extended shape uses 'reasoning_content'."""
        raw = {
            "choices": [
                {
                    "message": {
                        "content": "",
                        "reasoning_content": "Analysis done.\n\nFinal Answer: 42",
                    }
                }
            ]
        }
        result = _extract_openai_chat_response_text(raw)
        assert "42" in result

    def test_empty_payload(self) -> None:
        assert _extract_openai_chat_response_text({}) == ""
        assert _extract_openai_chat_response_text(None) == ""
        assert _extract_openai_chat_response_text("not a dict") == ""

    def test_empty_choices(self) -> None:
        assert _extract_openai_chat_response_text({"choices": []}) == ""

    def test_malformed_reasoning_only_label(self) -> None:
        """Reasoning that is just structural labels with no real content."""
        raw = {
            "choices": [
                {
                    "message": {
                        "content": "",
                        "reasoning": "Thinking Process:",
                    }
                }
            ]
        }
        result = _extract_openai_chat_response_text(raw)
        assert result == ""


# ---------------------------------------------------------------------------
# _sanitize_reasoning_fallback
# ---------------------------------------------------------------------------


class TestSanitizeReasoningFallback:
    """Sanitization of chain-of-thought text into usable output."""

    def test_conclusion_with_output_marker(self) -> None:
        text = "Step 1: think.\nStep 2: decide.\n\nOutput: The answer is blue."
        assert _sanitize_reasoning_fallback(text) == "The answer is blue."

    def test_conclusion_with_final_answer_marker(self) -> None:
        text = "Analysis...\n\nFinal Answer: 42"
        assert "42" in _sanitize_reasoning_fallback(text)

    def test_no_conclusion_uses_last_paragraph(self) -> None:
        text = "First paragraph.\n\nSecond paragraph.\n\nThis is the real answer."
        result = _sanitize_reasoning_fallback(text)
        assert result == "This is the real answer."

    def test_exceeding_max_chars_truncates(self) -> None:
        long_text = "word " * 200
        result = _sanitize_reasoning_fallback(long_text)
        assert len(result) <= 520  # 512 + some slack for ellipsis

    def test_empty_input(self) -> None:
        assert _sanitize_reasoning_fallback("") == ""
        assert _sanitize_reasoning_fallback("   ") == ""

    def test_strips_thinking_process_label(self) -> None:
        text = "Thinking Process: The answer is yes."
        result = _sanitize_reasoning_fallback(text)
        assert result == "The answer is yes."

    def test_strips_numbered_list_markers(self) -> None:
        text = "1. The answer is yes."
        result = _sanitize_reasoning_fallback(text)
        assert "The answer is yes" in result

    def test_strips_bullet_markers(self) -> None:
        text = "- The answer is yes."
        result = _sanitize_reasoning_fallback(text)
        assert "The answer is yes" in result

    def test_whitespace_only_after_sanitize(self) -> None:
        text = "Thinking Process:   \n  "
        result = _sanitize_reasoning_fallback(text)
        assert result == ""


if __name__ == "__main__":
    import pytest

    pytest.main([__file__, "-q"])
