SELECT current_user AS role,
       current_setting('transaction_read_only') AS transaction_read_only,
       has_database_privilege(current_user, current_database(), 'TEMP') AS database_temp,
       has_database_privilege(current_user, current_database(), 'CREATE') AS database_create,
       coalesce(bool_or(has_table_privilege(current_user,
         format('%I.%I', schemaname, tablename),
         'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER')), false) AS any_table_write
FROM pg_tables
WHERE schemaname = 'public'
GROUP BY current_user;
