package com.clenzy.tenant;

import com.clenzy.model.FiscalProfile;
import com.clenzy.model.OrganizationType;
import com.clenzy.model.UserRole;
import com.clenzy.repository.FiscalProfileRepository;
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
import java.util.Set;
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
 *
 * <p><b>Fail-closed</b> : une requete org-scopee dont le tenant ne peut pas
 * etre resolu (utilisateur inconnu, sans organisation, ou erreur de
 * resolution) est REFUSEE (403/500) au lieu d'etre servie sans isolation.
 * Seuls les chemins {@link #TENANT_OPTIONAL_PATHS} (onboarding, /api/me,
 * invitations, logout) restent accessibles sans organisation.</p>
 */
public class TenantFilter extends OncePerRequestFilter {

    private static final Logger logger = LoggerFactory.getLogger(TenantFilter.class);
    private static final String CACHE_PREFIX = "tenant:";
    private static final long CACHE_TTL_MINUTES = 5;

    private static final String FISCAL_CACHE_PREFIX = "fiscal:";

    /**
     * Issue de la resolution du tenant pour la requete courante.
     */
    enum TenantResolution {
        /** Organisation resolue, contexte pose (filtre Hibernate si applicable). */
        RESOLVED,
        /** Staff plateforme sans org : acces cross-org legitime, pas de filtre. */
        PLATFORM_STAFF,
        /** Aucune organisation rattachee (utilisateur inconnu en base ou sans org). */
        NO_ORGANIZATION,
        /** Erreur inattendue pendant la resolution (Redis/DB/...). */
        ERROR
    }

    /**
     * Chemins accessibles a un utilisateur authentifie SANS organisation
     * (premier login, onboarding, invitation en attente). La requete passe
     * alors sans contexte org : aucun de ces endpoints ne sert de donnees
     * org-scopees, et les ecritures restent protegees par
     * {@link TenantContext#getRequiredOrganizationId()}.
     * {@code /api/me} et {@code /api/me/**} sont egalement tenant-optionnels
     * (auto-provisioning + preferences personnelles, cf. {@link #isTenantOptional}).
     */
    private static final Set<String> TENANT_OPTIONAL_PATHS = Set.of(
            "/api/logout",
            "/api/invitations/info",
            "/api/invitations/register",
            "/api/invitations/accept"
    );

    private final UserRepository userRepository;
    private final OrganizationRepository organizationRepository;
    private final FiscalProfileRepository fiscalProfileRepository;
    private final EntityManager entityManager;
    private final RedisTemplate<String, Object> redisTemplate;
    private final TenantContext tenantContext;

    public TenantFilter(UserRepository userRepository,
                        OrganizationRepository organizationRepository,
                        FiscalProfileRepository fiscalProfileRepository,
                        EntityManager entityManager,
                        RedisTemplate<String, Object> redisTemplate,
                        TenantContext tenantContext) {
        this.userRepository = userRepository;
        this.organizationRepository = organizationRepository;
        this.fiscalProfileRepository = fiscalProfileRepository;
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
            TenantResolution resolution = resolveTenant(keycloakId);
            if (!proceedAllowed(resolution, request, response, keycloakId)) {
                // Fail-closed : reponse 403/500 deja ecrite, la chain n'est PAS
                // appelee — la requete n'est jamais servie sans isolation tenant.
                MDC.remove("orgId");
                tenantContext.clear();
                return;
            }
        } else {
            logger.warn("TenantFilter: pas d'auth JWT (auth={}, principal={})",
                    auth != null ? auth.getClass().getSimpleName() : "null",
                    auth != null ? auth.getPrincipal().getClass().getSimpleName() : "null");
        }

        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove("orgId");
            // CRITIQUE securite : clear le ThreadLocal pour eviter une fuite
            // cross-request quand Tomcat reutilise le thread. Le @RequestScope
            // initial nettoyait automatiquement, le ThreadLocal singleton
            // requiert un clear manuel.
            tenantContext.clear();
        }
    }

    /**
     * Fail-closed : decide si la requete peut continuer selon l'issue de la
     * resolution du tenant. En cas de refus, ecrit la reponse (403/500) et
     * retourne false.
     */
    private boolean proceedAllowed(TenantResolution resolution, HttpServletRequest request,
                                   HttpServletResponse response, String keycloakId) throws IOException {
        return switch (resolution) {
            case RESOLVED, PLATFORM_STAFF -> true;
            case NO_ORGANIZATION -> {
                if (isTenantOptional(request.getRequestURI())) {
                    logger.debug("TenantFilter: requete sans organisation autorisee sur chemin tenant-optionnel {}",
                            request.getRequestURI());
                    yield true;
                }
                logger.warn("TenantFilter: acces refuse (aucune organisation rattachee) keycloakId={}, uri={}",
                        keycloakId, request.getRequestURI());
                writeJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                        "Aucune organisation rattachee a cet utilisateur");
                yield false;
            }
            case ERROR -> {
                writeJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                        "Resolution du contexte d'organisation impossible");
                yield false;
            }
        };
    }

    private boolean isTenantOptional(String path) {
        if (path.equals("/api/me") || path.startsWith("/api/me/")) {
            return true;
        }
        return TENANT_OPTIONAL_PATHS.contains(path);
    }

    private void writeJsonError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write("{\"error\":\"" + message + "\"}");
    }

    private TenantResolution resolveTenant(String keycloakId) {
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
                    // Z2-SEC-05 : plus de fallback implicite sur "la seule org existante".
                    // Utilisateur pas encore en base (premier login) : seuls les chemins
                    // tenant-optionnels (/api/me pour l'auto-provisioning, invitations)
                    // restent accessibles, tout le reste est refuse (fail-closed).
                    logger.warn("TenantFilter: utilisateur non trouve en base pour keycloakId={}, aucune organisation resolue", keycloakId);
                    return TenantResolution.NO_ORGANIZATION;
                }

                var user = userOpt.get();
                orgId = user.getOrganizationId();
                isSuperAdmin = user.getRole().isPlatformStaff();
                isSystemOrg = false;
                logger.debug("TenantFilter: DB lookup keycloakId={}, userId={}, orgId={}, role={}, isPlatformStaff={}", keycloakId, user.getId(), orgId, user.getRole(), isSuperAdmin);

                if (orgId == null && !isSuperAdmin) {
                    // Z2-SEC-05 : pas d'org rattachee -> pas d'acces org-scope.
                    logger.warn("TenantFilter: utilisateur {} sans organization_id, aucune organisation resolue", keycloakId);
                    return TenantResolution.NO_ORGANIZATION;
                }

                if (orgId != null) {
                    // Detecter si l'organisation est de type SYSTEM (acces cross-org)
                    if (!isSuperAdmin) {
                        try {
                            var orgOpt = organizationRepository.findById(orgId);
                            if (orgOpt.isPresent() && orgOpt.get().getType() == OrganizationType.SYSTEM) {
                                isSystemOrg = true;
                                logger.debug("TenantFilter: organisation SYSTEM detectee pour keycloakId={}, orgId={}", keycloakId, orgId);
                            }
                        } catch (Exception e) {
                            // Conservateur : en cas de doute, l'utilisateur est traite
                            // comme org standard (filtre Hibernate active), jamais
                            // comme SYSTEM (acces cross-org).
                            logger.warn("TenantFilter: erreur verification type organisation: {}", e.getMessage());
                        }
                    }

                    // 3. Mettre en cache
                    cacheTenantInfo(cacheKey, orgId, isSuperAdmin, isSystemOrg);
                }
            }

            if (orgId == null) {
                if (isSuperAdmin) {
                    // Staff plateforme sans org : superAdmin, pas de filtre Hibernate
                    tenantContext.setOrganizationId(null);
                    tenantContext.setSuperAdmin(true);
                    logger.debug("TenantFilter: staff plateforme {} sans organization_id, bypass filtre", keycloakId);
                    return TenantResolution.PLATFORM_STAFF;
                }
                // Entree de cache sans org pour un non-staff : pas d'acces org-scope
                return TenantResolution.NO_ORGANIZATION;
            }

            // 4. Set sur TenantContext (request-scoped) + MDC pour logs correlés
            tenantContext.setOrganizationId(orgId);
            tenantContext.setSuperAdmin(isSuperAdmin);
            tenantContext.setSystemOrg(isSystemOrg);
            MDC.put("orgId", String.valueOf(orgId));
            logger.debug("TenantFilter: context SET orgId={}, superAdmin={}, systemOrg={}", orgId, isSuperAdmin, isSystemOrg);

            // 4b. Enrichir le contexte fiscal depuis FiscalProfile (avec cache Redis)
            if (cached != null && cached.countryCode != null) {
                tenantContext.setCountryCode(cached.countryCode);
                tenantContext.setDefaultCurrency(cached.defaultCurrency);
                tenantContext.setVatRegistered(cached.vatRegistered);
            } else {
                resolveFiscalContext(orgId);
            }

            // 5. Activer le filtre Hibernate pour les non-ADMIN et non-SYSTEM
            // Les utilisateurs SYSTEM ont besoin d'acceder aux interventions cross-org
            if (!isSuperAdmin && !isSystemOrg) {
                enableHibernateOrgFilter(orgId);
            }

            return TenantResolution.RESOLVED;

        } catch (Exception e) {
            // Z2-SEC-04 : fail-closed — l'appelant refuse la requete (500).
            // Plus de pass-through silencieux sans isolation tenant.
            logger.error("TenantFilter: erreur lors de la resolution du tenant pour keycloakId={}", keycloakId, e);
            return TenantResolution.ERROR;
        }
    }

    /**
     * Active le filtre Hibernate {@code organizationFilter} sur la Session
     * liee au thread courant.
     *
     * <p>Limite connue : avec {@code spring.jpa.open-in-view=false} (tous les
     * profils) et aucune transaction active au niveau du filtre servlet, il
     * n'existe pas d'EntityManager transactionnel lie au thread — l'unwrap
     * leve alors {@link IllegalStateException} ("No transactional EntityManager
     * available"). Dans ce cas le @Filter ne peut pas etre active ici et
     * l'isolation repose sur le TenantContext (orgId explicite dans les
     * services/repositories). Le tenant etant resolu et pose sur le contexte,
     * la requete n'est pas refusee pour autant.</p>
     */
    private void enableHibernateOrgFilter(Long orgId) {
        try {
            Session session = entityManager.unwrap(Session.class);
            session.enableFilter("organizationFilter")
                    .setParameter("orgId", orgId);
        } catch (IllegalStateException e) {
            logger.debug("TenantFilter: filtre Hibernate non activable (pas d'EntityManager transactionnel lie au thread): {}",
                    e.getMessage());
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

            // Enrichir avec le profil fiscal
            try {
                fiscalProfileRepository.findByOrganizationId(orgId).ifPresent(fp -> {
                    info.countryCode = fp.getCountryCode();
                    info.defaultCurrency = fp.getDefaultCurrency();
                    info.vatRegistered = fp.isVatRegistered();
                });
            } catch (Exception e) {
                logger.debug("TenantFilter: erreur chargement FiscalProfile pour cache: {}", e.getMessage());
            }

            redisTemplate.opsForValue().set(cacheKey, info, CACHE_TTL_MINUTES, TimeUnit.MINUTES);
        } catch (Exception e) {
            logger.debug("TenantFilter: erreur ecriture cache Redis: {}", e.getMessage());
        }
    }

    /**
     * Charge le FiscalProfile pour l'organisation et enrichit le TenantContext.
     * Utilise un cache Redis dedie avec TTL 5 min.
     */
    private void resolveFiscalContext(Long orgId) {
        try {
            fiscalProfileRepository.findByOrganizationId(orgId).ifPresent(fp -> {
                tenantContext.setCountryCode(fp.getCountryCode());
                tenantContext.setDefaultCurrency(fp.getDefaultCurrency());
                tenantContext.setVatRegistered(fp.isVatRegistered());
                logger.debug("TenantFilter: fiscal context SET country={}, currency={}, vat={}",
                    fp.getCountryCode(), fp.getDefaultCurrency(), fp.isVatRegistered());
            });
        } catch (Exception e) {
            logger.debug("TenantFilter: erreur chargement FiscalProfile: {}", e.getMessage());
            // Defaults FR/EUR already set in TenantContext
        }
    }

    /**
     * DTO pour le cache Redis du contexte tenant.
     */
    public static class TenantInfo implements Serializable {
        private static final long serialVersionUID = 3L;
        public Long organizationId;
        public boolean superAdmin;
        public boolean systemOrg;
        // Fiscal context
        public String countryCode;
        public String defaultCurrency;
        public boolean vatRegistered;

        public TenantInfo() {}

        public TenantInfo(Long organizationId, boolean superAdmin, boolean systemOrg) {
            this.organizationId = organizationId;
            this.superAdmin = superAdmin;
            this.systemOrg = systemOrg;
        }
    }
}
