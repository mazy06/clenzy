package com.clenzy.service.smartlock;

import com.clenzy.integration.tuya.service.TuyaApiService;
import com.clenzy.model.SmartLockAccessCode;
import com.clenzy.model.SmartLockAccessCode.CodeStatus;
import com.clenzy.model.SmartLockDevice;
import com.clenzy.repository.CheckInInstructionsRepository;
import com.clenzy.repository.MessageTemplateRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.SmartLockAccessCodeEventRepository;
import com.clenzy.repository.SmartLockAccessCodeRepository;
import com.clenzy.repository.SmartLockDeviceRepository;
import com.clenzy.service.OutboxPublisher;
import com.clenzy.service.access.AccessCodeGenerator;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.service.messaging.GuestMessagingService;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Isolation multi-tenant des codes d'acces de serrures — audit securite 2026-07-26,
 * constat P1-01.
 *
 * <p>Les trois methodes couvertes ici sont celles atteignables depuis HTTP avec un
 * {@code deviceId} pris dans l'URL ({@code SmartLockController} {@code /{id}/access-code}).
 * Elles chargeaient la serrure — ou ses codes — par identifiant sans verifier
 * l'organisation. Or {@code findById} ne traverse PAS le filtre Hibernate
 * {@code organizationFilter}, et ce filtre est de toute facon inerte en HTTP
 * ({@code open-in-view: false}) : rien ne limitait la portee au tenant courant.
 *
 * <p>La lecture est la plus grave des trois : {@code GET /{id}/access-code} n'exige que
 * {@code isAuthenticated()} et renvoie le PIN en clair dans le DTO.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("SmartLockAccessCodeService — isolation multi-tenant (P1-01)")
class SmartLockAccessCodeServiceCrossTenantTest {

    private static final Long ORG_ATTAQUANT = 1L;
    private static final Long ORG_VICTIME = 2L;
    private static final Long DEVICE_ID = 42L;

    @Mock private SmartLockAccessCodeRepository codeRepo;
    @Mock private SmartLockAccessCodeEventRepository eventRepo;
    @Mock private SmartLockDeviceRepository deviceRepo;
    @Mock private TuyaApiService tuyaApiService;
    @Mock private OutboxPublisher outboxPublisher;
    @Mock private GuestMessagingService guestMessagingService;
    @Mock private MessageTemplateRepository templateRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private CheckInInstructionsRepository checkInInstructionsRepository;
    @Mock private AccessCodeGenerator accessCodeGenerator;
    @Mock private SmartLockProviderRegistry providerRegistry;
    @Mock private TenantContext tenantContext;

    private SmartLockAccessCodeService service;

    @BeforeEach
    void setUp() {
        // Un HOST ordinaire de l'org attaquante : ni super-admin, ni org SYSTEM.
        when(tenantContext.getOrganizationId()).thenReturn(ORG_ATTAQUANT);
        when(tenantContext.isSuperAdmin()).thenReturn(false);
        when(tenantContext.isSystemOrg()).thenReturn(false);

        service = new SmartLockAccessCodeService(
                codeRepo, eventRepo, deviceRepo, tuyaApiService, outboxPublisher,
                guestMessagingService, templateRepository, new ObjectMapper(),
                propertyRepository, checkInInstructionsRepository, accessCodeGenerator,
                providerRegistry, new OrganizationAccessGuard(tenantContext));

        // La serrure ciblee appartient a une AUTRE organisation.
        SmartLockDevice deviceVictime = new SmartLockDevice();
        deviceVictime.setId(DEVICE_ID);
        deviceVictime.setOrganizationId(ORG_VICTIME);
        deviceVictime.setExternalDeviceId("tuya-victime");
        when(deviceRepo.findById(DEVICE_ID)).thenReturn(Optional.of(deviceVictime));
    }

    private SmartLockAccessCode codeActif() {
        SmartLockAccessCode code = new SmartLockAccessCode();
        code.setId(7L);
        code.setDeviceId(DEVICE_ID);
        code.setStatus(CodeStatus.ACTIVE);
        code.setValidFrom(LocalDateTime.now().minusDays(1));
        code.setValidUntil(LocalDateTime.now().plusDays(1));
        return code;
    }

    @Test
    @DisplayName("lire le code d'une serrure d'une autre organisation est refuse")
    void getCurrentForDevice_refuseUneSerrureHorsOrganisation() {
        when(codeRepo.findFirstByDeviceIdAndStatusOrderByCreatedAtDesc(DEVICE_ID, CodeStatus.ACTIVE))
                .thenReturn(Optional.of(codeActif()));

        assertThatThrownBy(() -> service.getCurrentForDevice(DEVICE_ID))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("faire tourner le code d'une serrure d'une autre organisation est refuse")
    void rotateManual_refuseUneSerrureHorsOrganisation() {
        assertThatThrownBy(() -> service.rotateManual(DEVICE_ID, null, null, null, "attaquant"))
                .isInstanceOf(AccessDeniedException.class);

        // Le refus doit precéder tout effet de bord : aucun code revoque, aucun appel provider.
        verify(codeRepo, never()).save(any());
        verify(tuyaApiService, never()).deleteTemporaryPassword(any(), any());
    }

    @Test
    @DisplayName("revoquer le code d'une serrure d'une autre organisation est refuse")
    void revokeForDevice_refuseUneSerrureHorsOrganisation() {
        when(codeRepo.findByDeviceIdAndStatus(DEVICE_ID, CodeStatus.ACTIVE))
                .thenReturn(List.of(codeActif()));

        assertThatThrownBy(() -> service.revokeForDevice(DEVICE_ID, "attaquant"))
                .isInstanceOf(AccessDeniedException.class);

        verify(codeRepo, never()).save(any());
    }

    @Test
    @DisplayName("une serrure de sa propre organisation reste accessible")
    void getCurrentForDevice_autoriseSaPropreOrganisation() {
        SmartLockDevice sien = new SmartLockDevice();
        sien.setId(DEVICE_ID);
        sien.setOrganizationId(ORG_ATTAQUANT);
        when(deviceRepo.findById(DEVICE_ID)).thenReturn(Optional.of(sien));
        when(codeRepo.findFirstByDeviceIdAndStatusOrderByCreatedAtDesc(DEVICE_ID, CodeStatus.ACTIVE))
                .thenReturn(Optional.of(codeActif()));

        assertThat(service.getCurrentForDevice(DEVICE_ID)).isPresent();
    }

    @Test
    @DisplayName("une serrure inexistante ne leve pas AccessDenied en lecture (204, pas 403)")
    void getCurrentForDevice_serrureInexistanteResteVide() {
        when(deviceRepo.findById(anyLong())).thenReturn(Optional.empty());

        // Le controller traduit un Optional vide en 204. Ne pas transformer ce cas en 403 :
        // cela transformerait l'endpoint en oracle d'existence d'identifiants.
        assertThat(service.getCurrentForDevice(999L)).isEmpty();
    }
}
