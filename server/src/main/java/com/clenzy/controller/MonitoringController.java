package com.clenzy.controller;

import com.clenzy.dto.SecurityAuditLogDto;
import com.clenzy.model.SecurityAuditEventType;
import com.clenzy.model.SecurityAuditLog;
import com.clenzy.model.UserStatus;
import com.clenzy.repository.SecurityAuditLogRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.JwtTokenService;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import javax.sql.DataSource;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.File;
import java.lang.management.ManagementFactory;
import java.lang.management.OperatingSystemMXBean;
import java.sql.Connection;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/admin/monitoring")
@Tag(name = "Monitoring", description = "Monitoring de la plateforme — sante, metriques, audit")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class MonitoringController {

    private static final Logger log = LoggerFactory.getLogger(MonitoringController.class);

    private final SecurityAuditLogRepository auditLogRepository;
    private final UserRepository userRepository;
    private final JwtTokenService jwtTokenService;
    private final DataSource dataSource;
    private final RedisConnectionFactory redisConnectionFactory;
    private final MeterRegistry meterRegistry;

    @Value("${keycloak.auth-server-url:}")
    private String keycloakUrl;

    @Value("${clenzy.jacoco.report-path:}")
    private String jacocoReportPath;

    public MonitoringController(SecurityAuditLogRepository auditLogRepository,
                                UserRepository userRepository,
                                JwtTokenService jwtTokenService,
                                DataSource dataSource,
                                RedisConnectionFactory redisConnectionFactory,
                                MeterRegistry meterRegistry) {
        this.auditLogRepository = auditLogRepository;
        this.userRepository = userRepository;
        this.jwtTokenService = jwtTokenService;
        this.dataSource = dataSource;
        this.redisConnectionFactory = redisConnectionFactory;
        this.meterRegistry = meterRegistry;
    }

    // ── Health ──────────────────────────────────────────────────────────────────

    @GetMapping("/health")
    @Operation(summary = "Sante de l'infrastructure",
               description = "Retourne l'etat de chaque composant (DB, Redis, etc.) et les metriques systeme.")
    public ResponseEntity<Map<String, Object>> getHealth() {
        List<Map<String, Object>> services = new ArrayList<>();

        services.add(checkPostgres());
        services.add(checkRedis());
        services.add(checkKeycloak());

        Map<String, Object> systemMetrics = buildSystemMetrics();

        return ResponseEntity.ok(Map.of(
            "services", services,
            "systemMetrics", systemMetrics
        ));
    }

    // ── Keycloak / Platform Metrics ─────────────────────────────────────────────

    @GetMapping("/keycloak-metrics")
    @Operation(summary = "Metriques plateforme",
               description = "Utilisateurs, tokens, performance API, securite.")
    public ResponseEntity<Map<String, Object>> getKeycloakMetrics() {
        Map<String, Object> users = buildUserMetrics();
        Map<String, Object> sessions = buildSessionMetrics();
        Map<String, Object> performance = buildPerformanceMetrics();
        Map<String, Object> security = buildSecurityMetrics();

        return ResponseEntity.ok(Map.of(
            "users", users,
            "sessions", sessions,
            "performance", performance,
            "security", security
        ));
    }

    // ── Audit Logs ──────────────────────────────────────────────────────────────

    @GetMapping("/audit-logs")
    @Operation(summary = "Logs d'audit securite",
               description = "Listing pagine avec filtre optionnel par eventType, actorId, result.")
    public ResponseEntity<Page<SecurityAuditLogDto>> getAuditLogs(
            @RequestParam(required = false) SecurityAuditEventType eventType,
            @RequestParam(required = false) String actorId,
            @RequestParam(required = false) String result,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC)
            Pageable pageable) {

        Specification<SecurityAuditLog> spec = Specification.where(null);

        if (eventType != null) {
            spec = spec.and((root, query, cb) ->
                cb.equal(root.get("eventType"), eventType));
        }
        if (actorId != null && !actorId.isBlank()) {
            spec = spec.and((root, query, cb) ->
                cb.equal(root.get("actorId"), actorId));
        }
        if (result != null && !result.isBlank()) {
            spec = spec.and((root, query, cb) ->
                cb.equal(root.get("result"), result));
        }

        Page<SecurityAuditLogDto> page = auditLogRepository.findAll(spec, pageable)
            .map(SecurityAuditLogDto::from);

        return ResponseEntity.ok(page);
    }

    // ── Test Coverage ──────────────────────────────────────────────────────────

    @GetMapping("/test-coverage")
    @Operation(summary = "Couverture de tests",
               description = "Retourne les metriques de couverture JaCoCo (ligne, branche, instruction).")
    public ResponseEntity<Map<String, Object>> getTestCoverage() {
        File jacocoXml = resolveJacocoReport();

        if (jacocoXml == null || !jacocoXml.exists()) {
            return ResponseEntity.ok(Map.of(
                "available", false,
                "message", "Rapport JaCoCo non disponible. Lancez 'mvn test' pour le generer."
            ));
        }

        try {
            var doc = DocumentBuilderFactory.newInstance()
                .newDocumentBuilder()
                .parse(jacocoXml);
            doc.getDocumentElement().normalize();

            // Parse top-level <counter> elements (direct children of <report>)
            var counters = doc.getDocumentElement().getElementsByTagName("counter");

            Map<String, Object> coverage = new LinkedHashMap<>();
            coverage.put("available", true);
            coverage.put("reportDate", Instant.ofEpochMilli(jacocoXml.lastModified()).toString());

            for (int i = 0; i < counters.getLength(); i++) {
                var node = counters.item(i);
                // Only top-level counters (parent = report)
                if (!"report".equals(node.getParentNode().getNodeName())) {
                    continue;
                }
                String type = node.getAttributes().getNamedItem("type").getNodeValue();
                long missed = Long.parseLong(node.getAttributes().getNamedItem("missed").getNodeValue());
                long covered = Long.parseLong(node.getAttributes().getNamedItem("covered").getNodeValue());
                long total = missed + covered;
                double percent = total > 0 ? (double) covered / total * 100 : 0;

                coverage.put(type.toLowerCase() + "Covered", covered);
                coverage.put(type.toLowerCase() + "Missed", missed);
                coverage.put(type.toLowerCase() + "Total", total);
                coverage.put(type.toLowerCase() + "Percent", Math.round(percent * 10.0) / 10.0);
            }

            return ResponseEntity.ok(coverage);
        } catch (Exception e) {
            log.warn("Erreur lors du parsing du rapport JaCoCo: {}", e.getMessage());
            return ResponseEntity.ok(Map.of(
                "available", false,
                "message", "Erreur de lecture du rapport: " + e.getMessage()
            ));
        }
    }

    /**
     * Cherche le rapport JaCoCo dans plusieurs emplacements possibles.
     * Priorite : chemin configure > jar location > user.dir > relatif.
     */
    private File resolveJacocoReport() {
        // 1. Chemin explicite via clenzy.jacoco.report-path
        if (jacocoReportPath != null && !jacocoReportPath.isBlank()) {
            File configured = new File(jacocoReportPath);
            if (configured.exists()) return configured;
        }

        // 2. Depuis le JAR/classes location (fiable quand lance via Maven/IDE)
        try {
            var codeSource = getClass().getProtectionDomain().getCodeSource();
            if (codeSource != null) {
                File classesDir = new File(codeSource.getLocation().toURI());
                // classesDir = target/classes → remonter a target/
                File targetDir = classesDir.getParentFile();
                if (targetDir != null) {
                    File fromClasses = new File(targetDir, "site/jacoco/jacoco.xml");
                    if (fromClasses.exists()) return fromClasses;
                }
            }
        } catch (Exception ignored) {
            // URISyntaxException ou SecurityException — on continue
        }

        // 3. Depuis user.dir (working directory du process)
        String userDir = System.getProperty("user.dir");
        for (String candidate : List.of(
                "target/site/jacoco/jacoco.xml",
                "server/target/site/jacoco/jacoco.xml"
        )) {
            File f = new File(userDir, candidate);
            if (f.exists()) return f;
        }

        // 4. Chemin relatif pur (si le CWD est deja dans server/)
        File relative = new File("target/site/jacoco/jacoco.xml");
        if (relative.exists()) return relative;

        return null;
    }

    // ── Private: Health checks ──────────────────────────────────────────────────

    private Map<String, Object> checkPostgres() {
        long start = System.nanoTime();
        String status = "UP";
        String details;

        try (Connection conn = dataSource.getConnection()) {
            conn.createStatement().execute("SELECT 1");
            long elapsed = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start);

            // HikariCP pool info
            if (dataSource instanceof com.zaxxer.hikari.HikariDataSource hikari) {
                var pool = hikari.getHikariPoolMXBean();
                if (pool != null) {
                    details = String.format("Pool: %d active, %d idle, %d total",
                        pool.getActiveConnections(),
                        pool.getIdleConnections(),
                        pool.getTotalConnections());
                } else {
                    details = "Connected (pool stats unavailable)";
                }
            } else {
                details = "Connected";
            }

            if (elapsed > 500) {
                status = "DEGRADED";
            }

            return serviceEntry("PostgreSQL", status, elapsed, "DATABASE", true, details);
        } catch (Exception e) {
            long elapsed = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start);
            log.warn("PostgreSQL health check failed: {}", e.getMessage());
            return serviceEntry("PostgreSQL", "DOWN", elapsed, "DATABASE", true,
                "Error: " + e.getMessage());
        }
    }

    private Map<String, Object> checkRedis() {
        long start = System.nanoTime();
        try {
            RedisConnection connection = redisConnectionFactory.getConnection();
            try {
                String pong = connection.ping();
                long elapsed = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start);
                String status = "PONG".equals(pong) ? "UP" : "DEGRADED";
                return serviceEntry("Redis", status, elapsed, "CACHE", false,
                    "Response: " + pong);
            } finally {
                connection.close();
            }
        } catch (Exception e) {
            long elapsed = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start);
            log.warn("Redis health check failed: {}", e.getMessage());
            return serviceEntry("Redis", "DOWN", elapsed, "CACHE", false,
                "Error: " + e.getMessage());
        }
    }

    private Map<String, Object> checkKeycloak() {
        if (keycloakUrl == null || keycloakUrl.isBlank()) {
            return serviceEntry("Keycloak", "UNKNOWN", 0, "AUTHENTICATION", true,
                "URL not configured");
        }
        long start = System.nanoTime();
        try {
            // Simple connectivity check — try to reach the Keycloak base URL
            java.net.URL url = new java.net.URL(keycloakUrl);
            java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(3000);
            conn.setReadTimeout(3000);
            conn.setRequestMethod("GET");
            int code = conn.getResponseCode();
            conn.disconnect();

            long elapsed = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start);
            String status = (code >= 200 && code < 400) ? "UP" : "DEGRADED";
            return serviceEntry("Keycloak", status, elapsed, "AUTHENTICATION", true,
                "HTTP " + code);
        } catch (Exception e) {
            long elapsed = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start);
            log.warn("Keycloak health check failed: {}", e.getMessage());
            return serviceEntry("Keycloak", "DOWN", elapsed, "AUTHENTICATION", true,
                "Error: " + e.getMessage());
        }
    }

    private Map<String, Object> serviceEntry(String name, String status, long responseTimeMs,
                                              String category, boolean critical, String details) {
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("name", name);
        entry.put("status", status);
        entry.put("responseTimeMs", responseTimeMs);
        entry.put("category", category);
        entry.put("critical", critical);
        entry.put("details", details);
        entry.put("lastCheck", Instant.now().toString());
        return entry;
    }

    // ── Private: System metrics ─────────────────────────────────────────────────

    private Map<String, Object> buildSystemMetrics() {
        Runtime runtime = Runtime.getRuntime();
        long heapUsed = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
        long heapMax = runtime.maxMemory() / (1024 * 1024);
        double memoryUsage = heapMax > 0 ? (double) heapUsed / heapMax * 100 : 0;

        double cpuUsage = getCpuUsage();

        // Disk usage
        File root = new File("/");
        long totalSpace = root.getTotalSpace();
        long usableSpace = root.getUsableSpace();
        double diskUsage = totalSpace > 0
            ? (double) (totalSpace - usableSpace) / totalSpace * 100 : 0;

        long uptimeMs = ManagementFactory.getRuntimeMXBean().getUptime();

        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("cpuUsage", Math.round(cpuUsage * 10.0) / 10.0);
        metrics.put("memoryUsage", Math.round(memoryUsage * 10.0) / 10.0);
        metrics.put("heapUsedMb", heapUsed);
        metrics.put("heapMaxMb", heapMax);
        metrics.put("diskUsage", Math.round(diskUsage * 10.0) / 10.0);
        metrics.put("uptimeSeconds", uptimeMs / 1000);
        return metrics;
    }

    private double getCpuUsage() {
        OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();
        if (osBean instanceof com.sun.management.OperatingSystemMXBean sunOs) {
            double cpu = sunOs.getCpuLoad() * 100;
            return cpu >= 0 ? cpu : 0;
        }
        double loadAvg = osBean.getSystemLoadAverage();
        int processors = osBean.getAvailableProcessors();
        return loadAvg >= 0 ? (loadAvg / processors) * 100 : 0;
    }

    // ── Private: User metrics ───────────────────────────────────────────────────

    private Map<String, Object> buildUserMetrics() {
        long total = userRepository.count();
        long active = userRepository.countByStatus(UserStatus.ACTIVE);
        long inactive = total - active;
        long newThisWeek = userRepository.countByCreatedAtAfter(
            LocalDateTime.now().minusDays(7));

        Map<String, Object> users = new LinkedHashMap<>();
        users.put("total", total);
        users.put("active", active);
        users.put("inactive", inactive);
        users.put("newThisWeek", newThisWeek);
        return users;
    }

    // ── Private: Session / Token metrics ────────────────────────────────────────

    private Map<String, Object> buildSessionMetrics() {
        JwtTokenService.TokenMetrics tm = jwtTokenService.getMetrics();

        Map<String, Object> sessions = new LinkedHashMap<>();
        sessions.put("totalTokens", tm.getTotalTokens());
        sessions.put("validTokens", tm.getValidTokens());
        sessions.put("revokedTokens", tm.getRevokedTokens());
        sessions.put("cacheHits", tm.getCacheHits());
        return sessions;
    }

    // ── Private: API Performance metrics ────────────────────────────────────────

    private Map<String, Object> buildPerformanceMetrics() {
        // Average response time from Micrometer
        double avgResponseTimeMs = 0;
        Timer requestTimer = meterRegistry.find("clenzy.api.request.duration").timer();
        if (requestTimer != null && requestTimer.count() > 0) {
            avgResponseTimeMs = requestTimer.mean(TimeUnit.MILLISECONDS);
        }

        // Total requests
        long totalRequests = 0;
        Counter requestCounter = meterRegistry.find("clenzy.api.request.total").counter();
        if (requestCounter != null) {
            totalRequests = (long) requestCounter.count();
        }

        // Error rate
        double errorRate = 0;
        Counter errorCounter = meterRegistry.find("clenzy.api.error.server").counter();
        if (errorCounter != null && totalRequests > 0) {
            errorRate = (errorCounter.count() / totalRequests) * 100;
        }

        // Uptime percent (JVM uptime vs 24h)
        long uptimeMs = ManagementFactory.getRuntimeMXBean().getUptime();
        double uptimePercent = Math.min(100, (double) uptimeMs / (24 * 3600 * 1000) * 100);

        Map<String, Object> perf = new LinkedHashMap<>();
        perf.put("avgResponseTimeMs", Math.round(avgResponseTimeMs * 10.0) / 10.0);
        perf.put("totalRequests", totalRequests);
        perf.put("errorRate", Math.round(errorRate * 100.0) / 100.0);
        perf.put("uptimePercent", Math.round(uptimePercent * 10.0) / 10.0);
        return perf;
    }

    // ── Private: Security metrics ───────────────────────────────────────────────

    private Map<String, Object> buildSecurityMetrics() {
        Instant oneWeekAgo = Instant.now().minus(7, java.time.temporal.ChronoUnit.DAYS);

        long failedLogins = auditLogRepository.countByEventTypeAndCreatedAtAfter(
            SecurityAuditEventType.LOGIN_FAILURE, oneWeekAgo);
        long permissionDenied = auditLogRepository.countByEventTypeAndCreatedAtAfter(
            SecurityAuditEventType.PERMISSION_DENIED, oneWeekAgo);
        long suspiciousActivity = auditLogRepository.countByEventTypeAndCreatedAtAfter(
            SecurityAuditEventType.SUSPICIOUS_ACTIVITY, oneWeekAgo);

        // Last security incident
        var incidentTypes = List.of(
            SecurityAuditEventType.LOGIN_FAILURE,
            SecurityAuditEventType.PERMISSION_DENIED,
            SecurityAuditEventType.SUSPICIOUS_ACTIVITY
        );
        String lastIncident = auditLogRepository
            .findTopByEventTypeInOrderByCreatedAtDesc(incidentTypes)
            .map(entry -> entry.getCreatedAt().toString())
            .orElse(null);

        Map<String, Object> sec = new LinkedHashMap<>();
        sec.put("failedLogins", failedLogins);
        sec.put("permissionDenied", permissionDenied);
        sec.put("suspiciousActivity", suspiciousActivity);
        sec.put("lastIncident", lastIncident);
        return sec;
    }
}
