package com.clenzy.marketplace.dto;

import com.clenzy.marketplace.model.EngagementMode;
import com.clenzy.marketplace.model.ProviderStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Fiche condensee pour les cartes de la liste.
 *
 * <p>Porte de quoi decider sans ouvrir le detail : qui, quoi, ou, a partir de
 * combien, dans quel etat. Les prestations sont resumees en categories plutot
 * qu'enumerees — une carte qui listerait quinze lignes de prix ne se lirait
 * plus.</p>
 */
public record ProviderSummaryDto(
    Long id,
    String publicRef,
    String displayName,
    String legalName,
    String headline,
    String avatarUrl,
    String email,
    String phone,

    String baseCity,
    String basePostalCode,
    String baseCountryCode,
    Integer travelRadiusKm,
    /** Villes couvertes, zone principale en tete. */
    List<String> coverageCities,

    ProviderStatus status,
    EngagementMode engagementMode,
    Long homeOrganizationId,
    String homeOrganizationName,

    /** Codes des categories couvertes, pour les pastilles de la carte. */
    List<String> categoryCodes,
    int offerCount,
    /** Plus bas prix affichable, toutes prestations confondues. Vide si tout est sur devis. */
    BigDecimal priceFrom,
    String currency,

    BigDecimal ratingAvg,
    int ratingCount,
    int completedMissions,
    boolean acceptsUrgent,
    List<String> languages,

    boolean verified,
    boolean complianceAlert,
    LocalDate insuranceExpiresAt,
    LocalDate vigilanceExpiresAt,

    /** Jours ISO declares (1 = lundi). Vide avec weeklyRestricted = aucun créneau autorisé. */
    List<Short> availableDays,
    boolean weeklyRestricted,

    LocalDateTime submittedAt,
    LocalDateTime createdAt
) {}
