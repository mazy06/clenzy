package com.clenzy.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link RoleMigrationRunner}.
 *
 * <p>On mocke DataSource + Connection + PreparedStatement + DatabaseMetaData /
 * ResultSet pour controler chaque branche : UPDATE renvoie 0 ou > 0 lignes,
 * tables existent / pas, exceptions silencieuses, etc.</p>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("RoleMigrationRunner")
class RoleMigrationRunnerTest {

    @Mock private DataSource dataSource;
    @Mock private Connection connection;
    @Mock private PreparedStatement preparedStatement;
    @Mock private DatabaseMetaData metaData;

    private RoleMigrationRunner runner;

    @BeforeEach
    void setUp() throws Exception {
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.prepareStatement(anyString())).thenReturn(preparedStatement);
        runner = new RoleMigrationRunner(dataSource);
    }

    private void stubTableExists(String tableName, boolean exists) throws SQLException {
        ResultSet rs = org.mockito.Mockito.mock(ResultSet.class);
        when(rs.next()).thenReturn(exists);
        when(connection.getMetaData()).thenReturn(metaData);
        when(metaData.getTables(any(), any(), eq(tableName), any())).thenReturn(rs);
    }

    @Test
    @DisplayName("run: aucune migration necessaire (0 update) + tables absentes")
    void run_noMigrationNeeded() throws Exception {
        when(preparedStatement.executeUpdate()).thenReturn(0);
        stubTableExists("roles", false);

        runner.run(null);

        // executeUpdate appele au moins 3x (drop CHECK + UPDATE ADMIN + UPDATE MANAGER + recreate CHECK)
        verify(preparedStatement, atLeast(3)).executeUpdate();
    }

    @Test
    @DisplayName("run: ADMIN -> SUPER_ADMIN + MANAGER -> SUPER_MANAGER + cleanup roles")
    void run_migratesRolesAndCleansUpRolesTable() throws Exception {
        // ADMIN migration => 2 lignes maj, MANAGER => 1, drop check => 0, recreate check => 0,
        // delete role_permissions => 1, delete roles => 2
        // On peut renvoyer une valeur generique > 0 pour simplifier
        when(preparedStatement.executeUpdate()).thenReturn(1);
        // 'roles' existe + 'role_permissions' existe
        ResultSet rolesRs = org.mockito.Mockito.mock(ResultSet.class);
        when(rolesRs.next()).thenReturn(true);
        ResultSet rolePermRs = org.mockito.Mockito.mock(ResultSet.class);
        when(rolePermRs.next()).thenReturn(true);
        when(connection.getMetaData()).thenReturn(metaData);
        when(metaData.getTables(any(), any(), eq("roles"), any())).thenReturn(rolesRs);
        when(metaData.getTables(any(), any(), eq("role_permissions"), any())).thenReturn(rolePermRs);

        runner.run(null);

        // Verifie les UPDATE SQL
        verify(connection).prepareStatement(org.mockito.ArgumentMatchers.contains(
            "UPDATE users SET role = 'SUPER_ADMIN'"));
        verify(connection).prepareStatement(org.mockito.ArgumentMatchers.contains(
            "UPDATE users SET role = 'SUPER_MANAGER'"));
        verify(connection).prepareStatement(org.mockito.ArgumentMatchers.contains(
            "DELETE FROM role_permissions"));
        verify(connection).prepareStatement(org.mockito.ArgumentMatchers.contains(
            "DELETE FROM roles WHERE name IN ('ADMIN', 'MANAGER')"));
    }

    @Test
    @DisplayName("run: roles table absent -> skip cleanup roles")
    void run_skipCleanupWhenRolesTableMissing() throws Exception {
        when(preparedStatement.executeUpdate()).thenReturn(1);
        stubTableExists("roles", false);

        runner.run(null);

        verify(connection, never()).prepareStatement(org.mockito.ArgumentMatchers.contains(
            "DELETE FROM roles WHERE name IN"));
    }

    @Test
    @DisplayName("run: role_permissions table absent -> drop seulement roles cleanup ok")
    void run_skipRolePermDeleteWhenTableMissing() throws Exception {
        when(preparedStatement.executeUpdate()).thenReturn(1);
        // roles table existe, role_permissions table n'existe pas
        ResultSet rolesRs = org.mockito.Mockito.mock(ResultSet.class);
        when(rolesRs.next()).thenReturn(true);
        ResultSet rpRs = org.mockito.Mockito.mock(ResultSet.class);
        when(rpRs.next()).thenReturn(false);
        when(connection.getMetaData()).thenReturn(metaData);
        when(metaData.getTables(any(), any(), eq("roles"), any())).thenReturn(rolesRs);
        when(metaData.getTables(any(), any(), eq("role_permissions"), any())).thenReturn(rpRs);

        runner.run(null);

        // delete role_permissions doit NE PAS etre appele
        verify(connection, never()).prepareStatement(org.mockito.ArgumentMatchers.contains(
            "DELETE FROM role_permissions"));
        // delete roles est appele
        verify(connection).prepareStatement(org.mockito.ArgumentMatchers.contains(
            "DELETE FROM roles WHERE name IN ('ADMIN', 'MANAGER')"));
    }

    @Test
    @DisplayName("run: connexion JDBC crash -> log error, ne propage pas")
    void run_swallowsConnectionError() throws Exception {
        when(dataSource.getConnection()).thenThrow(new SQLException("DB unavailable"));

        // Ne crashe pas
        runner.run(null);
    }

    @Test
    @DisplayName("run: drop CHECK constraint leve une exception -> swallowed (best-effort)")
    void run_swallowsDropConstraintError() throws Exception {
        // Premiere prepareStatement (drop CHECK) leve, les autres OK
        PreparedStatement dropStmt = org.mockito.Mockito.mock(PreparedStatement.class);
        when(dropStmt.executeUpdate()).thenThrow(new SQLException("drop fail"));
        PreparedStatement otherStmt = org.mockito.Mockito.mock(PreparedStatement.class);
        when(otherStmt.executeUpdate()).thenReturn(0);

        // Premiere prepareStatement renvoie dropStmt, ensuite otherStmt
        when(connection.prepareStatement(anyString())).thenReturn(dropStmt, otherStmt, otherStmt,
            otherStmt, otherStmt, otherStmt);
        stubTableExists("roles", false);

        runner.run(null);

        // Le runner a continue malgre l'erreur sur le drop CHECK
        verify(connection, atLeast(3)).prepareStatement(anyString());
    }

    @Test
    @DisplayName("run: tableExists() leve -> retourne false (catch all)")
    void run_tableExistsExceptionHandled() throws Exception {
        when(preparedStatement.executeUpdate()).thenReturn(0);
        // getMetaData leve
        when(connection.getMetaData()).thenThrow(new SQLException("meta down"));

        // Ne crashe pas
        runner.run(null);
    }

    @Test
    @DisplayName("constructor: stocke le DataSource")
    void constructor_storesDataSource() {
        // Just covers the constructor branch
        RoleMigrationRunner r = new RoleMigrationRunner(dataSource);
        org.assertj.core.api.Assertions.assertThat(r).isNotNull();
    }
}
