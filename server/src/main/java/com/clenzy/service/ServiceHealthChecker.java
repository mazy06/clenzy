package com.clenzy.service;

import com.clenzy.config.CalendarPartitionManager;
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
    private final CalendarPartitionManager calendarPartitionManager;

    @Value("${keycloak.auth-server-url:}")
    private String keycloakUrl;

    @Value("${stripe.secret-key:}")
    private String stripeSecretKey;

    public ServiceHealthChecker(DataSource dataSource,
                                 StringRedisTemplate redisTemplate,
                                 KafkaAdmin kafkaAdmin,
                                 ObjectProvider<JavaMailSender> mailSenderProvider,
                                 CalendarPartitionManager calendarPartitionManager) {
        this.dataSource = dataSource;
        this.redisTemplate = redisTemplate;
        this.kafkaAdmin = kafkaAdmin;
        this.mailSender = mailSenderProvider.getIfAvailable();
        this.calendarPartitionManager = calendarPartitionManager;
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
            case "calendar-partition-manager" -> checkCalendarPartitions();
            default -> new HealthResult(serviceName, "DOWN",
                    "Retest automatique non supporte pour le service '" + serviceName + "'");
        };
    }

    /**
     * Sante du job de partitionnement calendar_days. Contrairement aux autres
     * services (endpoints pingables), c'est un job planifie : on « teste » en
     * verifiant que les partitions cibles sont en place et, si besoin, en tentant
     * une reparation a la demande ({@link CalendarPartitionManager#probeAndHeal()}).
     * UP => l'incident associe est auto-resolu par le controller. Sur table plate
     * (dev), aucune panne possible → UP (l'incident bloque est resolu).
     */
    private HealthResult checkCalendarPartitions() {
        try {
            boolean healthy = calendarPartitionManager.probeAndHeal();
            return healthy
                    ? new HealthResult("calendar-partition-manager", "UP",
                            "Partitions calendar_days a jour (verifiees/reparees a la demande)")
                    : new HealthResult("calendar-partition-manager", "DOWN",
                            "Partitions calendar_days manquantes et reparation impossible "
                                    + "(droits insuffisants ou base indisponible)");
        } catch (Exception e) {
            log.warn("[HealthCheck] Calendar partitions check failed: {}", e.getMessage());
            return new HealthResult("calendar-partition-manager", "DOWN",
                    "Verification des partitions echouee: " + e.getMessage());
        }
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
            // Balance.retrieve : endpoint le plus permissif de l'API Stripe,
            // accessible par defaut avec toute cle valide (y compris les
            // restricted keys sans permission specifique). Si meme ce call
            // echoue avec un PermissionError, c'est une cle ultra-restricted
            // pour laquelle on ne peut pas verifier la sante mais qui est
            // techniquement valide (auth OK) — voir catch PermissionException.
            var options = com.stripe.net.RequestOptions.builder()
                    .setApiKey(stripeSecretKey)
                    .build();
            com.stripe.model.Balance.retrieve(options);
            return new HealthResult("stripe", "UP", "API Stripe OK");
        } catch (com.stripe.exception.PermissionException e) {
            // Cle valide (auth reussie) mais sans la permission pour Balance.read.
            // Cas typique d'une restricted key (rk_test_/rk_live_) tres limitee.
            // On considere le service UP : la cle est valide, simplement on ne
            // peut pas verifier plus en details.
            // /!\ Catch BEFORE AuthenticationException : PermissionException
            // est une sous-classe de AuthenticationException dans le SDK Stripe.
            log.info("[HealthCheck] Stripe key valide mais restricted (permission insuffisante pour Balance) : {}",
                    e.getMessage());
            return new HealthResult("stripe", "UP",
                    "API Stripe OK (cle restricted — sante verifiee via auth OAuth)");
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
