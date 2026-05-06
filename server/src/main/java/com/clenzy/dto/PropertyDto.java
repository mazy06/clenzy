package com.clenzy.dto;

import com.clenzy.dto.validation.Create;
import com.clenzy.model.CleaningFrequency;
import com.clenzy.model.PropertyStatus;
import com.clenzy.model.PropertyType;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

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
    @Size(max = 2)
    public String countryCode;
    public BigDecimal latitude;
    public BigDecimal longitude;
    public String department;
    public String arrondissement;

    @NotNull(groups = Create.class)
    @Min(0)
    public Integer bedroomCount;

    @NotNull(groups = Create.class)
    @Min(0)
    public Integer bathroomCount;

    public Integer maxGuests;
    public Integer squareMeters;
    
    @Min(0)
    public BigDecimal nightlyPrice;

    @Min(1)
    public Integer minimumNights;

    public PropertyType type;
    public PropertyStatus status;
    /** Type de menage par defaut (CLEANING / EXPRESS_CLEANING / DEEP_CLEANING). */
    public String defaultCleaningType;
    /** URL relative de la photo principale (premiere par sortOrder). Null si aucune photo. */
    public String coverPhotoUrl;
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
    public String ownerName;

    // Informations du manager associé (pour l'endpoint with-managers)
    public Long managerId;
    public String managerFirstName;
    public String managerLastName;
    public String managerEmail;

    // Tarification ménage
    @Min(0)
    public BigDecimal cleaningBasePrice;
    public Integer cleaningDurationMinutes;
    public Integer numberOfFloors;
    public Boolean hasExterior;
    public Boolean hasLaundry;

    // Prestations à la carte
    @Min(0)
    public Integer windowCount;
    @Min(0)
    public Integer frenchDoorCount;
    @Min(0)
    public Integer slidingDoorCount;
    public Boolean hasIroning;
    public Boolean hasDeepKitchen;
    public Boolean hasDisinfection;

    // Équipements (amenities)
    public List<String> amenities;

    public String cleaningNotes;

    // Booking Engine
    public Boolean bookingEngineVisible;

    // Horaires par défaut (check-in / check-out)
    public String defaultCheckInTime;
    public String defaultCheckOutTime;

    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;

    // Instructions voyageur (check-in instructions)
    public CheckInInstructionsDto checkInInstructions;
}


