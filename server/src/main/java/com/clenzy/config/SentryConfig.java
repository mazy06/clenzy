package com.clenzy.config;

import com.clenzy.tenant.TenantContext;
import io.sentry.Hint;
import io.sentry.SentryEvent;
import io.sentry.SentryOptions;
import io.sentry.spring.jakarta.SentryExceptionResolver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.ObjectProvider;

/**
 * Configuration Sentry — enrichissement des events avec le contexte applicatif.
 * Active uniquement si SENTRY_DSN est defini.
 *
 * Tags ajoutes a chaque event :
 *  - organization_id  : depuis TenantContext (request-scoped)
 *  - request_id       : depuis MDC (ApiGatewayFilter)
 *  - country_code     : depuis TenantContext fiscal context
 */
@Configuration
@ConditionalOnProperty(name = "sentry.dsn")
public class SentryConfig {

    private static final Logger log = LoggerFactory.getLogger(SentryConfig.class);

    /**
     * Enrichit chaque event Sentry avec les tags metier Clenzy
     * avant envoi au serveur Sentry.
     */
    @Bean
    public SentryOptions.BeforeSendCallback beforeSendCallback(
            ObjectProvider<TenantContext> tenantContextProvider) {
        return (SentryEvent event, Hint hint) -> {
            // Tag request ID depuis MDC (toujours disponible)
            String requestId = MDC.get("requestId");
            if (requestId != null) {
                event.setTag("request_id", requestId);
            }

            String propertyId = MDC.get("propertyId");
            if (propertyId != null) {
                event.setTag("property_id", propertyId);
            }

            String channel = MDC.get("channel");
            if (channel != null) {
                event.setTag("channel", channel);
            }

            // Tags depuis TenantContext (request-scoped — peut etre absent dans les Kafka consumers)
            try {
                TenantContext ctx = tenantContextProvider.getIfAvailable();
                if (ctx != null) {
                    Long orgId = ctx.getOrganizationId();
                    if (orgId != null) {
                        event.setTag("organization_id", orgId.toString());
                    }
                    event.setTag("country_code", ctx.getCountryCode());
                    if (ctx.isSuperAdmin()) {
                        event.setTag("is_super_admin", "true");
                    }
                }
            } catch (Exception e) {
                // TenantContext non disponible (ex: scheduler, Kafka consumer) — on continue
                log.trace("TenantContext not available for Sentry enrichment: {}", e.getMessage());
            }

            return event;
        };
    }
}
