package com.clenzy.integration.tuya.repository;

import com.clenzy.integration.tuya.model.TuyaDeviceClaim;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TuyaDeviceClaimRepository extends JpaRepository<TuyaDeviceClaim, Long> {

    /** Cross-org (l'entite n'est pas org-filtree) : voit la reclamation quelle que soit l'org. */
    Optional<TuyaDeviceClaim> findByTuyaDeviceId(String tuyaDeviceId);

    List<TuyaDeviceClaim> findByOrganizationId(Long organizationId);

    void deleteByTuyaDeviceId(String tuyaDeviceId);
}
