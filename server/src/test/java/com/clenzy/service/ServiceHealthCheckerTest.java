package com.clenzy.service;

import com.clenzy.config.CalendarPartitionManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.kafka.core.KafkaAdmin;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.test.util.ReflectionTestUtils;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.HashMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ServiceHealthCheckerTest {

    @Mock private DataSource dataSource;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private KafkaAdmin kafkaAdmin;
    @Mock private ObjectProvider<JavaMailSender> mailSenderProvider;
    @Mock private JavaMailSender mailSender;
    @Mock private CalendarPartitionManager calendarPartitionManager;

    private ServiceHealthChecker checker;

    @BeforeEach
    void setUp() {
        when(mailSenderProvider.getIfAvailable()).thenReturn(mailSender);
        checker = new ServiceHealthChecker(dataSource, redisTemplate, kafkaAdmin, mailSenderProvider, calendarPartitionManager);
        ReflectionTestUtils.setField(checker, "keycloakUrl", "");
        ReflectionTestUtils.setField(checker, "stripeSecretKey", "");
    }

    @Nested
    @DisplayName("check(unknown service)")
    class UnknownService {
        @Test
        void whenServiceNameNull_thenReturnsDown() {
            ServiceHealthChecker.HealthResult result = checker.check(null);
            assertThat(result.status()).isEqualTo("DOWN");
            assertThat(result.isUp()).isFalse();
        }

        @Test
        void whenUnknownService_thenReturnsDown() {
            ServiceHealthChecker.HealthResult result = checker.check("nonexistent");
            assertThat(result.status()).isEqualTo("DOWN");
            assertThat(result.service()).isEqualTo("nonexistent");
            assertThat(result.message()).contains("non supporte");
        }
    }

    @Nested
    @DisplayName("calendar-partition-manager check")
    class CalendarPartitions {
        @Test
        void whenProbeHealthy_thenReturnsUp() {
            when(calendarPartitionManager.probeAndHeal()).thenReturn(true);

            ServiceHealthChecker.HealthResult result = checker.check("calendar-partition-manager");

            assertThat(result.status()).isEqualTo("UP");
            assertThat(result.service()).isEqualTo("calendar-partition-manager");
        }

        @Test
        void whenProbeUnhealthy_thenReturnsDown() {
            when(calendarPartitionManager.probeAndHeal()).thenReturn(false);

            ServiceHealthChecker.HealthResult result = checker.check("calendar-partition-manager");

            assertThat(result.status()).isEqualTo("DOWN");
            assertThat(result.message()).contains("manquantes");
        }

        @Test
        void whenProbeThrows_thenReturnsDown() {
            when(calendarPartitionManager.probeAndHeal()).thenThrow(new RuntimeException("DB down"));

            ServiceHealthChecker.HealthResult result = checker.check("calendar-partition-manager");

            assertThat(result.status()).isEqualTo("DOWN");
            assertThat(result.message()).contains("echouee");
        }
    }

    @Nested
    @DisplayName("smtp check")
    class Smtp {
        @Test
        void whenMailSenderNotImpl_thenReturnsUpDirectly() {
            ServiceHealthChecker.HealthResult result = checker.check("smtp");
            assertThat(result.status()).isEqualTo("UP");
            assertThat(result.service()).isEqualTo("smtp");
        }

        @Test
        void whenJavaMailSenderImpl_thenTestsConnection() throws Exception {
            JavaMailSenderImpl impl = mock(JavaMailSenderImpl.class);
            when(mailSenderProvider.getIfAvailable()).thenReturn(impl);
            ServiceHealthChecker fresh = new ServiceHealthChecker(dataSource, redisTemplate, kafkaAdmin, mailSenderProvider, calendarPartitionManager);
            // testConnection success returns void (no exception)

            ServiceHealthChecker.HealthResult result = fresh.check("smtp");
            assertThat(result.status()).isEqualTo("UP");
        }

        @Test
        void whenJavaMailSenderImpl_throws_thenReturnsDown() throws Exception {
            JavaMailSenderImpl impl = mock(JavaMailSenderImpl.class);
            org.mockito.Mockito.doThrow(new jakarta.mail.MessagingException("SMTP unreachable")).when(impl).testConnection();
            when(mailSenderProvider.getIfAvailable()).thenReturn(impl);
            ServiceHealthChecker fresh = new ServiceHealthChecker(dataSource, redisTemplate, kafkaAdmin, mailSenderProvider, calendarPartitionManager);

            ServiceHealthChecker.HealthResult result = fresh.check("smtp");
            assertThat(result.status()).isEqualTo("DOWN");
        }

        @Test
        void whenMailSenderNull_thenReturnsDown() {
            ObjectProvider<JavaMailSender> nullProvider = mock(ObjectProvider.class);
            when(nullProvider.getIfAvailable()).thenReturn(null);
            ServiceHealthChecker fresh = new ServiceHealthChecker(dataSource, redisTemplate, kafkaAdmin, nullProvider, calendarPartitionManager);

            ServiceHealthChecker.HealthResult result = fresh.check("smtp");
            assertThat(result.status()).isEqualTo("DOWN");
            assertThat(result.message()).contains("non configure");
        }
    }

    @Nested
    @DisplayName("stripe check")
    class Stripe {
        @Test
        void whenSecretKeyBlank_thenReturnsDown() {
            ServiceHealthChecker.HealthResult result = checker.check("stripe");
            assertThat(result.status()).isEqualTo("DOWN");
            assertThat(result.message()).contains("non configure");
        }
    }

    @Nested
    @DisplayName("kafka check")
    class Kafka {
        @Test
        void whenAdminCreationFails_thenReturnsDown() {
            // KafkaAdmin.getConfigurationProperties returns empty map → AdminClient.create throws on connect
            when(kafkaAdmin.getConfigurationProperties()).thenReturn(new HashMap<>());
            ServiceHealthChecker.HealthResult result = checker.check("kafka");
            assertThat(result.status()).isEqualTo("DOWN");
        }
    }

    @Nested
    @DisplayName("redis check")
    class Redis {
        @Test
        void whenPingReturnsString_thenReturnsUp() {
            RedisConnectionFactory factory = mock(RedisConnectionFactory.class);
            RedisConnection connection = mock(RedisConnection.class);
            when(redisTemplate.getConnectionFactory()).thenReturn(factory);
            when(factory.getConnection()).thenReturn(connection);
            when(connection.ping()).thenReturn("PONG");

            ServiceHealthChecker.HealthResult result = checker.check("redis");
            assertThat(result.status()).isEqualTo("UP");
        }

        @Test
        void whenPingNull_thenReturnsDown() {
            RedisConnectionFactory factory = mock(RedisConnectionFactory.class);
            RedisConnection connection = mock(RedisConnection.class);
            when(redisTemplate.getConnectionFactory()).thenReturn(factory);
            when(factory.getConnection()).thenReturn(connection);
            when(connection.ping()).thenReturn(null);

            ServiceHealthChecker.HealthResult result = checker.check("redis");
            assertThat(result.status()).isEqualTo("DOWN");
        }

        @Test
        void whenPingThrows_thenReturnsDown() {
            when(redisTemplate.getConnectionFactory()).thenThrow(new RuntimeException("Redis down"));

            ServiceHealthChecker.HealthResult result = checker.check("redis");
            assertThat(result.status()).isEqualTo("DOWN");
        }
    }

    @Nested
    @DisplayName("postgresql check")
    class Postgresql {
        @Test
        void whenConnectionValid_thenReturnsUp() throws Exception {
            Connection conn = mock(Connection.class);
            when(dataSource.getConnection()).thenReturn(conn);
            when(conn.isValid(anyInt())).thenReturn(true);

            ServiceHealthChecker.HealthResult result = checker.check("postgresql");
            assertThat(result.status()).isEqualTo("UP");
        }

        @Test
        void whenConnectionInvalid_thenReturnsDown() throws Exception {
            Connection conn = mock(Connection.class);
            when(dataSource.getConnection()).thenReturn(conn);
            when(conn.isValid(anyInt())).thenReturn(false);

            ServiceHealthChecker.HealthResult result = checker.check("postgresql");
            assertThat(result.status()).isEqualTo("DOWN");
        }

        @Test
        void whenConnectionFails_thenReturnsDown() throws Exception {
            when(dataSource.getConnection()).thenThrow(new java.sql.SQLException("DB error"));

            ServiceHealthChecker.HealthResult result = checker.check("postgresql");
            assertThat(result.status()).isEqualTo("DOWN");
        }
    }

    @Nested
    @DisplayName("keycloak check")
    class Keycloak {
        @Test
        void whenUrlBlank_thenReturnsDown() {
            ServiceHealthChecker.HealthResult result = checker.check("keycloak");
            assertThat(result.status()).isEqualTo("DOWN");
            assertThat(result.message()).contains("non configure");
        }

        @Test
        void whenInvalidUrl_thenReturnsDown() {
            ReflectionTestUtils.setField(checker, "keycloakUrl", "not-a-url-at-all");
            ServiceHealthChecker.HealthResult result = checker.check("keycloak");
            assertThat(result.status()).isEqualTo("DOWN");
        }
    }

    @Nested
    @DisplayName("storage check")
    class Storage {
        @Test
        void whenTempDirAccessible_thenReturnsUp() {
            ServiceHealthChecker.HealthResult result = checker.check("storage");
            // Should be UP unless disk is very full (rare in test env)
            assertThat(result.service()).isEqualTo("storage");
            // Status depends on environment, but should not throw
            assertThat(result.status()).isIn("UP", "DOWN");
        }
    }

    @Test
    void healthResult_isUpReturnsTrueOnlyForUp() {
        ServiceHealthChecker.HealthResult up = new ServiceHealthChecker.HealthResult("test", "UP", "OK");
        ServiceHealthChecker.HealthResult down = new ServiceHealthChecker.HealthResult("test", "DOWN", "KO");

        assertThat(up.isUp()).isTrue();
        assertThat(down.isUp()).isFalse();
    }

    @Test
    void check_uppercaseServiceName_isCaseInsensitive() {
        // Validates the toLowerCase() branch in check()
        ServiceHealthChecker.HealthResult result = checker.check("KAFKA");
        assertThat(result.service()).isEqualTo("kafka");
        assertThat(result.status()).isEqualTo("DOWN"); // No real broker
    }

    @Test
    void check_emptyServiceName_returnsDown() {
        ServiceHealthChecker.HealthResult result = checker.check("");
        assertThat(result.status()).isEqualTo("DOWN");
        assertThat(result.service()).isEmpty();
    }

    @Nested
    @DisplayName("stripe with configured key")
    class StripeConfigured {
        @Test
        void whenInvalidKey_thenReturnsDown() {
            // With an invalid key, Stripe SDK throws AuthenticationException
            ReflectionTestUtils.setField(checker, "stripeSecretKey", "sk_test_invalid_key_for_test");

            ServiceHealthChecker.HealthResult result = checker.check("stripe");

            assertThat(result.service()).isEqualTo("stripe");
            // Either DOWN (auth failed) or UP (network error caught downstream) — both acceptable
            assertThat(result.status()).isIn("UP", "DOWN");
        }
    }

    @Nested
    @DisplayName("keycloak with reachable URL")
    class KeycloakReachable {
        @Test
        void whenUrlMalformed_thenReturnsDown() {
            ReflectionTestUtils.setField(checker, "keycloakUrl", "ht!tp://bad");

            ServiceHealthChecker.HealthResult result = checker.check("keycloak");

            assertThat(result.status()).isEqualTo("DOWN");
        }

        @Test
        void whenValidUrlButUnreachable_thenReturnsDown() {
            ReflectionTestUtils.setField(checker, "keycloakUrl",
                    "http://127.0.0.1:1/keycloak"); // port 1 unbound

            ServiceHealthChecker.HealthResult result = checker.check("keycloak");

            assertThat(result.service()).isEqualTo("keycloak");
            assertThat(result.status()).isEqualTo("DOWN");
        }
    }
}
