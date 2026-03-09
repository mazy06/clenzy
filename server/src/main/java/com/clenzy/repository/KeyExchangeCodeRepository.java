package com.clenzy.repository;

import com.clenzy.model.KeyExchangeCode;
import com.clenzy.model.KeyExchangeCode.CodeStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface KeyExchangeCodeRepository extends JpaRepository<KeyExchangeCode, Long> {

    List<KeyExchangeCode> findByPointId(Long pointId);

    List<KeyExchangeCode> findByPointIdAndStatus(Long pointId, CodeStatus status);

    List<KeyExchangeCode> findByPropertyIdAndStatus(Long propertyId, CodeStatus status);

    List<KeyExchangeCode> findByReservationId(Long reservationId);

    Optional<KeyExchangeCode> findByCode(String code);

    Optional<KeyExchangeCode> findByProviderCodeId(String providerCodeId);

    long countByPointIdAndStatus(Long pointId, CodeStatus status);
}
