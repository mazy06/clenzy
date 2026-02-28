package com.clenzy.service;

import com.clenzy.dto.FiscalProfileDto;
import com.clenzy.model.FiscalProfile;
import com.clenzy.model.FiscalRegime;
import com.clenzy.repository.FiscalProfileRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FiscalProfileServiceTest {

    @Mock
    private FiscalProfileRepository fiscalProfileRepository;

    @Mock
    private TenantContext tenantContext;

    private FiscalProfileService fiscalProfileService;

    @BeforeEach
    void setUp() {
        fiscalProfileService = new FiscalProfileService(fiscalProfileRepository, tenantContext);
    }

    private FiscalProfile createTestProfile() {
        FiscalProfile fp = new FiscalProfile();
        fp.setId(1L);
        fp.setOrganizationId(42L);
        fp.setCountryCode("FR");
        fp.setDefaultCurrency("EUR");
        fp.setFiscalRegime(FiscalRegime.STANDARD);
        fp.setVatRegistered(true);
        fp.setInvoiceLanguage("fr");
        fp.setInvoicePrefix("FA-");
        fp.setLegalEntityName("SARL Test");
        fp.setLegalAddress("1 rue Test, Paris");
        return fp;
    }

    @Nested
    class GetCurrentProfile {

        @Test
        void shouldReturnExistingProfile() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(42L);
            FiscalProfile existing = createTestProfile();

            when(fiscalProfileRepository.findByOrganizationId(42L))
                .thenReturn(Optional.of(existing));

            FiscalProfileDto result = fiscalProfileService.getCurrentProfile();

            assertThat(result.countryCode()).isEqualTo("FR");
            assertThat(result.defaultCurrency()).isEqualTo("EUR");
            assertThat(result.legalEntityName()).isEqualTo("SARL Test");
            assertThat(result.organizationId()).isEqualTo(42L);
        }

        @Test
        void shouldCreateDefaultProfileIfNotExists() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(42L);

            when(fiscalProfileRepository.findByOrganizationId(42L))
                .thenReturn(Optional.empty());
            when(fiscalProfileRepository.save(any(FiscalProfile.class)))
                .thenAnswer(invocation -> {
                    FiscalProfile fp = invocation.getArgument(0);
                    fp.setId(1L);
                    return fp;
                });

            FiscalProfileDto result = fiscalProfileService.getCurrentProfile();

            assertThat(result.countryCode()).isEqualTo("FR");
            assertThat(result.defaultCurrency()).isEqualTo("EUR");
            assertThat(result.fiscalRegime()).isEqualTo(FiscalRegime.STANDARD);
            assertThat(result.vatRegistered()).isTrue();
        }
    }

    @Nested
    class UpdateProfile {

        @Test
        void shouldUpdateExistingProfile() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(42L);
            FiscalProfile existing = createTestProfile();

            when(fiscalProfileRepository.findByOrganizationId(42L))
                .thenReturn(Optional.of(existing));
            when(fiscalProfileRepository.save(any(FiscalProfile.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

            FiscalProfileDto updateDto = new FiscalProfileDto(
                1L, 42L, "MA", "MAD", "TAX123", null,
                FiscalRegime.SIMPLIFIED, false, "QUARTERLY",
                "fr", "FA-", null, "SARL Maroc", "Casablanca"
            );

            FiscalProfileDto result = fiscalProfileService.updateProfile(updateDto);

            assertThat(result.countryCode()).isEqualTo("MA");
            assertThat(result.defaultCurrency()).isEqualTo("MAD");
            assertThat(result.fiscalRegime()).isEqualTo(FiscalRegime.SIMPLIFIED);
            assertThat(result.vatRegistered()).isFalse();
        }

        @Test
        void shouldCreateProfileIfNotExistsOnUpdate() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(99L);

            when(fiscalProfileRepository.findByOrganizationId(99L))
                .thenReturn(Optional.empty());
            when(fiscalProfileRepository.save(any(FiscalProfile.class)))
                .thenAnswer(invocation -> {
                    FiscalProfile fp = invocation.getArgument(0);
                    fp.setId(5L);
                    return fp;
                });

            FiscalProfileDto updateDto = new FiscalProfileDto(
                null, 99L, "SA", "SAR", "TIN12345", null,
                FiscalRegime.STANDARD, true, "MONTHLY",
                "ar", "INV-", null, "Company SA", "Riyadh"
            );

            FiscalProfileDto result = fiscalProfileService.updateProfile(updateDto);

            // After applyTo, the profile should have SA values
            assertThat(result.countryCode()).isEqualTo("SA");
            assertThat(result.defaultCurrency()).isEqualTo("SAR");
        }

        @Test
        void shouldPersistUpdatedProfile() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(42L);
            FiscalProfile existing = createTestProfile();

            when(fiscalProfileRepository.findByOrganizationId(42L))
                .thenReturn(Optional.of(existing));
            when(fiscalProfileRepository.save(any(FiscalProfile.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

            FiscalProfileDto updateDto = new FiscalProfileDto(
                1L, 42L, "MA", "MAD", null, null,
                FiscalRegime.STANDARD, true, "MONTHLY",
                "fr", "FA-", null, "Test", "Test Addr"
            );

            fiscalProfileService.updateProfile(updateDto);

            ArgumentCaptor<FiscalProfile> captor = ArgumentCaptor.forClass(FiscalProfile.class);
            verify(fiscalProfileRepository).save(captor.capture());
            assertThat(captor.getValue().getCountryCode()).isEqualTo("MA");
            assertThat(captor.getValue().getDefaultCurrency()).isEqualTo("MAD");
        }
    }

    @Nested
    class CreateDefaultProfile {

        @Test
        void shouldCreateWithFRDefaults() {
            when(fiscalProfileRepository.save(any(FiscalProfile.class)))
                .thenAnswer(invocation -> {
                    FiscalProfile fp = invocation.getArgument(0);
                    fp.setId(1L);
                    return fp;
                });

            FiscalProfile result = fiscalProfileService.createDefaultProfile(42L);

            assertThat(result.getOrganizationId()).isEqualTo(42L);
            assertThat(result.getCountryCode()).isEqualTo("FR");
            assertThat(result.getDefaultCurrency()).isEqualTo("EUR");
            assertThat(result.getFiscalRegime()).isEqualTo(FiscalRegime.STANDARD);
            assertThat(result.isVatRegistered()).isTrue();
            assertThat(result.getInvoiceLanguage()).isEqualTo("fr");
            assertThat(result.getInvoicePrefix()).isEqualTo("FA");
        }

        @Test
        void shouldPersistNewProfile() {
            when(fiscalProfileRepository.save(any(FiscalProfile.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

            fiscalProfileService.createDefaultProfile(42L);

            verify(fiscalProfileRepository).save(any(FiscalProfile.class));
        }
    }
}
