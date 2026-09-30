package com.clenzy.service.storage.offload;

import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.function.BooleanSupplier;

/**
 * Binaires de la table {@code binary_asset} (avatars, logos, médiathèque et justificatifs stockés en
 * mode base). En mode objet, cette table n'est plus lue : chaque ligne est copiée sous la <b>même
 * clé</b>, puis supprimée.
 */
final class BinaryAssetSource implements InlineBinarySource {

    private final JdbcTemplate jdbc;
    private final BooleanSupplier active;

    BinaryAssetSource(JdbcTemplate jdbc, BooleanSupplier active) {
        this.jdbc = jdbc;
        this.active = active;
    }

    @Override
    public String family() {
        return "binaires";
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
        return jdbc.queryForList("SELECT id FROM binary_asset WHERE id > ? ORDER BY id LIMIT ?",
                Long.class, afterId, limit);
    }

    @Override
    public PendingBinary load(long id) {
        return jdbc.query("SELECT storage_key, content_type, bytes FROM binary_asset WHERE id = ?",
                rs -> rs.next()
                        ? new PendingBinary(null, rs.getString("content_type"), rs.getBytes("bytes"),
                                rs.getString("storage_key"))
                        : null,
                id);
    }

    /** La clé logique est conservée telle quelle : c'est celle que les entités métier référencent. */
    @Override
    public String objectKey(PendingBinary binary) {
        return binary.currentRef();
    }

    @Override
    public boolean complete(long id, PendingBinary binary, String objectKey) {
        return jdbc.update("DELETE FROM binary_asset WHERE id = ? AND storage_key = ?", id, objectKey) == 1;
    }
}
