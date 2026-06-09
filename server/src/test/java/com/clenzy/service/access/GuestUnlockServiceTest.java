package com.clenzy.service.access;

import com.clenzy.config.GuideConfig;
import com.clenzy.model.CheckInInstructions;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.SmartLockDevice;
import com.clenzy.model.WelcomeGuide;
import com.clenzy.model.WelcomeGuideToken;
import com.clenzy.repository.CheckInInstructionsRepository;
import com.clenzy.repository.SmartLockDeviceRepository;
import com.clenzy.repository.WelcomeGuideTokenRepository;
import com.clenzy.service.NotificationService;
import com.clenzy.service.SmartLockService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GuestUnlockServiceTest {

    @Mock private WelcomeGuideTokenRepository tokenRepository;
    @Mock private CheckInInstructionsRepository instructionsRepository;
    @Mock private SmartLockDeviceRepository smartLockDeviceRepository;
    @Mock private SmartLockService smartLockService;
    @Mock private NotificationService notificationService;
    @Mock private StringRedisTemplate redisTemplate;

    private GuestUnlockService service;
    private final UUID tokenValue = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        GuideConfig config = new GuideConfig();
        service = new GuestUnlockService(tokenRepository, instructionsRepository,
                smartLockDeviceRepository, smartLockService, notificationService, config, redisTemplate);
        // Redis indisponible par défaut → fail-open (pas de rate-limit dans les tests).
        lenient().when(redisTemplate.opsForValue()).thenThrow(new RuntimeException("redis off"));
    }

    private WelcomeGuideToken validToken(boolean stayStarted) {
        Property property = new Property();
        property.setId(10L);
        property.setName("Studio");
        property.setTimezone("Europe/Paris");

        Reservation reservation = new Reservation();
        reservation.setId(100L);
        reservation.setStatus("confirmed");
        reservation.setCheckIn(stayStarted ? LocalDate.now().minusDays(1) : LocalDate.now().plusDays(2));
        reservation.setCheckInTime("15:00");
        reservation.setCheckOut(LocalDate.now().plusDays(3));

        WelcomeGuide guide = new WelcomeGuide();
        guide.setOrganizationId(1L);
        guide.setProperty(property);
        guide.setReservation(reservation);
        guide.setPublished(true);

        WelcomeGuideToken token = new WelcomeGuideToken();
        token.setToken(tokenValue);
        token.setGuide(guide);
        token.setReservation(reservation);
        token.setExpiresAt(LocalDateTime.now().plusDays(3));
        return token;
    }

    private SmartLockDevice tuyaLock() {
        SmartLockDevice lock = new SmartLockDevice();
        lock.setId(5L);
        lock.setExternalDeviceId("dev123");
        return lock; // brand par défaut TUYA
    }

    private CheckInInstructions enabledInstructions() {
        CheckInInstructions ci = new CheckInInstructions();
        ci.setGuestUnlockEnabled(true);
        return ci;
    }

    @Test
    void unknownToken_returnsInvalid() {
        when(tokenRepository.findByToken(tokenValue)).thenReturn(Optional.empty());
        assertThat(service.guestUnlock(tokenValue)).isEqualTo(GuestUnlockService.Status.INVALID);
    }

    @Test
    void optInDisabled_returnsDisabled() {
        when(tokenRepository.findByToken(tokenValue)).thenReturn(Optional.of(validToken(true)));
        when(instructionsRepository.findByPropertyId(10L)).thenReturn(Optional.empty());

        assertThat(service.guestUnlock(tokenValue)).isEqualTo(GuestUnlockService.Status.DISABLED);
        verify(smartLockService, never()).performLockCommand(any(), eq(false));
    }

    @Test
    void beforeCheckInTime_returnsLocked() {
        when(tokenRepository.findByToken(tokenValue)).thenReturn(Optional.of(validToken(false)));
        when(instructionsRepository.findByPropertyId(10L)).thenReturn(Optional.of(enabledInstructions()));

        assertThat(service.guestUnlock(tokenValue)).isEqualTo(GuestUnlockService.Status.LOCKED);
        verify(smartLockService, never()).performLockCommand(any(), eq(false));
    }

    @Test
    void afterCheckOutTime_returnsLocked_evenWithValidToken() {
        WelcomeGuideToken token = validToken(true);
        // Départ déjà passé (hier 11:00) — le token, lui, reste valide (checkout + grace).
        token.getReservation().setCheckOut(LocalDate.now().minusDays(1));
        token.getReservation().setCheckOutTime("11:00");
        when(tokenRepository.findByToken(tokenValue)).thenReturn(Optional.of(token));
        when(instructionsRepository.findByPropertyId(10L)).thenReturn(Optional.of(enabledInstructions()));

        assertThat(service.guestUnlock(tokenValue)).isEqualTo(GuestUnlockService.Status.LOCKED);
        verify(smartLockService, never()).performLockCommand(any(), eq(false));
    }

    @Test
    void tokenWithoutReservation_returnsDisabled() {
        WelcomeGuideToken token = validToken(true);
        token.setReservation(null);
        token.getGuide().setReservation(null); // livret orphelin / partage manuel
        when(tokenRepository.findByToken(tokenValue)).thenReturn(Optional.of(token));
        when(instructionsRepository.findByPropertyId(10L)).thenReturn(Optional.of(enabledInstructions()));

        assertThat(service.guestUnlock(tokenValue)).isEqualTo(GuestUnlockService.Status.DISABLED);
        verify(smartLockService, never()).performLockCommand(any(), eq(false));
    }

    @Test
    void stayStartedWithTuyaLock_unlocksAndNotifiesHost() {
        when(tokenRepository.findByToken(tokenValue)).thenReturn(Optional.of(validToken(true)));
        when(instructionsRepository.findByPropertyId(10L)).thenReturn(Optional.of(enabledInstructions()));
        when(smartLockDeviceRepository.findByPropertyIdAndStatus(10L, SmartLockDevice.DeviceStatus.ACTIVE))
                .thenReturn(List.of(tuyaLock()));

        assertThat(service.guestUnlock(tokenValue)).isEqualTo(GuestUnlockService.Status.OK);
        verify(smartLockService).performLockCommand(any(SmartLockDevice.class), eq(false));
        verify(notificationService).notifyAdminsAndManagersByOrgId(
                eq(1L), eq(NotificationKey.GUEST_DOOR_UNLOCKED), anyString(), anyString(), anyString());
    }

    @Test
    void allUnlockCommandsFail_returnsFailed() {
        when(tokenRepository.findByToken(tokenValue)).thenReturn(Optional.of(validToken(true)));
        when(instructionsRepository.findByPropertyId(10L)).thenReturn(Optional.of(enabledInstructions()));
        when(smartLockDeviceRepository.findByPropertyIdAndStatus(10L, SmartLockDevice.DeviceStatus.ACTIVE))
                .thenReturn(List.of(tuyaLock()));
        org.mockito.Mockito.doThrow(new IllegalStateException("tuya down"))
                .when(smartLockService).performLockCommand(any(), eq(false));

        assertThat(service.guestUnlock(tokenValue)).isEqualTo(GuestUnlockService.Status.FAILED);
        verify(notificationService, never()).notifyAdminsAndManagersByOrgId(any(), any(), any(), any(), any());
    }

    @Test
    void hasRemoteUnlockableLock_trueForActiveTuya() {
        when(smartLockDeviceRepository.findByPropertyIdAndStatus(10L, SmartLockDevice.DeviceStatus.ACTIVE))
                .thenReturn(List.of(tuyaLock()));
        assertThat(service.hasRemoteUnlockableLock(10L)).isTrue();
    }

    @Test
    void hasRemoteUnlockableLock_falseWhenLockOffline() {
        SmartLockDevice lock = tuyaLock();
        lock.setOnline(false); // hors ligne avéré → bouton masqué
        when(smartLockDeviceRepository.findByPropertyIdAndStatus(10L, SmartLockDevice.DeviceStatus.ACTIVE))
                .thenReturn(List.of(lock));
        assertThat(service.hasRemoteUnlockableLock(10L)).isFalse();
    }

    @Test
    void hasRemoteUnlockableLock_falseWithoutExternalId() {
        SmartLockDevice lock = new SmartLockDevice();
        lock.setId(6L); // pas d'externalDeviceId
        when(smartLockDeviceRepository.findByPropertyIdAndStatus(10L, SmartLockDevice.DeviceStatus.ACTIVE))
                .thenReturn(List.of(lock));
        assertThat(service.hasRemoteUnlockableLock(10L)).isFalse();
    }
}
