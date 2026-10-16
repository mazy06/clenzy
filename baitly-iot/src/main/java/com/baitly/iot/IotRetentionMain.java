package com.baitly.iot;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Scheduled maintenance job, run with its own SQL role (SELECT + DELETE), never the runtime one:
 * deletes measurements older than the retention period, then devices whose erasure the PMS
 * requested together with all of their measurements. Batched to keep locks and WAL bursts short.
 */
public final class IotRetentionMain {
    static final int BATCH = 5_000;

    private IotRetentionMain() {}

    public static void main(String[] args) throws Exception {
        var config = PrivateDatabaseConfiguration.load(args, "retention");
        int days = Integer.parseInt(config.getProperty("retentionDays", "90").trim());
        var result = purge(new JdbcTemplate(PrivateDatabaseConfiguration.dataSource(config)), Clock.systemUTC(), days);
        // Counts only: no identifier of a device, organization or property is printed.
        System.out.println("Baitly IoT retention: " + result.expiredMeasurements() + " expired measurements, "
                + result.erasedMeasurements() + " erased measurements, " + result.erasedDevices() + " erased devices");
    }

    record Result(long expiredMeasurements, long erasedMeasurements, long erasedDevices) {}

    static Result purge(JdbcTemplate jdbc, Clock clock, int retentionDays) {
        if (retentionDays < 8 || retentionDays > 3650) {
            // Ingestion accepts measurements up to seven days late: a shorter retention would delete them on arrival.
            throw new IllegalArgumentException("retentionDays must be between 8 and 3650");
        }
        var cutoff = Instant.now(clock).minus(Duration.ofDays(retentionDays)).atOffset(ZoneOffset.UTC);
        long expired = batches(jdbc, """
                DELETE FROM baitly_iot_noise_measurements WHERE ctid IN (
                  SELECT ctid FROM baitly_iot_noise_measurements WHERE measured_at < ? LIMIT ?)
                """, cutoff);
        long erasedMeasurements = batches(jdbc, """
                DELETE FROM baitly_iot_noise_measurements WHERE ctid IN (
                  SELECT m.ctid FROM baitly_iot_noise_measurements m JOIN baitly_iot_devices d ON d.id = m.device_id
                  WHERE d.erasure_requested_at IS NOT NULL LIMIT ?)
                """);
        long erasedDevices = jdbc.update("""
                DELETE FROM baitly_iot_devices d WHERE d.erasure_requested_at IS NOT NULL
                  AND NOT EXISTS (SELECT 1 FROM baitly_iot_noise_measurements m WHERE m.device_id = d.id)
                """);
        return new Result(expired, erasedMeasurements, erasedDevices);
    }

    private static long batches(JdbcTemplate jdbc, String sql, Object... leading) {
        Object[] arguments = java.util.Arrays.copyOf(leading, leading.length + 1);
        arguments[leading.length] = BATCH;
        long total = 0;
        int deleted;
        do {
            deleted = jdbc.update(sql, arguments);
            total += deleted;
        } while (deleted == BATCH);
        return total;
    }
}
