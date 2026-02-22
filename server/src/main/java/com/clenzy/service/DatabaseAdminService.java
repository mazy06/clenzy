package com.clenzy.service;

import com.clenzy.dto.BackupInfoDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/**
 * Service de gestion des backups PostgreSQL via pg_dump.
 * Securise : validation anti-path-traversal sur tous les noms de fichier.
 */
@Service
public class DatabaseAdminService {

    private static final Logger logger = LoggerFactory.getLogger(DatabaseAdminService.class);

    /** Regex stricte pour les noms de fichiers de backup */
    private static final Pattern SAFE_FILENAME = Pattern.compile("^[a-zA-Z0-9_.-]+\\.sql(\\.gz)?$");

    private static final DateTimeFormatter TIMESTAMP_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss");

    private final Path backupDir;
    private final String dbUrl;
    private final String dbUsername;
    private final String dbPassword;

    public DatabaseAdminService(
            @Value("${clenzy.backup.dir:/app/backups}") String backupDirPath,
            @Value("${spring.datasource.primary.url:${spring.datasource.url:}}") String dbUrl,
            @Value("${spring.datasource.primary.username:${spring.datasource.username:}}") String dbUsername,
            @Value("${spring.datasource.primary.password:${spring.datasource.password:}}") String dbPassword) {
        this.backupDir = Paths.get(backupDirPath);
        this.dbUrl = dbUrl;
        this.dbUsername = dbUsername;
        this.dbPassword = dbPassword;
        ensureBackupDir();
    }

    private void ensureBackupDir() {
        try {
            Files.createDirectories(backupDir);
        } catch (IOException e) {
            logger.warn("Impossible de creer le repertoire de backup: {}", backupDir, e);
        }
    }

    /**
     * Liste les backups disponibles, tries par date decroissante.
     */
    public List<BackupInfoDto> listBackups() throws IOException {
        if (!Files.exists(backupDir)) {
            return List.of();
        }

        try (Stream<Path> files = Files.list(backupDir)) {
            return files
                .filter(Files::isRegularFile)
                .filter(p -> p.getFileName().toString().endsWith(".sql.gz")
                          || p.getFileName().toString().endsWith(".sql"))
                .map(this::toBackupInfo)
                .sorted(Comparator.comparing(BackupInfoDto::createdAt).reversed())
                .toList();
        }
    }

    /**
     * Cree un nouveau dump de la base de donnees via pg_dump.
     * Le fichier est compresse en gzip.
     */
    public BackupInfoDto createBackup() throws IOException, InterruptedException {
        final String timestamp = TIMESTAMP_FORMAT.format(LocalDateTime.now());
        final String filename = "clenzy_backup_" + timestamp + ".sql.gz";
        final Path outputFile = backupDir.resolve(filename);

        // Extraire host, port, dbname depuis la JDBC URL
        final JdbcParams params = parseJdbcUrl(dbUrl);

        logger.info("Demarrage backup vers: {}", filename);

        ProcessBuilder pb = new ProcessBuilder(
            "sh", "-c",
            String.format(
                "PGPASSWORD='%s' pg_dump -h %s -p %s -U %s -d %s --no-owner --no-privileges | gzip > %s",
                dbPassword.replace("'", "'\\''"),
                params.host,
                params.port,
                dbUsername,
                params.database,
                outputFile.toAbsolutePath()
            )
        );
        pb.redirectErrorStream(true);

        Process process = pb.start();
        String output = new String(process.getInputStream().readAllBytes());
        int exitCode = process.waitFor();

        if (exitCode != 0) {
            logger.error("pg_dump echoue (exit {}): {}", exitCode, output);
            // Nettoyer le fichier partiel
            Files.deleteIfExists(outputFile);
            throw new IOException("pg_dump echoue (exit " + exitCode + "): " + output);
        }

        logger.info("Backup cree: {} ({} bytes)", filename, Files.size(outputFile));
        return toBackupInfo(outputFile);
    }

    /**
     * Retourne une Resource pour telecharger le backup.
     */
    public Resource downloadBackup(String filename) {
        validateFilename(filename);
        final Path file = backupDir.resolve(filename);

        if (!Files.exists(file) || !Files.isRegularFile(file)) {
            throw new IllegalArgumentException("Backup introuvable: " + filename);
        }

        return new FileSystemResource(file);
    }

    /**
     * Supprime un fichier de backup.
     */
    public void deleteBackup(String filename) throws IOException {
        validateFilename(filename);
        final Path file = backupDir.resolve(filename);

        if (!Files.exists(file)) {
            throw new IllegalArgumentException("Backup introuvable: " + filename);
        }

        Files.delete(file);
        logger.info("Backup supprime: {}", filename);
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    private BackupInfoDto toBackupInfo(Path file) {
        try {
            BasicFileAttributes attrs = Files.readAttributes(file, BasicFileAttributes.class);
            return new BackupInfoDto(
                file.getFileName().toString(),
                attrs.size(),
                attrs.creationTime().toInstant()
            );
        } catch (IOException e) {
            return new BackupInfoDto(file.getFileName().toString(), 0, Instant.now());
        }
    }

    /**
     * Validation stricte anti-path-traversal.
     */
    private void validateFilename(String filename) {
        if (filename == null || !SAFE_FILENAME.matcher(filename).matches()) {
            throw new SecurityException("Nom de fichier invalide: " + filename);
        }
    }

    /**
     * Parse une JDBC URL PostgreSQL.
     * Format: jdbc:postgresql://host:port/database
     */
    private JdbcParams parseJdbcUrl(String jdbcUrl) {
        String cleaned = jdbcUrl.replace("jdbc:postgresql://", "");
        // Supprimer les parametres de query string
        int queryIdx = cleaned.indexOf('?');
        if (queryIdx > 0) {
            cleaned = cleaned.substring(0, queryIdx);
        }

        String[] parts = cleaned.split("/");
        String hostPort = parts[0];
        String database = parts.length > 1 ? parts[1] : "clenzy";

        String host;
        String port;
        if (hostPort.contains(":")) {
            String[] hp = hostPort.split(":");
            host = hp[0];
            port = hp[1];
        } else {
            host = hostPort;
            port = "5432";
        }

        return new JdbcParams(host, port, database);
    }

    private record JdbcParams(String host, String port, String database) {}
}
