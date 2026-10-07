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
        void shouldReturnAnUnsavedDraftWithoutInventingVatRegistration() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(42L);

            when(fiscalProfileRepository.findByOrganizationId(42L))
                .thenReturn(Optional.empty());
            FiscalProfileDto result = fiscalProfileService.getCurrentProfile();

            assertThat(result.countryCode()).isEqualTo("FR");
            assertThat(result.defaultCurrency()).isEqualTo("EUR");
            assertThat(result.fiscalRegime()).isEqualTo(FiscalRegime.STANDARD);
            assertThat(result.vatRegistered()).isFalse();
            assertThat(result.id()).isNull();verify(fiscalProfileRepository,never()).save(any());
        }
    }

}
