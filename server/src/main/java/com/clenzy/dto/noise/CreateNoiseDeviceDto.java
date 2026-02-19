package com.clenzy.dto.noise;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class CreateNoiseDeviceDto {

    @NotBlank(message = "Le type de capteur est requis")
    private String deviceType; // MINUT ou TUYA

    @NotBlank(message = "Le nom du capteur est requis")
    private String name;

    @NotNull(message = "La propriete est requise")
    private Long propertyId;

    private String roomName;

    private String externalDeviceId;

    private String externalHomeId;

    // ─── Getters / Setters ──────────────────────────────────────

    public String getDeviceType() { return deviceType; }
    public void setDeviceType(String deviceType) { this.deviceType = deviceType; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }

    public String getRoomName() { return roomName; }
    public void setRoomName(String roomName) { this.roomName = roomName; }

    public String getExternalDeviceId() { return externalDeviceId; }
    public void setExternalDeviceId(String externalDeviceId) { this.externalDeviceId = externalDeviceId; }

    public String getExternalHomeId() { return externalHomeId; }
    public void setExternalHomeId(String externalHomeId) { this.externalHomeId = externalHomeId; }
}
