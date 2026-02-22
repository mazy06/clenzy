package com.clenzy.util;

import com.clenzy.model.UserRole;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.List;
import java.util.Map;

/**
 * Extrait le role utilisateur depuis un JWT Keycloak.
 * Centralise la logique dupliquee dans InterventionService, ServiceRequestService,
 * TeamService et PropertyController.
 */
public final class JwtRoleExtractor {

    private static final Logger log = LoggerFactory.getLogger(JwtRoleExtractor.class);

    private JwtRoleExtractor() {}

    /**
     * Extract the user's role from a Keycloak JWT token.
     * Checks realm_access.roles for the highest-priority role.
     *
     * Priority order:
     * 1. realm-admin -> SUPER_ADMIN
     * 2. Platform staff roles (SUPER_ADMIN, SUPER_MANAGER)
     * 3. First valid business role (HOST, TECHNICIAN, HOUSEKEEPER, etc.)
     * 4. Direct "role" claim fallback
     * 5. HOST as default
     */
    public static UserRole extractUserRole(Jwt jwt) {
        if (jwt == null) {
            log.debug("extractUserRole - JWT is null, returning HOST default");
            return UserRole.HOST;
        }

        try {
            // Try realm_access.roles (Keycloak format)
            Map<String, Object> realmAccess = jwt.getClaim("realm_access");
            log.debug("extractUserRole - realm_access: {}", realmAccess);

            if (realmAccess != null) {
                Object roles = realmAccess.get("roles");
                log.debug("extractUserRole - roles: {}", roles);

                if (roles instanceof List<?> roleList) {

                    // First pass: look for priority roles (platform staff)
                    for (Object role : roleList) {
                        if (role instanceof String roleStr) {
                            if (isKeycloakTechnicalRole(roleStr)) {
                                continue;
                            }

                            // Map "realm-admin" to SUPER_ADMIN
                            if (roleStr.equalsIgnoreCase("realm-admin")) {
                                return UserRole.SUPER_ADMIN;
                            }

                            try {
                                UserRole userRole = UserRole.valueOf(roleStr.toUpperCase());
                                if (userRole.isPlatformStaff()) {
                                    return userRole;
                                }
                            } catch (IllegalArgumentException e) {
                                // Not a known role, continue
                            }
                        }
                    }

                    // Second pass: return the first valid business role
                    for (Object role : roleList) {
                        if (role instanceof String roleStr) {
                            if (isKeycloakTechnicalRole(roleStr)
                                    || roleStr.equalsIgnoreCase("realm-admin")) {
                                continue;
                            }

                            try {
                                UserRole userRole = UserRole.valueOf(roleStr.toUpperCase());
                                log.debug("extractUserRole - returning business role: {}", userRole);
                                return userRole;
                            } catch (IllegalArgumentException e) {
                                // Not a known role, continue
                            }
                        }
                    }
                }
            }

            // Fallback: try the direct "role" claim
            String directRole = jwt.getClaimAsString("role");
            log.debug("extractUserRole - direct role claim: {}", directRole);

            if (directRole != null) {
                try {
                    return UserRole.valueOf(directRole.toUpperCase());
                } catch (IllegalArgumentException e) {
                    log.warn("extractUserRole - unknown direct role: {}, falling back to HOST", directRole);
                    return UserRole.HOST;
                }
            }

            // No role found, return HOST as default
            log.debug("extractUserRole - no role found, returning HOST default");
            return UserRole.HOST;
        } catch (Exception e) {
            log.error("extractUserRole - error during extraction", e);
            return UserRole.HOST;
        }
    }

    private static boolean isKeycloakTechnicalRole(String role) {
        return "offline_access".equals(role)
                || "uma_authorization".equals(role)
                || "default-roles-clenzy".equals(role);
    }
}
