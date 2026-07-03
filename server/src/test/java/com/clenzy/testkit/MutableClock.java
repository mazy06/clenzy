package com.clenzy.testkit;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;

/**
 * Clock de test mutable : l'instant courant est pose/avance par le test
 * (jamais de sleep). A exposer en {@code @Bean @Primary} dans une
 * {@code @TestConfiguration} pour remplacer le {@code Clock.systemUTC()}
 * de {@code ClockConfig} dans tous les services qui injectent {@link Clock}
 * (moteur d'automatisations, suggestions supervision, etc.).
 */
public final class MutableClock extends Clock {

    private volatile Instant instant;
    private final ZoneId zone;

    public MutableClock(Instant initial, ZoneId zone) {
        this.instant = initial;
        this.zone = zone;
    }

    public static MutableClock utc(Instant initial) {
        return new MutableClock(initial, ZoneId.of("UTC"));
    }

    /** Pose l'instant courant. */
    public void setInstant(Instant newInstant) {
        this.instant = newInstant;
    }

    /** Avance l'horloge. */
    public void advance(Duration duration) {
        this.instant = this.instant.plus(duration);
    }

    @Override
    public ZoneId getZone() {
        return zone;
    }

    @Override
    public Clock withZone(ZoneId newZone) {
        return new MutableClock(instant, newZone);
    }

    @Override
    public Instant instant() {
        return instant;
    }
}
