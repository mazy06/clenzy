package com.clenzy.service;

import org.apache.kafka.clients.admin.AdminClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.kafka.core.KafkaAdmin;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.net.HttpURLConnection;
import java.net.URL;
import java.sql.Connection;
import java.util.concurrent.TimeUnit;

/**
 * Verification de sante des services critiques a la demande.
 *
 * Reutilise la meme logique que {@link com.clenzy.scheduler.IncidentDetectionScheduler}
 * mais expose des resultats individuels pour le retest manuel d'incidents.
 */
@Service
public class ServiceHealthChecker {

    private static final Logger log = LoggerFactory.getLogger(ServiceHealthChecker.class);
    private static final int TIMEOUT_SECONDS = 5;

    private final DataSource dataSource;
    private final StringRedisTemplate redisTemplate;
    private final KafkaAdmin kafkaAdmin;
    private final JavaMailSender mailSender;

    @Value("${keycloak.auth-server-url:}")
    private String keycloakUrl;

    @Value("${stripe.secret-key:}")
    private String stripeSecretKey;

    public ServiceHealthChecker(DataSource dataSource,
                                 StringRedisTemplate redisTemplate,
                                 KafkaAdmin kafkaAdmin,
                                 ObjectProvider<JavaMailSender> mailSenderProvider) {
        this.dataSource = dataSource;
        this.redisTemplate = redisTemplate;
        this.kafkaAdmin = kafkaAdmin;
        this.mailSender = mailSenderProvider.getIfAvailable();
    }

    public record HealthResult(String service, String status, String message) {
        public boolean isUp() {
            return "UP".equals(status);
        }
    }

    /**
     * Teste la sante d'un service par son nom.
     * Retourne toujours un resultat (jamais d'exception non capturee).
     */
    public HealthResult check(String serviceName) {
        if (serviceName == null) {
            return new HealthResult("unknown", "DOWN", "Nom de service manquant");
        }

        return switch (serviceName.toLowerCase()) {
            case "smtp" -> checkSmtp();
            case "stripe" -> checkStripe();
            case "kafka" -> checkKafka();
            case "redis" -> checkRedis();
            case "postgresql" -> checkPostgresql();
            case "keycloak" -> checkKeycloak();
            case "storage" -> checkStorage();
            default -> new HealthResult(serviceName, "DOWN",
                    "Retest automatique non supporte pour le service '" + serviceName + "'");
        };
    }

    private HealthResult checkSmtp() {
        if (mailSender == null) {
            return new HealthResult("smtp", "DOWN", "JavaMailSender non configure");
        }
        try {
            if (mailSender instanceof JavaMailSenderImpl impl) {
                impl.testConnection();
            }
            return new HealthResult("smtp", "UP", "Connexion SMTP OK");
        } catch (Exception e) {
            log.warn("[HealthCheck] SMTP check failed: {}", e.getMessage());
            return new HealthResult("smtp", "DOWN", "SMTP inaccessible: " + e.getMessage());
        }
    }

    private HealthResult checkStripe() {
        if (stripeSecretKey == null || stripeSecretKey.isBlank()) {
            return new HealthResult("stripe", "DOWN", "Cle API Stripe non configuree");
        }
        try {
            // Appel leger : liste 0 events (fonctionne avec restricted keys)
            var params = com.stripe.model.EventCollection.class;
            var options = com.stripe.net.RequestOptions.builder()
                    .setApiKey(stripeSecretKey)
                    .build();
            com.stripe.model.Event.list(
                    java.util.Map.of("limit", 1), options);
            return new HealthResult("stripe", "UP", "API Stripe OK");
        } catch (com.stripe.exception.AuthenticationException e) {
            log.warn("[HealthCheck] Stripe auth failed: {}", e.getMessage());
            return new HealthResult("stripe", "DOWN", "Cle Stripe invalide: " + e.getMessage());
        } catch (Exception e) {
            log.warn("[HealthCheck] Stripe check failed: {}", e.getMessage());
            return new HealthResult("stripe", "DOWN", "Stripe inaccessible: " + e.getMessage());
        }
    }

    private HealthResult checkKafka() {
        try (AdminClient client = AdminClient.create(kafkaAdmin.getConfigurationProperties())) {
            client.describeCluster().clusterId().get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            return new HealthResult("kafka", "UP", "Cluster Kafka OK");
        } catch (Exception e) {
            log.warn("[HealthCheck] Kafka check failed: {}", e.getMessage());
            return new HealthResult("kafka", "DOWN", "Kafka inaccessible: " + e.getMessage());
        }
    }

    private HealthResult checkRedis() {
        try {
            String pong = redisTemplate.getConnectionFactory().getConnection().ping();
            if (pong == null) {
                return new HealthResult("redis", "DOWN", "Redis ping a retourne null");
            }
            return new HealthResult("redis", "UP", "Redis OK");
        } catch (Exception e) {
            log.warn("[HealthCheck] Redis check failed: {}", e.getMessage());
            return new HealthResult("redis", "DOWN", "Redis inaccessible: " + e.getMessage());
        }
    }

    private HealthResult checkPostgresql() {
        try (Connection conn = dataSource.getConnection()) {
            if (!conn.isValid(TIMEOUT_SECONDS)) {
                return new HealthResult("postgresql", "DOWN", "Connexion PostgreSQL invalide");
            }
            return new HealthResult("postgresql", "UP", "PostgreSQL OK");
        } catch (Exception e) {
            log.warn("[HealthCheck] PostgreSQL check failed: {}", e.getMessage());
            return new HealthResult("postgresql", "DOWN", "PostgreSQL inaccessible: " + e.getMessage());
        }
    }

    private HealthResult checkKeycloak() {
        if (keycloakUrl == null || keycloakUrl.isBlank()) {
            return new HealthResult("keycloak", "DOWN", "URL Keycloak non configuree");
        }
        try {
            URL url = new URL(keycloakUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(TIMEOUT_SECONDS * 1000);
            conn.setReadTimeout(TIMEOUT_SECONDS * 1000);
            conn.setRequestMethod("GET");
            int code = conn.getResponseCode();
            conn.disconnect();

            if (code >= 200 && code < 400) {
                return new HealthResult("keycloak", "UP", "Keycloak OK (HTTP " + code + ")");
            }
            return new HealthResult("keycloak", "DOWN", "Keycloak a retourne HTTP " + code);
        } catch (Exception e) {
            log.warn("[HealthCheck] Keycloak check failed: {}", e.getMessage());
            return new HealthResult("keycloak", "DOWN", "Keycloak inaccessible: " + e.getMessage());
        }
    }

    private HealthResult checkStorage() {
        try {
            java.io.File tmpDir = new java.io.File(System.getProperty("java.io.tmpdir"));
            java.io.File testFile = java.io.File.createTempFile("clenzy-health-", ".tmp", tmpDir);
            testFile.delete();

            long totalSpace = tmpDir.getTotalSpace();
            long usableSpace = tmpDir.getUsableSpace();
            double usedPercent = totalSpace > 0
                    ? (double) (totalSpace - usableSpace) / totalSpace * 100 : 0;

            if (usedPercent > 95) {
                return new HealthResult("storage", "DOWN",
                        String.format("Disque critique: %.1f%% utilise, %d Mo libres",
                                usedPercent, usableSpace / (1024 * 1024)));
            }
            return new HealthResult("storage", "UP",
                    String.format("Stockage OK (%.1f%% utilise)", usedPercent));
        } catch (Exception e) {
            log.warn("[HealthCheck] Storage check failed: {}", e.getMessage());
            return new HealthResult("storage", "DOWN", "Verification stockage echouee: " + e.getMessage());
        }
    }
}
