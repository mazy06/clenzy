package com.clenzy.repository;

import com.clenzy.model.VoucherPropertyScope;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Set;

/**
 * Repository pour {@link VoucherPropertyScope} (liaison M2M voucher ↔ property).
 *
 * <p>Convention metier : un voucher SANS aucune row de scope = applicable a
 * TOUTES les properties de l'org creatrice (resolu cote service, pas par
 * cette repository).</p>
 */
@Repository
public interface VoucherPropertyScopeRepository
    extends JpaRepository<VoucherPropertyScope, VoucherPropertyScope.PK> {

    /** Toutes les properties scope d'un voucher. */
    List<VoucherPropertyScope> findByVoucherId(Long voucherId);

    /** Tous les vouchers (ids) scopes a une property donnee. */
    @Query("""
        SELECT vps.voucherId FROM VoucherPropertyScope vps
        WHERE vps.propertyId = :propertyId
    """)
    List<Long> findVoucherIdsByPropertyId(@Param("propertyId") Long propertyId);

    /** Compte les properties scope d'un voucher (0 = applicable a toutes). */
    long countByVoucherId(Long voucherId);

    /** Verifie si une property specifique est dans le scope d'un voucher. */
    boolean existsByVoucherIdAndPropertyId(Long voucherId, Long propertyId);

    /**
     * Supprime toutes les rows de scope d'un voucher. Utilise lors de
     * l'edition pour ressembler le scope (delete-then-insert pattern).
     */
    @Modifying
    @Query("DELETE FROM VoucherPropertyScope vps WHERE vps.voucherId = :voucherId")
    void deleteByVoucherId(@Param("voucherId") Long voucherId);

    /** Property ids dans le scope d'un voucher (pratique pour DTOs). */
    @Query("""
        SELECT vps.propertyId FROM VoucherPropertyScope vps
        WHERE vps.voucherId = :voucherId
    """)
    Set<Long> findPropertyIdsByVoucherId(@Param("voucherId") Long voucherId);
}
