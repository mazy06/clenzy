package com.clenzy.tenant;

import com.clenzy.model.OrganizationType;
import com.clenzy.model.UserRole;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.hibernate.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

import org.slf4j.MDC;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.io.Serializable;
import java.util.concurrent.TimeUnit;

/**
 * Filtre Spring qui resout le contexte d'organisation a partir du JWT.
 * Enregistre dans la SecurityFilterChain APRES l'authentification JWT.
 *
 * Pour les utilisateurs non-staff, active le filtre Hibernate
 * "organizationFilter" pour isoler automatiquement les donnees.
 *
 * Le staff plateforme (SUPER_ADMIN, SUPER_MANAGER) ne recoit PAS
 * le filtre Hibernate → voit toutes les orgs.
 */
public class TenantFilter extends OncePerRequestFilter {

    private static final Logger logger = LoggerFactory.getLogger(TenantFilter.class);
    private static final String CACHE_PREFIX = "tenant:";
    private static final long CACHE_TTL_MINUTES = 5;

    private final UserRepository userRepository;
    private final OrganizationRepository organizationRepository;
    private final EntityManager entityManager;
    private final RedisTemplate<String, Object> redisTemplate;
    private final TenantContext tenantContext;

    public TenantFilter(UserRepository userRepository,
                        OrganizationRepository organizationRepository,
                        EntityManager entityManager,
                        RedisTemplate<String, Object> redisTemplate,
                        TenantContext tenantContext) {
        this.userRepository = userRepository;
        this.organizationRepository = organizationRepository;
        this.entityManager = entityManager;
        this.redisTemplate = redisTemplate;
        this.tenantContext = tenantContext;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                     FilterChain filterChain) throws ServletException, IOException {

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
            String keycloakId = jwt.getSubject();
            resolveTenant(keycloakId);
        } else {
            logger.warn("TenantFilter: pas d'auth JWT (auth={}, principal={})",
                    auth != null ? auth.getClass().getSimpleName() : "null",
                    auth != null ? auth.getPrincipal().getClass().getSimpleName() : "null");
        }

        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove("orgId");
        }
    }

    private void resolveTenant(String keycloakId) {
        try {
            // 1. Verifier le cache Redis
            String cacheKey = CACHE_PREFIX + keycloakId;
            TenantInfo cached = getCachedTenantInfo(cacheKey);

            Long orgId;
            boolean isSuperAdmin;
            boolean isSystemOrg;

            if (cached != null) {
                orgId = cached.organizationId;
                isSuperAdmin = cached.superAdmin;
                isSystemOrg = cached.systemOrg;
                logger.debug("TenantFilter: cache hit keycloakId={}, orgId={}, superAdmin={}, systemOrg={}", keycloakId, orgId, isSuperAdmin, isSystemOrg);
            } else {
                // 2. Lookup en base
                var userOpt = userRepository.findByKeycloakId(keycloakId);
                if (userOpt.isEmpty()) {
                    // Utilisateur pas encore en base (ex: premier login, auto-provisioning en cours)
                    // Tenter de resoudre l'org par defaut pour eviter des 500 sur les endpoints
                    logger.debug("TenantFilter: utilisateur non trouve pour keycloakId={}, tentative de fallback", keycloakId);
                    resolveDefaultOrganization();
                    return;
                }

                var user = userOpt.get();
                orgId = user.getOrganizationId();
                isSuperAdmin = user.getRole().isPlatformStaff();
                isSystemOrg = false;
                logger.debug("TenantFilter: DB lookup keycloakId={}, userId={}, orgId={}, role={}, isPlatformStaff={}", keycloakId, user.getId(), orgId, user.getRole(), isSuperAdmin);

                if (orgId == null && isSuperAdmin) {
                    // Staff plateforme sans org : marquer superAdmin et continuer sans filtre Hibernate
                    tenantContext.setOrganizationId(null);
                    tenantContext.setSuperAdmin(true);
                    logger.debug("TenantFilter: staff plateforme {} sans organization_id, bypass filtre", keycloakId);
                    return;
                }

                if (orgId == null) {
                    logger.warn("TenantFilter: utilisateur {} n'a pas d'organization_id, tentative de fallback", keycloakId);
                    resolveDefaultOrganization();
                    return;
                }

                // Detecter si l'organisation est de type SYSTEM (acces cross-org)
                if (!isSuperAdmin) {
                    try {
                        var orgOpt = organizationRepository.findById(orgId);
                        if (orgOpt.isPresent() && orgOpt.get().getType() == OrganizationType.SYSTEM) {
                            isSystemOrg = true;
                            logger.debug("TenantFilter: organisation SYSTEM detectee pour keycloakId={}, orgId={}", keycloakId, orgId);
                        }
                    } catch (Exception e) {
                        logger.warn("TenantFilter: erreur verification type organisation: {}", e.getMessage());
                    }
                }

                // 3. Mettre en cache
                cacheTenantInfo(cacheKey, orgId, isSuperAdmin, isSystemOrg);
            }

            // 4. Set sur TenantContext (request-scoped) + MDC pour logs correlés
            tenantContext.setOrganizationId(orgId);
            tenantContext.setSuperAdmin(isSuperAdmin);
            tenantContext.setSystemOrg(isSystemOrg);
            MDC.put("orgId", String.valueOf(orgId));
            logger.debug("TenantFilter: context SET orgId={}, superAdmin={}, systemOrg={}", orgId, isSuperAdmin, isSystemOrg);

            // 5. Activer le filtre Hibernate pour les non-ADMIN et non-SYSTEM
            // Les utilisateurs SYSTEM ont besoin d'acceder aux interventions cross-org
            if (!isSuperAdmin && !isSystemOrg) {
                Session session = entityManager.unwrap(Session.class);
                session.enableFilter("organizationFilter")
                        .setParameter("orgId", orgId);
            }

        } catch (Exception e) {
            logger.error("TenantFilter: erreur lors de la resolution du tenant pour keycloakId={}", keycloakId, e);
        }
    }

    /**
     * Fallback : quand l'utilisateur n'est pas en base ou n'a pas d'org,
     * on cherche l'organisation par defaut (la premiere/seule org existante).
     * Cela evite des 500 sur les premiers appels API apres l'auto-provisioning.
     */
    private void resolveDefaultOrganization() {
        try {
            var allOrgs = organizationRepository.findAll();
            if (allOrgs.size() == 1) {
                Long orgId = allOrgs.get(0).getId();
                tenantContext.setOrganizationId(orgId);
                tenantContext.setSuperAdmin(false);
                MDC.put("orgId", String.valueOf(orgId));

                Session session = entityManager.unwrap(Session.class);
                session.enableFilter("organizationFilter")
                        .setParameter("orgId", orgId);

                logger.debug("TenantFilter: fallback sur organisation par defaut id={}", orgId);
            } else {
                logger.warn("TenantFilter: {} organisations trouvees, impossible de choisir un fallback", allOrgs.size());
            }
        } catch (Exception e) {
            logger.debug("TenantFilter: erreur lors du fallback organisation: {}", e.getMessage());
        }
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // Ne pas filtrer les endpoints publics (webhooks, health, etc.)
        String path = request.getRequestURI();
        return path.startsWith("/actuator/")
                || path.startsWith("/api/webhooks/")
                || path.equals("/api/health")
                || path.startsWith("/api/auth/")
                || path.startsWith("/api/public/")
                || path.startsWith("/v3/api-docs")
                || path.startsWith("/swagger-ui");
    }

    private TenantInfo getCachedTenantInfo(String cacheKey) {
        try {
            Object cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached instanceof TenantInfo info) {
                return info;
            }
        } catch (Exception e) {
            logger.debug("TenantFilter: erreur lecture cache Redis: {}", e.getMessage());
        }
        return null;
    }

    private void cacheTenantInfo(String cacheKey, Long orgId, boolean superAdmin, boolean systemOrg) {
        try {
            TenantInfo info = new TenantInfo(orgId, superAdmin, systemOrg);
            redisTemplate.opsForValue().set(cacheKey, info, CACHE_TTL_MINUTES, TimeUnit.MINUTES);
        } catch (Exception e) {
            logger.debug("TenantFilter: erreur ecriture cache Redis: {}", e.getMessage());
        }
    }

    /**
     * DTO pour le cache Redis du contexte tenant.
     */
    public static class TenantInfo implements Serializable {
        private static final long serialVersionUID = 2L;
        public Long organizationId;
        public boolean superAdmin;
        public boolean systemOrg;

        public TenantInfo() {}

        public TenantInfo(Long organizationId, boolean superAdmin, boolean systemOrg) {
            this.organizationId = organizationId;
            this.superAdmin = superAdmin;
            this.systemOrg = systemOrg;
        }
    }
}
