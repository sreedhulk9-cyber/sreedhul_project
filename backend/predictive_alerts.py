from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict

from .alertness_trend import AlertnessTrendAnalyzer


@dataclass
class PredictiveAlertState:
    """
    Immutable snapshot of the predictive alert state.

    This does NOT trigger any UI or audio directly. It is intended for
    consumption by higher-level layers (e.g., backend routes, UI) that
    decide how to present calm, gradual, non-intrusive alerts.
    """

    alert_level: str  # "NONE" | "EARLY_WARNING" | "STRONG_WARNING"
    advisory_text: str
    trend: Dict[str, Any]


class PredictiveAlertEngine:
    """
    Predictive alert logic built on top of Alertness Score trends.

    - Uses trend analysis, not single-score events
    - Provides early and strong warnings based on steady downward trends
    - Avoids false alerts from isolated spikes/dips via:
        * rolling-window trend metrics
        * minimum history requirement
        * persistence (dwell time) before escalating
    """

    def __init__(
        self,
        *,
        # Trend analysis window (delegated to AlertnessTrendAnalyzer)
        trend_window_seconds: float = 300.0,
        # Score thresholds
        strong_score_threshold: float = 40.0,
        # Slope thresholds (points per minute, negative = declining)
        early_decline_slope_threshold_per_min: float = -0.5,
        strong_decline_slope_threshold_per_min: float = -1.5,
        # Persistence / dwell times (seconds) for calm, gradual escalation
        early_warning_min_duration: float = 20.0,
        strong_warning_min_duration: float = 40.0,
    ) -> None:
        self._trend = AlertnessTrendAnalyzer(window_seconds=trend_window_seconds)

        self.strong_score_threshold = float(strong_score_threshold)
        self.early_decline_slope_threshold_per_min = float(
            early_decline_slope_threshold_per_min
        )
        self.strong_decline_slope_threshold_per_min = float(
            strong_decline_slope_threshold_per_min
        )
        self.early_warning_min_duration = float(early_warning_min_duration)
        self.strong_warning_min_duration = float(strong_warning_min_duration)

        # State for persistence logic
        self._current_level: str = "NONE"
        self._level_since_ts: float | None = None
        self._pending_level: str | None = None
        self._pending_since_ts: float | None = None

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #

    def update(self, *, score: float, timestamp: float) -> PredictiveAlertState:
        """
        Ingest a new Alertness Score sample and return the current
        predictive alert state.

        This uses the internal AlertnessTrendAnalyzer to:
        - maintain a rolling 3–5 minute history
        - compute slopes and steady-decline metrics
        and then classifies an alert level based on those trends.
        """
        trend = self._trend.add_sample(score=score, timestamp=timestamp)
        raw_level = self._classify_raw_level(score=score, trend=trend)
        level = self._apply_persistence(
            candidate_level=raw_level,
            timestamp=timestamp,
        )

        advisory_text = self._advisory_for_level(level)

        return PredictiveAlertState(
            alert_level=level,
            advisory_text=advisory_text,
            trend=trend,
        )

    # ------------------------------------------------------------------ #
    # Internal helpers
    # ------------------------------------------------------------------ #

    def _classify_raw_level(self, *, score: float, trend: Dict[str, Any]) -> str:
        """
        Classify an instantaneous alert level based purely on trend metrics.
        This does NOT apply persistence/dwell-time smoothing.
        """
        if not trend.get("has_enough_history", False):
            return "NONE"

        slope_per_min = float(trend.get("overall_slope_per_min", 0.0))
        is_steady_decline = bool(trend.get("is_steady_decline", False))

        # Strong warning:
        # - Score already low
        # - Trend continues downward
        if (
            score < self.strong_score_threshold
            and is_steady_decline
            and slope_per_min <= self.strong_decline_slope_threshold_per_min
        ):
            return "STRONG_WARNING"

        # Early warning:
        # - Clear downward trend, but score not yet in critical range
        if is_steady_decline and slope_per_min <= self.early_decline_slope_threshold_per_min:
            return "EARLY_WARNING"

        # Otherwise we stay calm and avoid alerts for isolated fluctuations
        return "NONE"

    def _apply_persistence(self, *, candidate_level: str, timestamp: float) -> str:
        """
        Apply dwell-time / persistence rules so alerts feel calm, gradual,
        and non-intrusive.

        - Escalation to EARLY_WARNING or STRONG_WARNING only happens if the
          candidate level has remained stable for a minimum duration.
        - De-escalation back to NONE is allowed a bit more quickly to avoid
          lingering warnings once the trend improves.
        """
        ts = float(timestamp)

        # First-time initialization
        if self._current_level == "NONE" and self._level_since_ts is None:
            self._level_since_ts = ts

        # If the candidate matches the current level, we simply maintain it.
        if candidate_level == self._current_level:
            self._pending_level = None
            self._pending_since_ts = None
            return self._current_level

        # Handle de-escalation to NONE:
        if candidate_level == "NONE":
            # Reset to NONE calmly; we can allow relatively quick de-escalation.
            self._current_level = "NONE"
            self._level_since_ts = ts
            self._pending_level = None
            self._pending_since_ts = None
            return self._current_level

        # For EARLY_WARNING / STRONG_WARNING we enforce dwell time.
        # Start or update a pending level candidate.
        if self._pending_level != candidate_level:
            self._pending_level = candidate_level
            self._pending_since_ts = ts
            return self._current_level

        # Candidate matches existing pending level; check duration.
        assert self._pending_since_ts is not None
        elapsed = ts - self._pending_since_ts

        if self._pending_level == "EARLY_WARNING":
            if elapsed >= self.early_warning_min_duration:
                self._current_level = "EARLY_WARNING"
                self._level_since_ts = ts
                self._pending_level = None
                self._pending_since_ts = None
        elif self._pending_level == "STRONG_WARNING":
            if elapsed >= self.strong_warning_min_duration:
                self._current_level = "STRONG_WARNING"
                self._level_since_ts = ts
                self._pending_level = None
                self._pending_since_ts = None

        return self._current_level

    @staticmethod
    def _advisory_for_level(level: str) -> str:
        """
        Human-readable advisory text for the current alert level.
        This is intentionally calm and non-intrusive in tone.
        """
        if level == "STRONG_WARNING":
            return "Alertness is low and steadily decreasing. Please plan a safe break soon."
        if level == "EARLY_WARNING":
            return "Alertness is gradually declining. Consider a short rest if you can."
        return "Alertness trend is stable. No predictive warning at this time."

