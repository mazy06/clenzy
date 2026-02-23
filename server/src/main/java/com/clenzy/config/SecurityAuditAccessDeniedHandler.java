package com.clenzy.config;

import com.clenzy.service.SecurityAuditService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Handler custom pour les erreurs 403 (Acces refuse).
 * Log l'evenement PERMISSION_DENIED dans security_audit_log.
 *
 * Exigence Airbnb Partner Niveau 7.
 */
@Component
public class SecurityAuditAccessDeniedHandler implements AccessDeniedHandler {

    private static final Logger log = LoggerFactory.getLogger(SecurityAuditAccessDeniedHandler.class);

    private final SecurityAuditService securityAuditService;

    public SecurityAuditAccessDeniedHandler(SecurityAuditService securityAuditService) {
        this.securityAuditService = securityAuditService;
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
                       AccessDeniedException ex) throws IOException {
        String actorId = null;
        String actorEmail = null;

        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
                actorId = jwt.getSubject();
                actorEmail = jwt.getClaimAsString("email");
            }
        } catch (Exception e) {
            log.debug("Impossible d'extraire l'acteur pour le security audit: {}", e.getMessage());
        }

        String path = request.getRequestURI();
        String method = request.getMethod();

        // Exclure les endpoints actuator de l'audit — les scrapes internes Docker
        // ne sont pas des violations d'acces et inondent la table security_audit_log.
        if (!path.startsWith("/actuator")) {
            securityAuditService.logPermissionDenied(
                    actorId, actorEmail, "ENDPOINT", path, method + " " + path);
        }

        log.warn("Acces refuse: {} {} par {} ({})", method, path, actorEmail, ex.getMessage());

        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json");
        response.getWriter().write(
                "{\"error\":\"Acces refuse\",\"message\":\"Vous n'avez pas les permissions pour cette action\",\"status\":403}");
    }
}
