package com.clenzy.service.regulatory;

import com.clenzy.dto.FrRegulatoryProfileDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.FrRentalUse;
import com.clenzy.model.Property;
import com.clenzy.model.PropertyLicense;
import com.clenzy.model.RegulatoryConfig;
import com.clenzy.model.RegulatoryConfig.RegulatoryType;
import com.clenzy.repository.PropertyLicenseRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RegulatoryConfigRepository;
import com.clenzy.service.RegulatoryComplianceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FrRegulatoryProfileServiceTest {

    private static final Long ORG = 1L;
    private static final Long PROP = 10L;

    @Mock private PropertyRepository propertyRepository;
    @Mock private PropertyLicenseRepository licenseRepository;
    @Mock private RegulatoryConfigRepository configRepository;
    @Mock private RegulatoryComplianceService complianceService;
    @Mock private com.clenzy.service.TouristTaxService touristTaxService;
    @Mock private FrCommuneResolver communeResolver;

    private FrRegulatoryProfileService service;
    private Property property;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(Instant.parse("2026-10-01T10:00:00Z"), ZoneId.of("Europe/Paris"));
        service = new FrRegulatoryProfileService(propertyRepository, licenseRepository, configRepository,
                complianceService, touristTaxService, communeResolver, clock);
        property = new Property();
        property.setId(PROP);
        property.setCountryCode("FR");
        property.setTimezone("Europe/Paris");
        property.setCommuneInseeCode("75056");
        when(propertyRepository.findByIdWithOwner(PROP, ORG)).thenReturn(Optional.of(property));
        when(configRepository.findByPropertyAndType(any(), any(), any())).thenReturn(Optional.empty());
        when(configRepository.save(any(RegulatoryConfig.class))).thenAnswer(inv -> inv.getArgument(0));
        when(licenseRepository.findFirstByPropertyIdAndOrganizationIdAndLicenseType(
                PROP, ORG, PropertyLicense.LicenseType.TOURISM_REGISTRATION)).thenReturn(Optional.empty());
    }

    @Test
    void principalResidence_enablesNightsCapAtLegalMaximum() {
        service.update(PROP, ORG, new FrRegulatoryProfileDto.Update("RESIDENCE_PRINCIPALE", null, null));

        ArgumentCaptor<RegulatoryConfig> saved = ArgumentCaptor.forClass(RegulatoryConfig.class);
        verify(configRepository, atLeastOnce()).save(saved.capture());
        RegulatoryConfig cap = saved.getAllValues().stream()
                .filter(c -> c.getRegulatoryType() == RegulatoryType.ALUR_120_DAYS).findFirst().orElseThrow();
        assertThat(cap.getIsEnabled()).isTrue();
        assertThat(cap.getMaxDaysPerYear()).isEqualTo(120);
        assertThat(cap.getOrganizationId()).isEqualTo(ORG);
        assertThat(property.getFrRentalUse()).isEqualTo(FrRentalUse.RESIDENCE_PRINCIPALE);
    }

    @Test
    void secondHome_disablesAnExistingCap() {
        RegulatoryConfig existing = new RegulatoryConfig();
        existing.setRegulatoryType(RegulatoryType.ALUR_120_DAYS);
        existing.setIsEnabled(true);
        existing.setMaxDaysPerYear(90);
        when(configRepository.findByPropertyAndType(PROP, RegulatoryType.ALUR_120_DAYS, ORG))
                .thenReturn(Optional.of(existing));

        service.update(PROP, ORG, new FrRegulatoryProfileDto.Update("RESIDENCE_SECONDAIRE", null, null));

        assertThat(existing.getIsEnabled()).isFalse();
        assertThat(existing.getMaxDaysPerYear()).isEqualTo(90); // historique conservé
    }

    @Test
    void capAboveLegalMaximum_isRejected() {
        assertThatThrownBy(() -> service.update(PROP, ORG,
                new FrRegulatoryProfileDto.Update("RESIDENCE_PRINCIPALE", 150, null)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void missingCommune_isDeducedFromTheAddressAndKept() {
        property.setCommuneInseeCode(null);
        when(communeResolver.resolve(property)).thenReturn(Optional.of("2A004"));

        service.get(PROP, ORG);

        assertThat(property.getCommuneInseeCode()).isEqualTo("2A004");
        verify(propertyRepository).save(property);
    }

    @Test
    void profile_reportsMissingRegistrationAndRemainingNights() {
        property.setFrRentalUse(FrRentalUse.RESIDENCE_PRINCIPALE);
        RegulatoryConfig cap = new RegulatoryConfig();
        cap.setIsEnabled(true);
        cap.setMaxDaysPerYear(120);
        when(configRepository.findByPropertyAndType(PROP, RegulatoryType.ALUR_120_DAYS, ORG))
                .thenReturn(Optional.of(cap));
        when(complianceService.rentedNightsInYear(PROP, ORG, 2026)).thenReturn(87);

        FrRegulatoryProfileDto dto = service.get(PROP, ORG);

        assertThat(dto.registrationVerdict()).isEqualTo("ABSENT");
        assertThat(dto.registrationRequired()).isTrue();
        assertThat(dto.nightsRentedThisYear()).isEqualTo(87);
        assertThat(dto.nightsRemainingThisYear()).isEqualTo(33);
    }

    @Test
    void guestHouse_doesNotRequireRegistrationNumber() {
        property.setFrRentalUse(FrRentalUse.CHAMBRE_HOTES);
        assertThat(service.get(PROP, ORG).registrationRequired()).isFalse();
    }

    @Test
    void propertyOfAnotherOrganization_isNotFound() {
        when(propertyRepository.findByIdWithOwner(PROP, 2L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.get(PROP, 2L)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void overview_listsOnlyFrenchPropertiesWithTheirTaxStatus() {
        Property moroccan = new Property();
        moroccan.setId(11L);
        moroccan.setCountryCode("MA");
        when(propertyRepository.findByOrganizationId(ORG)).thenReturn(java.util.List.of(property, moroccan));
        when(touristTaxService.resolveConfig(PROP, ORG)).thenReturn(Optional.empty());

        var rows = service.overview(ORG);

        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).propertyId()).isEqualTo(PROP);
        assertThat(rows.get(0).touristTaxConfigured()).isFalse();
    }
}
