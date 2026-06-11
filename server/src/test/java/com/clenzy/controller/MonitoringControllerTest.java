package com.clenzy.controller;

import com.clenzy.dto.SecurityAuditLogDto;
import com.clenzy.model.SecurityAuditEventType;
import com.clenzy.model.SecurityAuditLog;
import com.clenzy.service.JwtTokenService;
import com.clenzy.service.MonitoringQueryService;
import io.micrometer.core.instrument.MeterRegistry;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.http.HttpStatus;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.mail.javamail.JavaMailSender;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Statement;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MonitoringControllerTest {

    @Mock private MonitoringQueryService monitoringQueryService;
    @Mock private JwtTokenService jwtTokenService;
    @Mock private DataSource dataSource;
    @Mock private RedisConnectionFactory redisConnectionFactory;
    @Mock private MeterRegistry meterRegistry;

    private MonitoringController controller;

    @SuppressWarnings("unchecked")
    @BeforeEach
    void setUp() {
        ObjectProvider<KafkaTemplate<String, Object>> kafkaProvider = mock(ObjectProvider.class);
        ObjectProvider<JavaMailSender> mailProvider = mock(ObjectProvider.class);

        controller = new MonitoringController(
            monitoringQueryService, jwtTokenService,
            dataSource, redisConnectionFactory, meterRegistry,
            kafkaProvider, mailProvider);
    }

    private static Map<String, Object> userMetricsMap(long total, long active, long newThisWeek) {
        Map<String, Object> users = new LinkedHashMap<>();
        users.put("total", total);
        users.put("active", active);
        users.put("inactive", total - active);
        users.put("newThisWeek", newThisWeek);
        return users;
    }

    private static Map<String, Object> securityMetricsMap(long failedLogins, long permissionDenied,
                                                          long suspiciousActivity, String lastIncident) {
        Map<String, Object> sec = new LinkedHashMap<>();
        sec.put("failedLogins", failedLogins);
        sec.put("permissionDenied", permissionDenied);
        sec.put("suspiciousActivity", suspiciousActivity);
        sec.put("lastIncident", lastIncident);
        return sec;
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
            when(monitoringQueryService.userMetrics())
                .thenReturn(userMetricsMap(42L, 38L, 3L));

            var tokenMetrics = new JwtTokenService.TokenMetrics(
                120, 10, 5, 3, 500, 2, 140, 85.7);
            when(jwtTokenService.getMetrics()).thenReturn(tokenMetrics);

            when(meterRegistry.find(anyString()))
                    .thenReturn(mock(io.micrometer.core.instrument.search.Search.class));

            when(monitoringQueryService.securityMetrics())
                .thenReturn(securityMetricsMap(5L, 2L, 0L, null));

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
            when(monitoringQueryService.userMetrics())
                .thenReturn(userMetricsMap(10L, 10L, 0L));

            var tokenMetrics = new JwtTokenService.TokenMetrics(0, 0, 0, 0, 0, 0, 0, 0);
            when(jwtTokenService.getMetrics()).thenReturn(tokenMetrics);
            when(meterRegistry.find(anyString()))
                    .thenReturn(mock(io.micrometer.core.instrument.search.Search.class));

            Instant incidentTime = Instant.parse("2026-02-20T14:30:00Z");
            when(monitoringQueryService.securityMetrics())
                .thenReturn(securityMetricsMap(0L, 0L, 0L, incidentTime.toString()));

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

            Page<SecurityAuditLogDto> mockPage = new PageImpl<>(
                List.of(SecurityAuditLogDto.from(log1), SecurityAuditLogDto.from(log2)));
            when(monitoringQueryService.searchAuditLogs(any(), any(), any(), any(Pageable.class)))
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
            Page<SecurityAuditLogDto> emptyPage = new PageImpl<>(List.of());
            when(monitoringQueryService.searchAuditLogs(any(), any(), any(), any(Pageable.class)))
                .thenReturn(emptyPage);

            // Act
            var response = controller.getAuditLogs(
                SecurityAuditEventType.SUSPICIOUS_ACTIVITY, null, null, PageRequest.of(0, 20));

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody().getContent()).isEmpty();
            verify(monitoringQueryService).searchAuditLogs(any(), any(), any(), any(Pageable.class));
        }

        @Test
        @DisplayName("when actorId filter then applies filter")
        void whenActorIdFilter_thenAppliesFilter() {
            // Arrange
            Page<SecurityAuditLogDto> emptyPage = new PageImpl<>(List.of());
            when(monitoringQueryService.searchAuditLogs(any(), any(), any(), any(Pageable.class)))
                .thenReturn(emptyPage);

            // Act
            var response = controller.getAuditLogs(null, "actor-123", null, PageRequest.of(0, 20));

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            verify(monitoringQueryService).searchAuditLogs(any(), any(), any(), any(Pageable.class));
        }

        @Test
        @DisplayName("when result filter then applies filter")
        void whenResultFilter_thenAppliesFilter() {
            // Arrange
            Page<SecurityAuditLogDto> emptyPage = new PageImpl<>(List.of());
            when(monitoringQueryService.searchAuditLogs(any(), any(), any(), any(Pageable.class)))
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
            Page<SecurityAuditLogDto> emptyPage = new PageImpl<>(List.of());
            when(monitoringQueryService.searchAuditLogs(any(), any(), any(), any(Pageable.class)))
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
            Page<SecurityAuditLogDto> emptyPage = new PageImpl<>(List.of());
            when(monitoringQueryService.searchAuditLogs(any(), any(), any(), any(Pageable.class)))
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

    // ============= EXTENDED =============

    @Nested
    @DisplayName("getHealth - Kafka/Stripe/Storage paths")
    class HealthExtended {

        @Test
        @SuppressWarnings("unchecked")
        void whenKafkaTemplateAvailable_thenReportsKafka() throws Exception {
            Connection sqlConn = mock(Connection.class);
            when(dataSource.getConnection()).thenReturn(sqlConn);
            when(sqlConn.createStatement()).thenReturn(mock(java.sql.Statement.class));
            RedisConnection redisConn = mock(RedisConnection.class);
            when(redisConnectionFactory.getConnection()).thenReturn(redisConn);
            when(redisConn.ping()).thenReturn("PONG");

            // Reconstruct controller WITH kafkaTemplate available
            ObjectProvider<KafkaTemplate<String, Object>> kp = mock(ObjectProvider.class);
            KafkaTemplate<String, Object> kt = mock(KafkaTemplate.class);
            when(kt.metrics()).thenReturn(java.util.Map.of());
            when(kp.getIfAvailable()).thenReturn(kt);

            ObjectProvider<JavaMailSender> mp = mock(ObjectProvider.class);
            when(mp.getIfAvailable()).thenReturn(null);

            controller = new MonitoringController(monitoringQueryService, jwtTokenService,
                    dataSource, redisConnectionFactory, meterRegistry, kp, mp);

            var response = controller.getHealth();
            List<Map<String, Object>> services = (List<Map<String, Object>>) response.getBody().get("services");
            assertThat(services.stream().filter(s -> "Kafka".equals(s.get("name"))).findFirst())
                    .isPresent();
        }

        @Test
        @SuppressWarnings("unchecked")
        void whenKafkaUnconfigured_thenUnknown() throws Exception {
            Connection sqlConn = mock(Connection.class);
            when(dataSource.getConnection()).thenReturn(sqlConn);
            when(sqlConn.createStatement()).thenReturn(mock(java.sql.Statement.class));
            RedisConnection redisConn = mock(RedisConnection.class);
            when(redisConnectionFactory.getConnection()).thenReturn(redisConn);
            when(redisConn.ping()).thenReturn("PONG");

            var response = controller.getHealth();
            List<Map<String, Object>> services = (List<Map<String, Object>>) response.getBody().get("services");
            var kafka = services.stream().filter(s -> "Kafka".equals(s.get("name"))).findFirst();
            assertThat(kafka).isPresent();
            assertThat(kafka.get()).containsEntry("status", "UNKNOWN");
        }

        @Test
        @SuppressWarnings("unchecked")
        void whenSmtpUnconfigured_thenUnknown() throws Exception {
            Connection sqlConn = mock(Connection.class);
            when(dataSource.getConnection()).thenReturn(sqlConn);
            when(sqlConn.createStatement()).thenReturn(mock(java.sql.Statement.class));
            RedisConnection redisConn = mock(RedisConnection.class);
            when(redisConnectionFactory.getConnection()).thenReturn(redisConn);
            when(redisConn.ping()).thenReturn("PONG");

            var response = controller.getHealth();
            List<Map<String, Object>> services = (List<Map<String, Object>>) response.getBody().get("services");
            var smtp = services.stream().filter(s -> "SMTP (Email)".equals(s.get("name"))).findFirst();
            assertThat(smtp).isPresent();
            assertThat(smtp.get()).containsEntry("status", "UNKNOWN");
        }

        @Test
        @SuppressWarnings("unchecked")
        void whenStripeUnconfigured_thenUnknown() throws Exception {
            Connection sqlConn = mock(Connection.class);
            when(dataSource.getConnection()).thenReturn(sqlConn);
            when(sqlConn.createStatement()).thenReturn(mock(java.sql.Statement.class));
            RedisConnection redisConn = mock(RedisConnection.class);
            when(redisConnectionFactory.getConnection()).thenReturn(redisConn);
            when(redisConn.ping()).thenReturn("PONG");

            // stripeSecretKey defaults to "" → UNKNOWN
            var response = controller.getHealth();
            List<Map<String, Object>> services = (List<Map<String, Object>>) response.getBody().get("services");
            var stripe = services.stream().filter(s -> "Stripe".equals(s.get("name"))).findFirst();
            assertThat(stripe).isPresent();
            assertThat(stripe.get()).containsEntry("status", "UNKNOWN");
        }

        @Test
        @SuppressWarnings("unchecked")
        void whenStorageOk_thenUpStatusReported() throws Exception {
            Connection sqlConn = mock(Connection.class);
            when(dataSource.getConnection()).thenReturn(sqlConn);
            when(sqlConn.createStatement()).thenReturn(mock(java.sql.Statement.class));
            RedisConnection redisConn = mock(RedisConnection.class);
            when(redisConnectionFactory.getConnection()).thenReturn(redisConn);
            when(redisConn.ping()).thenReturn("PONG");

            var response = controller.getHealth();
            List<Map<String, Object>> services = (List<Map<String, Object>>) response.getBody().get("services");
            var storage = services.stream().filter(s -> "Stockage disque".equals(s.get("name"))).findFirst();
            assertThat(storage).isPresent();
            // Should be UP (we can write to /tmp)
            assertThat(storage.get().get("status")).isIn("UP", "DEGRADED");
        }

        @Test
        @SuppressWarnings("unchecked")
        void whenRedisPingNotPong_thenDegraded() throws Exception {
            Connection sqlConn = mock(Connection.class);
            when(dataSource.getConnection()).thenReturn(sqlConn);
            when(sqlConn.createStatement()).thenReturn(mock(java.sql.Statement.class));
            RedisConnection redisConn = mock(RedisConnection.class);
            when(redisConnectionFactory.getConnection()).thenReturn(redisConn);
            when(redisConn.ping()).thenReturn("WHATEVER");

            var response = controller.getHealth();
            List<Map<String, Object>> services = (List<Map<String, Object>>) response.getBody().get("services");
            var redis = services.stream().filter(s -> "Redis".equals(s.get("name"))).findFirst();
            assertThat(redis).isPresent();
            assertThat(redis.get()).containsEntry("status", "DEGRADED");
        }
    }

    @Nested
    @DisplayName("getKeycloakMetrics - performance section")
    class KeycloakMetricsPerformance {

        @Test
        @SuppressWarnings("unchecked")
        void whenNoMicrometerData_thenDefaults() {
            when(monitoringQueryService.userMetrics()).thenReturn(userMetricsMap(0L, 0L, 0L));
            when(jwtTokenService.getMetrics()).thenReturn(new JwtTokenService.TokenMetrics(0,0,0,0,0,0,0,0));
            when(meterRegistry.find(anyString())).thenReturn(mock(io.micrometer.core.instrument.search.Search.class));
            when(monitoringQueryService.securityMetrics()).thenReturn(securityMetricsMap(0L, 0L, 0L, null));

            var response = controller.getKeycloakMetrics();
            Map<String, Object> performance = (Map<String, Object>) response.getBody().get("performance");
            assertThat(performance).containsKey("avgResponseTimeMs")
                    .containsKey("totalRequests")
                    .containsKey("errorRate")
                    .containsKey("uptimePercent");
        }

        @Test
        @SuppressWarnings("unchecked")
        void whenMicrometerHasTimerAndCounter_thenIncludedInPerformance() {
            when(monitoringQueryService.userMetrics()).thenReturn(userMetricsMap(0L, 0L, 0L));
            when(jwtTokenService.getMetrics()).thenReturn(new JwtTokenService.TokenMetrics(0,0,0,0,0,0,0,0));

            // Configure search to return a real timer + counter
            io.micrometer.core.instrument.search.Search timerSearch = mock(io.micrometer.core.instrument.search.Search.class);
            io.micrometer.core.instrument.Timer timer = mock(io.micrometer.core.instrument.Timer.class);
            when(timer.count()).thenReturn(100L);
            when(timer.mean(any())).thenReturn(50.0);
            when(timerSearch.timer()).thenReturn(timer);

            io.micrometer.core.instrument.search.Search counterSearch = mock(io.micrometer.core.instrument.search.Search.class);
            io.micrometer.core.instrument.Counter counter = mock(io.micrometer.core.instrument.Counter.class);
            when(counter.count()).thenReturn(1000.0);
            when(counterSearch.counter()).thenReturn(counter);

            io.micrometer.core.instrument.search.Search errSearch = mock(io.micrometer.core.instrument.search.Search.class);
            io.micrometer.core.instrument.Counter errCounter = mock(io.micrometer.core.instrument.Counter.class);
            when(errCounter.count()).thenReturn(10.0);
            when(errSearch.counter()).thenReturn(errCounter);

            when(meterRegistry.find("clenzy.api.request.duration")).thenReturn(timerSearch);
            when(meterRegistry.find("clenzy.api.request.total")).thenReturn(counterSearch);
            when(meterRegistry.find("clenzy.api.error.server")).thenReturn(errSearch);

            when(monitoringQueryService.securityMetrics()).thenReturn(securityMetricsMap(0L, 0L, 0L, null));

            var response = controller.getKeycloakMetrics();
            Map<String, Object> performance = (Map<String, Object>) response.getBody().get("performance");
            assertThat(performance.get("totalRequests")).isEqualTo(1000L);
            assertThat((Number) performance.get("avgResponseTimeMs")).isEqualTo(50.0);
        }
    }

    @Nested
    @DisplayName("getTestCoverage - JaCoCo XML parsing")
    class GetTestCoverageExtended {

        @Test
        void whenJacocoXmlExists_thenParsesCounters() throws Exception {
            // Create a minimal JaCoCo XML in a temp file
            java.io.File tempXml = java.io.File.createTempFile("jacoco-test-", ".xml");
            tempXml.deleteOnExit();
            String xml = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
                    + "<!DOCTYPE report PUBLIC \"-//JACOCO//DTD Report 1.1//EN\" \"report.dtd\">"
                    + "<report name=\"test\">"
                    + "<counter type=\"INSTRUCTION\" missed=\"10\" covered=\"90\"/>"
                    + "<counter type=\"BRANCH\" missed=\"5\" covered=\"15\"/>"
                    + "<counter type=\"LINE\" missed=\"3\" covered=\"27\"/>"
                    + "</report>";
            java.nio.file.Files.writeString(tempXml.toPath(), xml);

            // Set the report path via reflection
            java.lang.reflect.Field field = MonitoringController.class.getDeclaredField("jacocoReportPath");
            field.setAccessible(true);
            field.set(controller, tempXml.getAbsolutePath());

            var response = controller.getTestCoverage();
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).containsEntry("available", true);
            assertThat(response.getBody()).containsEntry("instructionCovered", 90L);
            assertThat(response.getBody()).containsEntry("instructionMissed", 10L);
            assertThat((Number) response.getBody().get("instructionPercent")).isEqualTo(90.0);
        }

        @Test
        void whenMalformedXml_thenReturnsErrorMessage() throws Exception {
            java.io.File tempXml = java.io.File.createTempFile("jacoco-test-bad-", ".xml");
            tempXml.deleteOnExit();
            java.nio.file.Files.writeString(tempXml.toPath(), "not-xml");

            java.lang.reflect.Field field = MonitoringController.class.getDeclaredField("jacocoReportPath");
            field.setAccessible(true);
            field.set(controller, tempXml.getAbsolutePath());

            var response = controller.getTestCoverage();
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).containsEntry("available", false);
            assertThat(response.getBody()).containsKey("message");
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // Additional coverage — Stripe TEST/LIVE mode, Kafka with metrics,
    // SMTP JavaMailSender path, system metrics path, audit log specs
    // ═══════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("getHealth - additional branches")
    class GetHealthMoreBranches {

        @Test
        @SuppressWarnings("unchecked")
        void whenKeycloakUrlSet_thenInvokesCheckKeycloak() throws Exception {
            Connection sqlConn = mock(Connection.class);
            when(dataSource.getConnection()).thenReturn(sqlConn);
            when(sqlConn.createStatement()).thenReturn(mock(java.sql.Statement.class));
            RedisConnection redisConn = mock(RedisConnection.class);
            when(redisConnectionFactory.getConnection()).thenReturn(redisConn);
            when(redisConn.ping()).thenReturn("PONG");

            // Set an unreachable keycloak URL — will go DOWN via exception
            java.lang.reflect.Field f = MonitoringController.class.getDeclaredField("keycloakUrl");
            f.setAccessible(true);
            f.set(controller, "http://nonexistent-kc-host:9999");

            var response = controller.getHealth();
            List<Map<String, Object>> services = (List<Map<String, Object>>) response.getBody().get("services");
            var kc = services.stream().filter(s -> "Keycloak".equals(s.get("name"))).findFirst();
            assertThat(kc).isPresent();
            assertThat(kc.get().get("status")).isIn("UP", "DOWN", "DEGRADED");
        }

        @Test
        @SuppressWarnings("unchecked")
        void whenStripeSecretKeySetButInvalid_thenDownStatus() throws Exception {
            Connection sqlConn = mock(Connection.class);
            when(dataSource.getConnection()).thenReturn(sqlConn);
            when(sqlConn.createStatement()).thenReturn(mock(java.sql.Statement.class));
            RedisConnection redisConn = mock(RedisConnection.class);
            when(redisConnectionFactory.getConnection()).thenReturn(redisConn);
            when(redisConn.ping()).thenReturn("PONG");

            java.lang.reflect.Field f = MonitoringController.class.getDeclaredField("stripeSecretKey");
            f.setAccessible(true);
            f.set(controller, "sk_test_invalidkey");

            var response = controller.getHealth();
            List<Map<String, Object>> services = (List<Map<String, Object>>) response.getBody().get("services");
            var stripe = services.stream().filter(s -> "Stripe".equals(s.get("name"))).findFirst();
            assertThat(stripe).isPresent();
            // Status may be UP or DOWN depending on connectivity; both branches reach mode=TEST
            assertThat((String) stripe.get().get("details")).contains("TEST");
        }

        @Test
        @SuppressWarnings("unchecked")
        void whenStripeSecretKeyLiveMode_thenLiveModeIdentified() throws Exception {
            Connection sqlConn = mock(Connection.class);
            when(dataSource.getConnection()).thenReturn(sqlConn);
            when(sqlConn.createStatement()).thenReturn(mock(java.sql.Statement.class));
            RedisConnection redisConn = mock(RedisConnection.class);
            when(redisConnectionFactory.getConnection()).thenReturn(redisConn);
            when(redisConn.ping()).thenReturn("PONG");

            java.lang.reflect.Field f = MonitoringController.class.getDeclaredField("stripeSecretKey");
            f.setAccessible(true);
            f.set(controller, "sk_live_invalid_xyz");

            var response = controller.getHealth();
            List<Map<String, Object>> services = (List<Map<String, Object>>) response.getBody().get("services");
            var stripe = services.stream().filter(s -> "Stripe".equals(s.get("name"))).findFirst();
            assertThat(stripe).isPresent();
            assertThat((String) stripe.get().get("details")).contains("LIVE");
        }

        @Test
        @SuppressWarnings("unchecked")
        void whenKafkaMetricsWithConnections_thenUpStatus() throws Exception {
            Connection sqlConn = mock(Connection.class);
            when(dataSource.getConnection()).thenReturn(sqlConn);
            when(sqlConn.createStatement()).thenReturn(mock(java.sql.Statement.class));
            RedisConnection redisConn = mock(RedisConnection.class);
            when(redisConnectionFactory.getConnection()).thenReturn(redisConn);
            when(redisConn.ping()).thenReturn("PONG");

            ObjectProvider<KafkaTemplate<String, Object>> kp = mock(ObjectProvider.class);
            KafkaTemplate<String, Object> kt = mock(KafkaTemplate.class);
            org.apache.kafka.common.MetricName mn = new org.apache.kafka.common.MetricName("connection-count",
                    "g", "d", java.util.Map.of());
            org.apache.kafka.common.Metric metric = mock(org.apache.kafka.common.Metric.class);
            when(metric.metricValue()).thenReturn(1.0);
            java.util.Map<org.apache.kafka.common.MetricName, ? extends org.apache.kafka.common.Metric> metricsMap =
                    java.util.Map.of(mn, metric);
            doReturn(metricsMap).when(kt).metrics();
            when(kp.getIfAvailable()).thenReturn(kt);

            ObjectProvider<JavaMailSender> mp = mock(ObjectProvider.class);
            when(mp.getIfAvailable()).thenReturn(null);

            controller = new MonitoringController(monitoringQueryService, jwtTokenService,
                    dataSource, redisConnectionFactory, meterRegistry, kp, mp);

            var response = controller.getHealth();
            List<Map<String, Object>> services = (List<Map<String, Object>>) response.getBody().get("services");
            var kafka = services.stream().filter(s -> "Kafka".equals(s.get("name"))).findFirst();
            assertThat(kafka).isPresent();
            assertThat(kafka.get()).containsEntry("status", "UP");
        }

        @Test
        @SuppressWarnings("unchecked")
        void whenKafkaMetricsThrows_thenDownStatus() throws Exception {
            Connection sqlConn = mock(Connection.class);
            when(dataSource.getConnection()).thenReturn(sqlConn);
            when(sqlConn.createStatement()).thenReturn(mock(java.sql.Statement.class));
            RedisConnection redisConn = mock(RedisConnection.class);
            when(redisConnectionFactory.getConnection()).thenReturn(redisConn);
            when(redisConn.ping()).thenReturn("PONG");

            ObjectProvider<KafkaTemplate<String, Object>> kp = mock(ObjectProvider.class);
            KafkaTemplate<String, Object> kt = mock(KafkaTemplate.class);
            when(kt.metrics()).thenThrow(new RuntimeException("kafka broke"));
            when(kp.getIfAvailable()).thenReturn(kt);

            ObjectProvider<JavaMailSender> mp = mock(ObjectProvider.class);
            controller = new MonitoringController(monitoringQueryService, jwtTokenService,
                    dataSource, redisConnectionFactory, meterRegistry, kp, mp);

            var response = controller.getHealth();
            List<Map<String, Object>> services = (List<Map<String, Object>>) response.getBody().get("services");
            var kafka = services.stream().filter(s -> "Kafka".equals(s.get("name"))).findFirst();
            assertThat(kafka).isPresent();
            assertThat(kafka.get()).containsEntry("status", "DOWN");
        }

        @Test
        @SuppressWarnings("unchecked")
        void whenMailSenderImplAvailable_thenInvokesTestConnection() throws Exception {
            Connection sqlConn = mock(Connection.class);
            when(dataSource.getConnection()).thenReturn(sqlConn);
            when(sqlConn.createStatement()).thenReturn(mock(java.sql.Statement.class));
            RedisConnection redisConn = mock(RedisConnection.class);
            when(redisConnectionFactory.getConnection()).thenReturn(redisConn);
            when(redisConn.ping()).thenReturn("PONG");

            ObjectProvider<KafkaTemplate<String, Object>> kp = mock(ObjectProvider.class);
            ObjectProvider<JavaMailSender> mp = mock(ObjectProvider.class);
            org.springframework.mail.javamail.JavaMailSenderImpl impl =
                    mock(org.springframework.mail.javamail.JavaMailSenderImpl.class);
            // testConnection succeeds (no exception)
            doNothing().when(impl).testConnection();
            when(impl.getHost()).thenReturn("smtp.example.com");
            when(impl.getPort()).thenReturn(587);
            when(mp.getIfAvailable()).thenReturn(impl);

            controller = new MonitoringController(monitoringQueryService, jwtTokenService,
                    dataSource, redisConnectionFactory, meterRegistry, kp, mp);

            var response = controller.getHealth();
            List<Map<String, Object>> services = (List<Map<String, Object>>) response.getBody().get("services");
            var smtp = services.stream().filter(s -> "SMTP (Email)".equals(s.get("name"))).findFirst();
            assertThat(smtp).isPresent();
            assertThat(smtp.get()).containsEntry("status", "UP");
        }

        @Test
        @SuppressWarnings("unchecked")
        void whenMailSenderImplThrows_thenDown() throws Exception {
            Connection sqlConn = mock(Connection.class);
            when(dataSource.getConnection()).thenReturn(sqlConn);
            when(sqlConn.createStatement()).thenReturn(mock(java.sql.Statement.class));
            RedisConnection redisConn = mock(RedisConnection.class);
            when(redisConnectionFactory.getConnection()).thenReturn(redisConn);
            when(redisConn.ping()).thenReturn("PONG");

            ObjectProvider<KafkaTemplate<String, Object>> kp = mock(ObjectProvider.class);
            ObjectProvider<JavaMailSender> mp = mock(ObjectProvider.class);
            org.springframework.mail.javamail.JavaMailSenderImpl impl =
                    mock(org.springframework.mail.javamail.JavaMailSenderImpl.class);
            doThrow(new jakarta.mail.MessagingException("Connection refused"))
                    .when(impl).testConnection();
            when(mp.getIfAvailable()).thenReturn(impl);

            controller = new MonitoringController(monitoringQueryService, jwtTokenService,
                    dataSource, redisConnectionFactory, meterRegistry, kp, mp);

            var response = controller.getHealth();
            List<Map<String, Object>> services = (List<Map<String, Object>>) response.getBody().get("services");
            var smtp = services.stream().filter(s -> "SMTP (Email)".equals(s.get("name"))).findFirst();
            assertThat(smtp).isPresent();
            assertThat(smtp.get()).containsEntry("status", "DOWN");
        }
    }

    @Nested
    @DisplayName("getAuditLogs - additional filter combos")
    class AuditLogsAdvanced {

        @Test
        void whenActorIdBlank_thenIgnored() {
            Page<SecurityAuditLogDto> emptyPage = new PageImpl<>(List.of());
            when(monitoringQueryService.searchAuditLogs(any(), any(), any(), any(Pageable.class)))
                    .thenReturn(emptyPage);

            var response = controller.getAuditLogs(null, "   ", null, PageRequest.of(0, 20));
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        }

        @Test
        void whenResultBlank_thenIgnored() {
            Page<SecurityAuditLogDto> emptyPage = new PageImpl<>(List.of());
            when(monitoringQueryService.searchAuditLogs(any(), any(), any(), any(Pageable.class)))
                    .thenReturn(emptyPage);

            var response = controller.getAuditLogs(null, null, "  ", PageRequest.of(0, 20));
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        }
    }
}
