package com.clenzy.controller;

import com.clenzy.model.SecurityAuditEventType;
import com.clenzy.model.SecurityAuditLog;
import com.clenzy.model.UserStatus;
import com.clenzy.repository.SecurityAuditLogRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.JwtTokenService;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.search.RequiredSearch;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.http.HttpStatus;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Statement;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MonitoringControllerTest {

    @Mock private SecurityAuditLogRepository auditLogRepository;
    @Mock private UserRepository userRepository;
    @Mock private JwtTokenService jwtTokenService;
    @Mock private DataSource dataSource;
    @Mock private RedisConnectionFactory redisConnectionFactory;
    @Mock private MeterRegistry meterRegistry;

    private MonitoringController controller;

    @BeforeEach
    void setUp() {
        controller = new MonitoringController(
            auditLogRepository, userRepository, jwtTokenService,
            dataSource, redisConnectionFactory, meterRegistry);
    }

    // ── Health endpoint ─────────────────────────────────────────────────────────

    @Test
    @SuppressWarnings("unchecked")
    void whenGetHealth_thenReturnsServicesAndMetrics() throws Exception {
        // Mock PostgreSQL check
        Connection sqlConn = mock(Connection.class);
        Statement stmt = mock(Statement.class);
        when(dataSource.getConnection()).thenReturn(sqlConn);
        when(sqlConn.createStatement()).thenReturn(stmt);

        // Mock Redis check
        RedisConnection redisConn = mock(RedisConnection.class);
        when(redisConnectionFactory.getConnection()).thenReturn(redisConn);
        when(redisConn.ping()).thenReturn("PONG");

        var response = controller.getHealth();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());

        var body = response.getBody();
        assertTrue(body.containsKey("services"));
        assertTrue(body.containsKey("systemMetrics"));

        List<Map<String, Object>> services = (List<Map<String, Object>>) body.get("services");
        assertFalse(services.isEmpty());

        // PostgreSQL should be UP
        var pgService = services.stream()
            .filter(s -> "PostgreSQL".equals(s.get("name")))
            .findFirst();
        assertTrue(pgService.isPresent());
        assertEquals("UP", pgService.get().get("status"));
        assertEquals("DATABASE", pgService.get().get("category"));
        assertTrue((Boolean) pgService.get().get("critical"));

        // Redis should be UP
        var redisService = services.stream()
            .filter(s -> "Redis".equals(s.get("name")))
            .findFirst();
        assertTrue(redisService.isPresent());
        assertEquals("UP", redisService.get().get("status"));

        // System metrics
        Map<String, Object> sysMetrics = (Map<String, Object>) body.get("systemMetrics");
        assertTrue(sysMetrics.containsKey("cpuUsage"));
        assertTrue(sysMetrics.containsKey("memoryUsage"));
        assertTrue(sysMetrics.containsKey("heapUsedMb"));
        assertTrue(sysMetrics.containsKey("heapMaxMb"));
        assertTrue(sysMetrics.containsKey("diskUsage"));
        assertTrue(sysMetrics.containsKey("uptimeSeconds"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void whenGetHealth_dbDown_thenReportsDown() throws Exception {
        // DB throws
        when(dataSource.getConnection()).thenThrow(new java.sql.SQLException("Connection refused"));

        // Redis OK
        RedisConnection redisConn = mock(RedisConnection.class);
        when(redisConnectionFactory.getConnection()).thenReturn(redisConn);
        when(redisConn.ping()).thenReturn("PONG");

        var response = controller.getHealth();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> services = (List<Map<String, Object>>) response.getBody().get("services");

        var pgService = services.stream()
            .filter(s -> "PostgreSQL".equals(s.get("name")))
            .findFirst();
        assertTrue(pgService.isPresent());
        assertEquals("DOWN", pgService.get().get("status"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void whenGetHealth_redisDown_thenReportsDown() throws Exception {
        // DB OK
        Connection sqlConn = mock(Connection.class);
        Statement stmt = mock(Statement.class);
        when(dataSource.getConnection()).thenReturn(sqlConn);
        when(sqlConn.createStatement()).thenReturn(stmt);

        // Redis throws
        when(redisConnectionFactory.getConnection())
            .thenThrow(new org.springframework.data.redis.RedisConnectionFailureException("refused"));

        var response = controller.getHealth();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> services = (List<Map<String, Object>>) response.getBody().get("services");

        var redisService = services.stream()
            .filter(s -> "Redis".equals(s.get("name")))
            .findFirst();
        assertTrue(redisService.isPresent());
        assertEquals("DOWN", redisService.get().get("status"));
    }

    // ── Keycloak metrics endpoint ───────────────────────────────────────────────

    @Test
    @SuppressWarnings("unchecked")
    void whenGetKeycloakMetrics_thenReturnsAllSections() {
        // Users
        when(userRepository.count()).thenReturn(42L);
        when(userRepository.countByStatus(UserStatus.ACTIVE)).thenReturn(38L);
        when(userRepository.countByCreatedAtAfter(any())).thenReturn(3L);

        // Token metrics
        var tokenMetrics = new JwtTokenService.TokenMetrics(
            120, 10, 5, 3, 500, 2, 140, 85.7);
        when(jwtTokenService.getMetrics()).thenReturn(tokenMetrics);

        // Micrometer (return null — no metrics registered yet)
        when(meterRegistry.find(anyString())).thenReturn(mock(io.micrometer.core.instrument.search.Search.class));

        // Security counts
        when(auditLogRepository.countByEventTypeAndCreatedAtAfter(
            eq(SecurityAuditEventType.LOGIN_FAILURE), any())).thenReturn(5L);
        when(auditLogRepository.countByEventTypeAndCreatedAtAfter(
            eq(SecurityAuditEventType.PERMISSION_DENIED), any())).thenReturn(2L);
        when(auditLogRepository.countByEventTypeAndCreatedAtAfter(
            eq(SecurityAuditEventType.SUSPICIOUS_ACTIVITY), any())).thenReturn(0L);
        when(auditLogRepository.findTopByEventTypeInOrderByCreatedAtDesc(anyList()))
            .thenReturn(Optional.empty());

        var response = controller.getKeycloakMetrics();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        var body = response.getBody();
        assertNotNull(body);

        // Users section
        Map<String, Object> users = (Map<String, Object>) body.get("users");
        assertEquals(42L, users.get("total"));
        assertEquals(38L, users.get("active"));
        assertEquals(4L, users.get("inactive"));
        assertEquals(3L, users.get("newThisWeek"));

        // Sessions section
        Map<String, Object> sessions = (Map<String, Object>) body.get("sessions");
        assertEquals(140L, sessions.get("totalTokens"));
        assertEquals(120L, sessions.get("validTokens"));
        assertEquals(5L, sessions.get("revokedTokens"));
        assertEquals(500L, sessions.get("cacheHits"));

        // Security section
        Map<String, Object> security = (Map<String, Object>) body.get("security");
        assertEquals(5L, security.get("failedLogins"));
        assertEquals(2L, security.get("permissionDenied"));
        assertEquals(0L, security.get("suspiciousActivity"));
        assertNull(security.get("lastIncident"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void whenGetKeycloakMetrics_withLastIncident_thenReturnsTimestamp() {
        when(userRepository.count()).thenReturn(10L);
        when(userRepository.countByStatus(UserStatus.ACTIVE)).thenReturn(10L);
        when(userRepository.countByCreatedAtAfter(any())).thenReturn(0L);

        var tokenMetrics = new JwtTokenService.TokenMetrics(0, 0, 0, 0, 0, 0, 0, 0);
        when(jwtTokenService.getMetrics()).thenReturn(tokenMetrics);
        when(meterRegistry.find(anyString())).thenReturn(mock(io.micrometer.core.instrument.search.Search.class));

        when(auditLogRepository.countByEventTypeAndCreatedAtAfter(any(), any())).thenReturn(0L);

        // Last incident exists
        SecurityAuditLog incident = new SecurityAuditLog(
            SecurityAuditEventType.LOGIN_FAILURE, "POST /api/auth", "DENIED");
        Instant incidentTime = Instant.parse("2026-02-20T14:30:00Z");
        incident.setCreatedAt(incidentTime);
        when(auditLogRepository.findTopByEventTypeInOrderByCreatedAtDesc(anyList()))
            .thenReturn(Optional.of(incident));

        var response = controller.getKeycloakMetrics();

        Map<String, Object> security = (Map<String, Object>) response.getBody().get("security");
        assertEquals(incidentTime.toString(), security.get("lastIncident"));
    }

    // ── Audit logs endpoint ─────────────────────────────────────────────────────

    @Test
    void whenGetAuditLogs_noFilters_thenReturnsPaginatedResults() {
        SecurityAuditLog log1 = new SecurityAuditLog(
            SecurityAuditEventType.LOGIN_SUCCESS, "POST /api/auth", "SUCCESS");
        log1.setId(1L);
        log1.setActorEmail("admin@example.com");
        log1.setActorIp("192.168.1.1");

        SecurityAuditLog log2 = new SecurityAuditLog(
            SecurityAuditEventType.LOGIN_FAILURE, "POST /api/auth", "DENIED");
        log2.setId(2L);
        log2.setActorEmail("hacker@example.com");

        Page<SecurityAuditLog> mockPage = new PageImpl<>(List.of(log1, log2));
        when(auditLogRepository.findAll(any(Specification.class), any(Pageable.class)))
            .thenReturn(mockPage);

        var response = controller.getAuditLogs(
            null, null, null,
            org.springframework.data.domain.PageRequest.of(0, 20));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(2, response.getBody().getContent().size());
        assertEquals("LOGIN_SUCCESS", response.getBody().getContent().get(0).eventType());
        assertEquals("admin@example.com", response.getBody().getContent().get(0).actorEmail());
    }

    @Test
    void whenGetAuditLogs_withEventTypeFilter_thenFilters() {
        Page<SecurityAuditLog> emptyPage = new PageImpl<>(List.of());
        when(auditLogRepository.findAll(any(Specification.class), any(Pageable.class)))
            .thenReturn(emptyPage);

        var response = controller.getAuditLogs(
            SecurityAuditEventType.SUSPICIOUS_ACTIVITY, null, null,
            org.springframework.data.domain.PageRequest.of(0, 20));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(0, response.getBody().getContent().size());
        verify(auditLogRepository).findAll(any(Specification.class), any(Pageable.class));
    }

    @Test
    void whenGetAuditLogs_emptyResults_thenReturnsEmptyPage() {
        Page<SecurityAuditLog> emptyPage = new PageImpl<>(List.of());
        when(auditLogRepository.findAll(any(Specification.class), any(Pageable.class)))
            .thenReturn(emptyPage);

        var response = controller.getAuditLogs(
            null, null, null,
            org.springframework.data.domain.PageRequest.of(0, 20));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody().getContent().isEmpty());
        assertEquals(0, response.getBody().getTotalElements());
    }
}
