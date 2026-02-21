package com.clenzy.config;

import com.clenzy.service.SecurityAuditService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Handler custom pour les erreurs 401 (Non authentifie).
 * Log l'evenement LOGIN_FAILURE dans security_audit_log
 * quand un endpoint protege est accede sans JWT valide.
 *
 * Exigence Airbnb Partner Niveau 7.
 */
@Component
public class SecurityAuditAuthEntryPoint implements AuthenticationEntryPoint {

    private static final Logger log = LoggerFactory.getLogger(SecurityAuditAuthEntryPoint.class);

    private final SecurityAuditService securityAuditService;

    public SecurityAuditAuthEntryPoint(SecurityAuditService securityAuditService) {
        this.securityAuditService = securityAuditService;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         AuthenticationException ex) throws IOException {
        String path = request.getRequestURI();
        String method = request.getMethod();

        securityAuditService.logLoginFailure(null,
                "Unauthenticated access: " + method + " " + path);

        log.warn("Acces non authentifie: {} {} ({})", method, path, ex.getMessage());

        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.getWriter().write(
                "{\"error\":\"Non authentifie\",\"message\":\"Token JWT manquant ou invalide\",\"status\":401}");
    }
}
