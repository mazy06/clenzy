package com.baitly.iot;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import static com.baitly.iot.DeviceContracts.*;

@Repository
public class DeviceRepository {
    private final JdbcTemplate jdbc;

    public DeviceRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record Device(UUID id, long organizationId, long propertyId, String name, boolean revoked,
                         int reportingIntervalSeconds, Instant lastReceivedAt, Instant lastMeasuredAt, boolean simulation) {}

    public void ensureSimulator(UUID id, long orgId, RegisterDevice input, String hash, Instant now) {
        jdbc.update("""
                INSERT INTO baitly_iot_devices
                (id, organization_id, property_id, name, token_hash, reporting_interval_seconds, created_at, simulation)
                VALUES (?, ?, ?, ?, ?, ?, ?, TRUE) ON CONFLICT DO NOTHING
                """, id, orgId, input.propertyId(), input.name(), hash, input.reportingIntervalSeconds(), utc(now));
    }

    public void rotate(UUID id, long orgId, String hash) {
        jdbc.update("UPDATE baitly_iot_devices SET token_hash = ? WHERE id = ? AND organization_id = ? AND NOT revoked",
                hash, id, orgId);
    }

    public void insert(UUID id, long orgId, RegisterDevice input, String hash, Instant now) {
        jdbc.update("""
                INSERT INTO baitly_iot_devices
                (id, organization_id, property_id, name, token_hash, reporting_interval_seconds, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, id, orgId, input.propertyId(), input.name(), hash,
                input.reportingIntervalSeconds(), utc(now));
    }

    public Optional<Device> authenticate(String hash) {
        return jdbc.query("SELECT * FROM baitly_iot_devices WHERE token_hash = ? AND NOT revoked",
                this::map, hash).stream().findFirst();
    }

    public Optional<Device> find(UUID id, long orgId) {
        return jdbc.query("SELECT * FROM baitly_iot_devices WHERE id = ? AND organization_id = ?",
                this::map, id, orgId).stream().findFirst();
    }

    public List<Device> list(long orgId) {
        return jdbc.query("SELECT * FROM baitly_iot_devices WHERE organization_id = ? ORDER BY created_at, id",
                this::map, orgId);
    }

    public Optional<Device> lock(UUID id) {
        return jdbc.query("SELECT * FROM baitly_iot_devices WHERE id = ? FOR UPDATE",
                this::map, id).stream().findFirst();
    }

    public Optional<Device> lockAuthenticated(DeviceIdentity identity) {
        return jdbc.query("SELECT * FROM baitly_iot_devices WHERE id = ? AND token_hash = ? AND NOT revoked FOR UPDATE",
                this::map, identity.id(), identity.tokenHash()).stream().findFirst();
    }

    public boolean revoke(UUID id, long orgId) {
        return jdbc.update("UPDATE baitly_iot_devices SET revoked = TRUE WHERE id = ? AND organization_id = ?",
                id, orgId) == 1;
    }

    public boolean insertMeasurement(UUID id, NoiseMeasurement input, Instant receivedAt) {
        return jdbc.update("""
                INSERT INTO baitly_iot_noise_measurements
                (device_id, event_id, measured_at, received_at, window_seconds, laeq_db_a)
                VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING
                """, id, input.eventId(), utc(input.measuredAt()), utc(receivedAt),
                input.windowSeconds(), input.laeqDbA()) == 1;
    }

    public Optional<MeasurementView> measurement(UUID deviceId, UUID eventId) {
        return jdbc.query("SELECT * FROM baitly_iot_noise_measurements WHERE device_id = ? AND event_id = ?",
                this::mapMeasurement, deviceId, eventId).stream().findFirst();
    }

    public void touch(UUID id, Instant receivedAt, Instant measuredAt) {
        jdbc.update("""
                UPDATE baitly_iot_devices SET last_received_at = ?,
                  last_measured_at = CASE WHEN last_measured_at IS NULL OR last_measured_at < ?
                    THEN ? ELSE last_measured_at END WHERE id = ?
                """, utc(receivedAt), utc(measuredAt), utc(measuredAt), id);
    }

    public List<MeasurementView> measurements(UUID id, Instant from, Instant to, int limit) {
        return jdbc.query("""
                SELECT * FROM (
                  SELECT * FROM baitly_iot_noise_measurements
                  WHERE device_id = ? AND measured_at >= ? AND measured_at < ?
                  ORDER BY measured_at DESC, event_id DESC LIMIT ?
                ) recent ORDER BY measured_at, event_id
                """, this::mapMeasurement, id, utc(from), utc(to), limit);
    }

    private Device map(ResultSet row, int index) throws SQLException {
        return new Device(row.getObject("id", UUID.class), row.getLong("organization_id"),
                row.getLong("property_id"), row.getString("name"), row.getBoolean("revoked"),
                row.getInt("reporting_interval_seconds"), instant(row, "last_received_at"),
                instant(row, "last_measured_at"), row.getBoolean("simulation"));
    }

    private MeasurementView mapMeasurement(ResultSet row, int index) throws SQLException {
        return new MeasurementView(row.getObject("event_id", UUID.class), instant(row, "measured_at"),
                instant(row, "received_at"), row.getInt("window_seconds"), row.getDouble("laeq_db_a"));
    }

    private static Instant instant(ResultSet row, String column) throws SQLException {
        OffsetDateTime value = row.getObject(column, OffsetDateTime.class);
        return value == null ? null : value.toInstant();
    }

    private static OffsetDateTime utc(Instant value) {
        return value.atOffset(java.time.ZoneOffset.UTC);
    }
}
