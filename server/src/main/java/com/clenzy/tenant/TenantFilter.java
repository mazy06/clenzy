package com.clenzy.tenant;

import com.clenzy.model.UserRole;
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
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.io.Serializable;
import java.util.concurrent.TimeUnit;

/**
 * Filtre Spring qui resout le contexte d'organisation a partir du JWT.
 * Enregistre dans la SecurityFilterChain APRES l'authentification JWT.
 *
 * Pour les utilisateurs non-ADMIN, active le filtre Hibernate
 * "organizationFilter" pour isoler automatiquement les donnees.
 *
 * ADMIN (super-admin) ne recoit PAS le filtre Hibernate → voit toutes les orgs.
 */
@Component
public class TenantFilter extends OncePerRequestFilter {

    private static final Logger logger = LoggerFactory.getLogger(TenantFilter.class);
    private static final String CACHE_PREFIX = "tenant:";
    private static final long CACHE_TTL_MINUTES = 5;

    private final UserRepository userRepository;
    private final EntityManager entityManager;
    private final RedisTemplate<String, Object> redisTemplate;
    private final TenantContext tenantContext;

    public TenantFilter(UserRepository userRepository,
                        EntityManager entityManager,
                        RedisTemplate<String, Object> redisTemplate,
                        TenantContext tenantContext) {
        this.userRepository = userRepository;
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
        }

        filterChain.doFilter(request, response);
    }

    private void resolveTenant(String keycloakId) {
        try {
            // 1. Verifier le cache Redis
            String cacheKey = CACHE_PREFIX + keycloakId;
            TenantInfo cached = getCachedTenantInfo(cacheKey);

            Long orgId;
            boolean isSuperAdmin;

            if (cached != null) {
                orgId = cached.organizationId;
                isSuperAdmin = cached.superAdmin;
            } else {
                // 2. Lookup en base
                var userOpt = userRepository.findByKeycloakId(keycloakId);
                if (userOpt.isEmpty()) {
                    logger.debug("TenantFilter: utilisateur non trouve pour keycloakId={}", keycloakId);
                    return;
                }

                var user = userOpt.get();
                orgId = user.getOrganizationId();
                isSuperAdmin = (user.getRole() == UserRole.ADMIN);

                if (orgId == null) {
                    logger.warn("TenantFilter: utilisateur {} n'a pas d'organization_id", keycloakId);
                    return;
                }

                // 3. Mettre en cache
                cacheTenantInfo(cacheKey, orgId, isSuperAdmin);
            }

            // 4. Set sur TenantContext (request-scoped)
            tenantContext.setOrganizationId(orgId);
            tenantContext.setSuperAdmin(isSuperAdmin);

            // 5. Activer le filtre Hibernate pour les non-ADMIN
            if (!isSuperAdmin) {
                Session session = entityManager.unwrap(Session.class);
                session.enableFilter("organizationFilter")
                        .setParameter("orgId", orgId);
            }

        } catch (Exception e) {
            logger.error("TenantFilter: erreur lors de la resolution du tenant pour keycloakId={}", keycloakId, e);
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

    private void cacheTenantInfo(String cacheKey, Long orgId, boolean superAdmin) {
        try {
            TenantInfo info = new TenantInfo(orgId, superAdmin);
            redisTemplate.opsForValue().set(cacheKey, info, CACHE_TTL_MINUTES, TimeUnit.MINUTES);
        } catch (Exception e) {
            logger.debug("TenantFilter: erreur ecriture cache Redis: {}", e.getMessage());
        }
    }

    /**
     * DTO pour le cache Redis du contexte tenant.
     */
    public static class TenantInfo implements Serializable {
        private static final long serialVersionUID = 1L;
        public Long organizationId;
        public boolean superAdmin;

        public TenantInfo() {}

        public TenantInfo(Long organizationId, boolean superAdmin) {
            this.organizationId = organizationId;
            this.superAdmin = superAdmin;
        }
    }
}
