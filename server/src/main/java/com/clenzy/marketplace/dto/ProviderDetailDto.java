package com.clenzy.marketplace.dto;

import com.clenzy.marketplace.model.EngagementMode;
import com.clenzy.marketplace.model.ProviderSource;
import com.clenzy.marketplace.model.ProviderStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Fiche complete : tout ce qu'il faut pour arbitrer sur un professionnel. */
public record ProviderDetailDto(
    Long id,
    String publicRef,

    String displayName,
    String legalName,
    String contactFirstName,
    String contactLastName,
    String email,
    String phone,
    String website,
    String headline,
    String bio,
    String avatarUrl,

    String baseAddress,
    String baseCity,
    String basePostalCode,
    String baseCountryCode,
    BigDecimal latitude,
    BigDecimal longitude,
    Integer travelRadiusKm,
    List<String> languages,

    ProviderStatus status,
    EngagementMode engagementMode,
    ProviderSource source,
    Long homeOrganizationId,
    String homeOrganizationName,
    Long userId,

    String registrationNumber,
    String vatNumber,
    String insuranceCompany,
    String insurancePolicyNumber,
    LocalDate insuranceExpiresAt,
    LocalDate vigilanceExpiresAt,
    boolean complianceAlert,

    String currency,
    BigDecimal minimumCharge,
    BigDecimal travelFee,
    boolean acceptsUrgent,
    Integer leadTimeHours,
    Integer cancellationNoticeHours,

    BigDecimal ratingAvg,
    int ratingCount,
    int completedMissions,
    BigDecimal acceptanceRatePct,
    Integer avgResponseMinutes,

    boolean verified,
    LocalDateTime verifiedAt,
    String reviewNote,

    /**
     * Preuve d'acceptation des conditions : version du document et horodatage.
     *
     * <p>L'adresse IP est volontairement ABSENTE — c'est une preuve a produire
     * en cas de contestation, pas une information d'ecran. Meme regle que pour
     * les utilisateurs.</p>
     */
    String termsVersion,
    LocalDateTime termsAcceptedAt,

    /**
     * Reponse deja adressee au candidat, et sa date d'envoi.
     *
     * <p>Exposees pour que le moderateur suivant sache ce qui a ete dit :
     * reecrire une decision deja annoncee, ou l'annoncer deux fois, se produit
     * quand l'ecran ne le montre pas.</p>
     */
    String decisionMessage,
    LocalDateTime decisionSentAt,

    /**
     * Date de confirmation de l'adresse. Vide = non prouvee, et la fiche ne peut
     * pas etre publiee. L'ecran doit le dire AVANT que le moderateur essaie.
     */
    LocalDateTime emailConfirmedAt,

    LocalDateTime submittedAt,
    LocalDateTime activatedAt,
    LocalDateTime suspendedAt,
    LocalDateTime lastActiveAt,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,

    List<ProviderOfferDto> offers,
    List<ProviderZoneDto> zones,
    List<ProviderAvailabilityDto> availability,
    boolean weeklyRestricted
) {}
