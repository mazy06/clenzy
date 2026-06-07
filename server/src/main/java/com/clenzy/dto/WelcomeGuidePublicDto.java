package com.clenzy.dto;

import com.clenzy.model.CheckInInstructions;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.WelcomeGuide;

import java.time.LocalDate;

/**
 * Payload public du livret d'accueil, servi au guest via un token valide.
 *
 * <p>Auto-rempli depuis le logement ({@link Property}), les instructions de
 * check-in ({@link CheckInInstructions}) et la reservation ({@link Reservation}) :
 * zero double-saisie pour l'hote. Le contenu editorial libre (autour de moi,
 * activites, sections custom) reste dans {@link #sections} (JSON gere par le livret).</p>
 */
public record WelcomeGuidePublicDto(
    String title,
    String language,
    String brandingColor,
    String logoUrl,
    String sections,
    PropertyInfo property,
    PracticalInfo practical,
    StayInfo stay,
    CheckInInfo checkIn
) {
    /** Localisation du logement (pour la carte "autour de moi" + adresse). */
    public record PropertyInfo(
        String name,
        String address,
        String city,
        String postalCode,
        String country,
        Double latitude,
        Double longitude
    ) {}

    /** Informations pratiques sensibles : wifi, digicode, regles, urgences. */
    public record PracticalInfo(
        String wifiName,
        String wifiPassword,
        String accessCode,
        String parkingInfo,
        String arrivalInstructions,
        String departureInstructions,
        String houseRules,
        String emergencyContact,
        String additionalNotes
    ) {}

    /** Check-in en ligne lie au sejour (nullable si non configure pour ce sejour). */
    public record CheckInInfo(String link, String status) {}

    /** Contexte du sejour courant (nullable si token sans reservation). */
    public record StayInfo(
        LocalDate checkIn,
        LocalDate checkOut,
        String checkInTime,
        String checkOutTime,
        String guestName,
        Integer guestCount
    ) {}

    public static WelcomeGuidePublicDto from(WelcomeGuide g, Property p,
                                             CheckInInstructions ci, Reservation r,
                                             String dynamicAccessCode, CheckInInfo checkIn) {
        PropertyInfo propertyInfo = (p == null) ? null : new PropertyInfo(
            p.getName(), p.getAddress(), p.getCity(), p.getPostalCode(), p.getCountry(),
            p.getLatitude() != null ? p.getLatitude().doubleValue() : null,
            p.getLongitude() != null ? p.getLongitude().doubleValue() : null
        );

        // Le digicode dynamique (serrure connectee) ecrase le code statique des instructions.
        boolean hasDynamicCode = dynamicAccessCode != null && !dynamicAccessCode.isBlank();
        PracticalInfo practicalInfo = (ci == null && !hasDynamicCode) ? null : new PracticalInfo(
            ci != null ? ci.getWifiName() : null,
            ci != null ? ci.getWifiPassword() : null,
            hasDynamicCode ? dynamicAccessCode : (ci != null ? ci.getAccessCode() : null),
            ci != null ? ci.getParkingInfo() : null,
            ci != null ? ci.getArrivalInstructions() : null,
            ci != null ? ci.getDepartureInstructions() : null,
            ci != null ? ci.getHouseRules() : null,
            resolveEmergency(ci, p),
            ci != null ? ci.getAdditionalNotes() : null
        );

        StayInfo stayInfo = (r == null) ? null : new StayInfo(
            r.getCheckIn(), r.getCheckOut(),
            firstNonBlank(r.getCheckInTime(), p != null ? p.getDefaultCheckInTime() : null),
            firstNonBlank(r.getCheckOutTime(), p != null ? p.getDefaultCheckOutTime() : null),
            r.getGuestName(), r.getGuestCount()
        );

        return new WelcomeGuidePublicDto(
            g.getTitle(), g.getLanguage(), g.getBrandingColor(), g.getLogoUrl(), g.getSections(),
            propertyInfo, practicalInfo, stayInfo, checkIn
        );
    }

    private static String resolveEmergency(CheckInInstructions ci, Property p) {
        if (ci != null && ci.getEmergencyContact() != null && !ci.getEmergencyContact().isBlank()) {
            return ci.getEmergencyContact();
        }
        return p != null ? p.getEmergencyContact() : null;
    }

    private static String firstNonBlank(String a, String b) {
        return (a != null && !a.isBlank()) ? a : b;
    }
}
