package com.clenzy.marketplace.dto;

import com.clenzy.marketplace.model.MarketplaceQuoteRequest;
import com.clenzy.marketplace.model.QuoteRequestStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Une demande de devis, vue par l'un ou l'autre cote.
 *
 * <p>Les deux identites y figurent — nom du prestataire ET nom de
 * l'organisation demandeuse. C'est exactement ce que la demande de devis
 * autorise : une mise en relation consentie, ou chacun sait a qui il parle. Le
 * catalogue, lui, reste anonyme tant que personne n'a rien demande.</p>
 */
public record QuoteRequestDto(
    Long id,
    QuoteRequestStatus status,

    Long providerId,
    String providerName,
    Long requesterOrganizationId,
    String requesterOrganizationName,

    Long propertyId,
    String categoryCode,
    String serviceItemCode,
    String title,
    String message,
    LocalDate desiredDate,

    BigDecimal quotedAmount,
    String quotedCurrency,
    String quoteMessage,
    LocalDate quoteValidUntil,
    LocalDateTime quotedAt,
    /** Vrai si la date de validite est passee : l'ecran doit le dire avant le clic. */
    boolean expired,

    LocalDateTime decidedAt,
    String decisionReason,
    Long interventionId,

    LocalDateTime createdAt,
    Long replacesQuoteId,
    java.time.LocalTime requestedStartTime,
    Integer requestedDurationMinutes
) {
    public static QuoteRequestDto from(MarketplaceQuoteRequest quote,
                                       String providerName,
                                       String requesterOrganizationName,
                                       LocalDate today) {
        return new QuoteRequestDto(
            quote.getId(),
            quote.getStatus(),
            quote.getProviderId(),
            providerName,
            quote.getRequesterOrganizationId(),
            requesterOrganizationName,
            quote.getPropertyId(),
            quote.getCategoryCode(),
            quote.getServiceItemCode(),
            quote.getTitle(),
            quote.getMessage(),
            quote.getDesiredDate(),
            quote.getQuotedAmount(),
            quote.getQuotedCurrency(),
            quote.getQuoteMessage(),
            quote.getQuoteValidUntil(),
            quote.getQuotedAt(),
            quote.isExpiredOn(today),
            quote.getDecidedAt(),
            quote.getDecisionReason(),
            quote.getInterventionId(),
            quote.getCreatedAt(), quote.getReplacesQuoteId(), quote.getRequestedStartTime(), quote.getRequestedDurationMinutes());
    }
}
