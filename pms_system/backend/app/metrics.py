from __future__ import annotations

from prometheus_client import Counter, Histogram, generate_latest

REQUEST_COUNT = Counter(
    "mptv_http_requests_total",
    "Total HTTP requests",
    ["method", "path", "status_code"],
)
REQUEST_LATENCY = Histogram(
    "mptv_http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "path"],
    buckets=(0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
)


def metrics_payload() -> bytes:
    return generate_latest()
