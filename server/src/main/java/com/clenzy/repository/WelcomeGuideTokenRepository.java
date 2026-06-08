package com.clenzy.repository;

import com.clenzy.model.WelcomeGuideToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WelcomeGuideTokenRepository extends JpaRepository<WelcomeGuideToken, Long> {

    Optional<WelcomeGuideToken> findByToken(UUID token);

    List<WelcomeGuideToken> findByReservationId(Long reservationId);

    /** Supprime tous les tokens d'un livret (suppression en cascade applicative — FK bloquante). */
    @Modifying
    @Query("delete from WelcomeGuideToken t where t.guide.id = :guideId")
    int deleteByGuideId(@Param("guideId") Long guideId);
}
