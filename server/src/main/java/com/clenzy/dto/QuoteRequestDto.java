package com.clenzy.dto;

import java.util.List;

/**
 * DTO pour les demandes de devis depuis la landing page.
 * Correspond aux 12 étapes du formulaire multi-step.
 */
public class QuoteRequestDto {

    private String propertyType;
    private String propertyCount;
    private String guestCapacity;
    private int surface;
    private String bookingFrequency;
    private String cleaningSchedule;
    private List<String> services;
    private Boolean needsMaintenance;
    private List<String> maintenanceTypes;
    private String calendarSync;
    private String city;
    private String postalCode;
    private String fullName;
    private String email;
    private String phone;

    public QuoteRequestDto() {}

    // --- Getters & Setters ---

    public String getPropertyType() { return propertyType; }
    public void setPropertyType(String propertyType) { this.propertyType = propertyType; }

    public String getPropertyCount() { return propertyCount; }
    public void setPropertyCount(String propertyCount) { this.propertyCount = propertyCount; }

    public String getGuestCapacity() { return guestCapacity; }
    public void setGuestCapacity(String guestCapacity) { this.guestCapacity = guestCapacity; }

    public int getSurface() { return surface; }
    public void setSurface(int surface) { this.surface = surface; }

    public String getBookingFrequency() { return bookingFrequency; }
    public void setBookingFrequency(String bookingFrequency) { this.bookingFrequency = bookingFrequency; }

    public String getCleaningSchedule() { return cleaningSchedule; }
    public void setCleaningSchedule(String cleaningSchedule) { this.cleaningSchedule = cleaningSchedule; }

    public List<String> getServices() { return services; }
    public void setServices(List<String> services) { this.services = services; }

    public Boolean getNeedsMaintenance() { return needsMaintenance; }
    public void setNeedsMaintenance(Boolean needsMaintenance) { this.needsMaintenance = needsMaintenance; }

    public List<String> getMaintenanceTypes() { return maintenanceTypes; }
    public void setMaintenanceTypes(List<String> maintenanceTypes) { this.maintenanceTypes = maintenanceTypes; }

    public String getCalendarSync() { return calendarSync; }
    public void setCalendarSync(String calendarSync) { this.calendarSync = calendarSync; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public String getPostalCode() { return postalCode; }
    public void setPostalCode(String postalCode) { this.postalCode = postalCode; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    @Override
    public String toString() {
        return "QuoteRequestDto{" +
                "propertyType='" + propertyType + '\'' +
                ", propertyCount='" + propertyCount + '\'' +
                ", fullName='" + fullName + '\'' +
                ", email='" + email + '\'' +
                ", city='" + city + '\'' +
                ", surface=" + surface +
                '}';
    }
}
