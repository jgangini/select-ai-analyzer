# Repository Agent Instructions

## Tool Usage

- When working in this code repository, prefer the `semble` MCP server for code search, symbol discovery, and finding related implementations before doing broad manual searches.
- Use `sentrux` as the architecture and structure sensor, not as a replacement for tests or builds.
- Prefer Sentrux for architecture-sensitive work: larger edits, refactors, module moves, dependency changes, MCP/agent-generated code sessions, or any repository that already has `.sentrux/rules.toml`.
- For repositories with rules, run Sentrux checks before finalizing changes when practical. For larger sessions, consider saving a baseline before edits and comparing after edits to catch structural regressions.
- Use the Sentrux MCP server when it is available in the current session; otherwise use the native CLI (`sentrux check`, `sentrux gate`, or `sentrux scan`). Do not open the GUI unless explicitly useful or requested.

## Graphify

This project has a knowledge graph at `graphify-out/` with core nodes, community structure, and cross-file relationships.

Rules:

- Always read `graphify-out/GRAPH_REPORT.md` before reading source files, running grep/glob searches, or answering codebase questions. The graph is the primary map of the codebase.
- If `graphify-out/wiki/index.md` exists, navigate it instead of reading raw files.
- For cross-module relationship questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep. These traverse the graph's extracted and inferred edges instead of scanning files.
- After modifying code, run `graphify update .` to keep the graph current. This is AST-only and has no API cost.
