-- Read-only diagnosis. Use the existing CI/CD diagnostics path, never ad-hoc production modifications.
SELECT revision,indexed_revision,indexed_at FROM baitly_directory_map_state;
SELECT level,count(*) AS groups,sum(count) AS companies
FROM baitly_directory_map_cells
WHERE revision=(SELECT indexed_revision FROM baitly_directory_map_state WHERE id=true)
GROUP BY level ORDER BY level;
SELECT indexrelname,idx_scan,pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes WHERE relname='baitly_directory_professionals' ORDER BY indexrelname;
-- Requires pg_stat_statements to have been preloaded by the PostgreSQL image configuration.
SELECT calls,round(mean_exec_time::numeric,2) AS mean_ms,round(total_exec_time::numeric,2) AS total_ms,rows,left(query,180) AS query
FROM public.pg_stat_statements WHERE query ILIKE '%baitly_directory%' ORDER BY total_exec_time DESC LIMIT 20;
