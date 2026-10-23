package com.clenzy.service;

import com.clenzy.model.NoiseDevice;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Timestamp;
import java.time.LocalDateTime;

/** Baitly : un resultat de GET ne peut restaurer un ancien rattachement ou episode. */
@Service
public class BaitlyNoiseStatusWriter {
    public record Snapshot(Long id, Long organization, Long property, NoiseDevice.DeviceType type,
                           String externalId, Boolean online, LocalDateTime refreshedAt) {
        static Snapshot capture(NoiseDevice device) {
            if (device.getStatus() != NoiseDevice.DeviceStatus.ACTIVE || device.isSimulation()) throw unavailable();
            return new Snapshot(device.getId(), device.getOrganizationId(), device.getPropertyId(),
                device.getDeviceType(), device.getExternalDeviceId(), device.getOnline(), device.getLastSeenAt());
        }
    }

    private final JdbcTemplate db;
    private final TransactionTemplate transaction;

    public BaitlyNoiseStatusWriter(JdbcTemplate db, PlatformTransactionManager manager) {
        this.db = db;
        transaction = new TransactionTemplate(manager);
        transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        transaction.setTimeout(10);
    }

    public void record(Snapshot before, boolean online, LocalDateTime observedAt) {
        try {
            if (before == null || before.id() == null || before.id() <= 0
                    || before.organization() == null || before.organization() <= 0
                    || before.property() == null || before.property() <= 0
                    || before.externalId() == null || before.externalId().isBlank()
                    || before.type() != NoiseDevice.DeviceType.MINUT && before.type() != NoiseDevice.DeviceType.TUYA
                    || observedAt == null) throw unavailable();
            Integer changed = transaction.execute(status -> db.update("""
                UPDATE noise_devices SET online=?, last_seen_at=?,
                    updated_at=CASE WHEN updated_at IS NULL OR updated_at < ? THEN ? ELSE updated_at END
                WHERE id=? AND organization_id=? AND property_id=? AND device_type=? AND external_device_id=?
                AND status='ACTIVE' AND simulation=false
                AND online IS NOT DISTINCT FROM ? AND last_seen_at IS NOT DISTINCT FROM ?
                AND (last_seen_at IS NULL OR last_seen_at <= ?)
                """, online, Timestamp.valueOf(observedAt), Timestamp.valueOf(observedAt), Timestamp.valueOf(observedAt),
                before.id(), before.organization(), before.property(), before.type().name(), before.externalId(),
                before.online(), before.refreshedAt() == null ? null : Timestamp.valueOf(before.refreshedAt()),
                Timestamp.valueOf(observedAt)));
            if (changed == null || changed != 1) throw unavailable();
        } catch (RuntimeException failure) {
            // Ne jamais recopier SQL, arguments ou cause d'origine vers le controller.
            throw unavailable();
        }
    }

    private static IllegalStateException unavailable() {
        return new IllegalStateException("Actualisation du capteur non confirmee");
    }
}
