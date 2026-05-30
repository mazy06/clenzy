package com.clenzy.dto.smartlock;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

class SmartLockDeviceDtoTest {

    @Test
    void defaultConstructor_allFieldsNull() {
        SmartLockDeviceDto dto = new SmartLockDeviceDto();

        assertNull(dto.getId());
        assertNull(dto.getName());
        assertNull(dto.getPropertyId());
        assertNull(dto.getPropertyName());
        assertNull(dto.getRoomName());
        assertNull(dto.getExternalDeviceId());
        assertNull(dto.getStatus());
        assertNull(dto.getLockState());
        assertNull(dto.getBatteryLevel());
        assertNull(dto.getCreatedAt());
    }

    @Test
    void settersAndGetters_roundtripAllFields() {
        LocalDateTime created = LocalDateTime.of(2026, 5, 30, 12, 0);
        SmartLockDeviceDto dto = new SmartLockDeviceDto();

        dto.setId(1L);
        dto.setName("Front door lock");
        dto.setPropertyId(10L);
        dto.setPropertyName("Villa Bleue");
        dto.setRoomName("Entrance");
        dto.setExternalDeviceId("nuki-abc-123");
        dto.setStatus("ONLINE");
        dto.setLockState("LOCKED");
        dto.setBatteryLevel(85);
        dto.setCreatedAt(created);

        assertEquals(1L, dto.getId());
        assertEquals("Front door lock", dto.getName());
        assertEquals(10L, dto.getPropertyId());
        assertEquals("Villa Bleue", dto.getPropertyName());
        assertEquals("Entrance", dto.getRoomName());
        assertEquals("nuki-abc-123", dto.getExternalDeviceId());
        assertEquals("ONLINE", dto.getStatus());
        assertEquals("LOCKED", dto.getLockState());
        assertEquals(85, dto.getBatteryLevel());
        assertEquals(created, dto.getCreatedAt());
    }

    @Test
    void setNull_clearsFields() {
        SmartLockDeviceDto dto = new SmartLockDeviceDto();
        dto.setName("A");
        dto.setBatteryLevel(50);

        dto.setName(null);
        dto.setBatteryLevel(null);

        assertNull(dto.getName());
        assertNull(dto.getBatteryLevel());
    }

    @Test
    void batteryLevel_canBeZero() {
        SmartLockDeviceDto dto = new SmartLockDeviceDto();
        dto.setBatteryLevel(0);
        assertEquals(0, dto.getBatteryLevel());
    }

    @Test
    void batteryLevel_canBe100() {
        SmartLockDeviceDto dto = new SmartLockDeviceDto();
        dto.setBatteryLevel(100);
        assertEquals(100, dto.getBatteryLevel());
    }
}
