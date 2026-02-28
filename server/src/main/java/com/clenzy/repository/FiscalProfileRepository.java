package com.clenzy.repository;

import com.clenzy.model.FiscalProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FiscalProfileRepository extends JpaRepository<FiscalProfile, Long> {

    Optional<FiscalProfile> findByOrganizationId(Long organizationId);

    boolean existsByOrganizationId(Long organizationId);

    List<FiscalProfile> findByCountryCode(String countryCode);
}
