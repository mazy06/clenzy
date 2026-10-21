package com.clenzy.config;

import com.clenzy.tenant.TenantContext;
import io.sentry.Hint;
import io.sentry.SentryEvent;
import io.sentry.SentryOptions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.ObjectProvider;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Set;

/**
 * Configuration Sentry — enrichissement des events avec le contexte applicatif.
 * Active uniquement si SENTRY_DSN est defini.
 *
 * Liste blanche avant envoi, puis contexte technique minimal. Les messages,
 * requetes, identites, breadcrumbs, pieces jointes et traces sont exclus.
 */
@Configuration
@ConditionalOnProperty(name = "sentry.dsn")
public class SentryConfig {

    private static final Logger log = LoggerFactory.getLogger(SentryConfig.class);

    /**
     * Enrichit chaque event Sentry avec les tags techniques Baitly
     * avant envoi au serveur Sentry.
     */
    @Bean
    public SentryOptions.BeforeSendCallback beforeSendCallback(
            ObjectProvider<TenantContext> tenantContextProvider) {
        return (SentryEvent event, Hint hint) -> {
            event = BaitlySentryPrivacy.sanitize(event, hint);
            // Accepter seulement un identifiant de correlation, jamais un texte libre.
            String requestId = MDC.get("requestId");
            if (requestId != null && requestId.matches("[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}")) {
                event.setTag("request_id", requestId);
            }

            // Tags depuis TenantContext (request-scoped — peut etre absent dans les Kafka consumers)
            try {
                TenantContext ctx = tenantContextProvider.getIfAvailable();
                if (ctx != null) {
                    Long orgId = ctx.getOrganizationId();
                    if (orgId != null) {
                        event.setTag("organization_ref", organizationRef(orgId));
                    }
                    if (ctx.getCountryCode() != null && Set.of("FR", "MA", "SA").contains(ctx.getCountryCode())) {
                        event.setTag("country_code", ctx.getCountryCode());
                    }
                    if (ctx.isSuperAdmin()) {
                        event.setTag("is_super_admin", "true");
                    }
                }
            } catch (Exception e) {
                // TenantContext non disponible (ex: scheduler, Kafka consumer) — on continue
                log.trace("Tenant context unavailable for Sentry enrichment");
            }

            return event;
        };
    }

    /** Automatic transaction spans can carry SQL parameters and raw URLs. */
    @Bean
    public SentryOptions.BeforeSendTransactionCallback baitlySentryTransactions() {
        return (transaction, hint) -> null;
    }

    @Bean
    public SentryOptions.BeforeBreadcrumbCallback baitlySentryBreadcrumbs() {
        return (breadcrumb, hint) -> null;
    }

    private static String organizationRef(Long id) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(
                    ("baitly-sentry-organization-v1:" + id).getBytes(StandardCharsets.UTF_8));
            return "bt_" + HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
