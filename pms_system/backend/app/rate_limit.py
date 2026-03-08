from __future__ import annotations

import threading
import time
from collections import defaultdict, deque


class SlidingWindowRateLimiter:
    def __init__(self, max_attempts: int, window_seconds: int) -> None:
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._lock = threading.Lock()
        self._events: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        now = time.time()
        with self._lock:
            dq = self._events[key]
            while dq and dq[0] <= now - self.window_seconds:
                dq.popleft()
            if len(dq) >= self.max_attempts:
                return False
            dq.append(now)
            return True
