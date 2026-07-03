package com.clenzy.repository;

import com.clenzy.model.YieldAdjustment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;

public interface YieldAdjustmentRepository extends JpaRepository<YieldAdjustment, Long> {

    /**
     * Cap journalier moteur : vrai si une évaluation a déjà produit des lignes
     * EFFECTIVES (skip exclus) pour ce bien ce jour calendaire — le moteur ne
     * repasse pas deux fois le même jour sur un bien.
     */
    boolean existsByPropertyIdAndAdjustmentDayAndSkipReasonIsNull(Long propertyId, LocalDate adjustmentDay);

    /**
     * Cap journalier à l'apply HITL : vrai si un ajustement a déjà été APPLIQUÉ
     * sur ce bien ce jour calendaire (les lignes SUGGESTED du scan du jour ne
     * bloquent pas leur propre apply).
     */
    boolean existsByPropertyIdAndAdjustmentDayAndModeAndSkipReasonIsNull(
            Long propertyId, LocalDate adjustmentDay, YieldAdjustment.Mode mode);

    Page<YieldAdjustment> findByOrganizationIdOrderByCreatedAtDescIdDesc(Long organizationId, Pageable pageable);

    Page<YieldAdjustment> findByOrganizationIdAndPropertyIdOrderByCreatedAtDescIdDesc(
            Long organizationId, Long propertyId, Pageable pageable);
}
