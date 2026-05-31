package com.clenzy.scheduler;

import com.clenzy.model.Incident.IncidentType;
import com.clenzy.service.IncidentService;
import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.admin.DescribeClusterResult;
import org.apache.kafka.common.KafkaFuture;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.kafka.core.KafkaAdmin;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.test.util.ReflectionTestUtils;

import javax.sql.DataSource;
import java.sql.Connection;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Tests for {@link IncidentDetectionScheduler}.
 * Covers all 7 health-checks (PG, Redis, Kafka, Keycloak, SMTP, Stripe, Storage).
 *
 * IMPORTANT: AdminClient.create is mocked at class scope to avoid real Kafka
 * network calls on each detectIncidents() invocation (60s default timeout).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class IncidentDetectionSchedulerTest {

    @Mock private IncidentService incidentService;
    @Mock private DataSource dataSource;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private RedisConnectionFactory redisConnectionFactory;
    @Mock private RedisConnection redisConnection;
    @Mock private KafkaAdmin kafkaAdmin;
    @Mock private JavaMailSenderImpl mailSender;
    @Mock private Connection jdbcConnection;
    @Mock private ObjectProvider<org.springframework.mail.javamail.JavaMailSender> mailProvider;

    private IncidentDetectionScheduler scheduler;
    private MockedStatic<AdminClient> adminStatic;
    private AdminClient mockAdmin;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() throws Exception {
        when(mailProvider.getIfAvailable()).thenReturn(mailSender);
        scheduler = new IncidentDetectionScheduler(
                incidentService, dataSource, redisTemplate, kafkaAdmin, mailProvider);

        when(dataSource.getConnection()).thenReturn(jdbcConnection);
        when(jdbcConnection.isValid(anyInt())).thenReturn(true);

        when(redisTemplate.getConnectionFactory()).thenReturn(redisConnectionFactory);
        when(redisConnectionFactory.getConnection()).thenReturn(redisConnection);
        when(redisConnection.ping()).thenReturn("PONG");

        when(kafkaAdmin.getConfigurationProperties()).thenReturn(new java.util.HashMap<>(
                java.util.Map.of("bootstrap.servers", "localhost:9092")));

        // Mock Kafka AdminClient to avoid real network calls
        mockAdmin = mock(AdminClient.class);
        DescribeClusterResult dcr = mock(DescribeClusterResult.class);
        KafkaFuture<String> kf = mock(KafkaFuture.class);
        when(kf.get(anyLong(), any())).thenReturn("cluster-id");
        when(dcr.clusterId()).thenReturn(kf);
        when(mockAdmin.describeCluster()).thenReturn(dcr);
        adminStatic = mockStatic(AdminClient.class);
        adminStatic.when(() -> AdminClient.create(anyMap())).thenReturn(mockAdmin);

        // Configure for OK by default
        ReflectionTestUtils.setField(scheduler, "keycloakUrl", "");
        ReflectionTestUtils.setField(scheduler, "stripeSecretKey", "");
    }

    @AfterEach
    void tearDown() {
        if (adminStatic != null) adminStatic.close();
    }

    @Nested
    @DisplayName("PostgreSQL check")
    class Postgres {

        @Test
        void whenConnectionValid_thenResolves() throws Exception {
            when(jdbcConnection.isValid(anyInt())).thenReturn(true);
            scheduler.detectIncidents();
            verify(incidentService, atLeastOnce()).resolveIncident(IncidentType.SERVICE_DOWN, "postgresql");
        }

        @Test
        void whenConnectionInvalid_thenOpensServiceDown() throws Exception {
            when(jdbcConnection.isValid(anyInt())).thenReturn(false);
            scheduler.detectIncidents();
            verify(incidentService).openIncident(eq(IncidentType.SERVICE_DOWN), eq("postgresql"),
                    contains("POSTGRESQL"), contains("connection invalid"));
        }

        @Test
        void whenGetConnectionThrows_thenOpensServiceDown() throws Exception {
            when(dataSource.getConnection()).thenThrow(new java.sql.SQLException("unreachable"));
            scheduler.detectIncidents();
            verify(incidentService).openIncident(eq(IncidentType.SERVICE_DOWN), eq("postgresql"),
                    anyString(), contains("unreachable"));
        }
    }

    @Nested
    @DisplayName("Redis check")
    class Redis {

        @Test
        void whenPingReturnsPONG_thenResolves() {
            scheduler.detectIncidents();
            verify(incidentService, atLeastOnce()).resolveIncident(IncidentType.SERVICE_DOWN, "redis");
        }

        @Test
        void whenPingReturnsNull_thenOpensIncident() {
            when(redisConnection.ping()).thenReturn(null);
            scheduler.detectIncidents();
            verify(incidentService).openIncident(eq(IncidentType.SERVICE_DOWN), eq("redis"),
                    anyString(), contains("null"));
        }

        @Test
        void whenPingThrows_thenOpensIncident() {
            when(redisConnection.ping()).thenThrow(new RuntimeException("conn refused"));
            scheduler.detectIncidents();
            verify(incidentService).openIncident(eq(IncidentType.SERVICE_DOWN), eq("redis"),
                    anyString(), contains("conn refused"));
        }
    }

    @Nested
    @DisplayName("Kafka check")
    class Kafka {

        @Test
        void whenAdminClientSucceeds_thenResolves() {
            scheduler.detectIncidents();
            verify(incidentService, atLeastOnce()).resolveIncident(IncidentType.SERVICE_DOWN, "kafka");
        }

        @Test
        void whenAdminClientCreateFails_thenOpensIncident() {
            // Override the class-level mock to throw
            adminStatic.when(() -> AdminClient.create(anyMap()))
                    .thenThrow(new RuntimeException("no brokers"));
            scheduler.detectIncidents();
            verify(incidentService).openIncident(eq(IncidentType.SERVICE_DOWN), eq("kafka"),
                    anyString(), contains("no brokers"));
        }

        @Test
        void whenDescribeClusterFails_thenOpensIncident() throws Exception {
            DescribeClusterResult dcr = mock(DescribeClusterResult.class);
            KafkaFuture<String> kf = mock(KafkaFuture.class);
            when(kf.get(anyLong(), any())).thenThrow(new java.util.concurrent.TimeoutException("describe timeout"));
            when(dcr.clusterId()).thenReturn(kf);
            when(mockAdmin.describeCluster()).thenReturn(dcr);

            scheduler.detectIncidents();
            verify(incidentService).openIncident(eq(IncidentType.SERVICE_DOWN), eq("kafka"),
                    anyString(), anyString());
        }
    }

    @Nested
    @DisplayName("Keycloak check")
    class Keycloak {

        @Test
        void emptyUrl_autoResolves() {
            ReflectionTestUtils.setField(scheduler, "keycloakUrl", "");
            scheduler.detectIncidents();
            verify(incidentService, atLeastOnce()).resolveIncident(IncidentType.SERVICE_DOWN, "keycloak");
        }

        @Test
        void invalidUrl_opensIncident() {
            ReflectionTestUtils.setField(scheduler, "keycloakUrl", "not-a-valid-url");
            scheduler.detectIncidents();
            verify(incidentService).openIncident(eq(IncidentType.SERVICE_DOWN), eq("keycloak"),
                    anyString(), anyString());
        }
    }

    @Nested
    @DisplayName("SMTP check")
    class Smtp {

        @Test
        void whenMailSenderNull_thenAutoResolves() {
            when(mailProvider.getIfAvailable()).thenReturn(null);
            IncidentDetectionScheduler s = new IncidentDetectionScheduler(
                    incidentService, dataSource, redisTemplate, kafkaAdmin, mailProvider);
            s.detectIncidents();
            verify(incidentService, atLeastOnce()).resolveIncident(IncidentType.SERVICE_DOWN, "smtp");
        }

        @Test
        void whenTestConnectionSucceeds_thenResolves() throws Exception {
            doNothing().when(mailSender).testConnection();
            scheduler.detectIncidents();
            verify(incidentService, atLeastOnce()).resolveIncident(IncidentType.SERVICE_DOWN, "smtp");
        }

        @Test
        void whenTestConnectionFails_thenOpensIncident() throws Exception {
            doThrow(new jakarta.mail.MessagingException("auth failed"))
                    .when(mailSender).testConnection();
            scheduler.detectIncidents();
            verify(incidentService).openIncident(eq(IncidentType.SERVICE_DOWN), eq("smtp"),
                    anyString(), contains("auth failed"));
        }
    }

    @Nested
    @DisplayName("Stripe check")
    class Stripe {

        @Test
        void whenKeyEmpty_thenAutoResolves() {
            ReflectionTestUtils.setField(scheduler, "stripeSecretKey", "");
            scheduler.detectIncidents();
            verify(incidentService, atLeastOnce()).resolveIncident(IncidentType.SERVICE_DOWN, "stripe");
        }
    }

    @Nested
    @DisplayName("Storage check")
    class Storage {

        @Test
        void whenTmpAccessible_thenResolves() {
            scheduler.detectIncidents();
            verify(incidentService, atLeastOnce()).resolveIncident(IncidentType.SERVICE_DOWN, "storage");
        }
    }

    @Nested
    @DisplayName("Orchestration")
    class Orchestration {

        @Test
        void detectIncidents_runsAllChecks_resolvesAtLeastFive() {
            scheduler.detectIncidents();
            verify(incidentService, atLeast(5)).resolveIncident(any(), anyString());
        }

        @Test
        void detectIncidents_doesNotThrowOnRepeatedRuns() {
            scheduler.detectIncidents();
            scheduler.detectIncidents();
        }
    }
}
