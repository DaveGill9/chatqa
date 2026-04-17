Added a dedicated `GET /health` handler that returns the required minimal JSON payload without changing existing health endpoints. This keeps `/` and `/healthz` behavior intact while satisfying the issue’s strict response shape.

**Changed files**
- `api/src/modules/health/health.controller.ts`

**Tests**
- Not added (no existing test harness for the API in this repo).

**Risks / assumptions**
- Assumes adding `/health` alongside existing `/healthz` is acceptable and won’t conflict with any external routing expectations.
- The response is exactly `{ "status": "ok" }` as required; no version/timestamp included.

**Follow-up**
- If you want coverage, I can add an e2e test once a Nest testing setup is in place.