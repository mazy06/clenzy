package com.clenzy.dto;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.ChannelCommission;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * DTO API de {@link ChannelCommission}.
 *
 * <p>Shape JSON strictement identique a l'ancienne serialisation directe de
 * l'entite (audit regle n°5 — pas d'entite JPA exposee par un endpoint REST) :
 * id, organizationId, channelName, commissionRate, vatRate, isGuestFacing,
 * notes, createdAt, updatedAt.</p>
 */
public record ChannelCommissionDto(
    Long id,
    Long organizationId,
    ChannelName channelName,
    BigDecimal commissionRate,
    BigDecimal vatRate,
    Boolean isGuestFacing,
    String notes,
    Instant createdAt,
    Instant updatedAt
) {
    public static ChannelCommissionDto from(ChannelCommission c) {
        return new ChannelCommissionDto(
            c.getId(),
            c.getOrganizationId(),
            c.getChannelName(),
            c.getCommissionRate(),
            c.getVatRate(),
            c.getIsGuestFacing(),
            c.getNotes(),
            c.getCreatedAt(),
            c.getUpdatedAt()
        );
    }
}
