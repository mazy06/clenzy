package com.clenzy.service;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.junit.jupiter.api.*;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
class BaitlyMissionDamagePhotosServiceTest {
    final InterventionRepository missions=mock(InterventionRepository.class);final IssueRepository issues=mock(IssueRepository.class);final IssuePhotoRepository photos=mock(IssuePhotoRepository.class);
    final InterventionAccessPolicy access=mock(InterventionAccessPolicy.class);final UserRepository users=mock(UserRepository.class);final PhotoStorageService storage=mock(PhotoStorageService.class);final PlatformTransactionManager tx=mock(PlatformTransactionManager.class);
    final BaitlyMissionDamagePhotosService service=new BaitlyMissionDamagePhotosService(missions,issues,photos,access,users,storage,tx);
    final Jwt jwt=Jwt.withTokenValue("test").header("alg","none").subject("worker").build();
    Intervention m;Issue issue;
    @BeforeEach void setup(){
        when(tx.getTransaction(any())).thenReturn(new SimpleTransactionStatus());m=new Intervention();m.setOrganizationId(7L);issue=new Issue();issue.setOrganizationId(7L);issue.setSourceInterventionId(1L);
        when(missions.findById(1L)).thenReturn(Optional.of(m));when(missions.findForReview(1L,7L)).thenReturn(Optional.of(m));when(issues.findById(2L)).thenReturn(Optional.of(issue));
        when(users.findByKeycloakId("worker")).thenReturn(Optional.of(new User()));
    }
    @Test void rejectsPhotoForAnotherMissionBeforeStorage(){
        issue.setSourceInterventionId(9L);
        assertThrows(org.springframework.security.access.AccessDeniedException.class,()->service.upload(1L,2L,List.of(new MockMultipartFile("photos","proof.jpg","image/jpeg",new byte[]{1})),jwt));
        verifyNoInteractions(storage);
    }
    @Test void repeatedUploadDoesNotCreateDuplicatePhoto(){
        var prior=new IssuePhoto();prior.setOriginalFilename("proof.jpg");prior.setStorageKey("old");when(photos.findByIssueIdOrderByCreatedAtAsc(2L)).thenReturn(List.of(prior));
        when(storage.store(any(),eq("image/jpeg"),eq("proof.jpg"))).thenReturn("retry");
        service.upload(1L,2L,List.of(new MockMultipartFile("photos","proof.jpg","image/jpeg",new byte[]{1})),jwt);
        verify(photos,never()).save(any());verify(storage).delete("retry");
    }
}
