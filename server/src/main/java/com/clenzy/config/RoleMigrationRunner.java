package com.clenzy.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

/**
 * Migre les anciens roles ADMIN/MANAGER vers SUPER_ADMIN/SUPER_MANAGER en base
 * au demarrage de l'application (AVANT toute requete JPA).
 *
 * Necessaire car :
 *   - L'enum UserRole n'a plus ADMIN/MANAGER
 *   - Hibernate crashe si la colonne role contient une valeur absente de l'enum
 *   - Les migrations Flyway ne sont pas utilisees en dev (ddl-auto: update)
 *
 * Idempotent : ne fait rien si aucun utilisateur n'a les anciens roles.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RoleMigrationRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(RoleMigrationRunner.class);

    private final DataSource dataSource;

    public RoleMigrationRunner(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public void run(ApplicationArguments args) {
        try (Connection conn = dataSource.getConnection()) {
            // 0. Supprimer l'ancienne contrainte CHECK si elle bloque la migration
            //    (peut contenir seulement les anciens roles ADMIN/MANAGER)
            dropCheckConstraintIfExists(conn);

            // 1. Migrer users.role ADMIN -> SUPER_ADMIN
            int adminCount = executeUpdate(conn,
                    "UPDATE users SET role = 'SUPER_ADMIN' WHERE role = 'ADMIN'");
            if (adminCount > 0) {
                log.warn("Migration: {} utilisateur(s) migre(s) de ADMIN vers SUPER_ADMIN", adminCount);
            }

            // 2. Migrer users.role MANAGER -> SUPER_MANAGER
            int managerCount = executeUpdate(conn,
                    "UPDATE users SET role = 'SUPER_MANAGER' WHERE role = 'MANAGER'");
            if (managerCount > 0) {
                log.warn("Migration: {} utilisateur(s) migre(s) de MANAGER vers SUPER_MANAGER", managerCount);
            }

            // 3. Recreer la contrainte CHECK avec les nouveaux roles
            recreateCheckConstraint(conn);

            // 4. Supprimer les anciens roles de la table roles (si elle existe)
            if (tableExists(conn, "roles")) {
                // Supprimer les role_permissions associees d'abord
                if (tableExists(conn, "role_permissions")) {
                    int rpDeleted = executeUpdate(conn,
                            "DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE name IN ('ADMIN', 'MANAGER'))");
                    if (rpDeleted > 0) {
                        log.info("Migration: {} role_permissions supprimee(s) pour ADMIN/MANAGER", rpDeleted);
                    }
                }

                int rolesDeleted = executeUpdate(conn,
                        "DELETE FROM roles WHERE name IN ('ADMIN', 'MANAGER')");
                if (rolesDeleted > 0) {
                    log.info("Migration: {} ancien(s) role(s) supprime(s) de la table roles", rolesDeleted);
                }
            }

            if (adminCount > 0 || managerCount > 0) {
                log.info("Migration des roles terminee avec succes");
            } else {
                log.debug("RoleMigrationRunner: aucune migration necessaire");
            }

        } catch (Exception e) {
            log.error("Erreur lors de la migration des roles: {}", e.getMessage(), e);
            // Ne pas bloquer le demarrage — le PermissionInitializer gerera les cas restants
        }
    }

    /**
     * Supprime la contrainte CHECK sur users.role si elle existe.
     * Necessaire car l'ancienne contrainte peut bloquer l'UPDATE vers SUPER_ADMIN.
     */
    private void dropCheckConstraintIfExists(Connection conn) {
        try {
            executeUpdate(conn,
                    "DO $$ BEGIN " +
                    "IF EXISTS (SELECT 1 FROM information_schema.constraint_column_usage " +
                    "WHERE table_name = 'users' AND constraint_name = 'users_role_check') THEN " +
                    "ALTER TABLE users DROP CONSTRAINT users_role_check; " +
                    "END IF; " +
                    "END $$");
            log.debug("RoleMigrationRunner: ancienne contrainte CHECK supprimee (si existante)");
        } catch (Exception e) {
            log.debug("RoleMigrationRunner: pas de contrainte CHECK a supprimer: {}", e.getMessage());
        }
    }

    /**
     * Recree la contrainte CHECK avec les nouveaux roles autorises.
     */
    private void recreateCheckConstraint(Connection conn) {
        try {
            executeUpdate(conn,
                    "DO $$ BEGIN " +
                    "IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage " +
                    "WHERE table_name = 'users' AND constraint_name = 'users_role_check') THEN " +
                    "ALTER TABLE users ADD CONSTRAINT users_role_check " +
                    "CHECK (role IN ('SUPER_ADMIN', 'SUPER_MANAGER', 'HOST', 'TECHNICIAN', " +
                    "'HOUSEKEEPER', 'SUPERVISOR', 'LAUNDRY', 'EXTERIOR_TECH')); " +
                    "END IF; " +
                    "END $$");
            log.debug("RoleMigrationRunner: contrainte CHECK recreee avec les nouveaux roles");
        } catch (Exception e) {
            log.warn("RoleMigrationRunner: impossible de recreer la contrainte CHECK: {}", e.getMessage());
        }
    }

    private int executeUpdate(Connection conn, String sql) throws Exception {
        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            return stmt.executeUpdate();
        }
    }

    private boolean tableExists(Connection conn, String tableName) {
        try (ResultSet rs = conn.getMetaData().getTables(null, null, tableName, null)) {
            return rs.next();
        } catch (Exception e) {
            return false;
        }
    }
}
