package com.clenzy.repository;

import com.clenzy.model.MessageIntent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public interface MessageIntentRepository extends JpaRepository<MessageIntent, Long> {

    /** Dédup classification : un message n'est classifié qu'une fois. */
    boolean existsByMessageId(Long messageId);

    /**
     * Intents récents d'un type sur les conversations d'un LOGEMENT (le scanner est
     * per-property) au-dessus d'un seuil de confiance. Jointure explicite : l'intent
     * ne porte pas le logement, sa conversation oui.
     */
    @Query("SELECT mi FROM MessageIntent mi, Conversation c " +
           "WHERE c.id = mi.conversationId " +
           "AND mi.organizationId = :orgId AND c.property.id = :propertyId " +
           "AND mi.intent = :intent AND mi.confidence >= :minConfidence " +
           "AND mi.createdAt >= :since " +
           "ORDER BY mi.createdAt DESC")
    List<MessageIntent> findRecentByPropertyAndIntent(@Param("orgId") Long orgId,
                                                      @Param("propertyId") Long propertyId,
                                                      @Param("intent") MessageIntent.Intent intent,
                                                      @Param("minConfidence") BigDecimal minConfidence,
                                                      @Param("since") LocalDateTime since);
}
