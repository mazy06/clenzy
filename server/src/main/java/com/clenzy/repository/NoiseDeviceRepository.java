package com.clenzy.repository;

import com.clenzy.model.NoiseDevice;
import com.clenzy.model.NoiseDevice.DeviceStatus;
import com.clenzy.model.NoiseDevice.DeviceType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface NoiseDeviceRepository extends JpaRepository<NoiseDevice, Long> {

    List<NoiseDevice> findByUserId(String userId);

    List<NoiseDevice> findByUserIdAndStatus(String userId, DeviceStatus status);

    List<NoiseDevice> findByUserIdAndDeviceType(String userId, DeviceType deviceType);

    List<NoiseDevice> findByPropertyId(Long propertyId);

    Optional<NoiseDevice> findByIdAndUserId(Long id, String userId);

    boolean existsByUserIdAndPropertyIdAndRoomName(String userId, Long propertyId, String roomName);

    long countByUserId(String userId);
}
