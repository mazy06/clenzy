package com.clenzy.booking.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Reponse apres creation d'un panier de reservations PENDING.
 *
 * <ul>
 *   <li>{@code batchCode} — UUID identifiant unique du panier (utilise pour le checkout
 *       groupe). Persiste dans le frontend pour relier le panier a la session Stripe.</li>
 *   <li>{@code reservations} — liste des reservations creees individuellement.</li>
 *   <li>{@code grandTotal} — somme des totaux de toutes les reservations.</li>
 *   <li>{@code currency} — devise commune (refuse si les proprietes ont des devises
 *       differentes — voir backend).</li>
 *   <li>{@code expiresAt} — expiration commune (la plus tot des reservations individuelles).</li>
 * </ul>
 */
public record BookingReserveBatchResponseDto(
    String batchCode,
    List<BookingReserveResponseDto> reservations,
    BigDecimal grandTotal,
    String currency,
    LocalDateTime expiresAt,
    boolean requiresPayment
) {}
