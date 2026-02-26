package com.clenzy.dto;

import com.clenzy.model.BillingPeriod;
import com.clenzy.model.OrganizationType;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * DTO pour la demande d'inscription depuis la landing page ou le PMS.
 * Contient les informations utilisateur + les donnees du formulaire de devis.
 */
public class InscriptionDto {

    @NotBlank(message = "Le nom complet est requis")
    @Size(min = 3, max = 100, message = "Le nom complet doit contenir entre 3 et 100 caracteres")
    private String fullName;

    @NotBlank(message = "L'email est requis")
    @Email(message = "L'email doit etre valide")
    private String email;

    private String phone;

    private String companyName;

    private String organizationType; // INDIVIDUAL, CONCIERGE, CLEANING_COMPANY

    @NotBlank(message = "Le mot de passe est requis")
    @Size(min = 8, message = "Le mot de passe doit contenir au moins 8 caracteres")
    private String password;

    @NotBlank(message = "Le forfait est requis")
    private String forfait; // essentiel, confort, premium

    // Donnees du formulaire de devis (optionnelles, venant de la landing page)
    private String city;
    private String postalCode;
    private String propertyType;
    private Integer propertyCount;
    private Integer surface;
    private Integer guestCapacity;

    // Donnees supplementaires du formulaire de devis
    private String bookingFrequency;
    private String cleaningSchedule;
    private String calendarSync;
    private List<String> services;
    private List<String> servicesDevis;

    private String billingPeriod = "MONTHLY";

    // Constructeurs
    public InscriptionDto() {}

    // Getters et Setters
    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }

    public String getOrganizationType() { return organizationType; }
    public void setOrganizationType(String organizationType) { this.organizationType = organizationType; }

    /**
     * Retourne le OrganizationType depuis la string, INDIVIDUAL par defaut.
     */
    public OrganizationType getOrganizationTypeEnum() {
        if (organizationType == null || organizationType.isBlank()) {
            return OrganizationType.INDIVIDUAL;
        }
        try {
            return OrganizationType.valueOf(organizationType);
        } catch (IllegalArgumentException e) {
            return OrganizationType.INDIVIDUAL;
        }
    }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getForfait() { return forfait; }
    public void setForfait(String forfait) { this.forfait = forfait; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public String getPostalCode() { return postalCode; }
    public void setPostalCode(String postalCode) { this.postalCode = postalCode; }

    public String getPropertyType() { return propertyType; }
    public void setPropertyType(String propertyType) { this.propertyType = propertyType; }

    public Integer getPropertyCount() { return propertyCount; }
    public void setPropertyCount(Integer propertyCount) { this.propertyCount = propertyCount; }

    public Integer getSurface() { return surface; }
    public void setSurface(Integer surface) { this.surface = surface; }

    public Integer getGuestCapacity() { return guestCapacity; }
    public void setGuestCapacity(Integer guestCapacity) { this.guestCapacity = guestCapacity; }

    public String getBookingFrequency() { return bookingFrequency; }
    public void setBookingFrequency(String bookingFrequency) { this.bookingFrequency = bookingFrequency; }

    public String getCleaningSchedule() { return cleaningSchedule; }
    public void setCleaningSchedule(String cleaningSchedule) { this.cleaningSchedule = cleaningSchedule; }

    public String getCalendarSync() { return calendarSync; }
    public void setCalendarSync(String calendarSync) { this.calendarSync = calendarSync; }

    public List<String> getServices() { return services; }
    public void setServices(List<String> services) { this.services = services; }

    public List<String> getServicesDevis() { return servicesDevis; }
    public void setServicesDevis(List<String> servicesDevis) { this.servicesDevis = servicesDevis; }

    public String getBillingPeriod() { return billingPeriod; }
    public void setBillingPeriod(String billingPeriod) { this.billingPeriod = billingPeriod; }

    public BillingPeriod getBillingPeriodEnum() {
        return BillingPeriod.fromString(billingPeriod);
    }

    /**
     * Extrait le prenom depuis le nom complet
     */
    public String getFirstName() {
        if (fullName == null || fullName.isBlank()) return "";
        String[] parts = fullName.trim().split("\\s+");
        return parts[0];
    }

    /**
     * Extrait le nom de famille depuis le nom complet
     */
    public String getLastName() {
        if (fullName == null || fullName.isBlank()) return "";
        String[] parts = fullName.trim().split("\\s+");
        if (parts.length < 2) return parts[0];
        StringBuilder sb = new StringBuilder();
        for (int i = 1; i < parts.length; i++) {
            if (i > 1) sb.append(" ");
            sb.append(parts[i]);
        }
        return sb.toString();
    }

    /**
     * Prix de l'abonnement PMS mensuel en centimes.
     * C'est ce montant qui est facture a l'inscription (premier mois).
     * Les prix des interventions (35/55/80 EUR) sont factures a l'utilisation.
     */
    public static final int PMS_SUBSCRIPTION_PRICE_CENTS = 500; // 5 EUR/mois

    /**
     * Retourne le prix a facturer a l'inscription (abonnement PMS, pas le forfait intervention).
     * Le montant total depend de la periode de facturation choisie.
     */
    public int getInscriptionPriceInCents() {
        BillingPeriod period = BillingPeriod.fromString(billingPeriod);
        return period.computeTotalPriceCents(PMS_SUBSCRIPTION_PRICE_CENTS);
    }

    /**
     * Retourne le nom d'affichage du forfait
     */
    public String getForfaitDisplayName() {
        if (forfait == null) return "Inconnu";
        return switch (forfait.toLowerCase()) {
            case "essentiel" -> "Essentiel";
            case "confort" -> "Confort";
            case "premium" -> "Premium";
            default -> forfait;
        };
    }

    @Override
    public String toString() {
        return "InscriptionDto{" +
                "fullName='" + fullName + '\'' +
                ", email='" + email + '\'' +
                ", forfait='" + forfait + '\'' +
                ", city='" + city + '\'' +
                '}';
    }
}
