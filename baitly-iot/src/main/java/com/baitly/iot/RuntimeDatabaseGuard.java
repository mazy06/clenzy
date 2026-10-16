package com.baitly.iot;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Fails closed in the hardened profile. Network isolation remains an infrastructure requirement. */
@Component
@Profile("hardened")
public class RuntimeDatabaseGuard implements InitializingBean {
    private final JdbcTemplate jdbc;
    private final boolean migrationsEnabled;

    public RuntimeDatabaseGuard(JdbcTemplate jdbc, @Value("${spring.liquibase.enabled:true}") boolean migrationsEnabled) {
        this.jdbc = jdbc; this.migrationsEnabled = migrationsEnabled;
    }

    @Override public void afterPropertiesSet() {
        if (migrationsEnabled) reject();
        boolean privileged = Boolean.TRUE.equals(jdbc.queryForObject("""
                SELECT EXISTS (
                  SELECT 1 FROM pg_roles r WHERE r.rolname = current_user
                    AND (r.rolsuper OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication OR r.rolbypassrls)
                ) OR EXISTS (
                  SELECT 1 FROM pg_auth_members WHERE member = (SELECT oid FROM pg_roles WHERE rolname = current_user)
                ) OR session_user <> current_user
                  OR has_database_privilege(current_database(), 'CREATE')
                  OR has_database_privilege(current_database(), 'TEMPORARY')
                  OR EXISTS (SELECT 1 FROM pg_database WHERE datallowconn
                    AND datname NOT IN (current_database(), 'postgres', 'template0', 'template1')
                    AND has_database_privilege(oid, 'CONNECT'))
                  OR EXISTS (SELECT 1 FROM pg_database WHERE datname = current_database()
                    AND datdba = (SELECT oid FROM pg_roles WHERE rolname = current_user))
                  OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspname !~ '^pg_'
                    AND nspname <> 'information_schema' AND has_schema_privilege(oid, 'CREATE'))
                  OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
                    AND c.relowner = (SELECT oid FROM pg_roles WHERE rolname = current_user))
                  OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                    WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
                    AND (p.proowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)
                      OR (p.prosecdef AND has_function_privilege(p.oid, 'EXECUTE'))))
                """, Boolean.class));
        if (privileged) reject();
        // No access to Liquibase's tables, foreign tables, views or other application tables.
        boolean extraTableAccess = Boolean.TRUE.equals(jdbc.queryForObject("""
                SELECT EXISTS (
                  SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
                    AND c.relkind IN ('r','p','v','m','f')
                    AND NOT (n.nspname = 'public' AND c.relname IN ('baitly_iot_devices','baitly_iot_noise_measurements'))
                    AND (has_table_privilege(c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
                      OR has_any_column_privilege(c.oid, 'SELECT,INSERT,UPDATE,REFERENCES'))
                ) OR has_table_privilege('public.baitly_iot_devices', 'DELETE,TRUNCATE,REFERENCES,TRIGGER')
                  OR has_any_column_privilege('public.baitly_iot_devices', 'REFERENCES')
                  OR has_table_privilege('public.baitly_iot_noise_measurements', 'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
                  OR has_any_column_privilege('public.baitly_iot_noise_measurements', 'UPDATE,REFERENCES')
                """, Boolean.class));
        if (extraTableAccess) reject();
        if (!Boolean.TRUE.equals(jdbc.queryForObject("""
                SELECT has_table_privilege('public.baitly_iot_devices', 'SELECT')
                  AND has_table_privilege('public.baitly_iot_devices', 'INSERT')
                  AND has_table_privilege('public.baitly_iot_devices', 'UPDATE')
                  AND has_table_privilege('public.baitly_iot_noise_measurements', 'SELECT')
                  AND has_table_privilege('public.baitly_iot_noise_measurements', 'INSERT')
                """, Boolean.class))) reject();
    }

    private static void reject() {
        throw new IllegalStateException("Baitly IoT requires an isolated database with a restricted runtime role and separate migrations");
    }
}
