package com.clenzy.tenant;

import jakarta.persistence.EntityManager;

/**
 * Pose les variables de session PostgreSQL (GUC) utilisées par la Row-Level Security
 * multi-tenant (audit sécurité 2026-07, F1-STRUCT).
 *
 * <ul>
 *   <li>{@code app.current_org} : l'organisation courante (vide si absente).</li>
 *   <li>{@code app.bypass_rls} : {@code on} pour le staff plateforme, les org SYSTEM,
 *       ET les threads background <b>sans</b> contexte tenant (exécution interne non
 *       tenant-scopée — même exemption qu'aujourd'hui où aucun filtre n'est actif).</li>
 * </ul>
 *
 * <p>Les GUC sont posées en <b>LOCAL</b> (transaction-scoped, {@code set_config(..., true)}) :
 * elles s'auto-réinitialisent au commit/rollback → aucune fuite entre connexions poolées.
 * Doit donc être appelé <b>à l'intérieur</b> d'une transaction (cf. {@link RlsTenantGucAspect}).</p>
 *
 * <p><b>Inerte tant que la RLS n'est pas activée</b> : les policies (changeset 0345) ne sont
 * pas câblées dans {@code db.changelog-master.yaml} et l'aspect est gardé par le flag
 * {@code clenzy.security.rls.enabled} (défaut {@code false}). Voir
 * {@code docs/security/RLS-ROLLOUT-RUNBOOK.md}.</p>
 */
public final class RlsGuc {

    private RlsGuc() {
    }

    public static void apply(EntityManager em, TenantContext ctx) {
        final Long org = ctx.getOrganizationId();
        final boolean bypass = ctx.isSuperAdmin() || ctx.isSystemOrg() || org == null;
        try {
            em.createNativeQuery("select set_config('app.current_org', :org, true)")
                    .setParameter("org", org == null ? "" : org.toString())
                    .getSingleResult();
            em.createNativeQuery("select set_config('app.bypass_rls', :bypass, true)")
                    .setParameter("bypass", bypass ? "on" : "off")
                    .getSingleResult();
        } catch (RuntimeException e) {
            // Pas de transaction/connexion liée (ne devrait pas arriver sous @Transactional) :
            // on NE relance PAS — la pose de GUC ne doit jamais casser une opération métier.
            // NB : si la GUC n'est pas posée alors que la RLS est active, les requêtes
            // renverront 0 ligne (fail-closed visible en staging), pas une fuite.
        }
    }
}
