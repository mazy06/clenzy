package com.clenzy.repository;

import com.clenzy.model.SmartLockAccessCode;
import com.clenzy.model.SmartLockAccessCode.CodeStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Acces aux codes d'acces de serrures. L'isolation multi-tenant est assuree par
 * le filtre Hibernate {@code organizationFilter} (pas de lookup par valeur de code
 * — chiffre au repos).
 */
@Repository
public interface SmartLockAccessCodeRepository extends JpaRepository<SmartLockAccessCode, Long> {

    /** Code actif courant d'une serrure (le plus recent). */
    Optional<SmartLockAccessCode> findFirstByDeviceIdAndStatusOrderByCreatedAtDesc(Long deviceId, CodeStatus status);

    /** Code actif courant d'une reservation (le plus recent). */
    Optional<SmartLockAccessCode> findFirstByReservationIdAndStatusOrderByCreatedAtDesc(Long reservationId, CodeStatus status);

    List<SmartLockAccessCode> findByReservationIdAndStatus(Long reservationId, CodeStatus status);

    List<SmartLockAccessCode> findByDeviceIdAndStatus(Long deviceId, CodeStatus status);
}
