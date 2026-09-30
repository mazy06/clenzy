package com.clenzy.service.storage.offload;

import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.UUID;
import java.util.function.BooleanSupplier;
import java.util.regex.Pattern;

/**
 * Famille dont les octets sont dans une colonne BYTEA {@code data}, à côté d'une colonne
 * {@code storage_key} : une fois l'objet écrit, la clé est enregistrée et {@code data} passe à NULL,
 * en une seule requête.
 *
 * <p>Les requêtes sont construites à partir de constantes du code (noms de table et de colonnes),
 * jamais d'une donnée reçue.</p>
 */
final class ByteaColumnSource implements InlineBinarySource {

    private final JdbcTemplate jdbc;
    private final String family;
    private final String table;
    private final String organizationSql;
    private final String keyPrefix;
    private final BooleanSupplier active;
    private final Pattern reusableKey;

    /**
     * @param organizationSql expression SQL de l'organisation, sur l'alias {@code t} de la table
     * @param keyPrefix       segment de clé après l'organisation (ex. {@code photos})
     */
    ByteaColumnSource(JdbcTemplate jdbc, String family, String table, String organizationSql,
                      String keyPrefix, BooleanSupplier active) {
        this.jdbc = jdbc;
        this.family = family;
        this.table = table;
        this.organizationSql = organizationSql;
        this.keyPrefix = keyPrefix;
        this.active = active;
        this.reusableKey = Pattern.compile("^org/\\d+/" + Pattern.quote(keyPrefix) + "/.+$");
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
        return Bucket.MEDIA;
    }

    @Override
    public List<Long> pendingIdsAfter(long afterId, int limit) {
        return jdbc.queryForList(
                "SELECT id FROM " + table + " WHERE data IS NOT NULL AND id > ? ORDER BY id LIMIT ?",
                Long.class, afterId, limit);
    }

    @Override
    public PendingBinary load(long id) {
        return jdbc.query(
                "SELECT " + organizationSql + " AS organization_id, t.content_type, t.data, t.storage_key"
                        + " FROM " + table + " t WHERE t.id = ? AND t.data IS NOT NULL",
                rs -> rs.next()
                        ? new PendingBinary(rs.getObject("organization_id", Long.class), rs.getString("content_type"),
                                rs.getBytes("data"), rs.getString("storage_key"))
                        : null,
                id);
    }

    /** Une clé déjà écrite par une ancienne migration (octets gardés) est réutilisée. */
    @Override
    public String objectKey(PendingBinary binary) {
        if (binary.currentRef() != null && reusableKey.matcher(binary.currentRef()).matches()) {
            return binary.currentRef();
        }
        if (binary.organizationId() == null) {
            throw new IllegalStateException("Organisation inconnue pour un fichier de " + family);
        }
        return "org/" + binary.organizationId() + "/" + keyPrefix + "/" + UUID.randomUUID();
    }

    @Override
    public boolean complete(long id, PendingBinary binary, String objectKey) {
        return jdbc.update(
                "UPDATE " + table + " SET storage_key = ?, data = NULL WHERE id = ? AND data IS NOT NULL",
                objectKey, id) == 1;
    }
}
