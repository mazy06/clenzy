package com.clenzy.scheduler;

import com.clenzy.model.Incident.IncidentType;
import com.clenzy.service.IncidentService;
import org.apache.kafka.clients.admin.AdminClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.kafka.core.KafkaAdmin;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.io.File;
import java.net.HttpURLConnection;
import java.net.URL;
import java.sql.Connection;
import java.util.concurrent.TimeUnit;

/**
 * Detection automatique d'incidents P1 par health check des services critiques.
 *
 * Verifie toutes les 5 minutes :
 * - PostgreSQL (connexion JDBC avec timeout 5s)
 * - Redis (ping via RedisTemplate)
 * - Kafka (describeCluster via KafkaAdmin)
 * - Keycloak (HTTP GET sur l'URL d'auth)
 * - SMTP (testConnection via JavaMailSender)
 * - Stripe (Balance.retrieve via API key)
 * - Stockage disque (ecriture tmp + espace disponible)
 *
 * Ouvre un incident si un service est DOWN, le resout automatiquement
 * quand le service redevient disponible.
 *
 * Cross-org : pas de TenantContext (infrastructure monitoring).
 */
@Service
public class IncidentDetectionScheduler {

    private static final Logger log = LoggerFactory.getLogger(IncidentDetectionScheduler.class);
    private static final int TIMEOUT_SECONDS = 5;

    private final IncidentService incidentService;
    private final DataSource dataSource;
    private final StringRedisTemplate redisTemplate;
    private final KafkaAdmin kafkaAdmin;
    private final JavaMailSender mailSender;

    @Value("${keycloak.auth-server-url:}")
    private String keycloakUrl;

    @Value("${stripe.secret-key:}")
    private String stripeSecretKey;

    public IncidentDetectionScheduler(IncidentService incidentService,
                                       DataSource dataSource,
                                       StringRedisTemplate redisTemplate,
                                       KafkaAdmin kafkaAdmin,
                                       ObjectProvider<JavaMailSender> mailSenderProvider) {
        this.incidentService = incidentService;
        this.dataSource = dataSource;
        this.redisTemplate = redisTemplate;
        this.kafkaAdmin = kafkaAdmin;
        this.mailSender = mailSenderProvider.getIfAvailable();
    }

    @Scheduled(cron = "0 */5 * * * *")
    public void detectIncidents() {
        checkPostgresql();
        checkRedis();
        checkKafka();
        checkKeycloak();
        checkSmtp();
        checkStripe();
        checkStorage();
    }

    // ── Core services ────────────────────────────────────────────────────────

    private void checkPostgresql() {
        final String serviceName = "postgresql";
        try {
            try (Connection conn = dataSource.getConnection()) {
                if (!conn.isValid(TIMEOUT_SECONDS)) {
                    openServiceDown(serviceName, "PostgreSQL connection invalid");
                    return;
                }
            }
            resolveIfOpen(serviceName);
        } catch (Exception e) {
            openServiceDown(serviceName, "PostgreSQL unreachable: " + e.getMessage());
        }
    }

    private void checkRedis() {
        final String serviceName = "redis";
        try {
            String pong = redisTemplate.getConnectionFactory().getConnection().ping();
            if (pong == null) {
                openServiceDown(serviceName, "Redis ping returned null");
                return;
            }
            resolveIfOpen(serviceName);
        } catch (Exception e) {
            openServiceDown(serviceName, "Redis unreachable: " + e.getMessage());
        }
    }

    private void checkKafka() {
        final String serviceName = "kafka";
        try (AdminClient client = AdminClient.create(kafkaAdmin.getConfigurationProperties())) {
            client.describeCluster().clusterId().get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            resolveIfOpen(serviceName);
        } catch (Exception e) {
            openServiceDown(serviceName, "Kafka unreachable: " + e.getMessage());
        }
    }

    // ── Authentication ───────────────────────────────────────────────────────

    private void checkKeycloak() {
        final String serviceName = "keycloak";
        if (keycloakUrl == null || keycloakUrl.isBlank()) return;
        try {
            URL url = new URL(keycloakUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(TIMEOUT_SECONDS * 1000);
            conn.setReadTimeout(TIMEOUT_SECONDS * 1000);
            conn.setRequestMethod("GET");
            int code = conn.getResponseCode();
            conn.disconnect();

            if (code >= 200 && code < 400) {
                resolveIfOpen(serviceName);
            } else {
                openServiceDown(serviceName, "Keycloak returned HTTP " + code);
            }
        } catch (Exception e) {
            openServiceDown(serviceName, "Keycloak unreachable: " + e.getMessage());
        }
    }

    // ── Email ────────────────────────────────────────────────────────────────

    private void checkSmtp() {
        final String serviceName = "smtp";
        if (mailSender == null) return;
        try {
            if (mailSender instanceof JavaMailSenderImpl impl) {
                impl.testConnection();
            }
            resolveIfOpen(serviceName);
        } catch (Exception e) {
            openServiceDown(serviceName, "SMTP unreachable: " + e.getMessage());
        }
    }

    // ── Payment ──────────────────────────────────────────────────────────────

    private void checkStripe() {
        final String serviceName = "stripe";
        if (stripeSecretKey == null || stripeSecretKey.isBlank()) return;
        try {
            var options = com.stripe.net.RequestOptions.builder()
                    .setApiKey(stripeSecretKey)
                    .build();
            com.stripe.model.Balance.retrieve(options);
            resolveIfOpen(serviceName);
        } catch (Exception e) {
            openServiceDown(serviceName, "Stripe unreachable: " + e.getMessage());
        }
    }

    // ── Storage ──────────────────────────────────────────────────────────────

    private void checkStorage() {
        final String serviceName = "storage";
        try {
            File tmpDir = new File(System.getProperty("java.io.tmpdir"));
            File testFile = File.createTempFile("clenzy-health-", ".tmp", tmpDir);
            boolean deleted = testFile.delete();

            long totalSpace = tmpDir.getTotalSpace();
            long usableSpace = tmpDir.getUsableSpace();
            double usedPercent = totalSpace > 0
                    ? (double) (totalSpace - usableSpace) / totalSpace * 100 : 0;

            if (usedPercent > 95) {
                openServiceDown(serviceName, String.format("Disk usage critical: %.1f%% used, %d MB free",
                        usedPercent, usableSpace / (1024 * 1024)));
            } else {
                resolveIfOpen(serviceName);
            }
        } catch (Exception e) {
            openServiceDown(serviceName, "Storage check failed: " + e.getMessage());
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private void openServiceDown(String serviceName, String description) {
        incidentService.openIncident(
                IncidentType.SERVICE_DOWN,
                serviceName,
                serviceName.toUpperCase() + " service down",
                description
        );
    }

    private void resolveIfOpen(String serviceName) {
        incidentService.resolveIncident(IncidentType.SERVICE_DOWN, serviceName);
    }
}
