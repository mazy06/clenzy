package com.clenzy.service.storage.offload;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URLConnection;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.function.BooleanSupplier;

/**
 * Documents encore sur le disque du serveur (PDF générés, mandats signés, justificatifs), référencés
 * par un chemin relatif dans une colonne. Chacun est écrit sur le stockage des documents sous
 * {@code org/{orgId}/documents/<ancien chemin>}, la colonne est mise à jour, puis le fichier est
 * supprimé du disque.
 *
 * <p>Requêtes construites à partir de constantes du code, jamais d'une donnée reçue ; le chemin lu en
 * base est borné au répertoire de stockage (anti path-traversal).</p>
 */
final class DiskDocumentSource implements InlineBinarySource {

    private static final Logger log = LoggerFactory.getLogger(DiskDocumentSource.class);

    private final JdbcTemplate jdbc;
    private final String family;
    private final String table;
    private final String pathColumn;
    private final Path baseDir;
    private final BooleanSupplier active;

    DiskDocumentSource(JdbcTemplate jdbc, String family, String table, String pathColumn, Path baseDir,
                       BooleanSupplier active) {
        this.jdbc = jdbc;
        this.family = family;
        this.table = table;
        this.pathColumn = pathColumn;
        this.baseDir = baseDir.toAbsolutePath().normalize();
        this.active = active;
    }

    @Override
    public String family() {
        return family;
    }

    @Override
    public boolean active() {
        return active.getAsBoolean();
    }

    @Override
    public Bucket bucket() {
        return Bucket.DOCUMENTS;
    }

    @Override
    public List<Long> pendingIdsAfter(long afterId, int limit) {
        return jdbc.queryForList(
                "SELECT id FROM " + table + " WHERE " + pathColumn + " IS NOT NULL AND " + pathColumn + " <> ''"
                        + " AND " + pathColumn + " NOT LIKE 'org/%' AND id > ? ORDER BY id LIMIT ?",
                Long.class, afterId, limit);
    }

    @Override
    public PendingBinary load(long id) {
        return jdbc.query("SELECT organization_id, " + pathColumn + " AS path FROM " + table + " WHERE id = ?",
                rs -> rs.next() ? read(id, rs.getLong("organization_id"), rs.getString("path")) : null,
                id);
    }

    private PendingBinary read(long id, long organizationId, String relativePath) {
        if (relativePath == null || relativePath.startsWith("org/")) {
            return null;
        }
        final Path file = baseDir.resolve(relativePath).normalize();
        if (!file.startsWith(baseDir) || !Files.isRegularFile(file)) {
            log.debug("Document {} id={} : fichier absent du disque ({}), ignoré", family, id, relativePath);
            return null;
        }
        try {
            final String contentType = URLConnection.guessContentTypeFromName(file.getFileName().toString());
            return new PendingBinary(organizationId, contentType != null ? contentType : "application/pdf",
                    Files.readAllBytes(file), relativePath);
        } catch (IOException e) {
            throw new UncheckedIOException("Lecture impossible : " + relativePath, e);
        }
    }

    @Override
    public String objectKey(PendingBinary binary) {
        return "org/" + binary.organizationId() + "/documents/" + binary.currentRef().replace('\\', '/');
    }

    /** Colonne mise à jour d'abord ; le fichier n'est supprimé du disque qu'ensuite. */
    @Override
    public boolean complete(long id, PendingBinary binary, String objectKey) {
        final int updated = jdbc.update(
                "UPDATE " + table + " SET " + pathColumn + " = ? WHERE id = ? AND " + pathColumn + " = ?",
                objectKey, id, binary.currentRef());
        if (updated != 1) {
            return false;
        }
        final Path file = baseDir.resolve(binary.currentRef()).normalize();
        try {
            Files.deleteIfExists(file);
        } catch (IOException e) {
            log.warn("Document {} id={} déplacé, mais fichier non supprimé du disque : {} ({})",
                    family, id, file, e.getMessage());
        }
        return true;
    }
}
