package com.clenzy.config.health;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.stereotype.Component;

/**
 * HealthIndicator custom pour Redis.
 *
 * Expose l'etat de connexion Redis sur /actuator/health.
 * Effectue un PING Redis et reporte UP/DOWN.
 */
@Component("redisCustomHealth")
public class RedisHealthIndicator implements HealthIndicator {

    private static final Logger log = LoggerFactory.getLogger(RedisHealthIndicator.class);

    private final RedisConnectionFactory connectionFactory;

    public RedisHealthIndicator(RedisConnectionFactory connectionFactory) {
        this.connectionFactory = connectionFactory;
    }

    @Override
    public Health health() {
        try {
            RedisConnection connection = connectionFactory.getConnection();
            try {
                String pong = connection.ping();
                if ("PONG".equals(pong)) {
                    return Health.up()
                            .withDetail("response", pong)
                            .build();
                } else {
                    return Health.down()
                            .withDetail("response", pong)
                            .withDetail("reason", "Unexpected PING response")
                            .build();
                }
            } finally {
                connection.close();
            }
        } catch (Exception e) {
            log.warn("Redis health check failed: {}", e.getMessage());
            return Health.down()
                    .withDetail("error", e.getClass().getSimpleName())
                    .withDetail("message", e.getMessage())
                    .build();
        }
    }
}
