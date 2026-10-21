# Baitly directory read model

PostgreSQL remains the source of truth. No organization prospect data or contact authorizations
enter the public map index. No Elasticsearch dependency is introduced.

## Deployment

1. Integrate the prepared infra changes first: PostgreSQL 15 with pgvector AND PostGIS,
   and pg_stat_statements preloaded. The major version, named volumes, database and
   container identifiers remain unchanged. The local image is built by Compose during
   normal CI/CD deployment; no vendor image tag is overwritten.
2. Integrate the application changes through normal CI/CD. Liquibase 0587 creates
   trigram/sort indexes, the revision counter and map cell tables. 0588 is idempotent
   and rechecked on each boot; it adds PostGIS when the installed image supports it.
   Older images retain the live SQL fallback rather than failing at startup.
3. An independent worker starts after 15 seconds and checks every minute. It scans
   source coordinates once at level 12, then rolls up levels 11 through 0.
   Only a complete generation is published. Concurrent source changes abort a stale
   rebuild through PostgreSQL repeatable-read serialization, then retry at the next tick.
   Initial trigram builds and the generated geography column can extend the first boot.
4. Promote to production only after staging validation. No container is restarted by
   this task. The infra and application repositories must both be deployed.

## Reads

- Map list: one ranked request, never an ID page plus a ranked page simultaneously.
  Proximity expands indexed spherical disks until it has 201 matches, or the entire viewport
  is covered. It sorts all candidates in that disk, including tied coordinates, before limiting.
  Sparse/empty views stop at a conservative viewport distance bound. Full details are fetched
  only for the selected 200 IDs. The other sort modes also paginate IDs before loading details.
- Geometry: PostGIS GiST disk filtering and spherical distance when available; safe SQL fallback otherwise.
  Map SELECT statements have a five-second JDBC timeout; expansion has an eight-second deadline
  checked between queries. A timeout is an error, never a partial response presented as complete.
- Nearby candidate sets are cached by 0.05-degree cells, source revision, filters and disk size.
  A 10-km safety margin covers center movement inside a cell. Only complete sets of at most 2,048
  IDs are reused; overflow falls back to the exact spatial query. The actual center, rectangle,
  ordering and cursor are applied after candidate retrieval, so caching never approximates ranking.
- Wide views: authenticated versioned MVT tiles, generated from the precalculated cells.
  Stable z/x/y keys share cache entries across nearby navigation and different users.
- Narrow views or city/text searches: exact JSON coverage, preserving existing filters.
- Cells store separate phone/email bit masks; a website alone never qualifies as a contact.
- Cache: bounded Caffeine single-flight then Redis, revision-scoped with five-minute Redis TTL.
  A Redis failure falls back to PostgreSQL. A publication changes the cache namespace.
  The state read itself is cached for at most two seconds.
- Browser: retain up to 2,000 detail records, preserving the focused company. A fully cached
  viewport is ranked locally without requesting company details again. Explicit refresh
  still requests fresh data. MVT failures fall back to the authenticated JSON endpoint.
- The MapLibre source survives loading/ready state changes. Vector/JSON mode uses camera zoom
  hysteresis (8.5/9.5); vectors remain until close-up coverage is ready. A new published revision
  can retry the vector path after a previous revision failed.
- Authenticated MVT requests use a session-isolated, revision-URL-keyed, in-flight deduplicating
  memory cache: 120 seconds, 128 entries, 8 MiB. Abort is reference counted; cancelling one consumer
  does not cancel another. Responses are copied to avoid transferred-buffer detachment. No token
  or payload is persisted to browser storage. Existing HTTP security headers remain untouched.
- The professional list uses TanStack Virtual with measured row heights, stable business keys,
  overscan and a pinned selected/focused row. It scrolls only the map sheet and preserves keyboard
  focus. Memoized rows avoid repainting every visible company on a selection update.
- Nginx compression includes application/vnd.mapbox-vector-tile and application/x-protobuf.
- HTTP security cache headers and authentication remain enforced; tokens are never put
  in tile URLs or sent to third-party tile hosts.

## Verification and diagnostics

The dedicated CI workflow uses real PostGIS 15 and applies actual Liquibase changesets.
The PostgreSQL integration test covers hierarchy counts, channel filters, withdrawal,
pagination, tile bytes and source revision invalidation.
It also compares spatial pagination with an exhaustive oracle and tests 2,300 businesses at one
coordinate to exercise candidate-cache overflow and tie ordering. Local PostGIS checks use an
isolated baitly_directory_test_<uuid> database on native port 5433, deleted after verification;
the CI PostgreSQL 15 endpoint remains 127.0.0.1:55442/postgres.

Prometheus metrics: baitly_directory_map_seconds, baitly_directory_cache_total
(layer=local/redis/database/redis_unavailable), baitly_directory_index_build_seconds.
Use scripts/baitly-directory-index/measure.sql through existing read-only diagnostics.
Compare cold and warm p50/p95 for a France view, a city, each contact filter and map pans.
The warm-cache p95 target is 300 ms; it is a target, not a measured production result.

Infra patch copy: scripts/baitly-directory-index/infra.patch. It is already applied locally
to the sibling infra repository. Do not apply it twice.
