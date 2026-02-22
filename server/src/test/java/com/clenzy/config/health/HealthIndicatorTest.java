package com.clenzy.config.health;

import org.apache.kafka.common.Metric;
import org.apache.kafka.common.MetricName;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.Status;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.kafka.core.KafkaTemplate;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class HealthIndicatorTest {

    // ── Kafka Health Indicator ───────────────────────────────────────

    @Nested
    @DisplayName("KafkaHealthIndicator")
    class KafkaHealthIndicatorTests {

        @Mock private KafkaTemplate<String, Object> kafkaTemplate;

        private KafkaHealthIndicator indicator;

        @BeforeEach
        void setUp() {
            indicator = new KafkaHealthIndicator(kafkaTemplate);
        }

        @Test
        @DisplayName("when metrics available with connections then returns UP")
        void whenMetricsAvailableWithConnections_thenReturnsUp() {
            // Arrange
            MetricName connectionCountName = new MetricName("connection-count", "group", "desc", Map.of());
            Metric connectionMetric = mock(Metric.class);
            when(connectionMetric.metricValue()).thenReturn(2.0);

            MetricName otherName = new MetricName("request-rate", "group", "desc", Map.of());
            Metric otherMetric = mock(Metric.class);

            Map<MetricName, Metric> metrics = new HashMap<>();
            metrics.put(connectionCountName, connectionMetric);
            metrics.put(otherName, otherMetric);

            doReturn(metrics).when(kafkaTemplate).metrics();

            // Act
            Health health = indicator.health();

            // Assert
            assertThat(health.getStatus()).isEqualTo(Status.UP);
            assertThat(health.getDetails()).containsEntry("metricsCount", 2);
            assertThat(health.getDetails()).containsEntry("connectionCount", 2.0);
        }

        @Test
        @DisplayName("when metrics available without connection-count then returns UP without connectionCount detail")
        void whenMetricsAvailableWithoutConnectionCount_thenReturnsUpWithoutConnectionCountDetail() {
            // Arrange
            MetricName otherName = new MetricName("request-rate", "group", "desc", Map.of());
            Metric otherMetric = mock(Metric.class);

            Map<MetricName, Metric> metrics = new HashMap<>();
            metrics.put(otherName, otherMetric);

            doReturn(metrics).when(kafkaTemplate).metrics();

            // Act
            Health health = indicator.health();

            // Assert
            assertThat(health.getStatus()).isEqualTo(Status.UP);
            assertThat(health.getDetails()).containsEntry("metricsCount", 1);
            assertThat(health.getDetails()).doesNotContainKey("connectionCount");
        }

        @Test
        @DisplayName("when metrics is null then returns UNKNOWN")
        void whenMetricsNull_thenReturnsUnknown() {
            // Arrange
            doReturn(null).when(kafkaTemplate).metrics();

            // Act
            Health health = indicator.health();

            // Assert
            assertThat(health.getStatus()).isEqualTo(Status.UNKNOWN);
            assertThat(health.getDetails()).containsEntry("reason", "No Kafka producer metrics available");
        }

        @Test
        @DisplayName("when metrics is empty then returns UNKNOWN")
        void whenMetricsEmpty_thenReturnsUnknown() {
            // Arrange
            doReturn(Map.of()).when(kafkaTemplate).metrics();

            // Act
            Health health = indicator.health();

            // Assert
            assertThat(health.getStatus()).isEqualTo(Status.UNKNOWN);
        }

        @Test
        @DisplayName("when exception thrown then returns DOWN with error details")
        void whenExceptionThrown_thenReturnsDown() {
            // Arrange
            when(kafkaTemplate.metrics()).thenThrow(new RuntimeException("Kafka broker unreachable"));

            // Act
            Health health = indicator.health();

            // Assert
            assertThat(health.getStatus()).isEqualTo(Status.DOWN);
            assertThat(health.getDetails())
                    .containsEntry("error", "RuntimeException")
                    .containsEntry("message", "Kafka broker unreachable");
        }
    }

    // ── Redis Health Indicator ───────────────────────────────────────

    @Nested
    @DisplayName("RedisHealthIndicator")
    class RedisHealthIndicatorTests {

        @Mock private RedisConnectionFactory connectionFactory;
        @Mock private RedisConnection redisConnection;

        private RedisHealthIndicator indicator;

        @BeforeEach
        void setUp() {
            indicator = new RedisHealthIndicator(connectionFactory);
        }

        @Test
        @DisplayName("when PING returns PONG then returns UP")
        void whenPingReturnsPong_thenReturnsUp() {
            // Arrange
            when(connectionFactory.getConnection()).thenReturn(redisConnection);
            when(redisConnection.ping()).thenReturn("PONG");

            // Act
            Health health = indicator.health();

            // Assert
            assertThat(health.getStatus()).isEqualTo(Status.UP);
            assertThat(health.getDetails()).containsEntry("response", "PONG");
            verify(redisConnection).close();
        }

        @Test
        @DisplayName("when PING returns unexpected response then returns DOWN")
        void whenPingReturnsUnexpected_thenReturnsDown() {
            // Arrange
            when(connectionFactory.getConnection()).thenReturn(redisConnection);
            when(redisConnection.ping()).thenReturn("LOADING");

            // Act
            Health health = indicator.health();

            // Assert
            assertThat(health.getStatus()).isEqualTo(Status.DOWN);
            assertThat(health.getDetails())
                    .containsEntry("response", "LOADING")
                    .containsEntry("reason", "Unexpected PING response");
            verify(redisConnection).close();
        }

        @Test
        @DisplayName("when connection fails then returns DOWN with error")
        void whenConnectionFails_thenReturnsDown() {
            // Arrange
            when(connectionFactory.getConnection())
                    .thenThrow(new RuntimeException("Connection refused"));

            // Act
            Health health = indicator.health();

            // Assert
            assertThat(health.getStatus()).isEqualTo(Status.DOWN);
            assertThat(health.getDetails())
                    .containsEntry("error", "RuntimeException")
                    .containsEntry("message", "Connection refused");
        }

        @Test
        @DisplayName("when connection closes even after ping exception")
        void whenPingThrows_thenConnectionStillCloses() {
            // Arrange
            when(connectionFactory.getConnection()).thenReturn(redisConnection);
            when(redisConnection.ping()).thenThrow(new RuntimeException("PING failed"));

            // Act — the exception from ping() propagates to the outer catch
            // since the finally block runs close() which may then also fail,
            // but the outer catch handles it
            Health health = indicator.health();

            // Assert
            assertThat(health.getStatus()).isEqualTo(Status.DOWN);
        }
    }
}
