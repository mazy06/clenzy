package com.clenzy.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * DTO enrichi pour le listing des voyageurs.
 * Inclut les informations d'organisation pour la vue cross-tenant (super admin).
 */
public record GuestListDto(
    Long id,
    String firstName,
    String lastName,
    String email,
    String phone,
    String fullName,
    String channel,
    Integer totalStays,
    BigDecimal totalSpent,
    String language,
    LocalDateTime createdAt,
    Long organizationId,
    String organizationName
) {}
