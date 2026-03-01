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

        tenantFilter.doFilter(request, response, filterChain);

        assertEquals(orgId, tenantContext.getOrganizationId());
        assertFalse(tenantContext.isSuperAdmin());
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

        tenantFilter.doFilter(request, response, filterChain);

        assertTrue(tenantContext.isSuperAdmin());
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

        tenantFilter.doFilter(request, response, filterChain);

        assertEquals(orgId, tenantContext.getOrganizationId());
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

        tenantFilter.doFilter(request, response, filterChain);

        assertEquals(defaultOrgId, tenantContext.getOrganizationId());
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
}
