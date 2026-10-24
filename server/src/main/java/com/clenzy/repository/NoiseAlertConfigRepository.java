package com.clenzy.repository;

import com.clenzy.model.NoiseAlertConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface NoiseAlertConfigRepository extends JpaRepository<NoiseAlertConfig, Long> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM NoiseAlertConfig c WHERE c.organizationId=:orgId AND c.propertyId=:propertyId")
    Optional<NoiseAlertConfig> findForUpdate(@Param("orgId") Long orgId,@Param("propertyId") Long propertyId);


    Optional<NoiseAlertConfig> findByOrganizationIdAndPropertyId(Long organizationId, Long propertyId);

    List<NoiseAlertConfig> findByOrganizationId(Long organizationId);

    @Query("SELECT c FROM NoiseAlertConfig c LEFT JOIN FETCH c.timeWindows WHERE c.enabled = true")
    List<NoiseAlertConfig> findAllEnabledWithTimeWindows();

    @Query("SELECT c FROM NoiseAlertConfig c LEFT JOIN FETCH c.timeWindows " +
           "WHERE c.organizationId = :orgId AND c.propertyId = :propertyId")
    Optional<NoiseAlertConfig> findByOrgAndPropertyWithTimeWindows(
        @Param("orgId") Long orgId,
        @Param("propertyId") Long propertyId);
}
