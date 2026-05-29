package com.clenzy.service.voucher;

import com.clenzy.model.voucher.VoucherChannelScope;
import com.clenzy.model.voucher.VoucherDiscountType;
import com.clenzy.model.voucher.VoucherStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Payload pour l'edition d'un {@link com.clenzy.model.BookingVoucher} existant.
 *
 * <p>Les champs {@code organizationId}, {@code type}, {@code createdByOrgType},
 * {@code createdByUserId} ne sont PAS modifiables (defini a la creation).</p>
 *
 * <p>Le statut ne peut bouger que selon les transitions autorisees :</p>
 * <ul>
 *   <li>{@code DRAFT} -> {@code ACTIVE} ou {@code PAUSED} ou rester DRAFT</li>
 *   <li>{@code ACTIVE} -> {@code PAUSED} ou rester ACTIVE</li>
 *   <li>{@code PAUSED} -> {@code ACTIVE} ou rester PAUSED</li>
 *   <li>{@code EXPIRED} : non modifiable (transition irreversible faite par scheduler)</li>
 * </ul>
 *
 * <p>{@code code} : modifiable pour MANUAL_CODE, ignore pour AUTO_CAMPAIGN.
 * Changer le code peut casser les liens partages, mais permet le pivot rapide
 * en cas de leak.</p>
 *
 * @param propertyIds null = ne pas modifier le scope ; liste vide = repasser
 *                    en "applicable a toutes les properties de l'org" ;
 *                    liste non vide = remplacer le scope existant (pattern
 *                    delete-then-insert dans le service).
 */
public record VoucherUpdatePayload(
    String name,
    String description,
    String code,
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
