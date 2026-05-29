package com.clenzy.service.voucher;

import com.clenzy.model.voucher.VoucherChannelScope;
import com.clenzy.model.voucher.VoucherDiscountType;
import com.clenzy.model.voucher.VoucherStatus;
import com.clenzy.model.voucher.VoucherType;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Payload pour la creation d'un {@link com.clenzy.model.BookingVoucher}.
 *
 * <p>Recu par {@code BookingVoucherService.create} apres conversion du DTO
 * REST. Les regles de validation business sont appliquees dans le service
 * (les annotations Bean Validation sont sur les DTOs REST).</p>
 *
 * @param name             nom interne de la campagne (obligatoire)
 * @param description      description libre (optionnelle)
 * @param code             code texte pour MANUAL_CODE (null pour AUTO_CAMPAIGN)
 * @param type             MANUAL_CODE ou AUTO_CAMPAIGN
 * @param discountType     PERCENTAGE / FIXED_AMOUNT / FREE_NIGHTS
 * @param discountValue    valeur (semantique selon discountType)
 * @param validFrom        debut de validite (null = effectif immediatement)
 * @param validUntil       fin de validite (null = pas d'expiration)
 * @param minStayNights    nb min de nuits eligibles
 * @param minTotalAmount   sous-total min eligible
 * @param maxStayNights    nb max de nuits eligibles
 * @param maxUsesTotal     plafond global d'utilisations
 * @param maxUsesPerGuest  plafond par-guest (default 1)
 * @param channelScope     canal autorise (default ALL)
 * @param status           DRAFT (default) ou ACTIVE
 * @param propertyIds      properties cibles (vide = toutes les properties de l'org)
 */
public record VoucherCreatePayload(
    String name,
    String description,
    String code,
    VoucherType type,
    VoucherDiscountType discountType,
    BigDecimal discountValue,
    Instant validFrom,
    Instant validUntil,
    Integer minStayNights,
    BigDecimal minTotalAmount,
    Integer maxStayNights,
    Integer maxUsesTotal,
    Integer maxUsesPerGuest,
    VoucherChannelScope channelScope,
    VoucherStatus status,
    List<Long> propertyIds
) {}
