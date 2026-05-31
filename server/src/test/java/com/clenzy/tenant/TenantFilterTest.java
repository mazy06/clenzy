package com.clenzy.tenant;

import com.clenzy.model.Organization;
import com.clenzy.model.OrganizationType;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.repository.FiscalProfileRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.hibernate.Filter;
import org.hibernate.Session;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import jakarta.servlet.FilterChain;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TenantFilterTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private OrganizationRepository organizationRepository;

    @Mock
    private FiscalProfileRepository fiscalProfileRepository;

    @Mock
    private EntityManager entityManager;

    @Mock
    private RedisTemplate<String, Object> redisTemplate;

    @Mock
    private ValueOperations<String, Object> valueOperations;

    @Mock
    private Session session;

    @Mock
    private Filter hibernateFilter;

    @Mock
    private FilterChain filterChain;

    private TenantContext tenantContext;
    private TenantFilter tenantFilter;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantFilter = new TenantFilter(userRepository, organizationRepository,
                fiscalProfileRepository, entityManager, redisTemplate, tenantContext);

        lenient().when(entityManager.unwrap(Session.class)).thenReturn(session);
        lenient().when(session.enableFilter("organizationFilter")).thenReturn(hibernateFilter);
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void doFilter_jwtPresent_resolvesTenant() throws Exception {
        String keycloakId = "test-keycloak-id";
        Long orgId = 1L;
        setupJwtAuth(keycloakId);

        User user = new User("Test", "User", "test@test.com", "password123");
        user.setOrganizationId(orgId);
        user.setRole(UserRole.HOST);

        when(valueOperations.get("tenant:" + keycloakId)).thenReturn(null);
        when(userRepository.findByKeycloakId(keycloakId)).thenReturn(Optional.of(user));

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        request.setRequestURI("/api/properties");

        // Capture l'etat tenant PENDANT l'execution du chain (avant le clear()
        // du finally). TenantContext est maintenant ThreadLocal donc clear()
        // dans le finally evite les fuites cross-request quand Tomcat reutilise
        // le thread — mais on ne peut plus assertEqual apres doFilter().
        Long[] capturedOrgId = {null};
        Boolean[] capturedSuperAdmin = {null};
        doAnswer(inv -> {
            capturedOrgId[0] = tenantContext.getOrganizationId();
            capturedSuperAdmin[0] = tenantContext.isSuperAdmin();
            return null;
        }).when(filterChain).doFilter(any(), any());

        tenantFilter.doFilter(request, response, filterChain);

        assertEquals(orgId, capturedOrgId[0]);
        assertFalse(capturedSuperAdmin[0]);
        verify(session).enableFilter("organizationFilter");
        verify(hibernateFilter).setParameter("orgId", orgId);
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void doFilter_superAdmin_noHibernateFilter() throws Exception {
        String keycloakId = "admin-keycloak-id";
        setupJwtAuth(keycloakId);

        User user = new User("Admin", "User", "admin@test.com", "password123");
        user.setOrganizationId(null);
        user.setRole(UserRole.SUPER_ADMIN);

        when(valueOperations.get("tenant:" + keycloakId)).thenReturn(null);
        when(userRepository.findByKeycloakId(keycloakId)).thenReturn(Optional.of(user));

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        request.setRequestURI("/api/properties");

        Boolean[] capturedSuperAdmin = {null};
        doAnswer(inv -> {
            capturedSuperAdmin[0] = tenantContext.isSuperAdmin();
            return null;
        }).when(filterChain).doFilter(any(), any());

        tenantFilter.doFilter(request, response, filterChain);

        assertTrue(capturedSuperAdmin[0]);
        // Super admin with null orgId -> no Hibernate filter
        verify(session, never()).enableFilter(anyString());
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void doFilter_noAuth_noTenantResolution() throws Exception {
        // No JWT auth set
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        request.setRequestURI("/api/properties");

        tenantFilter.doFilter(request, response, filterChain);

        assertNull(tenantContext.getOrganizationId());
        verify(userRepository, never()).findByKeycloakId(anyString());
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void doFilter_cacheHit_skipsDbLookup() throws Exception {
        String keycloakId = "cached-user";
        Long orgId = 2L;
        setupJwtAuth(keycloakId);

        TenantFilter.TenantInfo cachedInfo = new TenantFilter.TenantInfo(orgId, false, false);

        when(valueOperations.get("tenant:" + keycloakId)).thenReturn(cachedInfo);

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        request.setRequestURI("/api/properties");

        Long[] capturedOrgId = {null};
        doAnswer(inv -> {
            capturedOrgId[0] = tenantContext.getOrganizationId();
            return null;
        }).when(filterChain).doFilter(any(), any());

        tenantFilter.doFilter(request, response, filterChain);

        assertEquals(orgId, capturedOrgId[0]);
        verify(userRepository, never()).findByKeycloakId(anyString());
        verify(session).enableFilter("organizationFilter");
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void doFilter_userNotInDb_fallbackDefaultOrg() throws Exception {
        String keycloakId = "new-user";
        Long defaultOrgId = 99L;
        setupJwtAuth(keycloakId);

        when(valueOperations.get("tenant:" + keycloakId)).thenReturn(null);
        when(userRepository.findByKeycloakId(keycloakId)).thenReturn(Optional.empty());

        Organization org = new Organization("Default Org", OrganizationType.INDIVIDUAL, "default-org");
        org.setId(defaultOrgId);
        when(organizationRepository.findAll()).thenReturn(List.of(org));

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        request.setRequestURI("/api/properties");

        Long[] capturedOrgId = {null};
        doAnswer(inv -> {
            capturedOrgId[0] = tenantContext.getOrganizationId();
            return null;
        }).when(filterChain).doFilter(any(), any());

        tenantFilter.doFilter(request, response, filterChain);

        assertEquals(defaultOrgId, capturedOrgId[0]);
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void shouldNotFilter_publicEndpoints() throws Exception {
        // Actuator endpoint -- should be skipped by shouldNotFilter
        setupJwtAuth("some-user");

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/actuator/health");
        MockHttpServletResponse response = new MockHttpServletResponse();

        tenantFilter.doFilter(request, response, filterChain);

        // For public endpoints, TenantFilter skips tenant resolution entirely
        verify(userRepository, never()).findByKeycloakId(anyString());
        assertNull(tenantContext.getOrganizationId());
        verify(filterChain).doFilter(request, response);
    }

    private void setupJwtAuth(String keycloakId) {
        Jwt jwt = mock(Jwt.class);
        when(jwt.getSubject()).thenReturn(keycloakId);
        JwtAuthenticationToken auth = new JwtAuthenticationToken(jwt);
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    // ─── Additional coverage ─────────────────────────────────────────────

    @Test
    void doFilter_webhookEndpoint_skipsFilter() throws Exception {
        setupJwtAuth("some-user");

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/webhooks/stripe");
        MockHttpServletResponse response = new MockHttpServletResponse();

        tenantFilter.doFilter(request, response, filterChain);

        verify(userRepository, never()).findByKeycloakId(anyString());
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void doFilter_authEndpoint_skipsFilter() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/auth/refresh");
        MockHttpServletResponse response = new MockHttpServletResponse();

        tenantFilter.doFilter(request, response, filterChain);

        verify(userRepository, never()).findByKeycloakId(anyString());
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void doFilter_publicEndpoint_skipsFilter() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/public/landing");
        MockHttpServletResponse response = new MockHttpServletResponse();

        tenantFilter.doFilter(request, response, filterChain);

        verify(userRepository, never()).findByKeycloakId(anyString());
    }

    @Test
    void doFilter_swaggerUi_skipsFilter() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/swagger-ui/index.html");
        MockHttpServletResponse response = new MockHttpServletResponse();

        tenantFilter.doFilter(request, response, filterChain);

        verify(userRepository, never()).findByKeycloakId(anyString());
    }

    @Test
    void doFilter_apiDocs_skipsFilter() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/v3/api-docs");
        MockHttpServletResponse response = new MockHttpServletResponse();

        tenantFilter.doFilter(request, response, filterChain);

        verify(userRepository, never()).findByKeycloakId(anyString());
    }

    @Test
    void doFilter_apiHealth_skipsFilter() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/health");
        MockHttpServletResponse response = new MockHttpServletResponse();

        tenantFilter.doFilter(request, response, filterChain);

        verify(userRepository, never()).findByKeycloakId(anyString());
    }

    @Test
    void doFilter_userWithNullOrg_nonStaff_attemptsFallback() throws Exception {
        String keycloakId = "no-org-user";
        Long defaultOrgId = 7L;
        setupJwtAuth(keycloakId);

        User user = new User("No", "Org", "no@org.com", "p");
        user.setOrganizationId(null);
        user.setRole(UserRole.HOST); // not staff

        when(valueOperations.get("tenant:" + keycloakId)).thenReturn(null);
        when(userRepository.findByKeycloakId(keycloakId)).thenReturn(Optional.of(user));

        Organization org = new Organization("Default", OrganizationType.INDIVIDUAL, "default");
        org.setId(defaultOrgId);
        when(organizationRepository.findAll()).thenReturn(List.of(org));

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        request.setRequestURI("/api/properties");

        Long[] capturedOrgId = {null};
        doAnswer(inv -> {
            capturedOrgId[0] = tenantContext.getOrganizationId();
            return null;
        }).when(filterChain).doFilter(any(), any());

        tenantFilter.doFilter(request, response, filterChain);

        assertEquals(defaultOrgId, capturedOrgId[0]);
    }

    @Test
    void doFilter_userIsSystemOrg_skipsHibernateFilter() throws Exception {
        String keycloakId = "system-user";
        Long orgId = 5L;
        setupJwtAuth(keycloakId);

        User user = new User("Sys", "User", "sys@sys.com", "p");
        user.setOrganizationId(orgId);
        user.setRole(UserRole.HOST);

        Organization systemOrg = new Organization("System", OrganizationType.SYSTEM, "system");
        systemOrg.setId(orgId);

        when(valueOperations.get("tenant:" + keycloakId)).thenReturn(null);
        when(userRepository.findByKeycloakId(keycloakId)).thenReturn(Optional.of(user));
        when(organizationRepository.findById(orgId)).thenReturn(Optional.of(systemOrg));

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        request.setRequestURI("/api/properties");

        Boolean[] capturedSystem = {null};
        doAnswer(inv -> {
            capturedSystem[0] = tenantContext.isSystemOrg();
            return null;
        }).when(filterChain).doFilter(any(), any());

        tenantFilter.doFilter(request, response, filterChain);

        assertTrue(capturedSystem[0]);
        // SYSTEM org: no Hibernate filter
        verify(session, never()).enableFilter("organizationFilter");
    }

    @Test
    void doFilter_orgLookupThrows_doesNotCrash() throws Exception {
        String keycloakId = "kc-id";
        setupJwtAuth(keycloakId);

        User user = new User("Test", "User", "t@t.com", "p");
        user.setOrganizationId(1L);
        user.setRole(UserRole.HOST);

        when(valueOperations.get("tenant:" + keycloakId)).thenReturn(null);
        when(userRepository.findByKeycloakId(keycloakId)).thenReturn(Optional.of(user));
        when(organizationRepository.findById(1L))
                .thenThrow(new RuntimeException("DB error"));

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        request.setRequestURI("/api/properties");

        // Should not throw
        tenantFilter.doFilter(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
    }

    @Test
    void doFilter_cacheReadThrows_fallsBackToDbLookup() throws Exception {
        String keycloakId = "kc-cache-err";
        Long orgId = 3L;
        setupJwtAuth(keycloakId);

        when(valueOperations.get("tenant:" + keycloakId))
                .thenThrow(new RuntimeException("Redis down"));

        User user = new User("U", "U", "u@u.com", "p");
        user.setOrganizationId(orgId);
        user.setRole(UserRole.HOST);
        when(userRepository.findByKeycloakId(keycloakId)).thenReturn(Optional.of(user));

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        request.setRequestURI("/api/properties");

        Long[] capturedOrgId = {null};
        doAnswer(inv -> {
            capturedOrgId[0] = tenantContext.getOrganizationId();
            return null;
        }).when(filterChain).doFilter(any(), any());

        tenantFilter.doFilter(request, response, filterChain);

        assertEquals(orgId, capturedOrgId[0]);
    }

    @Test
    void doFilter_cachedSuperAdmin_noHibernateFilter() throws Exception {
        String keycloakId = "kc-admin-cached";
        setupJwtAuth(keycloakId);
        // cached as super admin
        TenantFilter.TenantInfo cached = new TenantFilter.TenantInfo(null, true, false);
        when(valueOperations.get("tenant:" + keycloakId)).thenReturn(cached);

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        request.setRequestURI("/api/properties");

        Boolean[] capturedSuper = {null};
        doAnswer(inv -> {
            capturedSuper[0] = tenantContext.isSuperAdmin();
            return null;
        }).when(filterChain).doFilter(any(), any());

        tenantFilter.doFilter(request, response, filterChain);

        assertTrue(capturedSuper[0]);
        verify(userRepository, never()).findByKeycloakId(anyString());
    }

    @Test
    void doFilter_userNotInDbNoFallback_skipsResolution() throws Exception {
        String keycloakId = "no-db-user";
        setupJwtAuth(keycloakId);

        when(valueOperations.get("tenant:" + keycloakId)).thenReturn(null);
        when(userRepository.findByKeycloakId(keycloakId)).thenReturn(Optional.empty());
        // 0 or > 1 orgs prevents fallback
        when(organizationRepository.findAll()).thenReturn(List.of());

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        request.setRequestURI("/api/properties");

        tenantFilter.doFilter(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
    }
}
