package com.clenzy.service.signature;

import com.clenzy.model.ContractSignatureRequest;
import com.clenzy.model.DocumentGeneration;
import com.clenzy.repository.ContractSignatureRequestRepository;
import com.clenzy.repository.DocumentGenerationRepository;
import com.clenzy.service.DocumentStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests dedies a {@link ClenzyInternalSignatureProvider} (audit T-BP-10) : le
 * provider interne CLENZY_CUSTOM (creation des demandes de signature, reutilisation
 * du lien PENDING, statuts, restitution du PDF signe) n'avait aucune classe de test.
 */
@ExtendWith(MockitoExtension.class)
class ClenzyInternalSignatureProviderTest {

    private static final Long GENERATION_ID = 10L;
    private static final Long CONTRACT_ID = 55L;
    private static final Long ORG_ID = 7L;
    private static final String BASE_URL = "https://app.clenzy.fr/sign";
    private static final int VALIDITY_DAYS = 30;

    @Mock private ContractSignatureRequestRepository signatureRequestRepository;
    @Mock private DocumentGenerationRepository generationRepository;
    @Mock private DocumentStorageService documentStorageService;

    private ClenzyInternalSignatureProvider provider;

    @BeforeEach
    void setUp() {
        provider = new ClenzyInternalSignatureProvider(
                signatureRequestRepository, generationRepository, documentStorageService,
                BASE_URL, VALIDITY_DAYS);
    }

    // -- Helpers --------------------------------------------------------------

    private SignatureRequest request(List<Signer> signers) {
        return new SignatureRequest(GENERATION_ID, "Mandat de gestion", signers, null, ORG_ID);
    }

    private SignatureRequest nominalRequest() {
        return request(List.of(new Signer("owner@test.com", "Jean Dupont", "owner", 1)));
    }

    private DocumentGeneration generation() {
        DocumentGeneration generation = new DocumentGeneration();
        generation.setId(GENERATION_ID);
        generation.setReferenceId(CONTRACT_ID);
        generation.setOrganizationId(99L);
        return generation;
    }

    private ContractSignatureRequest pendingRequest(LocalDateTime expiresAt) {
        ContractSignatureRequest existing = new ContractSignatureRequest();
        existing.setContractId(CONTRACT_ID);
        existing.setToken(UUID.randomUUID());
        existing.setStatus(ContractSignatureRequest.Status.PENDING);
        existing.setExpiresAt(expiresAt);
        return existing;
    }

    // -- createSignatureRequest ------------------------------------------------

    @Nested
    @DisplayName("createSignatureRequest")
    class CreateSignatureRequest {

        @Test
        @DisplayName("without signer returns failure")
        void whenNoSigner_thenFailure() {
            // Act
            SignatureResult result = provider.createSignatureRequest(request(List.of()));

            // Assert
            assertThat(result.success()).isFalse();
            assertThat(result.errorMessage()).contains("signataire");
            verify(signatureRequestRepository, never()).save(any());
        }

        @Test
        @DisplayName("with unknown document generation returns failure")
        void whenGenerationNotFound_thenFailure() {
            // Arrange
            when(generationRepository.findById(GENERATION_ID)).thenReturn(Optional.empty());

            // Act
            SignatureResult result = provider.createSignatureRequest(nominalRequest());

            // Assert
            assertThat(result.success()).isFalse();
            verify(signatureRequestRepository, never()).save(any());
        }

        @Test
        @DisplayName("nominal case creates a PENDING request with token, expiry and signing URL")
        void whenNominal_thenCreatesPendingRequest() {
            // Arrange
            when(generationRepository.findById(GENERATION_ID)).thenReturn(Optional.of(generation()));
            when(signatureRequestRepository.findFirstByContractIdAndStatus(
                    CONTRACT_ID, ContractSignatureRequest.Status.PENDING))
                    .thenReturn(Optional.empty());
            when(signatureRequestRepository.save(any(ContractSignatureRequest.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            // Act
            SignatureResult result = provider.createSignatureRequest(nominalRequest());

            // Assert
            assertThat(result.success()).isTrue();
            ArgumentCaptor<ContractSignatureRequest> captor =
                    ArgumentCaptor.forClass(ContractSignatureRequest.class);
            verify(signatureRequestRepository).save(captor.capture());
            ContractSignatureRequest created = captor.getValue();
            assertThat(created.getContractId()).isEqualTo(CONTRACT_ID);
            assertThat(created.getDocumentGenerationId()).isEqualTo(GENERATION_ID);
            assertThat(created.getOrganizationId()).isEqualTo(ORG_ID);
            assertThat(created.getSignerEmail()).isEqualTo("owner@test.com");
            assertThat(created.getStatus()).isEqualTo(ContractSignatureRequest.Status.PENDING);
            assertThat(created.getToken()).isNotNull();
            assertThat(created.getExpiresAt())
                    .isAfter(LocalDateTime.now().plusDays(VALIDITY_DAYS - 1));
            assertThat(result.signatureRequestId()).isEqualTo(created.getToken().toString());
            assertThat(result.signingUrl()).isEqualTo(BASE_URL + "/" + created.getToken());
        }

        @Test
        @DisplayName("org falls back to the generation's org when request has none")
        void whenRequestHasNoOrg_thenUsesGenerationOrg() {
            // Arrange
            when(generationRepository.findById(GENERATION_ID)).thenReturn(Optional.of(generation()));
            when(signatureRequestRepository.findFirstByContractIdAndStatus(
                    CONTRACT_ID, ContractSignatureRequest.Status.PENDING))
                    .thenReturn(Optional.empty());
            when(signatureRequestRepository.save(any(ContractSignatureRequest.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));
            SignatureRequest withoutOrg = new SignatureRequest(GENERATION_ID, "Mandat",
                    List.of(new Signer("owner@test.com", "Jean", "owner", 1)), null, null);

            // Act
            provider.createSignatureRequest(withoutOrg);

            // Assert
            ArgumentCaptor<ContractSignatureRequest> captor =
                    ArgumentCaptor.forClass(ContractSignatureRequest.class);
            verify(signatureRequestRepository).save(captor.capture());
            assertThat(captor.getValue().getOrganizationId()).isEqualTo(99L);
        }

        @Test
        @DisplayName("a still-valid PENDING request is reused (same token, no new row)")
        void whenValidPendingExists_thenReusesIt() {
            // Arrange
            ContractSignatureRequest existing = pendingRequest(LocalDateTime.now().plusDays(5));
            when(generationRepository.findById(GENERATION_ID)).thenReturn(Optional.of(generation()));
            when(signatureRequestRepository.findFirstByContractIdAndStatus(
                    CONTRACT_ID, ContractSignatureRequest.Status.PENDING))
                    .thenReturn(Optional.of(existing));

            // Act
            SignatureResult result = provider.createSignatureRequest(nominalRequest());

            // Assert : meme lien renvoye, aucune nouvelle row
            assertThat(result.success()).isTrue();
            assertThat(result.signatureRequestId()).isEqualTo(existing.getToken().toString());
            verify(signatureRequestRepository, never()).save(any());
        }

        @Test
        @DisplayName("an expired PENDING request is cancelled and a new one is created")
        void whenExpiredPendingExists_thenCancelsAndRecreates() {
            // Arrange
            ContractSignatureRequest expired = pendingRequest(LocalDateTime.now().minusDays(1));
            UUID expiredToken = expired.getToken();
            when(generationRepository.findById(GENERATION_ID)).thenReturn(Optional.of(generation()));
            when(signatureRequestRepository.findFirstByContractIdAndStatus(
                    CONTRACT_ID, ContractSignatureRequest.Status.PENDING))
                    .thenReturn(Optional.of(expired));
            when(signatureRequestRepository.save(any(ContractSignatureRequest.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            // Act
            SignatureResult result = provider.createSignatureRequest(nominalRequest());

            // Assert : l'expiree est annulee, un nouveau token est emis
            assertThat(expired.getStatus()).isEqualTo(ContractSignatureRequest.Status.CANCELLED);
            assertThat(result.success()).isTrue();
            assertThat(result.signatureRequestId()).isNotEqualTo(expiredToken.toString());
            verify(signatureRequestRepository, times(2)).save(any(ContractSignatureRequest.class));
        }
    }

    // -- getStatus ---------------------------------------------------------------

    @Nested
    @DisplayName("getStatus")
    class GetStatus {

        private ContractSignatureRequest withStatus(ContractSignatureRequest.Status status,
                                                    LocalDateTime expiresAt) {
            ContractSignatureRequest request = pendingRequest(expiresAt);
            request.setStatus(status);
            return request;
        }

        @Test
        @DisplayName("SIGNED row maps to SIGNED")
        void whenSigned_thenSigned() {
            ContractSignatureRequest row = withStatus(
                    ContractSignatureRequest.Status.SIGNED, LocalDateTime.now().plusDays(1));
            when(signatureRequestRepository.findByToken(row.getToken())).thenReturn(Optional.of(row));

            assertThat(provider.getStatus(row.getToken().toString()))
                    .isEqualTo(SignatureStatus.SIGNED);
        }

        @Test
        @DisplayName("valid PENDING row maps to PENDING")
        void whenPendingValid_thenPending() {
            ContractSignatureRequest row = withStatus(
                    ContractSignatureRequest.Status.PENDING, LocalDateTime.now().plusDays(1));
            when(signatureRequestRepository.findByToken(row.getToken())).thenReturn(Optional.of(row));

            assertThat(provider.getStatus(row.getToken().toString()))
                    .isEqualTo(SignatureStatus.PENDING);
        }

        @Test
        @DisplayName("expired PENDING row maps to EXPIRED")
        void whenPendingExpired_thenExpired() {
            ContractSignatureRequest row = withStatus(
                    ContractSignatureRequest.Status.PENDING, LocalDateTime.now().minusDays(1));
            when(signatureRequestRepository.findByToken(row.getToken())).thenReturn(Optional.of(row));

            assertThat(provider.getStatus(row.getToken().toString()))
                    .isEqualTo(SignatureStatus.EXPIRED);
        }

        @Test
        @DisplayName("CANCELLED row and unknown token both map to CANCELLED")
        void whenCancelledOrUnknown_thenCancelled() {
            ContractSignatureRequest row = withStatus(
                    ContractSignatureRequest.Status.CANCELLED, LocalDateTime.now().plusDays(1));
            when(signatureRequestRepository.findByToken(row.getToken())).thenReturn(Optional.of(row));
            UUID unknown = UUID.randomUUID();
            when(signatureRequestRepository.findByToken(unknown)).thenReturn(Optional.empty());

            assertThat(provider.getStatus(row.getToken().toString()))
                    .isEqualTo(SignatureStatus.CANCELLED);
            assertThat(provider.getStatus(unknown.toString()))
                    .isEqualTo(SignatureStatus.CANCELLED);
        }
    }

    // -- getSignedDocument ---------------------------------------------------------

    @Nested
    @DisplayName("getSignedDocument")
    class GetSignedDocument {

        @Test
        @DisplayName("unknown token throws IllegalArgumentException")
        void whenUnknownToken_thenThrows() {
            UUID unknown = UUID.randomUUID();
            when(signatureRequestRepository.findByToken(unknown)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> provider.getSignedDocument(unknown.toString()))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("missing signed document path throws IllegalStateException")
        void whenNoSignedPath_thenThrows() {
            ContractSignatureRequest row = pendingRequest(LocalDateTime.now().plusDays(1));
            when(signatureRequestRepository.findByToken(row.getToken())).thenReturn(Optional.of(row));

            assertThatThrownBy(() -> provider.getSignedDocument(row.getToken().toString()))
                    .isInstanceOf(IllegalStateException.class);
        }

        @Test
        @DisplayName("stored path is loaded from document storage")
        void whenPathPresent_thenLoadsBytes() {
            ContractSignatureRequest row = pendingRequest(LocalDateTime.now().plusDays(1));
            row.setStatus(ContractSignatureRequest.Status.SIGNED);
            row.setSignedDocumentPath("contracts/signed/CTR-55.pdf");
            when(signatureRequestRepository.findByToken(row.getToken())).thenReturn(Optional.of(row));
            byte[] pdf = {0x25, 0x50, 0x44, 0x46};
            when(documentStorageService.loadAsBytes("contracts/signed/CTR-55.pdf")).thenReturn(pdf);

            byte[] result = provider.getSignedDocument(row.getToken().toString());

            assertThat(result).isEqualTo(pdf);
        }
    }

    // -- Divers ----------------------------------------------------------------------

    @Test
    @DisplayName("provider type is CLENZY_CUSTOM and is always available")
    void providerTypeAndAvailability() {
        assertThat(provider.getType()).isEqualTo(SignatureProviderType.CLENZY_CUSTOM);
        assertThat(provider.isAvailable()).isTrue();
    }

    @Test
    @DisplayName("signing URL has no double slash when base URL ends with '/'")
    void whenBaseUrlEndsWithSlash_thenNoDoubleSlash() {
        // Arrange : base URL avec slash final
        ClenzyInternalSignatureProvider slashProvider = new ClenzyInternalSignatureProvider(
                signatureRequestRepository, generationRepository, documentStorageService,
                BASE_URL + "/", VALIDITY_DAYS);
        when(generationRepository.findById(GENERATION_ID)).thenReturn(Optional.of(generation()));
        when(signatureRequestRepository.findFirstByContractIdAndStatus(
                CONTRACT_ID, ContractSignatureRequest.Status.PENDING))
                .thenReturn(Optional.empty());
        when(signatureRequestRepository.save(any(ContractSignatureRequest.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        // Act
        SignatureResult result = slashProvider.createSignatureRequest(nominalRequest());

        // Assert
        assertThat(result.signingUrl()).startsWith(BASE_URL + "/");
        assertThat(result.signingUrl()).doesNotContain("//sign//");
        assertThat(result.signingUrl().substring("https://".length())).doesNotContain("//");
    }
}
