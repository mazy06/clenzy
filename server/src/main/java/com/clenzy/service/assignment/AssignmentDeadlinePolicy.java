package com.clenzy.service.assignment;

import java.time.*;

/** Délais Baitly : l'échéance annoncée reste un instant, indépendant du scheduler. */
public final class AssignmentDeadlinePolicy {
    private AssignmentDeadlinePolicy() {}

    public record Settings(int distantMinutes, int standardMinutes, int imminentMinutes,
                           int criticalMinutes, int unscheduledMinutes, int preparationMinutes) {
        public Settings {
            if (distantMinutes < 1 || standardMinutes < 1 || imminentMinutes < 1
                    || criticalMinutes < 1 || unscheduledMinutes < 1 || preparationMinutes < 0
                    || distantMinutes > 10080 || standardMinutes > 10080 || imminentMinutes > 10080
                    || criticalMinutes > 10080 || unscheduledMinutes > 10080 || preparationMinutes > 1440)
                throw new IllegalArgumentException("Délais d'attribution invalides");
        }
        public static Settings defaults() { return new Settings(720, 120, 30, 15, 1440, 30); }
    }

    public static Instant expiresAt(Instant now, Instant start, boolean critical, Settings settings) {
        long minutes = critical ? settings.criticalMinutes() : start == null ? settings.unscheduledMinutes()
            : start.isAfter(now.plus(Duration.ofHours(48))) ? settings.distantMinutes()
            : !start.isBefore(now.plus(Duration.ofHours(6))) ? settings.standardMinutes() : settings.imminentMinutes();
        Instant deadline = now.plus(Duration.ofMinutes(minutes));
        if (start != null) {
            Instant latest = start.minus(Duration.ofMinutes(settings.preparationMinutes()));
            if (latest.isBefore(deadline)) deadline = latest;
        }
        return deadline;
    }

    public static boolean canRespond(Instant now, Instant expiresAt) {
        return expiresAt != null && now.isBefore(expiresAt);
    }
}
