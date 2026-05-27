package com.clenzy.repository;

import com.clenzy.model.PlatformPromoCode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface PlatformPromoCodeRepository extends JpaRepository<PlatformPromoCode, Long> {

    /**
     * Lookup case-insensitive (le code est stocke UPPER mais on normalise
     * par securite cote query).
     */
    @Query("SELECT p FROM PlatformPromoCode p WHERE UPPER(p.code) = UPPER(:code)")
    Optional<PlatformPromoCode> findByCodeIgnoreCase(@Param("code") String code);

    /**
     * Increment atomique du compteur d'usage. Renvoie le nombre de lignes
     * modifiees : 1 si succes, 0 si le quota est atteint (CAS pattern).
     *
     * <p>Le service appelle cette methode dans une transaction ; si elle
     * retourne 0, le service refuse le code (course condition sur la
     * derniere utilisation disponible).</p>
     */
    @Modifying
    @Query("""
            UPDATE PlatformPromoCode p
            SET p.usedCount = p.usedCount + 1
            WHERE p.id = :id
              AND p.active = true
              AND (p.maxUses IS NULL OR p.usedCount < p.maxUses)
            """)
    int tryIncrementUsedCount(@Param("id") Long id);
}
