package com.clenzy.config;

import com.clenzy.model.AuditAction;
import com.clenzy.model.AuditLog;
import com.clenzy.model.AuditSource;
import com.clenzy.repository.AuditLogRepository;
import com.clenzy.tenant.TenantContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Set;

/**
 * Intercepteur d'audit logging complet.
 * Trace toutes les requetes API (POST/PUT/DELETE) avec code reponse,
 * et les acces admin separement.
 *
 * Les GET ne sont pas logges pour eviter le bruit (sauf admin endpoints).
 * Les logs d'audit ont une retention de 2 ans minimum (gere en DB).
 */
@Component
public class AuditLoggingInterceptor implements HandlerInterceptor {

    private static final Logger log = LoggerFactory.getLogger(AuditLoggingInterceptor.class);

    private static final Set<String> AUDITED_METHODS = Set.of("POST", "PUT", "DELETE", "PATCH");
    private static final Set<String> ADMIN_PATHS = Set.of(
            "/api/users", "/api/teams", "/api/pricing-config", "/api/admin"
    );

    private final AuditLogRepository auditLogRepository;
    private final TenantContext tenantContext;

    public AuditLoggingInterceptor(AuditLogRepository auditLogRepository,
                                    TenantContext tenantContext) {
        this.auditLogRepository = auditLogRepository;
        this.tenantContext = tenantContext;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                 Object handler, Exception ex) {
        String method = request.getMethod();
        String path = request.getRequestURI();

        // Skip non-API paths
        if (!path.startsWith("/api/")) return;
        // Skip health/public endpoints
        if (path.startsWith("/api/health") || path.startsWith("/api/public/")) return;

        boolean isAdminAccess = isAdminPath(path);
        boolean isMutatingMethod = AUDITED_METHODS.contains(method);

        // Log: all mutating operations + all admin GET accesses
        if (!isMutatingMethod && !isAdminAccess) return;

        try {
            AuditAction action = resolveAction(method, path);
            String userId = null;
            String userEmail = null;
            String userRole = null;

            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
                userId = jwt.getSubject();
                userEmail = jwt.getClaimAsString("email");
                // Extract role from authorities
                userRole = auth.getAuthorities().stream()
                        .map(Object::toString)
                        .filter(a -> a.startsWith("ROLE_"))
                        .findFirst()
                        .map(a -> a.substring(5))
                        .orElse(null);
            }

            int statusCode = response.getStatus();
            String details = method + " " + path + " → " + statusCode;
            if (ex != null) {
                details += " (error: " + ex.getMessage() + ")";
            }

            AuditLog entry = new AuditLog(action, resolveEntityType(path), null);
            entry.setUserId(userId);
            entry.setUserEmail(userEmail);
            entry.setDetails(details);
            entry.setSource(isAdminAccess ? AuditSource.ADMIN : AuditSource.WEB);
            entry.setIpAddress(getClientIp(request));
            entry.setUserAgent(truncate(request.getHeader("User-Agent"), 500));
            entry.setOrganizationId(tenantContext.getOrganizationId());

            if (isAdminAccess && userRole != null) {
                entry.setNewValue("role=" + userRole);
            }

            saveAsync(entry);

            if (isAdminAccess) {
                log.info("ADMIN AUDIT: {} {} {} by {} ({})", method, path, statusCode, userEmail, userRole);
            }
        } catch (Exception e) {
            // Never fail the request due to audit logging
            log.debug("Erreur audit logging: {}", e.getMessage());
        }
    }

    private AuditAction resolveAction(String method, String path) {
        if (path.contains("/permissions") || path.contains("/roles")) {
            return AuditAction.PERMISSION_CHANGE;
        }
        return switch (method) {
            case "POST" -> AuditAction.CREATE;
            case "PUT", "PATCH" -> AuditAction.UPDATE;
            case "DELETE" -> AuditAction.DELETE;
            default -> AuditAction.READ;
        };
    }

    private String resolveEntityType(String path) {
        // Extract entity type from path: /api/interventions/123 -> Intervention
        String[] segments = path.split("/");
        if (segments.length >= 3) {
            String resource = segments[2]; // after /api/
            // Singularize and capitalize
            if (resource.endsWith("s") && !resource.endsWith("ss")) {
                resource = resource.substring(0, resource.length() - 1);
            }
            return resource.substring(0, 1).toUpperCase() + resource.substring(1);
        }
        return "API";
    }

    private boolean isAdminPath(String path) {
        return ADMIN_PATHS.stream().anyMatch(path::startsWith);
    }

    private String getClientIp(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return remoteAddr;
    }

    private String truncate(String value, int maxLength) {
        if (value == null) return null;
        return value.length() > maxLength ? value.substring(0, maxLength) : value;
    }

    @Async
    protected void saveAsync(AuditLog entry) {
        try {
            auditLogRepository.save(entry);
        } catch (Exception e) {
            log.error("Erreur sauvegarde audit log API: {}", e.getMessage());
        }
    }
}
