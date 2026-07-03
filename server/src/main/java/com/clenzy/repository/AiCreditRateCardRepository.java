package com.clenzy.repository;

import com.clenzy.model.AiCreditRateCard;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AiCreditRateCardRepository extends JpaRepository<AiCreditRateCard, Long> {

    /** Versions courantes de la grille (effective_to IS NULL). */
    List<AiCreditRateCard> findByEffectiveToIsNull();
}
