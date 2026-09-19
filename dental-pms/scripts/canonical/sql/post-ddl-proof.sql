SELECT migration_name, finished_at IS NOT NULL AS finished, rolled_back_at IS NULL AS not_rolled_back
FROM "_prisma_migrations"
WHERE migration_name = '20260918190000_wave0_control_plane';

SELECT relname AS canonical_table
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relkind = 'r'
  AND relname LIKE 'canonical_%'
ORDER BY relname;

SELECT typname AS canonical_enum
FROM pg_type
WHERE typnamespace = 'public'::regnamespace
  AND typname IN ('CanonicalMigrationStatus', 'CanonicalMigrationCountType', 'CanonicalFeatureControlType')
ORDER BY typname;

SELECT 'canonical_feature_flag_versions' AS table_name, count(*) AS rows FROM canonical_feature_flag_versions
UNION ALL SELECT 'canonical_feature_flags', count(*) FROM canonical_feature_flags
UNION ALL SELECT 'canonical_migration_batch_counts', count(*) FROM canonical_migration_batch_counts
UNION ALL SELECT 'canonical_migration_batches', count(*) FROM canonical_migration_batches
UNION ALL SELECT 'canonical_migration_run_events', count(*) FROM canonical_migration_run_events
ORDER BY table_name;
