package com.clenzy.service.access;

import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

/**
 * Garde d'isolation d'organisation unique et <b>fail-closed</b>.
 *
 * <p>Remplace les 7 copies dupliquees de {@code requireSameOrganization}
 * (SmartLockService, DocumentAccessService, PropertyService,
 * PropertyController, StripeService, InterventionPaymentService,
 * RateManagerService) qui etaient toutes <b>fail-open</b> : elles ne
 * rejetaient l'acces que si les DEUX org (tenant + entite) etaient non-NULL
 * et differentes. Couple aux {@code organization_id} NULL legacy, ce
 * comportement ouvrait un IDOR cross-org exploitable (audit SECU9-ORGID).</p>
 *
 * <h2>Semantique fail-closed</h2>
 * <ol>
 *   <li><b>Bypass</b> du staff plateforme (SUPER_ADMIN/SUPER_MANAGER) et des
 *       orgs SYSTEM — memes exemptions que le filtre Hibernate
 *       {@code organizationFilter} (cf. {@code TenantFilter}), que
 *       {@code findById} ne traverse pas.</li>
 *   <li>Sinon, on <b>refuse</b> des qu'un doute subsiste : tenant org NULL,
 *       entite org NULL, ou orgs differentes.</li>
 * </ol>
 *
 * <p>Modele fail-closed imite : {@code UserService.requireSameOrganizationOrSelf}.</p>
 */
@Component
public class OrganizationAccessGuard {

    private final TenantContext tenantContext;

    public OrganizationAccessGuard(TenantContext tenantContext) {
        this.tenantContext = tenantContext;
    }

    /**
     * Refuse l'acces (fail-closed) si l'entite n'appartient pas a
     * l'organisation du tenant courant.
     *
     * <p>Bypass d'abord le staff plateforme et l'org SYSTEM ; sinon leve
     * {@link AccessDeniedException} si le tenant org est NULL, si
     * {@code entityOrgId} est NULL, ou si les deux orgs different.</p>
     *
     * @param entityOrgId   l'organizationId de l'entite chargee (peut etre NULL)
     * @param resourceLabel message d'erreur si l'acces est refuse
     * @throws AccessDeniedException si l'acces est refuse
     */
    public void requireSameOrganization(Long entityOrgId, String resourceLabel) {
        requireSameOrganization(entityOrgId, tenantContext.getOrganizationId(), resourceLabel);
    }

    /**
     * Variante fail-closed comparant l'org de l'entite a un {@code expectedOrgId}
     * EXPLICITE (et non au TenantContext courant).
     *
     * <p>A utiliser dans les flux ou l'org de reference est passee en parametre
     * plutot que resolue via le ThreadLocal : typiquement
     * {@link com.clenzy.service.CalendarEngine}, invoque aussi bien en HTTP qu'en
     * arriere-plan (Kafka consumers, schedulers) ou le {@code orgId} du caller fait
     * foi. Le bypass staff plateforme / org SYSTEM reste evalue via le TenantContext
     * (operations HTTP super-admin) ; en arriere-plan le contexte n'est pas
     * super-admin et la comparaison explicite {@code entityOrgId == expectedOrgId}
     * tranche.</p>
     *
     * @param entityOrgId   organizationId de l'entite chargee (peut etre NULL)
     * @param expectedOrgId organizationId attendu / du caller (peut etre NULL)
     * @param resourceLabel message d'erreur si l'acces est refuse
     * @throws AccessDeniedException si l'acces est refuse
     */
    public void requireSameOrganization(Long entityOrgId, Long expectedOrgId, String resourceLabel) {
        if (tenantContext.isSuperAdmin() || tenantContext.isSystemOrg()) {
            return;
        }
        if (expectedOrgId == null || entityOrgId == null || !expectedOrgId.equals(entityOrgId)) {
            throw new AccessDeniedException(resourceLabel);
        }
    }
}
