package com.clenzy.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "properties")
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class Property {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @NotBlank(message = "Le nom du logement est obligatoire")
    @Size(min = 3, max = 100, message = "Le nom doit contenir entre 3 et 100 caractères")
    @Column(name = "name", nullable = false)
    private String name;
    
    @Size(max = 500, message = "La description ne peut pas dépasser 500 caractères")
    @Column(columnDefinition = "TEXT")
    private String description;
    
    @NotBlank(message = "L'adresse est obligatoire")
    @Size(max = 200, message = "L'adresse ne peut pas dépasser 200 caractères")
    @Column(nullable = false)
    private String address;
    
    @Size(max = 10, message = "Le code postal ne peut pas dépasser 10 caractères")
    @Column(name = "postal_code")
    private String postalCode;
    
    @Size(max = 50, message = "La ville ne peut pas dépasser 50 caractères")
    private String city;
    
    @Size(max = 50, message = "Le pays ne peut pas dépasser 50 caractères")
    private String country;
    
    @Column(name = "latitude")
    private BigDecimal latitude;
    
    @Column(name = "longitude")
    private BigDecimal longitude;

    @Column(name = "department", length = 3)
    private String department;

    @Column(name = "arrondissement", length = 5)
    private String arrondissement;
    
    @NotNull(message = "Le nombre de chambres est obligatoire")
    @Column(name = "bedroom_count", nullable = false)
    private Integer bedroomCount;
    
    @NotNull(message = "Le nombre de salles de bain est obligatoire")
    @Column(name = "bathroom_count", nullable = false)
    private Integer bathroomCount;
    
    @Column(name = "max_guests")
    private Integer maxGuests;
    
    @Column(name = "square_meters")
    private Integer squareMeters;
    
    @Column(name = "nightly_price", precision = 10, scale = 2)
    private BigDecimal nightlyPrice;

    @Column(name = "default_currency", nullable = false, length = 3, columnDefinition = "varchar(3) default 'EUR'")
    private String defaultCurrency = "EUR";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PropertyType type = PropertyType.APARTMENT;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PropertyStatus status = PropertyStatus.ACTIVE;
    
    @Column(name = "airbnb_listing_id")
    private String airbnbListingId;
    
    @Column(name = "airbnb_url")
    private String airbnbUrl;
    
    @Column(name = "cleaning_frequency")
    @Enumerated(EnumType.STRING)
    private CleaningFrequency cleaningFrequency = CleaningFrequency.AFTER_EACH_STAY;
    
    @Column(name = "maintenance_contract")
    private boolean maintenanceContract = false;
    
    @Column(name = "emergency_contact")
    private String emergencyContact;
    
    @Column(name = "emergency_phone")
    private String emergencyPhone;
    
    @Column(name = "access_instructions", columnDefinition = "TEXT")
    private String accessInstructions;
    
    @Column(name = "special_requirements", columnDefinition = "TEXT")
    private String specialRequirements;

    @Column(name = "default_check_in_time", length = 5)
    private String defaultCheckInTime = "15:00";

    @Column(name = "default_check_out_time", length = 5)
    private String defaultCheckOutTime = "11:00";

    // ─── Tarification ménage ────────────────────────────────────────────────────

    @Column(name = "cleaning_base_price", precision = 10, scale = 2)
    private BigDecimal cleaningBasePrice;

    @Column(name = "cleaning_duration_minutes")
    private Integer cleaningDurationMinutes;

    @Column(name = "number_of_floors")
    private Integer numberOfFloors;

    @Column(name = "has_exterior")
    private Boolean hasExterior = false;

    @Column(name = "has_laundry")
    private Boolean hasLaundry = true;

    // ─── Prestations à la carte ───────────────────────────────────────────────────

    @Column(name = "window_count")
    private Integer windowCount = 0;

    @Column(name = "french_door_count")
    private Integer frenchDoorCount = 0;

    @Column(name = "sliding_door_count")
    private Integer slidingDoorCount = 0;

    @Column(name = "has_ironing")
    private Boolean hasIroning = false;

    @Column(name = "has_deep_kitchen")
    private Boolean hasDeepKitchen = false;

    @Column(name = "has_disinfection")
    private Boolean hasDisinfection = false;

    @Column(name = "amenities", columnDefinition = "TEXT")
    private String amenities;

    @Column(name = "cleaning_notes", columnDefinition = "TEXT")
    private String cleaningNotes;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    @UpdateTimestamp
    private LocalDateTime updatedAt;
    
    // Relations
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;
    
    @OneToMany(mappedBy = "property", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private Set<ServiceRequest> serviceRequests = new HashSet<>();
    
    // Relation vers les interventions supprimée car nous utilisons ServiceRequest directement
    
    @OneToMany(mappedBy = "property", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private Set<PropertyPhoto> photos = new HashSet<>();
    
    // Constructeurs
    public Property() {}
    
    public Property(String name, String address, Integer bedroomCount, Integer bathroomCount, User owner) {
        this.name = name;
        this.address = address;
        this.bedroomCount = bedroomCount;
        this.bathroomCount = bathroomCount;
        this.owner = owner;
    }
    
    // Getters et Setters
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }
    
    public String getName() {
        return name;
    }
    
    public void setName(String name) {
        this.name = name;
    }
    
    public String getDescription() {
        return description;
    }
    
    public void setDescription(String description) {
        this.description = description;
    }
    
    public String getAddress() {
        return address;
    }
    
    public void setAddress(String address) {
        this.address = address;
    }
    
    public String getPostalCode() {
        return postalCode;
    }
    
    public void setPostalCode(String postalCode) {
        this.postalCode = postalCode;
    }
    
    public String getCity() {
        return city;
    }
    
    public void setCity(String city) {
        this.city = city;
    }
    
    public String getCountry() {
        return country;
    }
    
    public void setCountry(String country) {
        this.country = country;
    }
    
    public BigDecimal getLatitude() {
        return latitude;
    }
    
    public void setLatitude(BigDecimal latitude) {
        this.latitude = latitude;
    }
    
    public BigDecimal getLongitude() {
        return longitude;
    }
    
    public void setLongitude(BigDecimal longitude) {
        this.longitude = longitude;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public String getArrondissement() {
        return arrondissement;
    }

    public void setArrondissement(String arrondissement) {
        this.arrondissement = arrondissement;
    }

    public Integer getBedroomCount() {
        return bedroomCount;
    }
    
    public void setBedroomCount(Integer bedroomCount) {
        this.bedroomCount = bedroomCount;
    }
    
    public Integer getBathroomCount() {
        return bathroomCount;
    }
    
    public void setBathroomCount(Integer bathroomCount) {
        this.bathroomCount = bathroomCount;
    }
    
    public Integer getMaxGuests() {
        return maxGuests;
    }
    
    public void setMaxGuests(Integer maxGuests) {
        this.maxGuests = maxGuests;
    }
    
    public Integer getSquareMeters() {
        return squareMeters;
    }
    
    public void setSquareMeters(Integer squareMeters) {
        this.squareMeters = squareMeters;
    }
    
    public BigDecimal getNightlyPrice() {
        return nightlyPrice;
    }
    
    public void setNightlyPrice(BigDecimal nightlyPrice) {
        this.nightlyPrice = nightlyPrice;
    }
    
    public String getDefaultCurrency() {
        return defaultCurrency;
    }

    public void setDefaultCurrency(String defaultCurrency) {
        this.defaultCurrency = defaultCurrency;
    }

    public PropertyType getType() {
        return type;
    }
    
    public void setType(PropertyType type) {
        this.type = type;
    }
    
    public PropertyStatus getStatus() {
        return status;
    }
    
    public void setStatus(PropertyStatus status) {
        this.status = status;
    }
    
    public String getAirbnbListingId() {
        return airbnbListingId;
    }
    
    public void setAirbnbListingId(String airbnbListingId) {
        this.airbnbListingId = airbnbListingId;
    }
    
    public String getAirbnbUrl() {
        return airbnbUrl;
    }
    
    public void setAirbnbUrl(String airbnbUrl) {
        this.airbnbUrl = airbnbUrl;
    }
    
    public CleaningFrequency getCleaningFrequency() {
        return cleaningFrequency;
    }
    
    public void setCleaningFrequency(CleaningFrequency cleaningFrequency) {
        this.cleaningFrequency = cleaningFrequency;
    }
    
    public boolean isMaintenanceContract() {
        return maintenanceContract;
    }
    
    public void setMaintenanceContract(boolean maintenanceContract) {
        this.maintenanceContract = maintenanceContract;
    }
    
    public String getEmergencyContact() {
        return emergencyContact;
    }
    
    public void setEmergencyContact(String emergencyContact) {
        this.emergencyContact = emergencyContact;
    }
    
    public String getEmergencyPhone() {
        return emergencyPhone;
    }
    
    public void setEmergencyPhone(String emergencyPhone) {
        this.emergencyPhone = emergencyPhone;
    }
    
    public String getAccessInstructions() {
        return accessInstructions;
    }
    
    public void setAccessInstructions(String accessInstructions) {
        this.accessInstructions = accessInstructions;
    }
    
    public String getSpecialRequirements() {
        return specialRequirements;
    }
    
    public void setSpecialRequirements(String specialRequirements) {
        this.specialRequirements = specialRequirements;
    }

    public String getDefaultCheckInTime() {
        return defaultCheckInTime;
    }

    public void setDefaultCheckInTime(String defaultCheckInTime) {
        this.defaultCheckInTime = defaultCheckInTime;
    }

    public String getDefaultCheckOutTime() {
        return defaultCheckOutTime;
    }

    public void setDefaultCheckOutTime(String defaultCheckOutTime) {
        this.defaultCheckOutTime = defaultCheckOutTime;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
    
    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
    
    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
    
    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
    
    public User getOwner() {
        return owner;
    }
    
    public void setOwner(User owner) {
        this.owner = owner;
    }
    
    public Set<ServiceRequest> getServiceRequests() {
        return serviceRequests;
    }
    
    public void setServiceRequests(Set<ServiceRequest> serviceRequests) {
        this.serviceRequests = serviceRequests;
    }
    

    
    public Set<PropertyPhoto> getPhotos() {
        return photos;
    }

    public void setPhotos(Set<PropertyPhoto> photos) {
        this.photos = photos;
    }

    public BigDecimal getCleaningBasePrice() {
        return cleaningBasePrice;
    }

    public void setCleaningBasePrice(BigDecimal cleaningBasePrice) {
        this.cleaningBasePrice = cleaningBasePrice;
    }

    public Integer getCleaningDurationMinutes() {
        return cleaningDurationMinutes;
    }

    public void setCleaningDurationMinutes(Integer cleaningDurationMinutes) {
        this.cleaningDurationMinutes = cleaningDurationMinutes;
    }

    public Integer getNumberOfFloors() {
        return numberOfFloors;
    }

    public void setNumberOfFloors(Integer numberOfFloors) {
        this.numberOfFloors = numberOfFloors;
    }

    public Boolean getHasExterior() {
        return hasExterior;
    }

    public void setHasExterior(Boolean hasExterior) {
        this.hasExterior = hasExterior;
    }

    public Boolean getHasLaundry() {
        return hasLaundry;
    }

    public void setHasLaundry(Boolean hasLaundry) {
        this.hasLaundry = hasLaundry;
    }

    public Integer getWindowCount() {
        return windowCount;
    }

    public void setWindowCount(Integer windowCount) {
        this.windowCount = windowCount;
    }

    public Integer getFrenchDoorCount() {
        return frenchDoorCount;
    }

    public void setFrenchDoorCount(Integer frenchDoorCount) {
        this.frenchDoorCount = frenchDoorCount;
    }

    public Integer getSlidingDoorCount() {
        return slidingDoorCount;
    }

    public void setSlidingDoorCount(Integer slidingDoorCount) {
        this.slidingDoorCount = slidingDoorCount;
    }

    public Boolean getHasIroning() {
        return hasIroning;
    }

    public void setHasIroning(Boolean hasIroning) {
        this.hasIroning = hasIroning;
    }

    public Boolean getHasDeepKitchen() {
        return hasDeepKitchen;
    }

    public void setHasDeepKitchen(Boolean hasDeepKitchen) {
        this.hasDeepKitchen = hasDeepKitchen;
    }

    public Boolean getHasDisinfection() {
        return hasDisinfection;
    }

    public void setHasDisinfection(Boolean hasDisinfection) {
        this.hasDisinfection = hasDisinfection;
    }

    public String getAmenities() {
        return amenities;
    }

    public void setAmenities(String amenities) {
        this.amenities = amenities;
    }

    public String getCleaningNotes() {
        return cleaningNotes;
    }

    public void setCleaningNotes(String cleaningNotes) {
        this.cleaningNotes = cleaningNotes;
    }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    // Méthodes utilitaires
    public String getFullAddress() {
        StringBuilder address = new StringBuilder(this.address);
        if (postalCode != null && !postalCode.isEmpty()) {
            address.append(", ").append(postalCode);
        }
        if (city != null && !city.isEmpty()) {
            address.append(" ").append(city);
        }
        if (country != null && !country.isEmpty()) {
            address.append(", ").append(country);
        }
        return address.toString();
    }
    
    public boolean hasCoordinates() {
        return latitude != null && longitude != null;
    }
    
    public boolean isActive() {
        return PropertyStatus.ACTIVE.equals(status);
    }
    
    @Override
    public String toString() {
        return "Property{" +
                "id=" + id +
                ", name='" + name + '\'' +
                ", address='" + address + '\'' +
                ", city='" + city + '\'' +
                ", type=" + type +
                ", status=" + status +
                '}';
    }
}
