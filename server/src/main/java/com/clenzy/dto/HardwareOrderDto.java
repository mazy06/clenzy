package com.clenzy.dto;

import com.clenzy.model.HardwareOrder;
import com.clenzy.model.OrderStatus;

import java.time.LocalDateTime;

/**
 * DTO de sortie de {@link HardwareOrder}.
 *
 * <p>Shape JSON strictement identique a l'ancienne serialisation directe de
 * l'entite (audit regle n°5 — pas d'entite JPA exposee par un endpoint REST) :
 * id, organizationId, userId, stripeSessionId, stripePaymentIntentId, status,
 * totalAmount, currency, itemsJson, shippingName, shippingAddress, shippingCity,
 * shippingPostalCode, shippingCountry, createdAt, updatedAt.</p>
 */
public record HardwareOrderDto(
    Long id,
    Long organizationId,
    String userId,
    String stripeSessionId,
    String stripePaymentIntentId,
    OrderStatus status,
    int totalAmount,
    String currency,
    String itemsJson,
    String shippingName,
    String shippingAddress,
    String shippingCity,
    String shippingPostalCode,
    String shippingCountry,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
    public static HardwareOrderDto from(HardwareOrder o) {
        return new HardwareOrderDto(
            o.getId(),
            o.getOrganizationId(),
            o.getUserId(),
            o.getStripeSessionId(),
            o.getStripePaymentIntentId(),
            o.getStatus(),
            o.getTotalAmount(),
            o.getCurrency(),
            o.getItemsJson(),
            o.getShippingName(),
            o.getShippingAddress(),
            o.getShippingCity(),
            o.getShippingPostalCode(),
            o.getShippingCountry(),
            o.getCreatedAt(),
            o.getUpdatedAt()
        );
    }
}
