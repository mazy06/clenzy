package com.clenzy.controller;

import com.clenzy.model.SecurityAuditEventType;
import com.clenzy.model.SecurityAuditLog;
import com.clenzy.model.UserStatus;
import com.clenzy.repository.SecurityAuditLogRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.JwtTokenService;
import io.micrometer.core.instrument.MeterRegistry;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
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

import static org.assertj.core.api.Assertions.assertThat;
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

    // ── Health endpoint ─────────────────────────────────────────────

    @Nested
    @DisplayName("getHealth")
    class GetHealth {

        @Test
        @DisplayName("when all services up then returns services and metrics")
        @SuppressWarnings("unchecked")
        void whenAllServicesUp_thenReturnsServicesAndMetrics() throws Exception {
            // Arrange
            Connection sqlConn = mock(Connection.class);
            Statement stmt = mock(Statement.class);
            when(dataSource.getConnection()).thenReturn(sqlConn);
            when(sqlConn.createStatement()).thenReturn(stmt);

            RedisConnection redisConn = mock(RedisConnection.class);
            when(redisConnectionFactory.getConnection()).thenReturn(redisConn);
            when(redisConn.ping()).thenReturn("PONG");

            // Act
            var response = controller.getHealth();

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).isNotNull();

            var body = response.getBody();
            assertThat(body).containsKey("services").containsKey("systemMetrics");

            List<Map<String, Object>> services = (List<Map<String, Object>>) body.get("services");
            assertThat(services).isNotEmpty();

            // PostgreSQL should be UP
            var pgService = services.stream()
                .filter(s -> "PostgreSQL".equals(s.get("name")))
                .findFirst();
            assertThat(pgService).isPresent();
            assertThat(pgService.get()).containsEntry("status", "UP")
                    .containsEntry("category", "DATABASE");
            assertThat((Boolean) pgService.get().get("critical")).isTrue();

            // Redis should be UP
            var redisService = services.stream()
                .filter(s -> "Redis".equals(s.get("name")))
                .findFirst();
            assertThat(redisService).isPresent();
            assertThat(redisService.get()).containsEntry("status", "UP");

            // System metrics
            Map<String, Object> sysMetrics = (Map<String, Object>) body.get("systemMetrics");
            assertThat(sysMetrics).containsKeys("cpuUsage", "memoryUsage", "heapUsedMb",
                    "heapMaxMb", "diskUsage", "uptimeSeconds");
        }

        @Test
        @DisplayName("when DB is down then reports DOWN status for PostgreSQL")
        @SuppressWarnings("unchecked")
        void whenDbDown_thenReportsDown() throws Exception {
            // Arrange
            when(dataSource.getConnection()).thenThrow(new java.sql.SQLException("Connection refused"));

            RedisConnection redisConn = mock(RedisConnection.class);
            when(redisConnectionFactory.getConnection()).thenReturn(redisConn);
            when(redisConn.ping()).thenReturn("PONG");

            // Act
            var response = controller.getHealth();

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            List<Map<String, Object>> services = (List<Map<String, Object>>) response.getBody().get("services");

            var pgService = services.stream()
                .filter(s -> "PostgreSQL".equals(s.get("name")))
                .findFirst();
            assertThat(pgService).isPresent();
            assertThat(pgService.get()).containsEntry("status", "DOWN");
        }

        @Test
        @DisplayName("when Redis is down then reports DOWN status for Redis")
        @SuppressWarnings("unchecked")
        void whenRedisDown_thenReportsDown() throws Exception {
            // Arrange
            Connection sqlConn = mock(Connection.class);
            Statement stmt = mock(Statement.class);
            when(dataSource.getConnection()).thenReturn(sqlConn);
            when(sqlConn.createStatement()).thenReturn(stmt);

            when(redisConnectionFactory.getConnection())
                .thenThrow(new org.springframework.data.redis.RedisConnectionFailureException("refused"));

            // Act
            var response = controller.getHealth();

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            List<Map<String, Object>> services = (List<Map<String, Object>>) response.getBody().get("services");

            var redisService = services.stream()
                .filter(s -> "Redis".equals(s.get("name")))
                .findFirst();
            assertThat(redisService).isPresent();
            assertThat(redisService.get()).containsEntry("status", "DOWN");
        }

        @Test
        @DisplayName("when Keycloak URL not configured then reports UNKNOWN")
        @SuppressWarnings("unchecked")
        void whenKeycloakUrlNotConfigured_thenReportsUnknown() throws Exception {
            // Arrange
            Connection sqlConn = mock(Connection.class);
            Statement stmt = mock(Statement.class);
            when(dataSource.getConnection()).thenReturn(sqlConn);
            when(sqlConn.createStatement()).thenReturn(stmt);

            RedisConnection redisConn = mock(RedisConnection.class);
            when(redisConnectionFactory.getConnection()).thenReturn(redisConn);
            when(redisConn.ping()).thenReturn("PONG");

            // keycloakUrl defaults to "" (empty) from @Value

            // Act
            var response = controller.getHealth();

            // Assert
            List<Map<String, Object>> services = (List<Map<String, Object>>) response.getBody().get("services");
            var kcService = services.stream()
                .filter(s -> "Keycloak".equals(s.get("name")))
                .findFirst();
            assertThat(kcService).isPresent();
            assertThat(kcService.get()).containsEntry("status", "UNKNOWN");
        }
    }

    // ── Keycloak/Platform Metrics endpoint ──────────────────────────

    @Nested
    @DisplayName("getKeycloakMetrics")
    class GetKeycloakMetrics {

        @Test
        @DisplayName("when called then returns all sections (users, sessions, performance, security)")
        @SuppressWarnings("unchecked")
        void whenCalled_thenReturnsAllSections() {
            // Arrange
            when(userRepository.count()).thenReturn(42L);
            when(userRepository.countByStatus(UserStatus.ACTIVE)).thenReturn(38L);
            when(userRepository.countByCreatedAtAfter(any())).thenReturn(3L);

            var tokenMetrics = new JwtTokenService.TokenMetrics(
                120, 10, 5, 3, 500, 2, 140, 85.7);
            when(jwtTokenService.getMetrics()).thenReturn(tokenMetrics);

            when(meterRegistry.find(anyString()))
                    .thenReturn(mock(io.micrometer.core.instrument.search.Search.class));

            when(auditLogRepository.countByEventTypeAndCreatedAtAfter(
                eq(SecurityAuditEventType.LOGIN_FAILURE), any())).thenReturn(5L);
            when(auditLogRepository.countByEventTypeAndCreatedAtAfter(
                eq(SecurityAuditEventType.PERMISSION_DENIED), any())).thenReturn(2L);
            when(auditLogRepository.countByEventTypeAndCreatedAtAfter(
                eq(SecurityAuditEventType.SUSPICIOUS_ACTIVITY), any())).thenReturn(0L);
            when(auditLogRepository.findTopByEventTypeInOrderByCreatedAtDesc(anyList()))
                .thenReturn(Optional.empty());

            // Act
            var response = controller.getKeycloakMetrics();

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            var body = response.getBody();
            assertThat(body).isNotNull();

            // Users section
            Map<String, Object> users = (Map<String, Object>) body.get("users");
            assertThat(users).containsEntry("total", 42L)
                    .containsEntry("active", 38L)
                    .containsEntry("inactive", 4L)
                    .containsEntry("newThisWeek", 3L);

            // Sessions section
            Map<String, Object> sessions = (Map<String, Object>) body.get("sessions");
            assertThat(sessions).containsEntry("totalTokens", 140L)
                    .containsEntry("validTokens", 120L)
                    .containsEntry("revokedTokens", 5L)
                    .containsEntry("cacheHits", 500L);

            // Security section
            Map<String, Object> security = (Map<String, Object>) body.get("security");
            assertThat(security).containsEntry("failedLogins", 5L)
                    .containsEntry("permissionDenied", 2L)
                    .containsEntry("suspiciousActivity", 0L);
            assertThat(security.get("lastIncident")).isNull();
        }

        @Test
        @DisplayName("when last incident exists then returns incident timestamp")
        @SuppressWarnings("unchecked")
        void whenLastIncidentExists_thenReturnsTimestamp() {
            // Arrange
            when(userRepository.count()).thenReturn(10L);
            when(userRepository.countByStatus(UserStatus.ACTIVE)).thenReturn(10L);
            when(userRepository.countByCreatedAtAfter(any())).thenReturn(0L);

            var tokenMetrics = new JwtTokenService.TokenMetrics(0, 0, 0, 0, 0, 0, 0, 0);
            when(jwtTokenService.getMetrics()).thenReturn(tokenMetrics);
            when(meterRegistry.find(anyString()))
                    .thenReturn(mock(io.micrometer.core.instrument.search.Search.class));

            when(auditLogRepository.countByEventTypeAndCreatedAtAfter(any(), any())).thenReturn(0L);

            SecurityAuditLog incident = new SecurityAuditLog(
                SecurityAuditEventType.LOGIN_FAILURE, "POST /api/auth", "DENIED");
            Instant incidentTime = Instant.parse("2026-02-20T14:30:00Z");
            incident.setCreatedAt(incidentTime);
            when(auditLogRepository.findTopByEventTypeInOrderByCreatedAtDesc(anyList()))
                .thenReturn(Optional.of(incident));

            // Act
            var response = controller.getKeycloakMetrics();

            // Assert
            Map<String, Object> security = (Map<String, Object>) response.getBody().get("security");
            assertThat(security.get("lastIncident")).isEqualTo(incidentTime.toString());
        }
    }

    // ── Audit Logs endpoint ─────────────────────────────────────────

    @Nested
    @DisplayName("getAuditLogs")
    class GetAuditLogs {

        @Test
        @DisplayName("when no filters then returns paginated results")
        void whenNoFilters_thenReturnsPaginatedResults() {
            // Arrange
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

            // Act
            var response = controller.getAuditLogs(null, null, null, PageRequest.of(0, 20));

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getContent()).hasSize(2);
            assertThat(response.getBody().getContent().get(0).eventType()).isEqualTo("LOGIN_SUCCESS");
            assertThat(response.getBody().getContent().get(0).actorEmail()).isEqualTo("admin@example.com");
        }

        @Test
        @DisplayName("when event type filter then applies filter")
        void whenEventTypeFilter_thenAppliesFilter() {
            // Arrange
            Page<SecurityAuditLog> emptyPage = new PageImpl<>(List.of());
            when(auditLogRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(emptyPage);

            // Act
            var response = controller.getAuditLogs(
                SecurityAuditEventType.SUSPICIOUS_ACTIVITY, null, null, PageRequest.of(0, 20));

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody().getContent()).isEmpty();
            verify(auditLogRepository).findAll(any(Specification.class), any(Pageable.class));
        }

        @Test
        @DisplayName("when actorId filter then applies filter")
        void whenActorIdFilter_thenAppliesFilter() {
            // Arrange
            Page<SecurityAuditLog> emptyPage = new PageImpl<>(List.of());
            when(auditLogRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(emptyPage);

            // Act
            var response = controller.getAuditLogs(null, "actor-123", null, PageRequest.of(0, 20));

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            verify(auditLogRepository).findAll(any(Specification.class), any(Pageable.class));
        }

        @Test
        @DisplayName("when result filter then applies filter")
        void whenResultFilter_thenAppliesFilter() {
            // Arrange
            Page<SecurityAuditLog> emptyPage = new PageImpl<>(List.of());
            when(auditLogRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(emptyPage);

            // Act
            var response = controller.getAuditLogs(null, null, "DENIED", PageRequest.of(0, 20));

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        }

        @Test
        @DisplayName("when all filters applied then combines them")
        void whenAllFilters_thenCombinesThem() {
            // Arrange
            Page<SecurityAuditLog> emptyPage = new PageImpl<>(List.of());
            when(auditLogRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(emptyPage);

            // Act
            var response = controller.getAuditLogs(
                SecurityAuditEventType.LOGIN_FAILURE, "actor-1", "DENIED", PageRequest.of(0, 20));

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody().getContent()).isEmpty();
        }

        @Test
        @DisplayName("when empty results then returns empty page")
        void whenEmptyResults_thenReturnsEmptyPage() {
            // Arrange
            Page<SecurityAuditLog> emptyPage = new PageImpl<>(List.of());
            when(auditLogRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(emptyPage);

            // Act
            var response = controller.getAuditLogs(null, null, null, PageRequest.of(0, 20));

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody().getContent()).isEmpty();
            assertThat(response.getBody().getTotalElements()).isZero();
        }
    }

    // ── Test Coverage endpoint ──────────────────────────────────────

    @Nested
    @DisplayName("getTestCoverage")
    class GetTestCoverage {

        @Test
        @DisplayName("when called then returns OK with available key")
        void whenCalled_thenReturnsOkWithAvailableKey() {
            // Act — the report may or may not exist depending on build state
            var response = controller.getTestCoverage();

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody()).containsKey("available");
        }
    }
}
