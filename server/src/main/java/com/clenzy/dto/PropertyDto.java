package com.clenzy.dto;

import com.clenzy.dto.validation.Create;
import com.clenzy.model.CleaningFrequency;
import com.clenzy.model.PropertyStatus;
import com.clenzy.model.PropertyType;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class PropertyDto {
    public Long id;

    @NotBlank(groups = Create.class)
    @Size(min = 3, max = 100)
    public String name;

    public String description;

    @NotBlank(groups = Create.class)
    @Size(max = 200)
    public String address;

    public String postalCode;
    public String city;
    public String country;
    public BigDecimal latitude;
    public BigDecimal longitude;

    @NotNull(groups = Create.class)
    @Min(0)
    public Integer bedroomCount;

    @NotNull(groups = Create.class)
    @Min(0)
    public Integer bathroomCount;

    public Integer maxGuests;
    public Integer squareMeters;
    public PropertyType type;
    public PropertyStatus status;
    public String airbnbListingId;
    public String airbnbUrl;
    public CleaningFrequency cleaningFrequency;
    public boolean maintenanceContract;
    public String emergencyContact;
    public String emergencyPhone;
    public String accessInstructions;
    public String specialRequirements;

    @NotNull(groups = Create.class)
    public Long ownerId;

    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}


