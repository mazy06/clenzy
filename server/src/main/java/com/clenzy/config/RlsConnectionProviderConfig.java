package com.clenzy.config;

import com.clenzy.tenant.RlsGuc;
import com.clenzy.tenant.RlsTenantConnectionProvider;
import com.clenzy.tenant.TenantContext;
import org.hibernate.cfg.AvailableSettings;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;

/**
 * Installe {@link RlsTenantConnectionProvider} — le contexte tenant est pose a la prise de
 * connexion plutot qu'a l'ouverture d'une transaction applicative. Audit securite
 * 2026-07-26, plan REM-T-01.
 *
 * <h2>Ce que ce montage change</h2>
 * <p>La couverture des GUC cesse de dependre de la presence d'un {@code @Transactional} au
 * bon endroit. Les 34 chemins recenses par l'inventaire — scanners de supervision,
 * rotation des codes d'acces, push CRS Channex — passaient a cote du pointcut de
 * {@code RlsTenantGucAspect} par construction, pas par negligence : ils enchainent des
 * appels LLM ou des effets externes, qu'une transaction ne doit jamais englober. Ils sont
 * desormais couverts sans etre modifies.</p>
 *
 * <h2>Consequence sur l'instrumentation de mesure</h2>
 * <p>{@code RlsMissingGucInspector} devient <b>silencieux par construction</b> pour tout le
 * trafic JPA : {@link RlsGuc#setPoseeParConnexion} lui apprend qu'aucune connexion ne peut
 * plus arriver sans contexte. Ce n'est pas une mise en sourdine, c'est la disparition de ce
 * qu'il mesurait. En contrepartie, il ne detecte plus rien : le risque residuel a surveiller
 * n'est plus « GUC absente » (impossible) mais « GUC posee en bypass alors qu'un tenant
 * etait attendu » — un thread de fond qui a perdu son contexte. Cette detection-la reste a
 * ecrire ; l'inventaire actuel ne la couvre pas.</p>
 *
 * <h2>Ordre de bascule</h2>
 * <p>Ce provider n'est installe que si {@code clenzy.security.rls.enabled=true}. Poser ce
 * drapeau reste sans effet visible tant que le contexte Liquibase {@code rls} n'applique
 * pas les politiques du changeset {@code 0345} : aucune policy ne lit ces GUC. L'inverse —
 * politiques appliquees sans le drapeau — viderait les ecrans. Voir
 * {@code docs/security/RLS-ROLLOUT-RUNBOOK.md}.</p>
 */
@Configuration
public class RlsConnectionProviderConfig {

    private static final Logger log = LoggerFactory.getLogger(RlsConnectionProviderConfig.class);

    /**
     * {@code ObjectProvider} plutot qu'une injection directe : la {@code DataSource} n'est
     * resolue qu'au moment ou Hibernate construit ses proprietes, pas a la creation de ce
     * bean de configuration.
     */
    @Bean
    HibernatePropertiesCustomizer rlsTenantConnectionProviderCustomizer(
            ObjectProvider<DataSource> dataSource,
            TenantContext tenantContext,
            @Value("${clenzy.security.rls.enabled:false}") boolean rlsEnabled) {

        if (!rlsEnabled) {
            // Drapeau a false : Hibernate garde son provider par defaut, zero surcout,
            // zero changement de comportement.
            return properties -> { };
        }

        return properties -> {
            // Hibernate accepte une INSTANCE sous cette cle et la retourne telle quelle,
            // avant meme de regarder `hibernate.connection.datasource`
            // (ConnectionProviderInitiator). C'est ce qui permet de lui passer un provider
            // deja porteur du TenantContext de Spring.
            properties.put(AvailableSettings.CONNECTION_PROVIDER,
                    new RlsTenantConnectionProvider(dataSource.getObject(), tenantContext));
            RlsGuc.setPoseeParConnexion(true);
            log.info("RLS : contexte tenant pose a la prise de connexion — la couverture ne "
                    + "depend plus de la presence d'un @Transactional dans com.clenzy.");
        };
    }
}
