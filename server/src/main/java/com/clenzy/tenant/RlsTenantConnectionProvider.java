package com.clenzy.tenant;

import org.hibernate.engine.jdbc.connections.spi.ConnectionProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;

/**
 * Pose le contexte tenant PostgreSQL ({@link RlsGuc}) a la <b>prise de connexion</b> — et non
 * a l'ouverture d'une transaction applicative. Audit securite 2026-07-26, plan REM-T-01.
 *
 * <h2>Le trou que ce provider ferme</h2>
 * <p>{@link RlsTenantGucAspect} ne pose les GUC que sur les methodes {@code @Transactional}
 * de {@code com.clenzy}. Un bean non transactionnel qui appelle un repository directement
 * ouvre sa transaction dans {@code SimpleJpaRepository} — paquet {@code org.springframework},
 * hors du pointcut. Aucune GUC n'est alors posee, et sous RLS active la requete renvoie
 * <b>zero ligne sans lever d'erreur</b>.</p>
 *
 * <p>Ce n'etait pas un oubli ponctuel mais une propriete structurelle : les scanners de
 * supervision enchainent des appels LLM et les executeurs de cartes des effets externes —
 * ni les uns ni les autres ne peuvent porter une transaction. L'inventaire du 2026-08 en a
 * recense 34 chemins, dont la rotation des codes d'acces (272 occurrences) et dix scanners.
 * Les corriger un a un les aurait fermes ce jour-la, sans rien empecher du trente-cinquieme.</p>
 *
 * <h2>Pourquoi la connexion est le bon point de pose</h2>
 * <p>Aucune requete JPA n'atteint PostgreSQL sans emprunter une connexion ici. Poser les GUC
 * a cet endroit rend la couverture <b>structurelle</b> plutot que declarative : elle ne
 * depend plus de la presence d'une annotation au bon endroit. C'est la cible que le runbook
 * {@code docs/security/RLS-ROLLOUT-RUNBOOK.md} designait deja comme « robuste long terme ».</p>
 *
 * <p>{@link RlsTenantGucAspect} reste en place et garde son utilite : ses GUC sont LOCAL
 * (portee transaction) et refletent le contexte au moment ou la transaction s'ouvre. Quand
 * un flux change d'organisation en cours de connexion — {@code TenantScopedExecutor} dans
 * une boucle, par exemple — c'est l'aspect qui reajuste, tandis que la connexion garde la
 * valeur de son emprunt. Les deux lisent {@link RlsGuc#valeursPour} : ils ne peuvent pas
 * diverger.</p>
 *
 * <h2>Cout</h2>
 * <p>Un aller-retour SQL par <b>emprunt de connexion</b> — pas par requete. Le mode de
 * gestion par defaut de Hibernate ({@code DELAYED_ACQUISITION_AND_RELEASE_AFTER_TRANSACTION})
 * garde la connexion le temps de la transaction : le cout est donc d'une instruction par
 * transaction, les deux GUC etant posees d'un seul appel. Inerte quand
 * {@code clenzy.security.rls.enabled=false} : le provider n'est alors pas installe du tout.</p>
 *
 * @see RlsGuc#applySession(Connection, TenantContext)
 */
public class RlsTenantConnectionProvider implements ConnectionProvider {

    private static final Logger log = LoggerFactory.getLogger(RlsTenantConnectionProvider.class);

    private final DataSource dataSource;
    private final TenantContext tenantContext;

    public RlsTenantConnectionProvider(DataSource dataSource, TenantContext tenantContext) {
        this.dataSource = dataSource;
        this.tenantContext = tenantContext;
    }

    /**
     * Emprunte une connexion et y ecrit le contexte tenant du thread appelant.
     *
     * <p>Si l'ecriture echoue, la connexion est <b>refermee</b> avant que l'exception ne
     * remonte : la rendre au pool sans contexte pose la ferait servir la requete suivante
     * avec le contexte de son emprunteur precedent. Le pool ouvrira une autre connexion ;
     * une panne franche vaut mieux qu'une lecture cross-tenant silencieuse.</p>
     */
    @Override
    public Connection getConnection() throws SQLException {
        final Connection connection = dataSource.getConnection();
        try {
            RlsGuc.applySession(connection, tenantContext);
            return connection;
        } catch (SQLException | RuntimeException e) {
            refermer(connection, e);
            throw e;
        }
    }

    @Override
    public void closeConnection(Connection connection) throws SQLException {
        connection.close();
    }

    /**
     * {@code false} : la liberation agressive (rendre la connexion entre deux instructions
     * d'une meme transaction) est reservee aux environnements JTA. C'est aussi ce que
     * repond le provider par defaut de Spring Boot, et ce qui garantit ici qu'une
     * transaction conserve la connexion sur laquelle son contexte a ete pose.
     */
    @Override
    public boolean supportsAggressiveRelease() {
        return false;
    }

    @Override
    public boolean isUnwrappableAs(Class<?> unwrapType) {
        return ConnectionProvider.class.equals(unwrapType)
                || RlsTenantConnectionProvider.class.isAssignableFrom(unwrapType)
                || DataSource.class.isAssignableFrom(unwrapType);
    }

    @Override
    @SuppressWarnings("unchecked")
    public <T> T unwrap(Class<T> unwrapType) {
        if (ConnectionProvider.class.equals(unwrapType)
                || RlsTenantConnectionProvider.class.isAssignableFrom(unwrapType)) {
            return (T) this;
        }
        if (DataSource.class.isAssignableFrom(unwrapType)) {
            return (T) dataSource;
        }
        throw new UnsupportedOperationException("Type non supporte : " + unwrapType);
    }

    /** Fermeture best-effort : l'echec d'origine ne doit pas etre masque par celui-ci. */
    private static void refermer(Connection connection, Exception cause) {
        try {
            connection.close();
        } catch (SQLException fermeture) {
            log.warn("RLS : fermeture de la connexion non contextualisee impossible ({}) — "
                    + "cause initiale : {}", fermeture.getMessage(), cause.getMessage());
        }
    }
}
