# Security Review Notes

Lineage currently behaves like a local/LAN developer application, not a hardened
multi-tenant service. The API has no user authentication, so production exposure
should sit behind an authenticated reverse proxy or platform-level access
control.

## Current Controls

- Episode IDs accepted by API routes are constrained to `sXXeYY` before reaching
  repository and cache paths.
- Character/name path parameters are length-limited and restricted to simple
  screenplay-safe characters.
- LLM-cost routes use an in-process rate limiter keyed by `X-Lineage-Device`
  with IP fallback.
- Ask prompt inputs are bounded by Pydantic field limits; continuity-flag text is
  clipped before entering prompts.
- Rerank debug traces are clipped and only returned from stats when both
  `LINEAGE_DEBUG_RERANK` and `LINEAGE_EXPOSE_DEBUG_STATS` are enabled.
- CORS defaults to local development origins when no explicit allow-list is set.

## Known Residual Risks

- The in-process limiter does not coordinate across multiple server processes or
  hosts. Use gateway/edge rate limits for hosted deployments.
- `X-Lineage-Device` is not authentication; users can rotate it. It is only a
  cost-control hint for local sessions.
- `/api/stats/overview` exposes operational model usage and, when debug stats
  are explicitly enabled, recent retrieval traces. Keep debug stats disabled in
  shared environments.
- LLM guardrails reduce prompt-injection risk but cannot guarantee model
  compliance. The app still treats model outputs as untrusted and parses only
  bounded JSON structures where JSON is required.
