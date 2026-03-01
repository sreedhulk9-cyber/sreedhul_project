from collections import deque
from typing import Deque, Tuple, Dict, Any


class AlertnessTrendAnalyzer:
    """
    Analyze trends in the Driver Alertness Score over a rolling time window.

    This module does NOT modify detection logic or scoring logic. It purely
    consumes already-computed alertness scores over time and exposes
    trend-related metrics for UI and higher-level alert logic.
    """

    def __init__(
        self,
        window_seconds: float = 300.0,
        min_points_for_trend: int = 5,
        steady_decline_slope_threshold_per_min: float = -0.5,
        strong_decline_slope_threshold_per_min: float = -3.0,
        steady_decline_ratio_threshold: float = 0.7,
    ) -> None:
        """
        :param window_seconds: Rolling history window in seconds (3–5 minutes typical).
        :param min_points_for_trend: Minimum samples required before we trust trend metrics.
        :param steady_decline_slope_threshold_per_min: Overall slope (points/minute) below
            which we consider the trend to be meaningfully declining.
        :param strong_decline_slope_threshold_per_min: Slope below this is considered strong/rapid decline.
        :param steady_decline_ratio_threshold: Fraction of steps that must be non-increasing
            to call the trend a steady decline.
        """
        self.window_seconds = float(window_seconds)
        self.min_points_for_trend = int(min_points_for_trend)
        self.steady_decline_slope_threshold_per_min = float(steady_decline_slope_threshold_per_min)
        self.strong_decline_slope_threshold_per_min = float(strong_decline_slope_threshold_per_min)
        self.steady_decline_ratio_threshold = float(steady_decline_ratio_threshold)

        # History of (timestamp, score) samples
        self._samples: Deque[Tuple[float, float]] = deque()

    # --- Core public API -------------------------------------------------

    def add_sample(self, score: float, timestamp: float) -> Dict[str, Any]:
        """
        Add a new alertness score sample and update internal rolling-window history.

        Returns a dictionary with trend metrics that can be consumed by the UI
        or higher-level alert logic. This call does NOT trigger any alerts.
        """
        ts = float(timestamp)
        sc = float(score)

        # Append new sample
        self._samples.append((ts, sc))

        # Drop samples outside rolling window (keep last N seconds)
        cutoff = ts - self.window_seconds
        while self._samples and self._samples[0][0] < cutoff:
            self._samples.popleft()

        # Compute and return current trend analysis
        return self._analyze_trend()

    def get_trend(self) -> Dict[str, Any]:
        """
        Return the latest computed trend metrics without adding a new sample.
        """
        return self._analyze_trend()

    # --- Internal helpers ------------------------------------------------

    def _analyze_trend(self) -> Dict[str, Any]:
        samples = list(self._samples)
        n = len(samples)

        trend: Dict[str, Any] = {
            "window_seconds": self.window_seconds,
            "sample_count": n,
            "has_enough_history": n >= self.min_points_for_trend,
            "current_score": samples[-1][1] if n else None,
            "oldest_score": samples[0][1] if n else None,
            "overall_slope_per_min": 0.0,
            "is_steady_decline": False,
            "decline_ratio": 0.0,
            "trend_label": "INSUFFICIENT_DATA" if n < self.min_points_for_trend else "STABLE",
        }

        if n < 2:
            # Not enough points to define a slope
            return trend

        # Normalize times to start at 0 for numerical stability
        t0 = samples[0][0]
        times = [ts - t0 for ts, _ in samples]
        scores = [sc for _, sc in samples]

        total_time = times[-1] - times[0]
        if total_time <= 0.0:
            # All timestamps are identical; treat as no trend
            return trend

        # --- Linear regression slope (score vs time) ---------------------
        # slope_units: points per second
        slope_per_sec = self._linear_regression_slope(times, scores)
        slope_per_min = slope_per_sec * 60.0
        trend["overall_slope_per_min"] = slope_per_min

        # --- Steady-decline ratio ----------------------------------------
        # Fraction of consecutive steps where score is not increasing.
        declines = 0
        steps = 0
        for i in range(1, n):
            prev = samples[i - 1][1]
            cur = samples[i][1]
            if cur <= prev:
                declines += 1
            steps += 1

        decline_ratio = (declines / steps) if steps > 0 else 0.0
        trend["decline_ratio"] = decline_ratio

        # Steady decline: mostly non-increasing and slope sufficiently negative
        is_steady_decline = (
            slope_per_min <= self.steady_decline_slope_threshold_per_min
            and decline_ratio >= self.steady_decline_ratio_threshold
        )
        trend["is_steady_decline"] = is_steady_decline

        # --- High-level qualitative label --------------------------------
        if n < self.min_points_for_trend:
            trend["trend_label"] = "INSUFFICIENT_DATA"
        else:
            if slope_per_min >= self.steady_decline_slope_threshold_per_min:
                trend["trend_label"] = "STABLE"
            elif slope_per_min <= self.strong_decline_slope_threshold_per_min and is_steady_decline:
                # Strong negative slope and consistently trending down
                trend["trend_label"] = "STEADY_STRONG_DECLINE"
            elif is_steady_decline:
                # Negative slope with mostly non-increasing steps
                trend["trend_label"] = "STEADY_GRADUAL_DECLINE"
            else:
                # Negative but noisy, or oscillating
                trend["trend_label"] = "VOLATILE"

        return trend

    @staticmethod
    def _linear_regression_slope(times: list[float], scores: list[float]) -> float:
        """
        Simple least-squares linear regression slope (score vs time).
        Returns slope in points per second.
        """
        n = len(times)
        if n < 2:
            return 0.0

        mean_t = sum(times) / n
        mean_s = sum(scores) / n

        var_t = 0.0
        cov_ts = 0.0
        for t, s in zip(times, scores):
            dt = t - mean_t
            ds = s - mean_s
            var_t += dt * dt
            cov_ts += dt * ds

        if var_t <= 1e-9:
            return 0.0

        return cov_ts / var_t

