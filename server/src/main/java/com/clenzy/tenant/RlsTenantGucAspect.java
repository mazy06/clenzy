package com.clenzy.tenant;

import jakarta.persistence.EntityManager;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Pose les GUC PostgreSQL de tenant ({@link RlsGuc}) au début de chaque méthode
 * {@code @Transactional} du code applicatif, pour la Row-Level Security multi-tenant
 * (audit sécurité 2026-07, F1-STRUCT). C'est le filet qui rattrape un {@code findById}
 * ou une requête non scopée que le filtre Hibernate (inerte en HTTP) et une garde
 * d'ownership oubliée laisseraient passer.
 *
 * <p><b>INERTE par défaut</b> : gardé par {@code clenzy.security.rls.enabled}
 * (défaut {@code false}). Tant que la RLS n'est pas activée (changeset 0345 non câblé
 * dans le master changelog), aucun {@code set_config} n'est émis → zéro overhead,
 * zéro changement de comportement. Rollout stagé : {@code docs/security/RLS-ROLLOUT-RUNBOOK.md}.</p>
 *
 * <p><b>Ordre</b> : {@code LOWEST_PRECEDENCE} pour s'exécuter au plus profond, donc
 * <b>après</b> l'ouverture de transaction par Spring (sinon {@code set_config(..., true)}
 * LOCAL n'aurait pas de transaction où s'appliquer). Ce positionnement DOIT être validé
 * en staging (une GUC non posée = requêtes vides, visible immédiatement).</p>
 *
 * <p><b>Couverture connue (à valider en staging)</b> : l'aspect cible les méthodes
 * {@code @Transactional} de {@code com.clenzy}. Les accès repository Spring Data appelés
 * <b>directement</b> hors d'un service applicatif @Transactional (rare) ne sont pas couverts
 * par ce pointcut — la cible robuste long terme est un {@code ConnectionProvider} Hibernate
 * posant la GUC au checkout de connexion.</p>
 */
@Aspect
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class RlsTenantGucAspect {

    private final EntityManager entityManager;
    private final TenantContext tenantContext;
    private final boolean rlsEnabled;

    public RlsTenantGucAspect(EntityManager entityManager,
                              TenantContext tenantContext,
                              @Value("${clenzy.security.rls.enabled:false}") boolean rlsEnabled) {
        this.entityManager = entityManager;
        this.tenantContext = tenantContext;
        this.rlsEnabled = rlsEnabled;
    }

    @Before("@annotation(org.springframework.transaction.annotation.Transactional) && within(com.clenzy..*)")
    public void applyTenantGuc() {
        if (!rlsEnabled) {
            return;
        }
        RlsGuc.apply(entityManager, tenantContext);
    }
}
