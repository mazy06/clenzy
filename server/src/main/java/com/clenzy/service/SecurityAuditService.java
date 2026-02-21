package com.clenzy.service;

import com.clenzy.model.SecurityAuditEventType;
import com.clenzy.model.SecurityAuditLog;
import com.clenzy.repository.SecurityAuditLogRepository;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Map;

/**
 * Service d'audit securite pour tracer les evenements de securite specifiques.
 * Separee de l'AuditLogService metier — table et retention differentes.
 *
 * Exigence Airbnb Partner Niveau 7 : audit trail securite complet.
 * Events : LOGIN_SUCCESS, LOGIN_FAILURE, PERMISSION_DENIED, DATA_ACCESS,
 *          ADMIN_ACTION, SECRET_ROTATION, SUSPICIOUS_ACTIVITY.
 */
@Service
public class SecurityAuditService {

    private static final Logger log = LoggerFactory.getLogger(SecurityAuditService.class);

    private final SecurityAuditLogRepository repository;
    private final TenantContext tenantContext;
    private final ObjectMapper objectMapper;

    public SecurityAuditService(SecurityAuditLogRepository repository,
                                TenantContext tenantContext,
                                ObjectMapper objectMapper) {
        this.repository = repository;
        this.tenantContext = tenantContext;
        this.objectMapper = objectMapper;
    }

    // ─── Login events ─────────────────────────────────────────────────────────

    public void logLoginSuccess(String actorId, String actorEmail) {
        SecurityAuditLog entry = new SecurityAuditLog(
                SecurityAuditEventType.LOGIN_SUCCESS, "LOGIN", "SUCCESS");
        entry.setActorId(actorId);
        entry.setActorEmail(actorEmail);
        enrichAndSave(entry);
    }

    public void logLoginFailure(String actorEmail, String reason) {
        SecurityAuditLog entry = new SecurityAuditLog(
                SecurityAuditEventType.LOGIN_FAILURE, "LOGIN", "DENIED");
        entry.setActorEmail(actorEmail);
        entry.setDetails(toJson(Map.of("reason", reason != null ? reason : "unknown")));
        enrichAndSave(entry);
    }

    // ─── Permission denied ────────────────────────────────────────────────────

    public void logPermissionDenied(String actorId, String actorEmail,
                                     String resourceType, String resourceId, String action) {
        SecurityAuditLog entry = new SecurityAuditLog(
                SecurityAuditEventType.PERMISSION_DENIED, action, "DENIED");
        entry.setActorId(actorId);
        entry.setActorEmail(actorEmail);
        entry.setResourceType(resourceType);
        entry.setResourceId(resourceId);
        enrichAndSave(entry);
    }

    // ─── Admin actions ────────────────────────────────────────────────────────

    public void logAdminAction(String actorId, String actorEmail,
                                String action, String details) {
        SecurityAuditLog entry = new SecurityAuditLog(
                SecurityAuditEventType.ADMIN_ACTION, action, "SUCCESS");
        entry.setActorId(actorId);
        entry.setActorEmail(actorEmail);
        entry.setDetails(details);
        enrichAndSave(entry);
    }

    // ─── Suspicious activity ──────────────────────────────────────────────────

    public void logSuspiciousActivity(String actorId, String description,
                                       Map<String, Object> context) {
        SecurityAuditLog entry = new SecurityAuditLog(
                SecurityAuditEventType.SUSPICIOUS_ACTIVITY, description, "ERROR");
        entry.setActorId(actorId);
        entry.setDetails(toJson(context));
        enrichAndSave(entry);
    }

    // ─── Data access ──────────────────────────────────────────────────────────

    public void logDataAccess(String actorId, String actorEmail,
                               String resourceType, String resourceId) {
        SecurityAuditLog entry = new SecurityAuditLog(
                SecurityAuditEventType.DATA_ACCESS, "READ", "SUCCESS");
        entry.setActorId(actorId);
        entry.setActorEmail(actorEmail);
        entry.setResourceType(resourceType);
        entry.setResourceId(resourceId);
        enrichAndSave(entry);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private void enrichAndSave(SecurityAuditLog entry) {
        enrichWithRequestInfo(entry);
        try {
            entry.setOrganizationId(tenantContext.getOrganizationId());
        } catch (Exception e) {
            // TenantContext peut ne pas etre disponible (ex: 401 avant TenantFilter)
        }
        saveAsync(entry);
    }

    private void enrichWithRequestInfo(SecurityAuditLog entry) {
        try {
            ServletRequestAttributes attrs = (ServletRequestAttributes)
                    RequestContextHolder.getRequestAttributes();
            if (attrs != null) {
                HttpServletRequest request = attrs.getRequest();
                entry.setActorIp(getClientIpAddress(request));
                String ua = request.getHeader("User-Agent");
                entry.setUserAgent(ua != null && ua.length() > 500 ? ua.substring(0, 500) : ua);
            }
        } catch (Exception e) {
            log.debug("Impossible d'extraire les infos requete pour security audit: {}", e.getMessage());
        }

        // Enrichir actorId/actorEmail si pas deja set (depuis le SecurityContext)
        if (entry.getActorId() == null) {
            try {
                Authentication auth = SecurityContextHolder.getContext().getAuthentication();
                if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
                    entry.setActorId(jwt.getSubject());
                    if (entry.getActorEmail() == null) {
                        entry.setActorEmail(jwt.getClaimAsString("email"));
                    }
                }
            } catch (Exception e) {
                // Pas de JWT disponible (ex: endpoint public)
            }
        }
    }

    private String getClientIpAddress(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isEmpty()) {
            return xRealIp;
        }
        return request.getRemoteAddr();
    }

    private String toJson(Map<String, ?> data) {
        if (data == null) return null;
        try {
            return objectMapper.writeValueAsString(data);
        } catch (Exception e) {
            log.debug("Erreur serialisation JSON pour security audit: {}", e.getMessage());
            return data.toString();
        }
    }

    @Async
    protected void saveAsync(SecurityAuditLog entry) {
        try {
            repository.save(entry);
            log.debug("Security audit: {} {} {} by {}",
                    entry.getEventType(), entry.getAction(), entry.getResult(), entry.getActorEmail());
        } catch (Exception e) {
            // Ne JAMAIS faire echouer l'operation metier a cause de l'audit
            log.error("Erreur sauvegarde security audit log: {}", e.getMessage());
        }
    }
}
