from collections import deque
from typing import Deque, List, Tuple


class DriverAlertnessScorer:
    """
    Continuous driver alertness score in range [0, 100].

    The score is designed to behave like a fuel/battery gauge:
    - Starts at 100
    - Decreases gradually when drowsiness patterns appear
    - Recovers slowly when the driver appears alert
    - Applies exponential smoothing for stability
    """

    def __init__(
        self,
        initial_score: float = 100.0,
        ear_threshold: float = 0.25,
        nod_pitch_threshold: float = -10.0,
        window_seconds: float = 60.0,
        smoothing_alpha: float = 0.1,
        prolonged_blink_threshold: float = 0.3,
        max_score: float = 100.0,
        min_score: float = 0.0,
    ) -> None:
        self.ear_threshold = ear_threshold
        self.nod_pitch_threshold = nod_pitch_threshold
        self.window_seconds = window_seconds
        self.smoothing_alpha = smoothing_alpha
        self.prolonged_blink_threshold = prolonged_blink_threshold
        self.max_score = max_score
        self.min_score = min_score

        # Score state
        self.raw_score = float(initial_score)
        self.smoothed_score = float(initial_score)

        # Time state
        self.last_timestamp: float | None = None

        # Blink state
        self.eyes_closed: bool = False
        self.eye_state_change_ts: float | None = None
        self.blink_events: Deque[Tuple[float, float]] = deque()

        # Head nodding state
        self.nodding_active: bool = False
        self.last_nod_start_ts: float | None = None
        self.nod_events: Deque[float] = deque()

    def _update_time(self, timestamp: float) -> float:
        """Update internal time state and return delta-time in seconds."""
        if self.last_timestamp is None:
            self.last_timestamp = float(timestamp)
            return 0.0

        current_ts = float(timestamp)
        dt = max(0.0, current_ts - self.last_timestamp)
        self.last_timestamp = current_ts
        return dt

    def _update_blinks(self, ear: float, timestamp: float) -> Tuple[float, float]:
        """
        Track blink events using EAR and return:
        - current blink duration (seconds)
        - blink frequency (blinks per minute) over the recent window
        """
        ts = float(timestamp)
        closed = ear < self.ear_threshold

        if closed and not self.eyes_closed:
            # Transition: open -> closed
            self.eyes_closed = True
            self.eye_state_change_ts = ts
        elif not closed and self.eyes_closed:
            # Transition: closed -> open  => a blink event
            if self.eye_state_change_ts is not None:
                duration = max(0.0, ts - self.eye_state_change_ts)
                self.blink_events.append((ts, duration))
            self.eyes_closed = False
            self.eye_state_change_ts = ts

        # Purge old events outside the rolling window
        cutoff = ts - self.window_seconds
        while self.blink_events and self.blink_events[0][0] < cutoff:
            self.blink_events.popleft()

        current_blink_duration = 0.0
        if self.eyes_closed and self.eye_state_change_ts is not None:
            current_blink_duration = max(0.0, ts - self.eye_state_change_ts)

        blink_frequency_per_minute = 0.0
        if self.blink_events:
            blinks_per_second = len(self.blink_events) / max(self.window_seconds, 1e-3)
            blink_frequency_per_minute = blinks_per_second * 60.0

        return current_blink_duration, blink_frequency_per_minute

    def _update_nods(self, pitch: float, timestamp: float) -> float:
        """
        Track head nod events using pitch and return:
        - nod frequency (nods per minute) over the recent window
        """
        ts = float(timestamp)
        below = pitch < self.nod_pitch_threshold

        if below and not self.nodding_active:
            self.nodding_active = True
            self.last_nod_start_ts = ts
        elif not below and self.nodding_active:
            # Count a nod when we come back from a dipped head position
            self.nodding_active = False
            self.nod_events.append(ts)

        cutoff = ts - self.window_seconds
        while self.nod_events and self.nod_events[0] < cutoff:
            self.nod_events.popleft()

        nod_frequency_per_minute = 0.0
        if self.nod_events:
            nods_per_second = len(self.nod_events) / max(self.window_seconds, 1e-3)
            nod_frequency_per_minute = nods_per_second * 60.0

        return nod_frequency_per_minute

    def update_from_signals(
        self,
        ear: float,
        pitch: float,
        yaw: float,
        timestamp: float,
        yawning_frequency: float = 0.0,
    ) -> float:
        """
        High-level update using raw signals as they come from the camera pipeline.

        This derives:
        - blink duration
        - blink frequency
        - head nodding frequency
        - yawning frequency (optional external input; defaults to 0)
        """
        dt = self._update_time(timestamp)
        blink_duration, blink_frequency = self._update_blinks(ear, timestamp)
        nod_frequency = self._update_nods(pitch, timestamp)

        return self._update_score(
            dt=dt,
            blink_duration=blink_duration,
            blink_frequency=blink_frequency,
            yawn_frequency=yawning_frequency,
            nod_frequency=nod_frequency,
        )

    def _update_score(
        self,
        dt: float,
        blink_duration: float,
        blink_frequency: float,
        yawn_frequency: float,
        nod_frequency: float,
    ) -> float:
        """
        Core scoring function.

        Score decreases gradually as:
        - blink duration increases (long eye closures)
        - blink frequency increases
        - yawning frequency increases
        - head nodding frequency increases
        """
        if dt <= 0.0:
            return self.smoothed_score

        # Prolonged blink beyond a small baseline threshold
        prolonged_blink_excess = max(0.0, blink_duration - self.prolonged_blink_threshold)

        # Blink frequency: focus on values above ~20 blinks/min
        blink_freq_excess = max(0.0, blink_frequency - 20.0) / 20.0

        # Yawns and nods are already "per minute" rates
        yawn_factor = max(0.0, yawn_frequency)
        nod_factor = max(0.0, nod_frequency)

        # Aggregate fatigue load from different behaviors
        fatigue_load = (
            3.0 * prolonged_blink_excess
            + 1.0 * blink_freq_excess
            + 4.0 * yawn_factor
            + 2.0 * nod_factor
        )

        if fatigue_load > 0.0:
            # Base drain plus additional drain from fatigue patterns.
            # Because dt is in seconds, this naturally ensures gradual change.
            drain_rate = 0.5 + fatigue_load  # points per second at high fatigue
            self.raw_score -= drain_rate * dt
        else:
            # Gentle recovery toward max_score when no drowsy patterns are present
            recovery_rate = 0.2  # points per second at full rest (~12/min)
            self.raw_score += recovery_rate * dt

        # Clamp to valid range
        self.raw_score = max(self.min_score, min(self.max_score, self.raw_score))

        # Exponential smoothing for stable UI indicator
        alpha = self.smoothing_alpha
        self.smoothed_score = alpha * self.raw_score + (1.0 - alpha) * self.smoothed_score

        return self.smoothed_score

    def get_score(self) -> float:
        """Return the current smoothed alertness score."""
        return float(self.smoothed_score)

