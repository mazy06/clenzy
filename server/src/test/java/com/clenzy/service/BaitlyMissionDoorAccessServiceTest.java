package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.smartlock.SmartLockCodeProvisioner;
import org.junit.jupiter.api.*;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import java.time.*;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

class BaitlyMissionDoorAccessServiceTest {
    final InterventionRepository missions=mock(InterventionRepository.class);
    final InterventionAccessPolicy access=mock(InterventionAccessPolicy.class);
    final SmartLockDeviceRepository devices=mock(SmartLockDeviceRepository.class);
    final BaitlyInterventionDoorCodeRepository codes=mock(BaitlyInterventionDoorCodeRepository.class);
    final SmartLockCodeProvisioner provider=mock(SmartLockCodeProvisioner.class);
    final PlatformTransactionManager manager=mock(PlatformTransactionManager.class);
    final Clock clock=Clock.fixed(Instant.parse("2026-10-13T10:00:00Z"),ZoneOffset.UTC);
    final Jwt jwt=Jwt.withTokenValue("test").header("alg","none").subject("worker").build();
    BaitlyMissionDoorAccessService service;
    Intervention mission; SmartLockDevice device;
    @BeforeEach void setup(){
        when(manager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        service=new BaitlyMissionDoorAccessService(missions,access,devices,codes,provider,manager,clock);
        mission=new Intervention();mission.setOrganizationId(7L);mission.setStatus(InterventionStatus.PENDING);mission.setScheduledDate(LocalDateTime.of(2026,10,13,12,0));
        var property=new Property();property.setId(3L);property.setOrganizationId(7L);property.setTimezone("Europe/Paris");mission.setProperty(property);
        device=new SmartLockDevice();device.setId(4L);device.setName("Entrée");
        when(missions.findById(1L)).thenReturn(Optional.of(mission));when(missions.findForReview(1L,7L)).thenReturn(Optional.of(mission));
        when(devices.findBaitlyMissionLocks(3L,7L)).thenReturn(List.of(device));
        when(codes.findBound(1L,4L,7L,3L)).thenReturn(Optional.empty());
    }
    BaitlyInterventionDoorCode code(LocalDateTime from,LocalDateTime until){return new BaitlyInterventionDoorCode(7L,1L,3L,4L,from,until,"worker",from);}
    @Test void readingDoesNotProvisionOrReadGuestCodes(){
        assertEquals("NOT_PREPARED",service.list(1L,jwt).get(0).status());
        verify(codes).findBound(1L,4L,7L,3L);verifyNoInteractions(provider);
    }
    @Test void unauthorizedActorCannotReadOrPrepare(){
        doThrow(new org.springframework.security.access.AccessDeniedException("Denied")).when(access).requireAssignee(mission,jwt);
        assertThrows(org.springframework.security.access.AccessDeniedException.class,()->service.list(1L,jwt));
        assertThrows(org.springframework.security.access.AccessDeniedException.class,()->service.prepare(1L,jwt));verifyNoInteractions(devices,codes,provider);
    }
    @Test void pinOnlyAppearsDuringItsWindow(){
        var row=code(LocalDateTime.of(2026,10,13,11,30),LocalDateTime.of(2026,10,13,13,30));row.activate("123456","external");
        when(codes.findBound(1L,4L,7L,3L)).thenReturn(Optional.of(row));assertEquals("123456",service.list(1L,jwt).get(0).code());
        row=code(LocalDateTime.of(2026,10,13,13,0),LocalDateTime.of(2026,10,13,14,0));row.activate("123456","external");
        when(codes.findBound(1L,4L,7L,3L)).thenReturn(Optional.of(row));assertEquals("SCHEDULED",service.list(1L,jwt).get(0).status());assertNull(service.list(1L,jwt).get(0).code());
        row=code(LocalDateTime.of(2026,10,13,10,0),LocalDateTime.of(2026,10,13,12,0));row.activate("123456","external");
        when(codes.findBound(1L,4L,7L,3L)).thenReturn(Optional.of(row));assertEquals("EXPIRED",service.list(1L,jwt).get(0).status());assertNull(service.list(1L,jwt).get(0).code());
    }
    @Test void preparationIsAcknowledgedAndIdempotent(){
        when(codes.saveAndFlush(any())).thenAnswer(call->{BaitlyInterventionDoorCode row=call.getArgument(0);when(codes.findBound(1L,4L,7L,3L)).thenReturn(Optional.of(row));return row;});
        when(provider.place(eq(device),eq("Baitly-intervention-1"),any(),any(),eq(ZoneId.of("Europe/Paris")))).thenReturn(new SmartLockCodeProvisioner.PlacedCode("123456","external"));
        assertEquals("123456",service.prepare(1L,jwt).get(0).code());service.prepare(1L,jwt);
        verify(provider,times(1)).place(any(),anyString(),any(),any(),any());
    }
    @Test void failedHardwareWriteNeverExposesOrRetriesAPin(){
        when(codes.saveAndFlush(any())).thenAnswer(call->{BaitlyInterventionDoorCode row=call.getArgument(0);when(codes.findBound(1L,4L,7L,3L)).thenReturn(Optional.of(row));return row;});
        when(provider.place(any(),anyString(),any(),any(),any())).thenThrow(new IllegalStateException("Provider unavailable"));
        var door=service.prepare(1L,jwt).get(0);assertEquals("FAILED",door.status());assertNull(door.code());service.prepare(1L,jwt);
        verify(provider,times(1)).place(any(),anyString(),any(),any(),any());
    }
}
