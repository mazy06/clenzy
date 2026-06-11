package com.clenzy.tenant;

import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.orm.jpa.EntityManagerFactoryUtils;
import org.springframework.orm.jpa.EntityManagerHolder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.function.Supplier;

/**
 * Execute une action dans un contexte tenant complet HORS requete HTTP
 * (schedulers, consumers Kafka, threads async).
 *
 * <p>Hors HTTP, {@code TenantFilter} ne s'execute pas : poser uniquement
 * l'orgId sur {@link TenantContext} ne suffit pas, car le filtre Hibernate
 * {@code organizationFilter} (garde-fou central d'isolation multi-tenant)
 * n'est jamais active sur la Session. Ce helper aligne l'isolation des
 * traitements batch sur celle des requetes HTTP :</p>
 *
 * <ol>
 *   <li>pose l'orgId sur le {@link TenantContext} du thread courant ;</li>
 *   <li>lie un {@link EntityManager} au thread (pattern OpenEntityManagerInView)
 *       pour que les methodes {@code @Transactional} appelees pendant l'action
 *       reutilisent la MEME Session Hibernate ({@code open-in-view=false} :
 *       sans cette liaison, chaque transaction ouvrirait une Session vierge
 *       sans le filtre) ;</li>
 *   <li>active {@code organizationFilter} sur cette Session ;</li>
 *   <li>nettoie TOUT en {@code finally} : unbind + close de l'EntityManager,
 *       {@code TenantContext.clear()} (contrat de securite ThreadLocal —
 *       le thread est partage, ex. pool sched-*).</li>
 * </ol>
 *
 * <p>Les appels imbriques ne sont pas supportes : si un contexte tenant est
 * deja pose sur le thread, l'appel est rejete (fail-loud plutot que fuite
 * silencieuse cross-tenant).</p>
 */
@Component
public class TenantScopedExecutor {

    public static final String ORGANIZATION_FILTER = "organizationFilter";
    public static final String ORG_ID_PARAM = "orgId";

    private static final Logger log = LoggerFactory.getLogger(TenantScopedExecutor.class);

    private final TenantContext tenantContext;
    private final EntityManagerFactory entityManagerFactory;

    public TenantScopedExecutor(TenantContext tenantContext, EntityManagerFactory entityManagerFactory) {
        this.tenantContext = tenantContext;
        this.entityManagerFactory = entityManagerFactory;
    }

    /**
     * Variante sans valeur de retour de {@link #callAsOrganization(Long, Supplier)}.
     */
    public void runAsOrganization(Long organizationId, Runnable action) {
        callAsOrganization(organizationId, () -> {
            action.run();
            return null;
        });
    }

    /**
     * Execute {@code action} avec le contexte tenant de {@code organizationId} :
     * TenantContext pose + filtre Hibernate {@code organizationFilter} actif sur
     * la Session liee au thread pour toute la duree de l'action.
     *
     * @throws IllegalArgumentException si {@code organizationId} est null
     * @throws IllegalStateException    si un contexte tenant est deja pose
     *                                  sur le thread (appel imbrique)
     */
    public <T> T callAsOrganization(Long organizationId, Supplier<T> action) {
        if (organizationId == null) {
            throw new IllegalArgumentException(
                    "organizationId est requis pour une execution tenant-scoped");
        }
        if (tenantContext.getOrganizationId() != null) {
            throw new IllegalStateException(
                    "TenantScopedExecutor: un contexte tenant est deja pose sur ce thread "
                            + "(orgId=" + tenantContext.getOrganizationId()
                            + "), appels imbriques non supportes");
        }

        EntityManagerHolder existingHolder =
                (EntityManagerHolder) TransactionSynchronizationManager.getResource(entityManagerFactory);

        EntityManager entityManager = null;
        boolean created = false;
        boolean bound = false;
        try {
            tenantContext.setOrganizationId(organizationId);
            tenantContext.setSuperAdmin(false);
            tenantContext.setSystemOrg(false);

            if (existingHolder == null) {
                entityManager = entityManagerFactory.createEntityManager();
                created = true;
                TransactionSynchronizationManager.bindResource(
                        entityManagerFactory, new EntityManagerHolder(entityManager));
                bound = true;
            } else {
                // Un EntityManager est deja lie (ex: appel depuis une transaction
                // en cours) : on active le filtre sur sa Session et on le
                // desactivera en sortie sans fermer cet EntityManager.
                entityManager = existingHolder.getEntityManager();
            }

            entityManager.unwrap(Session.class)
                    .enableFilter(ORGANIZATION_FILTER)
                    .setParameter(ORG_ID_PARAM, organizationId);

            return action.get();
        } finally {
            if (bound) {
                TransactionSynchronizationManager.unbindResource(entityManagerFactory);
            }
            if (created) {
                EntityManagerFactoryUtils.closeEntityManager(entityManager);
            } else if (entityManager != null) {
                disableFilterQuietly(entityManager, organizationId);
            }
            tenantContext.clear();
        }
    }

    private void disableFilterQuietly(EntityManager entityManager, Long organizationId) {
        try {
            entityManager.unwrap(Session.class).disableFilter(ORGANIZATION_FILTER);
        } catch (RuntimeException e) {
            log.warn("TenantScopedExecutor: impossible de desactiver le filtre {} apres l'execution orgId={}: {}",
                    ORGANIZATION_FILTER, organizationId, e.getMessage());
        }
    }
}
