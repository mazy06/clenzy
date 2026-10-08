package com.clenzy.repository;

import com.clenzy.model.FiscalProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FiscalProfileRepository extends JpaRepository<FiscalProfile, Long> {

    @org.springframework.data.jpa.repository.Query("select p from FiscalProfile p where p.organizationId=:organizationId and p.primaryProfile=true")
    Optional<FiscalProfile> findByOrganizationId(@org.springframework.data.repository.query.Param("organizationId") Long organizationId);

    Optional<FiscalProfile> findByOrganizationIdAndCountryCode(Long organizationId,String countryCode);

    List<FiscalProfile> findByOrganizationIdOrderByCountryCode(Long organizationId);

    boolean existsByOrganizationId(Long organizationId);

    List<FiscalProfile> findByCountryCode(String countryCode);
}
