package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.junit.jupiter.api.*;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.server.ResponseStatusException;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyMissionEvidenceServiceTest {
    final InterventionRepository missions = mock(InterventionRepository.class);
    final InterventionAccessPolicy access = mock(InterventionAccessPolicy.class);
    final InterventionPhotoRepository photos = mock(InterventionPhotoRepository.class);
    final Clock clock = Clock.fixed(Instant.parse("2026-10-14T15:00:00Z"), ZoneOffset.UTC);
    final BaitlyMissionEvidenceService service = new BaitlyMissionEvidenceService(missions, access, photos, clock);
    final Jwt jwt = mock(Jwt.class);
    Intervention mission;

    @BeforeEach void setup() {
        mission = new Intervention(); mission.setId(4L); mission.setOrganizationId(7L); mission.setStatus(InterventionStatus.IN_PROGRESS);
        when(missions.findById(4L)).thenReturn(Optional.of(mission));
        when(missions.findForReview(4L, 7L)).thenReturn(Optional.of(mission));
    }

    @Test void whenDiagnosticIsRecorded_thenNotesAndMaterialsReachThePmsFields() {
        service.recordDiagnostic(4L, new BaitlyMissionEvidenceService.Diagnostic("Filtre encrassé", "clogging",
            List.of(new BaitlyMissionEvidenceService.Material("Filtre", 2))), jwt);
        assertEquals("[clogging] Filtre encrassé", mission.getTechnicianNotes());
        assertEquals("Filtre × 2", mission.getMaterialsUsed());
        verify(access).requireAssignee(mission, jwt);
    }
    @Test void whenFindingIsMissing_thenDiagnosticIsRejected() {
        assertThrows(ResponseStatusException.class, () -> service.recordDiagnostic(4L, new BaitlyMissionEvidenceService.Diagnostic(" ", null, List.of()), jwt));
    }
    @Test void whenSignatureImageWasNotUploaded_thenSignatureIsRefused() {
        when(photos.findAllByInterventionId(4L, 7L)).thenReturn(List.of());
        assertThrows(ResponseStatusException.class, () -> service.recordSignature(4L, new BaitlyMissionEvidenceService.Signature("SIGNED", "Leïla"), jwt));
        assertNull(mission.getBaitlySignatureStatus());
    }
    @Test void whenSignatureImageExists_thenSignerAndTimeAreStored() {
        var image = new InterventionPhoto(); image.setOriginalFilename("baitly-4-step-signature-1.png");
        when(photos.findAllByInterventionId(4L, 7L)).thenReturn(List.of(image));
        service.recordSignature(4L, new BaitlyMissionEvidenceService.Signature("SIGNED", " Leïla "), jwt);
        assertEquals("SIGNED", mission.getBaitlySignatureStatus());
        assertEquals("Leïla", mission.getBaitlySignerName());
        assertEquals(LocalDateTime.of(2026, 10, 14, 15, 0), mission.getBaitlySignedAt());
    }
    @Test void whenNoClientIsPresent_thenAbsenceIsRecordedWithoutSigner() {
        service.recordSignature(4L, new BaitlyMissionEvidenceService.Signature("CLIENT_ABSENT", "ignored"), jwt);
        assertEquals("CLIENT_ABSENT", mission.getBaitlySignatureStatus());
        assertNull(mission.getBaitlySignerName());
    }
    @Test void whenMissionIsNotRunning_thenEvidenceIsRejected() {
        mission.setStatus(InterventionStatus.PENDING);
        assertThrows(ResponseStatusException.class, () -> service.recordSignature(4L, new BaitlyMissionEvidenceService.Signature("CLIENT_ABSENT", null), jwt));
    }
}
