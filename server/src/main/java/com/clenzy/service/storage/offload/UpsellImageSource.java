package com.clenzy.service.storage.offload;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.function.BooleanSupplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Images des extras (upsells) enregistrées en data URL base64 dans {@code upsell_offers.image_url}.
 * Chacune devient un média de la médiathèque (objet sur le stockage + ligne {@code media_assets}) et
 * l'offre pointe désormais vers son lien public {@code /api/public/media/t/{jeton}}.
 */
final class UpsellImageSource implements InlineBinarySource {

    private static final Logger log = LoggerFactory.getLogger(UpsellImageSource.class);
    private static final Pattern DATA_URL = Pattern.compile("^data:([\\w.+-]+/[\\w.+-]+);base64,(.+)$", Pattern.DOTALL);

    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaction;
    private final BooleanSupplier active;

    UpsellImageSource(JdbcTemplate jdbc, PlatformTransactionManager transactionManager, BooleanSupplier active) {
        this.jdbc = jdbc;
        this.transaction = new TransactionTemplate(transactionManager);
        this.active = active;
    }

    @Override
    public String family() {
        return "images-extras";
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
                "SELECT id FROM upsell_offers WHERE image_url LIKE 'data:%' AND id > ? ORDER BY id LIMIT ?",
                Long.class, afterId, limit);
    }

    @Override
    public PendingBinary load(long id) {
        return jdbc.query(
                "SELECT organization_id, image_url FROM upsell_offers WHERE id = ? AND image_url LIKE 'data:%'",
                rs -> rs.next() ? decode(id, rs.getLong("organization_id"), rs.getString("image_url")) : null,
                id);
    }

    private static PendingBinary decode(long id, long organizationId, String dataUrl) {
        final Matcher matcher = DATA_URL.matcher(dataUrl);
        if (!matcher.matches()) {
            log.warn("Image de l'extra id={} : data URL illisible, laissée en place", id);
            return null;
        }
        final byte[] bytes;
        try {
            bytes = Base64.getMimeDecoder().decode(matcher.group(2));
        } catch (IllegalArgumentException e) {
            log.warn("Image de l'extra id={} : base64 invalide, laissée en place", id);
            return null;
        }
        return new PendingBinary(organizationId, matcher.group(1), bytes, dataUrl);
    }

    @Override
    public String objectKey(PendingBinary binary) {
        return "org/" + binary.organizationId() + "/photos/" + UUID.randomUUID();
    }

    /** Crée le média et repointe l'offre dans une même transaction ; rien si l'image a changé entre-temps. */
    @Override
    public boolean complete(long id, PendingBinary binary, String objectKey) {
        final UUID token = UUID.randomUUID();
        final Boolean done = transaction.execute(status -> {
            jdbc.update("INSERT INTO media_assets (organization_id, public_token, storage_key, content_type,"
                            + " file_name, file_size, created_at) VALUES (?, ?, ?, ?, ?, ?, now())",
                    binary.organizationId(), token, objectKey, binary.contentType(),
                    "extra-" + id, binary.data().length);
            final int updated = jdbc.update("UPDATE upsell_offers SET image_url = ? WHERE id = ? AND image_url = ?",
                    "/api/public/media/t/" + token, id, binary.currentRef());
            if (updated != 1) {
                status.setRollbackOnly();
                return false;
            }
            return true;
        });
        return Boolean.TRUE.equals(done);
    }
}
