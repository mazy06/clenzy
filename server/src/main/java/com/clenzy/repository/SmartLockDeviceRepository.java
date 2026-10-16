package com.clenzy.repository;

import com.clenzy.model.SmartLockDevice;
import com.clenzy.model.SmartLockDevice.DeviceStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SmartLockDeviceRepository extends JpaRepository<SmartLockDevice, Long> {
    @org.springframework.data.jpa.repository.Query(value="SELECT * FROM smart_lock_devices WHERE property_id=:property AND organization_id=:org AND status='ACTIVE'",nativeQuery=true)
    List<SmartLockDevice> findBaitlyMissionLocks(@org.springframework.data.repository.query.Param("property")Long property,@org.springframework.data.repository.query.Param("org")Long org);

    List<SmartLockDevice> findByUserId(String userId);

    List<SmartLockDevice> findByUserIdAndStatus(String userId, DeviceStatus status);

    List<SmartLockDevice> findByPropertyId(Long propertyId);

    List<SmartLockDevice> findByPropertyIdAndStatus(Long propertyId, DeviceStatus status);

    Optional<SmartLockDevice> findByIdAndUserId(Long id, String userId);

    long countByUserId(String userId);

    Optional<SmartLockDevice> findByExternalDeviceId(String externalDeviceId);

    /** Org-scoped : le filtre Hibernate organizationFilter assure l'isolation */
    /** Serrures d'une organisation : seule lecture a exposer a un utilisateur. */
    List<SmartLockDevice> findByOrganizationIdAndStatus(Long organizationId, DeviceStatus status);

}
