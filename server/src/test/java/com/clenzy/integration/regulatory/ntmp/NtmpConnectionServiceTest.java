package com.clenzy.integration.regulatory.ntmp;

import com.clenzy.exception.NotFoundException;
import com.clenzy.integration.external.service.ApiKeyEncryptionService;
import com.clenzy.integration.regulatory.model.RegulatoryConnection;
import com.clenzy.integration.regulatory.model.RegulatoryProviderType;
import com.clenzy.integration.regulatory.repository.RegulatoryConnectionRepository;
import com.clenzy.model.PropertyLicense;
import com.clenzy.repository.PropertyLicenseRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Clock;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class NtmpConnectionServiceTest {

    private static final Long ORG = 7L;
    private static final Long PROPERTY = 42L;

    @Mock private RegulatoryConnectionRepository connections;
    @Mock private PropertyLicenseRepository licenses;
    @Mock private ApiKeyEncryptionService encryption;
    @Mock private NtmpGatewayClient gateway;

    private NtmpConnectionService service;

    @BeforeEach
    void setUp() {
        service = new NtmpConnectionService(
                connections, licenses, encryption, new NtmpTokenProvider(Clock.systemUTC()), gateway);
        when(encryption.decrypt(any())).thenReturn("secret-en-clair");
    }

    private RegulatoryConnection connection(RegulatoryConnection.Status status) {
        RegulatoryConnection connection = new RegulatoryConnection();
        connection.setId(1L);
        connection.setOrganizationId(ORG);
        connection.setProvider(RegulatoryProviderType.NTMP);
        connection.setGatewayUrl("https://customer-gateway.tourism.sa");
        connection.setFacilityId("agence-baitly");
        connection.setFacilitySecretEncrypted("chiffre");
        connection.setStatus(status);
        return connection;
    }

    private PropertyLicense license(PropertyLicense.LicenseType type, String number) {
        PropertyLicense license = new PropertyLicense();
        license.setLicenseType(type);
        license.setLicenseNumber(number);
        return license;
    }

    @Test
    void whenOrganisationHasNoConnection_thenNotFound() {
        when(connections.findByOrganizationIdAndProvider(ORG, RegulatoryProviderType.NTMP))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.credentialsFor(ORG, PROPERTY))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void whenConnectionIsRevoked_thenRefusedBeforeAnyNetworkCall() {
        when(connections.findByOrganizationIdAndProvider(ORG, RegulatoryProviderType.NTMP))
                .thenReturn(Optional.of(connection(RegulatoryConnection.Status.REVOKED)));

        assertThatThrownBy(() -> service.credentialsFor(ORG, PROPERTY))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("REVOKED");
    }

    @Test
    void whenPropertyHasNoTourismLicence_thenRefusedWithTheProperty() {
        when(connections.findByOrganizationIdAndProvider(ORG, RegulatoryProviderType.NTMP))
                .thenReturn(Optional.of(connection(RegulatoryConnection.Status.ACTIVE)));
        // Un certificat de securite ne designe pas l'etablissement aupres du ministere.
        when(licenses.findByPropertyIdAndOrganizationIdOrderByExpiresAtAsc(anyLong(), anyLong()))
                .thenReturn(List.of(license(PropertyLicense.LicenseType.SAFETY_CERT, "SC-1")));

        assertThatThrownBy(() -> service.credentialsFor(ORG, PROPERTY))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("42");
    }

    @Test
    void whenTourismLicenceNumberIsBlank_thenTreatedAsMissing() {
        when(connections.findByOrganizationIdAndProvider(ORG, RegulatoryProviderType.NTMP))
                .thenReturn(Optional.of(connection(RegulatoryConnection.Status.ACTIVE)));
        when(licenses.findByPropertyIdAndOrganizationIdOrderByExpiresAtAsc(anyLong(), anyLong()))
                .thenReturn(List.of(license(PropertyLicense.LicenseType.TOURISM_REGISTRATION, "   ")));

        assertThatThrownBy(() -> service.credentialsFor(ORG, PROPERTY))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void whenEverythingIsInPlace_thenCredentialsCarryTheDecryptedSecretAndTheLicence() {
        when(connections.findByOrganizationIdAndProvider(ORG, RegulatoryProviderType.NTMP))
                .thenReturn(Optional.of(connection(RegulatoryConnection.Status.ACTIVE)));
        when(licenses.findByPropertyIdAndOrganizationIdOrderByExpiresAtAsc(anyLong(), anyLong()))
                .thenReturn(List.of(
                        license(PropertyLicense.LicenseType.SAFETY_CERT, "SC-1"),
                        license(PropertyLicense.LicenseType.TOURISM_REGISTRATION, "50123456")));

        var credentials = service.credentialsFor(ORG, PROPERTY);

        assertThat(credentials.externalLicenseId()).isEqualTo("50123456");
        assertThat(credentials.facilitySecret()).isEqualTo("secret-en-clair");
        assertThat(credentials.gatewayUrl()).isEqualTo("https://customer-gateway.tourism.sa");
        // Par defaut on ne declare rien en production.
        assertThat(credentials.sandbox()).isTrue();
    }
}
