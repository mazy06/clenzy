package com.clenzy.service;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

class BaitlyMissionWorkflowTest {
    final PropertyStockItemRepository stocks=mock(PropertyStockItemRepository.class);
    final InterventionPhotoRepository photos=mock(InterventionPhotoRepository.class);
    final PropertyInventoryItemRepository inventory=mock(PropertyInventoryItemRepository.class);
    final BaitlyMissionWorkflow workflow=new BaitlyMissionWorkflow(stocks,photos,new ObjectMapper(),inventory);
    Intervention mission;
    @BeforeEach void setup(){mission=new Intervention();mission.setId(1L);mission.setOrganizationId(7L);mission.setType("CLEANING");var p=new Property();p.setId(3L);p.setOrganizationId(7L);p.setBedroomCount(0);p.setBathroomCount(0);mission.setProperty(p);}
    @Test void stagesFollowActualPropertyAndStockRatherThanDemoDefaults(){
        assertEquals(List.of("inspection","surfaces","after_photos","signature"),workflow.steps(mission,"ON_SITE"));
        mission.getProperty().setBedroomCount(2);mission.getProperty().setBathroomCount(1);
        var item=new PropertyStockItem();item.setQuantity(2);item.setReorderThreshold(2);
        when(stocks.findByPropertyIdAndOrganizationIdOrderByNameAsc(3L,7L)).thenReturn(List.of(item));
        when(inventory.findBaitlyMissionInventory(3L,7L)).thenReturn(List.of(new PropertyInventoryItem()));
        assertEquals(List.of("inspection","surfaces","sanitary","linen","inventory","restock","after_photos","signature"),workflow.steps(mission,"ON_SITE"));
        item.setQuantity(5);assertFalse(workflow.steps(mission,"ON_SITE").contains("restock"));
        mission.setCompletedSteps("[\"restock\"]");assertTrue(workflow.steps(mission,"ON_SITE").contains("restock"));
        assertEquals(List.of("delivery","review"),workflow.steps(mission,"REMOTE"));
    }
    @Test void submittedCleaningRequiresServerEvidenceForEachRoomAndAfterWork(){
        var room=new BaitlyMobileWorkService.Room("living_1","living",1);
        String complete="[\"inspection\",\"surfaces\",\"surfaces_living_1\",\"after_photos\",\"signature\"]";
        mission.recordBaitlySignature("CLIENT_ABSENT",null,java.time.LocalDateTime.now());
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->workflow.validate(mission,"ON_SITE",complete,true,List.of(room)));
        var before=new InterventionPhoto();before.setPhase(InterventionPhoto.PhotoPhase.BEFORE);before.setOriginalFilename("baitly-1-step-inspection_living_1-photo.jpg");
        var after=new InterventionPhoto();after.setPhase(InterventionPhoto.PhotoPhase.AFTER);
        when(photos.findAllByInterventionId(1L,7L)).thenReturn(List.of(before,after));
        assertDoesNotThrow(()->workflow.validate(mission,"ON_SITE",complete,true,List.of(room)));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->workflow.validate(mission,"ON_SITE","[\"inspection\",\"surfaces\",\"after_photos\"]",true,List.of(room)));
    }
    @Test void reportCannotPretendIncompleteRemoteWorkIsSubmitted(){
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->workflow.validate(mission,"REMOTE","[\"delivery\"]",true,List.of()));
        assertDoesNotThrow(()->workflow.validate(mission,"REMOTE","[\"delivery\",\"review\"]",true,List.of()));
        verifyNoInteractions(photos);
    }
    @Test void roomValidationUsesTheSamePersistedIndexesAsThePms(){
        var rooms=List.of(new BaitlyMobileWorkService.Room("bedroom_1","bedroom",1),new BaitlyMobileWorkService.Room("living_1","living",1));
        workflow.synchronizeRooms(mission,"[\"inspection\",\"surfaces_living_1\"]",rooms);
        assertEquals("[1]",mission.getValidatedRooms());assertEquals(List.of("living_1"),workflow.validatedRoomIds(mission,rooms));assertEquals(50,mission.getProgressPercentage());
    }
    @Test void whenMaintenanceIsSubmitted_thenDiagnosticAndSignatureNeedServerEvidence(){
        mission.setType("MAINTENANCE");
        assertEquals(List.of("inspection","diagnostic","work","test","after_photos","signature"),workflow.steps(mission,"ON_SITE"));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->workflow.validate(mission,"ON_SITE","[\"diagnostic\"]",false,List.of()));
        mission.setTechnicianNotes("Filtre encrassé");
        assertDoesNotThrow(()->workflow.validate(mission,"ON_SITE","[\"diagnostic\"]",false,List.of()));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->workflow.validate(mission,"ON_SITE","[\"signature\"]",false,List.of()));
        mission.recordBaitlySignature("SIGNED","Leïla",java.time.LocalDateTime.now());
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->workflow.validate(mission,"ON_SITE","[\"signature\"]",false,List.of()));
        var image=new InterventionPhoto();image.setOriginalFilename("baitly-1-step-signature-1.png");
        when(photos.findAllByInterventionId(1L,7L)).thenReturn(List.of(image));
        assertDoesNotThrow(()->workflow.validate(mission,"ON_SITE","[\"signature\"]",false,List.of()));
    }
    @Test void whenNoClientIsPresent_thenTheDeclaredAbsenceCompletesTheSignatureStep(){
        mission.setType("MAINTENANCE");mission.recordBaitlySignature("CLIENT_ABSENT",null,java.time.LocalDateTime.now());
        assertDoesNotThrow(()->workflow.validate(mission,"ON_SITE","[\"signature\"]",false,List.of()));
    }
}
