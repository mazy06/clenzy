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

    /**
     * Mode strict : refuse le bypass <b>implicite</b> accordé à un thread sans contexte tenant.
     *
     * <p>Audit 2026-07, défaut R3 : la règle {@code bypass = … || org == null} exempte de RLS
     * <b>toute</b> exécution dépourvue de contexte tenant — soit l'intégralité de
     * {@code /api/public/**} (exclu du {@code TenantFilter}), les 18 consumers Kafka et les
     * schedulers financiers. Le filet ne couvrait donc précisément pas les surfaces où
     * l'audit a trouvé les fuites cross-tenant.</p>
     *
     * <p><b>Opt-in, défaut {@code false}</b> : activer ce mode avant d'avoir donné un contexte
     * tenant à ces chemins (REM-S1-05 — {@code TenantScopedExecutor} sur les consumers,
     * scoping de la surface publique) ne produirait pas une fuite mais un <b>outage</b> :
     * sans {@code app.current_org} ni bypass, la policy ne matche aucune ligne. Le mécanisme
     * de fermeture est ici, testé ; son activation attend que les chemins soient scopés.</p>
     *
     * <p>Le bypass <b>explicite</b> (staff plateforme, organisation SYSTEM) n'est jamais
     * affecté : le mode strict ne ferme que l'exemption accidentelle.</p>
     */
    private static volatile boolean strictContext = false;

    private RlsGuc() {
    }

    /** Voir {@link #strictContext}. Piloté par {@code clenzy.security.rls.strict-context}. */
    public static void setStrictContext(boolean strict) {
        strictContext = strict;
    }

    public static boolean isStrictContext() {
        return strictContext;
    }

    public static void apply(EntityManager em, TenantContext ctx) {
        final Long org = ctx.getOrganizationId();
        // Bypass EXPLICITE : décision métier assumée (staff plateforme, org SYSTEM).
        final boolean explicitBypass = ctx.isSuperAdmin() || ctx.isSystemOrg();
        // Bypass IMPLICITE : simple absence de contexte tenant — accordé par défaut pour ne pas
        // casser les exécutions internes, refusé en mode strict (défaut R3).
        final boolean implicitBypass = org == null && !strictContext;
        final boolean bypass = explicitBypass || implicitBypass;
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
