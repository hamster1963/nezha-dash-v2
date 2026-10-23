# Incremental frontend boundaries

The application keeps React, TanStack Query, the existing WebSocket provider and public import facades. Feature folders contain behavior with a stable owner; shared formatting, transport and cache adapters stay in `lib`.

## Server overview

`features/servers/selectors.ts` owns group membership, stable sorting, status filtering and group-level statistics. It is independent of storage and React. `use-server-preferences.ts` owns saved flags, group selection and scroll restoration. Controls, lists and empty/error states are separate components. `pages/Server.tsx` composes these boundaries with API and WebSocket data.

Compatibility keys remain `showMap`, `showServices`, `inline` (string `0`/`1`), `selectedGroup`, `fromMainPage` and `scrollPosition`.

## Detail charts

`features/server-detail/realtime-series.ts` projects one server from the provider's existing history, once per render dependency change. Current data wins duplicate timestamps, output is oldest-first and capped at 30 frames. Missing servers/cards do not create fabricated samples. Zero and consecutive equal readings are valid. Charts synchronize by timestamp value, since GPU histories can be sparse.

Metric-specific components preserve presentation, units and tooltips. Network history bytes/second becomes MiB/second; memory/swap/disk history bytes becomes percentage using host capacity. GPU realtime samples are indexed by card; the historical backend has one `gpu` metric and no per-card index parameter, so historical queries are shared rather than inventing an API.

`hooks/use-metric-history.ts` uses TanStack Query keys containing server ID, metric and period. Aborts are forwarded to the transport. Results expose status, error and actual data period; incomplete or failed paired requests do not display stale series. Each member of a pair is cached independently and timestamps are joined using the primary series order.

## Pure metrics and transport

`lib/server-metrics.ts` is storage-free. `formatNezhaInfo` remains a compatibility facade combining that projection with `lib/public-note-cache.ts`. The cache retains `server_${id}_public_note` and its existing nonempty-note/fallback semantics.

`lib/http.ts` handles HTTP and business failures without unwrapping payloads. `lib/nezha-api.ts` preserves existing fetch functions and adds optional cancellation. Profile refresh retains its CSRF header and hourly throttle.

## Runtime configuration

`features/runtime-config` owns trusted custom-code injection and typed access to legacy globals. `lib/inject.ts` and `lib/runtime-config.ts` remain public compatibility facades.

Initialization awaits ordered external scripts and styles, exposes loading/ready/error, and aborts stale work. Each injection owns its DOM nodes and cleanup. Removing script nodes cannot undo arbitrary JavaScript side effects already executed.

The public `window.*` names are unchanged. Writable configurable data properties are observed while consumers are mounted, so delayed assignments work without a mandatory new event. Existing custom accessors, readonly and nonconfigurable globals are never replaced; these retain a bounded five-second discovery fallback. `runtimeConfigChange` explicitly refreshes unusual custom integrations, and the existing `backgroundChange` event remains supported. Saved background and language keys are unchanged.

## Verification

Run `pnpm verify` for formatting/lint, coverage, TypeScript and production build. Regression suites cover values/timestamps, empty monitors, failed and out-of-order history switches, server identity changes, sparse GPUs, selector ordering, saved preferences, delayed configuration and aborted injection. Coverage thresholds are unchanged. Recharts unit doubles verify data and synchronization contracts; browser checks are complementary and must be reported separately.
