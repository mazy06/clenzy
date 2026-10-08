package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.dto.FiscalProfileDto;
import com.clenzy.repository.*;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyFiscalJurisdictionsTest {
    FiscalProfileRepository profiles;OrganizationRepository organizations;TenantContext tenant;
    BaitlyFiscalJurisdictions service;FiscalProfile french;
    @BeforeEach void setup() {
        profiles=mock(FiscalProfileRepository.class);organizations=mock(OrganizationRepository.class);tenant=mock(TenantContext.class);
        when(tenant.getRequiredOrganizationId()).thenReturn(7L);when(organizations.lockById(7L)).thenReturn(Optional.of(new Organization()));
        french=new FiscalProfile(7L,"FR","EUR");french.setLegalEntityName("Gestion française");
        when(profiles.findByOrganizationId(7L)).thenReturn(Optional.of(french));
        service=new BaitlyFiscalJurisdictions(profiles,organizations,tenant);
    }
    Property property(String country){var p=new Property();p.setOrganizationId(7L);p.setCountryCode(country);return p;}
    @Test void frenchAndMoroccanPropertiesUseDifferentSellerProfilesInSameOrganization() {
        var maroc=new FiscalProfile(7L,"MA","MAD");maroc.setLegalEntityName("Gestion marocaine");
        when(profiles.findByOrganizationIdAndCountryCode(7L,"MA")).thenReturn(Optional.of(maroc));
        assertThat(BaitlyFiscalJurisdictions.forProperty(profiles,7L,property("FR"))).isSameAs(french);
        assertThat(BaitlyFiscalJurisdictions.forProperty(profiles,7L,property("MA"))).isSameAs(maroc);
    }
    @Test void foreignProfileIsNeverUsedAsFallback() {
        assertThatThrownBy(()->BaitlyFiscalJurisdictions.forProperty(profiles,7L,property("SA"))).hasMessageContaining("profil fiscal SA");
    }
    @Test void missingCountryAndForeignOrganizationAreRejected() {
        assertThatThrownBy(()->BaitlyFiscalJurisdictions.forProperty(profiles,7L,property(null))).hasMessageContaining("Pays fiscal");
        assertThatThrownBy(()->BaitlyFiscalJurisdictions.forProperty(profiles,8L,property("FR"))).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }
    @Test void readingANewJurisdictionDoesNotInventRegistrationOrWriteData() {
        var dto=service.get("MA");assertThat(dto.id()).isNull();assertThat(dto.vatRegistered()).isFalse();
        assertThat(dto.defaultCurrency()).isEqualTo("MAD");assertThat(dto.legalEntityName()).isNull();verify(profiles,never()).save(any());
    }
    @Test void savingSecondaryProfileKeepsPrimaryAndIgnoresForgedOrganizationId() {
        var maroc=new FiscalProfile(666L,"MA","MAD");maroc.setLegalEntityName("Gestion Maroc");maroc.setLegalAddress("Adresse de test");
        when(profiles.save(any())).thenAnswer(call->call.getArgument(0));
        var saved=service.update("MA",FiscalProfileDto.from(maroc));
        assertThat(saved.organizationId()).isEqualTo(7L);assertThat(french.getCountryCode()).isEqualTo("FR");
        var captor=org.mockito.ArgumentCaptor.forClass(FiscalProfile.class);verify(profiles).save(captor.capture());assertThat(captor.getValue().isPrimaryProfile()).isFalse();
    }
    @Test void profileCannotBeMovedToAnotherCountry(){assertThatThrownBy(()->service.update("MA",FiscalProfileDto.from(french))).hasMessageContaining("déplacé");}
    @Test void missingFiscalRegimeIsRejectedBeforeSaving() {
        french.setLegalAddress("Adresse de test");french.setFiscalRegime(null);
        assertThatThrownBy(()->service.update("FR",FiscalProfileDto.from(french))).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("régime fiscal");
        verify(profiles,never()).save(any());
    }
}
