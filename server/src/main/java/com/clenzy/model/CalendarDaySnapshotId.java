package com.clenzy.model;

import java.io.Serializable;
import java.time.LocalDate;
import java.util.Objects;

/** Clé composite de {@link CalendarDaySnapshot} : (property, nuit, jour de photo). */
public class CalendarDaySnapshotId implements Serializable {

    private Long propertyId;
    private LocalDate stayDate;
    private LocalDate snapshotDate;

    public CalendarDaySnapshotId() {
    }

    public CalendarDaySnapshotId(Long propertyId, LocalDate stayDate, LocalDate snapshotDate) {
        this.propertyId = propertyId;
        this.stayDate = stayDate;
        this.snapshotDate = snapshotDate;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof CalendarDaySnapshotId other)) return false;
        return Objects.equals(propertyId, other.propertyId)
                && Objects.equals(stayDate, other.stayDate)
                && Objects.equals(snapshotDate, other.snapshotDate);
    }

    @Override
    public int hashCode() {
        return Objects.hash(propertyId, stayDate, snapshotDate);
    }
}
