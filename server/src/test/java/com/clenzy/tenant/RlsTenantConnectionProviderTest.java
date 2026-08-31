package com.clenzy.tenant;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Verrouille le contrat de {@link RlsTenantConnectionProvider} : le contexte tenant est
 * ecrit sur <b>chaque</b> connexion empruntee, et une connexion qui n'a pas pu l'etre ne
 * retourne jamais au pool.
 *
 * <p>Ces deux proprietes ne sont pas des details d'implementation. La premiere est ce qui
 * empeche une connexion de servir la requete suivante avec le contexte de son emprunteur
 * precedent — une GUC de session survit au retour dans le pool, donc seule l'ecriture
 * inconditionnelle protege. La seconde est ce qui transforme un echec d'ecriture en panne
 * franche plutot qu'en lecture cross-tenant silencieuse.</p>
 */
class RlsTenantConnectionProviderTest {

    private DataSource dataSource;
    private Connection connection;
    private PreparedStatement statement;
    private TenantContext tenantContext;
    private RlsTenantConnectionProvider provider;

    /** Parametres reellement transmis a PostgreSQL, dans l'ordre (1 = org, 2 = bypass). */
    private List<String> parametres;

    @BeforeEach
    void setUp() throws SQLException {
        parametres = new ArrayList<>();
        dataSource = mock(DataSource.class);
        connection = mock(Connection.class);
        statement = mock(PreparedStatement.class);
        tenantContext = new TenantContext();

        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.prepareStatement(anyString())).thenReturn(statement);
        when(statement.execute()).thenReturn(true);
        // setString(index, valeur) : on ne garde que la valeur, l'ordre suffit a les distinguer.
        org.mockito.Mockito.doAnswer(call -> {
            parametres.add(call.getArgument(1));
            return null;
        }).when(statement).setString(anyInt(), anyString());

        provider = new RlsTenantConnectionProvider(dataSource, tenantContext);
    }

    @AfterEach
    void tearDown() {
        tenantContext.clear();
        RlsGuc.setStrictContext(false);
        RlsGuc.setPoseeParConnexion(false);
    }

    @Test
    @DisplayName("organisation presente : elle est posee sur la connexion, sans bypass")
    void avecOrganisation_poseLOrgSansBypass() throws SQLException {
        tenantContext.setOrganizationId(42L);

        Connection empruntee = provider.getConnection();

        assertThat(empruntee).isSameAs(connection);
        assertThat(parametres).containsExactly("42", "off");
    }

    @Test
    @DisplayName("staff plateforme : bypass explicite pose sur la connexion")
    void staffPlateforme_bypassExplicite() throws SQLException {
        tenantContext.setOrganizationId(42L);
        tenantContext.setSuperAdmin(true);

        provider.getConnection();

        assertThat(parametres).containsExactly("42", "on");
    }

    @Test
    @DisplayName("sans contexte tenant, les GUC sont posees quand meme (chaine vide + bypass)")
    void sansContexte_ecritureQuandMeme() throws SQLException {
        // Le cas critique : sauter l'ecriture ici laisserait la connexion porter le
        // contexte de son emprunteur precedent — exactement la fuite que ce provider evite.
        provider.getConnection();

        assertThat(parametres).containsExactly("", "on");
        verify(statement, times(1)).execute();
    }

    @Test
    @DisplayName("mode strict : l'absence de contexte ne vaut plus bypass")
    void modeStrict_pasDeBypassImplicite() throws SQLException {
        RlsGuc.setStrictContext(true);

        provider.getConnection();

        assertThat(parametres).containsExactly("", "off");
    }

    @Test
    @DisplayName("echec de l'ecriture : la connexion est refermee et l'erreur remonte")
    void echecEcriture_connexionRefermee() throws SQLException {
        when(statement.execute()).thenThrow(new SQLException("contexte non pose"));
        tenantContext.setOrganizationId(42L);

        assertThatThrownBy(() -> provider.getConnection())
                .isInstanceOf(SQLException.class)
                .hasMessage("contexte non pose");

        // Rendre cette connexion au pool la ferait servir la requete suivante avec le
        // contexte de l'emprunteur precedent.
        verify(connection).close();
    }

    @Test
    @DisplayName("liberation agressive refusee : la transaction garde sa connexion contextualisee")
    void pasDeLiberationAgressive() {
        assertThat(provider.supportsAggressiveRelease()).isFalse();
    }

    @Test
    @DisplayName("closeConnection referme, sans rien reecrire")
    void closeConnection_refermeSimplement() throws SQLException {
        provider.closeConnection(connection);

        verify(connection).close();
        verify(connection, never()).prepareStatement(anyString());
    }
}
