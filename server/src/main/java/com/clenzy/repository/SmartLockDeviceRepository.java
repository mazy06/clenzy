package com.clenzy.repository;

import com.clenzy.model.SmartLockDevice;
import com.clenzy.model.SmartLockDevice.DeviceStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SmartLockDeviceRepository extends JpaRepository<SmartLockDevice, Long> {

    List<SmartLockDevice> findByUserId(String userId);

    List<SmartLockDevice> findByUserIdAndStatus(String userId, DeviceStatus status);

    List<SmartLockDevice> findByPropertyId(Long propertyId);

    Optional<SmartLockDevice> findByIdAndUserId(Long id, String userId);

    long countByUserId(String userId);

    Optional<SmartLockDevice> findByExternalDeviceId(String externalDeviceId);

    /** Org-scoped : le filtre Hibernate organizationFilter assure l'isolation */
    List<SmartLockDevice> findByStatus(DeviceStatus status);
}
