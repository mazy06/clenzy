package com.clenzy.dto;

import com.clenzy.model.WaitlistSignup;

import java.time.LocalDateTime;

/**
 * DTO de sortie (consultation admin) de {@link WaitlistSignup}.
 *
 * <p>Shape JSON strictement identique a l'ancienne serialisation directe de
 * l'entite (audit regle n°5 — pas d'entite JPA exposee par un endpoint REST) :
 * id, email, fullName, phone, propertyCount, city, source, ipAddress,
 * brevoSynced, createdAt, unsubscribedAt.</p>
 *
 * <p>Distinct de {@link WaitlistSignupDto} qui est le payload d'<em>entree</em>
 * public (champs de capture uniquement).</p>
 */
public record WaitlistSignupAdminDto(
    Long id,
    String email,
    String fullName,
    String phone,
    String propertyCount,
    String city,
    String source,
    String ipAddress,
    boolean brevoSynced,
    LocalDateTime createdAt,
    LocalDateTime unsubscribedAt
) {
    public static WaitlistSignupAdminDto from(WaitlistSignup s) {
        return new WaitlistSignupAdminDto(
            s.getId(),
            s.getEmail(),
            s.getFullName(),
            s.getPhone(),
            s.getPropertyCount(),
            s.getCity(),
            s.getSource(),
            s.getIpAddress(),
            s.isBrevoSynced(),
            s.getCreatedAt(),
            s.getUnsubscribedAt()
        );
    }
}
