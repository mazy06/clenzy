package com.clenzy.config;

import com.clenzy.tenant.TenantContext;
import org.slf4j.MDC;
import org.springframework.core.task.TaskDecorator;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Map;

/**
 * Propage les contextes ThreadLocal du thread appelant vers les threads
 * {@code @Async} (Z1-BUGS-06) :
 * <ul>
 *   <li>{@link TenantContext} — sans lui, les methodes @Async qui font du JPA
 *       (UserProfileSyncService, ReconciliationService, AuditLogService...)
 *       tournent avec orgId=null : ecritures sans organization_id et lectures
 *       sans cloisonnement d'organisation ;</li>
 *   <li>{@link SecurityContextHolder} — pour les controles @PreAuthorize /
 *       ownership executes dans la tache ;</li>
 *   <li>MDC — pour la correlation des logs.</li>
 * </ul>
 *
 * <p><b>Nettoyage</b> : chaque contexte est efface en {@code finally}. Meme si
 * l'executor cree un virtual thread neuf par tache (pas de reattribution), le
 * clear garantit l'absence de fuite si l'executor change un jour pour un pool.</p>
 */
public class ContextPropagatingTaskDecorator implements TaskDecorator {

    private final TenantContext tenantContext;

    public ContextPropagatingTaskDecorator(TenantContext tenantContext) {
        this.tenantContext = tenantContext;
    }

    @Override
    public Runnable decorate(Runnable runnable) {
        // Capture sur le thread soumetteur (thread HTTP avec TenantFilter passe)
        final Long organizationId = tenantContext.getOrganizationId();
        final boolean superAdmin = tenantContext.isSuperAdmin();
        final boolean systemOrg = tenantContext.isSystemOrg();
        final String countryCode = tenantContext.getCountryCode();
        final String defaultCurrency = tenantContext.getDefaultCurrency();
        final boolean vatRegistered = tenantContext.isVatRegistered();
        final SecurityContext securityContext = SecurityContextHolder.getContext();
        final Map<String, String> mdcContext = MDC.getCopyOfContextMap();

        return () -> {
            try {
                tenantContext.setOrganizationId(organizationId);
                tenantContext.setSuperAdmin(superAdmin);
                tenantContext.setSystemOrg(systemOrg);
                tenantContext.setCountryCode(countryCode);
                tenantContext.setDefaultCurrency(defaultCurrency);
                tenantContext.setVatRegistered(vatRegistered);
                SecurityContextHolder.setContext(securityContext);
                if (mdcContext != null) {
                    MDC.setContextMap(mdcContext);
                }
                runnable.run();
            } finally {
                tenantContext.clear();
                SecurityContextHolder.clearContext();
                MDC.clear();
            }
        };
    }
}
