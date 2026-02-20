package com.clenzy.dto.noise;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class CreateNoiseDeviceDto {

    @NotBlank(message = "Le type de capteur est requis")
    private String deviceType; // MINUT ou TUYA

    @NotBlank(message = "Le nom du capteur est requis")
    private String name;

    @NotNull(message = "La propriete est requise")
    private Long propertyId;

    @Size(max = 100, message = "Le nom de la piece ne peut pas depasser 100 caracteres")
    private String roomName;

    @Pattern(regexp = "^[a-zA-Z0-9_-]{1,64}$", message = "ID device externe invalide: caracteres alphanumeriques, tirets et underscores uniquement")
    @Size(max = 64, message = "L'ID device externe ne peut pas depasser 64 caracteres")
    private String externalDeviceId;

    @Pattern(regexp = "^[a-zA-Z0-9_-]{1,64}$", message = "ID home externe invalide: caracteres alphanumeriques, tirets et underscores uniquement")
    @Size(max = 64, message = "L'ID home externe ne peut pas depasser 64 caracteres")
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
