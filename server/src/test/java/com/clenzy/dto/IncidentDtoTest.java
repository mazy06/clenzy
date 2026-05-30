package com.clenzy.dto;

import com.clenzy.model.Incident;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

class IncidentDtoTest {

    @Test
    void canonicalConstructor_exposesAllAccessors() {
        LocalDateTime opened = LocalDateTime.of(2026, 5, 1, 9, 0);
        LocalDateTime acked = LocalDateTime.of(2026, 5, 1, 9, 15);
        LocalDateTime resolved = LocalDateTime.of(2026, 5, 1, 10, 0);

        IncidentDto dto = new IncidentDto(
            42L,
            Incident.IncidentType.SERVICE_DOWN,
            Incident.IncidentSeverity.P1,
            Incident.IncidentStatus.RESOLVED,
            "pms-server",
            "Backend down",
            "Health check failed for >5 min",
            opened, acked, resolved,
            new BigDecimal("60.50"),
            true, false
        );

        assertEquals(42L, dto.id());
        assertEquals(Incident.IncidentType.SERVICE_DOWN, dto.type());
        assertEquals(Incident.IncidentSeverity.P1, dto.severity());
        assertEquals(Incident.IncidentStatus.RESOLVED, dto.status());
        assertEquals("pms-server", dto.serviceName());
        assertEquals("Backend down", dto.title());
        assertEquals("Health check failed for >5 min", dto.description());
        assertEquals(opened, dto.openedAt());
        assertEquals(acked, dto.acknowledgedAt());
        assertEquals(resolved, dto.resolvedAt());
        assertEquals(new BigDecimal("60.50"), dto.resolutionMinutes());
        assertTrue(dto.autoDetected());
        assertFalse(dto.autoResolved());
    }

    @Test
    void from_mapsAllFieldsFromEntity() {
        LocalDateTime opened = LocalDateTime.of(2026, 1, 1, 0, 0);
        LocalDateTime acked = LocalDateTime.of(2026, 1, 1, 0, 10);
        LocalDateTime resolved = LocalDateTime.of(2026, 1, 1, 0, 30);

        Incident incident = new Incident();
        incident.setId(7L);
        incident.setType(Incident.IncidentType.DOUBLE_BOOKING);
        incident.setSeverity(Incident.IncidentSeverity.P2);
        incident.setStatus(Incident.IncidentStatus.OPEN);
        incident.setServiceName("calendar-engine");
        incident.setTitle("Double booking detected");
        incident.setDescription("Two reservations overlap on property #42");
        incident.setOpenedAt(opened);
        incident.setAcknowledgedAt(acked);
        incident.setResolvedAt(resolved);
        incident.setResolutionMinutes(new BigDecimal("30.00"));
        incident.setAutoDetected(true);
        incident.setAutoResolved(true);

        IncidentDto dto = IncidentDto.from(incident);

        assertEquals(7L, dto.id());
        assertEquals(Incident.IncidentType.DOUBLE_BOOKING, dto.type());
        assertEquals(Incident.IncidentSeverity.P2, dto.severity());
        assertEquals(Incident.IncidentStatus.OPEN, dto.status());
        assertEquals("calendar-engine", dto.serviceName());
        assertEquals("Double booking detected", dto.title());
        assertEquals("Two reservations overlap on property #42", dto.description());
        assertEquals(opened, dto.openedAt());
        assertEquals(acked, dto.acknowledgedAt());
        assertEquals(resolved, dto.resolvedAt());
        assertEquals(new BigDecimal("30.00"), dto.resolutionMinutes());
        assertTrue(dto.autoDetected());
        assertTrue(dto.autoResolved());
    }

    @Test
    void from_defaultEntity_returnsExpectedDefaults() {
        Incident incident = new Incident();
        incident.setTitle("Pending incident");

        IncidentDto dto = IncidentDto.from(incident);

        // Defaults from entity
        assertEquals(Incident.IncidentSeverity.P1, dto.severity());
        assertEquals(Incident.IncidentStatus.OPEN, dto.status());
        assertTrue(dto.autoDetected()); // entity default = true
        assertFalse(dto.autoResolved());
        assertNull(dto.id());
        assertNull(dto.acknowledgedAt());
        assertNull(dto.resolvedAt());
    }

    @Test
    void record_equalityByValue() {
        IncidentDto a = new IncidentDto(
            1L, Incident.IncidentType.SYNC_UNAVAILABLE, Incident.IncidentSeverity.P3,
            Incident.IncidentStatus.ACKNOWLEDGED, "sync", "t", "d",
            null, null, null, null, false, false);
        IncidentDto b = new IncidentDto(
            1L, Incident.IncidentType.SYNC_UNAVAILABLE, Incident.IncidentSeverity.P3,
            Incident.IncidentStatus.ACKNOWLEDGED, "sync", "t", "d",
            null, null, null, null, false, false);
        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
    }
}
