package com.clenzy.service.smartlock;

import com.clenzy.integration.tuya.service.TuyaApiService;
import com.clenzy.model.MessageTemplate;
import com.clenzy.model.MessageTemplateType;
import com.clenzy.model.Reservation;
import com.clenzy.model.SmartLockAccessCode;
import com.clenzy.model.SmartLockAccessCode.CodeSource;
import com.clenzy.model.SmartLockAccessCode.CodeStatus;
import com.clenzy.model.SmartLockAccessCodeEvent;
import com.clenzy.model.SmartLockAccessCodeEvent.EventType;
import com.clenzy.model.SmartLockDevice;
import com.clenzy.repository.MessageTemplateRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.SmartLockAccessCodeEventRepository;
import com.clenzy.repository.SmartLockAccessCodeRepository;
import com.clenzy.repository.SmartLockDeviceRepository;
import com.clenzy.service.OutboxPublisher;
import com.clenzy.service.messaging.GuestMessagingService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SmartLockAccessCodeServiceTest {

    @Mock private SmartLockAccessCodeRepository codeRepo;
    @Mock private SmartLockAccessCodeEventRepository eventRepo;
    @Mock private SmartLockDeviceRepository deviceRepo;
    @Mock private TuyaApiService tuyaApiService;
    @Mock private OutboxPublisher outboxPublisher;
    @Mock private GuestMessagingService guestMessagingService;
    @Mock private MessageTemplateRepository templateRepository;
    @Mock private PropertyRepository propertyRepository;

    private SmartLockAccessCodeService service;

    @BeforeEach
    void setUp() {
        service = new SmartLockAccessCodeService(codeRepo, eventRepo, deviceRepo, tuyaApiService,
                outboxPublisher, guestMessagingService, templateRepository, new ObjectMapper(), propertyRepository);
    }

    private SmartLockDevice device() {
        SmartLockDevice d = new SmartLockDevice();
        d.setId(10L);
        d.setOrganizationId(99L);
        d.setPropertyId(5L);
        d.setExternalDeviceId("dev123");
        return d;
    }

    private Reservation reservation() {
        Reservation r = new Reservation();
        r.setId(7L);
        r.setGuestName("Jean Dupont");
        r.setCheckIn(LocalDate.of(2026, 7, 1));
        r.setCheckOut(LocalDate.of(2026, 7, 5));
        return r;
    }

    private void persistReturnsWithId() {
        when(codeRepo.save(any(SmartLockAccessCode.class))).thenAnswer(inv -> {
            SmartLockAccessCode c = inv.getArgument(0);
            if (c.getId() == null) c.setId(1L);
            return c;
        });
    }

    @Test
    void generateForReservation_success_persistsActiveCodeAndNotifiesGuest() {
        persistReturnsWithId();
        when(tuyaApiService.createTemporaryPassword(eq("dev123"), anyLong(), anyLong(), anyString()))
                .thenReturn(Map.of("password", "123456", "tuyaPasswordId", "tp1"));
        when(templateRepository.findByOrganizationIdAndTypeAndIsActiveTrue(99L, MessageTemplateType.ACCESS_CODE))
                .thenReturn(List.of(new MessageTemplate()));

        SmartLockAccessCode result = service.generateForReservation(reservation(), device(), CodeSource.AUTO_RESERVATION);

        assertNotNull(result);
        assertEquals(CodeStatus.ACTIVE, result.getStatus());
        assertEquals("123456", result.getCode());
        assertEquals("tp1", result.getTuyaPasswordId());
        verify(outboxPublisher).publish(eq("SMART_LOCK_ACCESS_CODE"), anyString(), eq("CODE_GENERATED"),
                anyString(), anyString(), anyString(), eq(99L));
        verify(guestMessagingService).sendForReservationViaChannel(any(), any(), eq(99L), any(), anyMap());
        assertTrue(savedEventTypes().contains(EventType.CODE_GENERATED));
        assertTrue(savedEventTypes().contains(EventType.CODE_DELIVERED));
    }

    @Test
    void generateForReservation_tuyaFails_recordsFailureAndDoesNotThrow() {
        when(tuyaApiService.createTemporaryPassword(anyString(), anyLong(), anyLong(), anyString()))
                .thenThrow(new RuntimeException("Tuya down"));

        SmartLockAccessCode result = service.generateForReservation(reservation(), device(), CodeSource.AUTO_RESERVATION);

        assertNull(result);
        verify(codeRepo, never()).save(any());
        verify(guestMessagingService, never()).sendForReservationViaChannel(any(), any(), anyLong(), any(), anyMap());
        assertTrue(savedEventTypes().contains(EventType.GENERATION_FAILED));
    }

    @Test
    void generateForReservation_noTemplate_persistsButDeliveryFails() {
        persistReturnsWithId();
        when(tuyaApiService.createTemporaryPassword(anyString(), anyLong(), anyLong(), anyString()))
                .thenReturn(Map.of("password", "654321", "tuyaPasswordId", "tp2"));
        when(templateRepository.findByOrganizationIdAndTypeAndIsActiveTrue(99L, MessageTemplateType.ACCESS_CODE))
                .thenReturn(List.of());

        SmartLockAccessCode result = service.generateForReservation(reservation(), device(), CodeSource.AUTO_RESERVATION);

        assertNotNull(result);
        assertEquals(CodeStatus.ACTIVE, result.getStatus());
        verify(guestMessagingService, never()).sendForReservationViaChannel(any(), any(), anyLong(), any(), anyMap());
        assertTrue(savedEventTypes().contains(EventType.DELIVERY_FAILED));
    }

    @Test
    void revokeForDevice_callsTuyaDeleteAndMarksRevoked() {
        SmartLockAccessCode code = activeCode("tp1");
        when(codeRepo.findByDeviceIdAndStatus(10L, CodeStatus.ACTIVE)).thenReturn(List.of(code));
        when(deviceRepo.findById(10L)).thenReturn(Optional.of(device()));
        when(codeRepo.save(any(SmartLockAccessCode.class))).thenAnswer(inv -> inv.getArgument(0));

        service.revokeForDevice(10L, "user-1");

        verify(tuyaApiService).deleteTemporaryPassword("dev123", "tp1");
        assertEquals(CodeStatus.REVOKED, code.getStatus());
        assertNotNull(code.getRevokedAt());
    }

    @Test
    void revokeForDevice_tuyaDeleteFails_stillRevokesLocally() {
        SmartLockAccessCode code = activeCode("tp1");
        when(codeRepo.findByDeviceIdAndStatus(10L, CodeStatus.ACTIVE)).thenReturn(List.of(code));
        when(deviceRepo.findById(10L)).thenReturn(Optional.of(device()));
        when(codeRepo.save(any(SmartLockAccessCode.class))).thenAnswer(inv -> inv.getArgument(0));
        doThrow(new RuntimeException("Tuya down")).when(tuyaApiService).deleteTemporaryPassword(anyString(), anyString());

        service.revokeForDevice(10L, "user-1");

        assertEquals(CodeStatus.REVOKED, code.getStatus());
    }

    private SmartLockAccessCode activeCode(String tuyaPasswordId) {
        SmartLockAccessCode c = new SmartLockAccessCode();
        c.setId(1L);
        c.setOrganizationId(99L);
        c.setDeviceId(10L);
        c.setPropertyId(5L);
        c.setStatus(CodeStatus.ACTIVE);
        c.setTuyaPasswordId(tuyaPasswordId);
        return c;
    }

    private List<EventType> savedEventTypes() {
        ArgumentCaptor<SmartLockAccessCodeEvent> captor = ArgumentCaptor.forClass(SmartLockAccessCodeEvent.class);
        verify(eventRepo, atLeastOnce()).save(captor.capture());
        return captor.getAllValues().stream().map(SmartLockAccessCodeEvent::getEventType).toList();
    }
}
