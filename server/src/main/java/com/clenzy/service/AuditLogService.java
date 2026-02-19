package com.clenzy.service;

import com.clenzy.model.AuditAction;
import com.clenzy.model.AuditLog;
import com.clenzy.model.AuditSource;
import com.clenzy.repository.AuditLogRepository;
import com.clenzy.tenant.TenantContext;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.Instant;

/**
 * Service d'audit pour tracer les actions sensibles.
 * Les logs sont ecrits de maniere asynchrone pour ne pas impacter les performances.
 *
 * Exigence Airbnb Partner : audit trail complet avec retention 2 ans minimum.
 */
@Service
public class AuditLogService {

    private static final Logger log = LoggerFactory.getLogger(AuditLogService.class);

    private final AuditLogRepository auditLogRepository;
    private final TenantContext tenantContext;

    public AuditLogService(AuditLogRepository auditLogRepository,
                           TenantContext tenantContext) {
        this.auditLogRepository = auditLogRepository;
        this.tenantContext = tenantContext;
    }

    // ─── Methodes principales de logging ──────────────────────────────────────

    /**
     * Log une action de creation.
     */
    public void logCreate(String entityType, String entityId, String details) {
        logAction(AuditAction.CREATE, entityType, entityId, null, null, details, AuditSource.WEB);
    }

    /**
     * Log une action de mise a jour.
     */
    public void logUpdate(String entityType, String entityId, String oldValue, String newValue, String details) {
        logAction(AuditAction.UPDATE, entityType, entityId, oldValue, newValue, details, AuditSource.WEB);
    }

    /**
     * Log une action de suppression.
     */
    public void logDelete(String entityType, String entityId, String details) {
        logAction(AuditAction.DELETE, entityType, entityId, null, null, details, AuditSource.WEB);
    }

    /**
     * Log une connexion reussie.
     */
    public void logLogin(String userId, String userEmail) {
        AuditLog entry = new AuditLog(AuditAction.LOGIN, "User", userId);
        entry.setUserId(userId);
        entry.setUserEmail(userEmail);
        entry.setDetails("Connexion reussie");
        entry.setSource(AuditSource.WEB);
        enrichWithRequestInfo(entry);
        entry.setOrganizationId(tenantContext.getOrganizationId());
        saveAsync(entry);
    }

    /**
     * Log une tentative de connexion echouee.
     */
    public void logLoginFailed(String userEmail, String reason) {
        AuditLog entry = new AuditLog(AuditAction.LOGIN_FAILED, "User", null);
        entry.setUserEmail(userEmail);
        entry.setDetails("Tentative de connexion echouee: " + reason);
        entry.setSource(AuditSource.WEB);
        enrichWithRequestInfo(entry);
        entry.setOrganizationId(tenantContext.getOrganizationId());
        saveAsync(entry);
    }

    /**
     * Log une deconnexion.
     */
    public void logLogout(String userId, String userEmail) {
        AuditLog entry = new AuditLog(AuditAction.LOGOUT, "User", userId);
        entry.setUserId(userId);
        entry.setUserEmail(userEmail);
        entry.setDetails("Deconnexion");
        entry.setSource(AuditSource.WEB);
        enrichWithRequestInfo(entry);
        entry.setOrganizationId(tenantContext.getOrganizationId());
        saveAsync(entry);
    }

    /**
     * Log un changement de statut.
     */
    public void logStatusChange(String entityType, String entityId, String oldStatus, String newStatus) {
        logAction(AuditAction.STATUS_CHANGE, entityType, entityId, oldStatus, newStatus,
                "Statut change de " + oldStatus + " a " + newStatus, AuditSource.WEB);
    }

    /**
     * Log un paiement.
     */
    public void logPayment(String entityType, String entityId, String details) {
        logAction(AuditAction.PAYMENT, entityType, entityId, null, null, details, AuditSource.WEB);
    }

    /**
     * Log un webhook recu.
     */
    public void logWebhook(String entityType, String entityId, String details) {
        logAction(AuditAction.WEBHOOK_RECEIVED, entityType, entityId, null, null, details, AuditSource.WEBHOOK);
    }

    /**
     * Log une synchronisation Airbnb.
     */
    public void logSync(String entityType, String entityId, String details) {
        logAction(AuditAction.SYNC, entityType, entityId, null, null, details, AuditSource.AIRBNB_SYNC);
    }

    // ─── Methode generique ────────────────────────────────────────────────────

    public void logAction(AuditAction action, String entityType, String entityId,
                          String oldValue, String newValue, String details, AuditSource source) {
        AuditLog entry = new AuditLog(action, entityType, entityId);
        entry.setOldValue(oldValue);
        entry.setNewValue(newValue);
        entry.setDetails(details);
        entry.setSource(source);

        // Enrichir avec les infos utilisateur depuis le SecurityContext
        enrichWithUserInfo(entry);
        enrichWithRequestInfo(entry);
        entry.setOrganizationId(tenantContext.getOrganizationId());

        saveAsync(entry);
    }

    // ─── Consultation des logs ────────────────────────────────────────────────

    public Page<AuditLog> getByUser(String userId, Pageable pageable) {
        return auditLogRepository.findByUserIdOrderByTimestampDesc(userId, pageable);
    }

    public Page<AuditLog> getByEntity(String entityType, String entityId, Pageable pageable) {
        return auditLogRepository.findByEntityTypeAndEntityIdOrderByTimestampDesc(entityType, entityId, pageable);
    }

    public Page<AuditLog> getByAction(AuditAction action, Pageable pageable) {
        return auditLogRepository.findByActionOrderByTimestampDesc(action, pageable);
    }

    public long countSince(Instant from) {
        return auditLogRepository.countByTimestampAfter(from);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private void enrichWithUserInfo(AuditLog entry) {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
                entry.setUserId(jwt.getSubject());
                entry.setUserEmail(jwt.getClaimAsString("email"));
            }
        } catch (Exception e) {
            log.debug("Impossible d'extraire les informations utilisateur pour l'audit: {}", e.getMessage());
        }
    }

    private void enrichWithRequestInfo(AuditLog entry) {
        try {
            ServletRequestAttributes attrs = (ServletRequestAttributes)
                    RequestContextHolder.getRequestAttributes();
            if (attrs != null) {
                HttpServletRequest request = attrs.getRequest();
                entry.setIpAddress(getClientIpAddress(request));
                entry.setUserAgent(truncate(request.getHeader("User-Agent"), 500));
            }
        } catch (Exception e) {
            log.debug("Impossible d'extraire les informations de requete pour l'audit: {}", e.getMessage());
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

    private String truncate(String value, int maxLength) {
        if (value == null) return null;
        return value.length() > maxLength ? value.substring(0, maxLength) : value;
    }

    @Async
    protected void saveAsync(AuditLog entry) {
        try {
            auditLogRepository.save(entry);
            log.debug("Audit log: {} {} {} by {}",
                    entry.getAction(), entry.getEntityType(), entry.getEntityId(), entry.getUserEmail());
        } catch (Exception e) {
            // Ne JAMAIS faire echouer l'operation metier a cause de l'audit
            log.error("Erreur lors de la sauvegarde de l'audit log: {}", e.getMessage());
        }
    }
}
