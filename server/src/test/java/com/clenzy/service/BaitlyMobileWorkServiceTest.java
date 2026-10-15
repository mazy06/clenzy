package com.clenzy.service;
import com.clenzy.marketplace.service.*;
import com.clenzy.marketplace.repository.MarketplaceServiceItemRepository;
import com.clenzy.model.Intervention;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.exception.UnauthorizedException;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.jwt.Jwt;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BaitlyMobileWorkServiceTest {
    @Mock InterventionRepository missions;@Mock InterventionAccessPolicy access;
    @Mock InterventionMapper mapper;@Mock InterventionLifecycleService lifecycle;@Mock InterventionProgressService progress;
    @Mock ProviderAccountResolver accounts;@Mock BaitlyNetworkService network;@Mock UserService users;
    @Mock MarketplaceServiceItemRepository items;
    @Mock com.clenzy.repository.InterventionPhotoRepository missionPhotos;
    @Mock PhotoStorageService photoStorage;
    @Mock BaitlyMissionWorkflow workflow;
    @InjectMocks BaitlyMobileWorkService service;
    Jwt jwt=Jwt.withTokenValue("test").header("alg","none").subject("worker").build();
    @Test void readAccessDoesNotGrantExecution() {
        var mission=new Intervention();when(missions.findById(1L)).thenReturn(Optional.of(mission));
        when(access.requireAssignee(mission,jwt)).thenThrow(new UnauthorizedException("not assigned"));
        assertThat(service.detail(1L,jwt).canExecute()).isFalse();
    }
    @Test void staleReportCannotOverwriteAColleague() {
        var mission=new Intervention();when(missions.findById(1L)).thenReturn(Optional.of(mission));
        assertThatThrownBy(()->service.report(1L,"old report","[]",1L,jwt))
            .isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        verifyNoInteractions(progress);
    }
    @Test void outsiderCannotSubmitOrEditReport() {
        var mission=new Intervention();when(missions.findById(1L)).thenReturn(Optional.of(mission));
        when(access.requireAssignee(mission,jwt)).thenThrow(new UnauthorizedException("not assigned"));
        assertThatThrownBy(()->service.action(1L,"submit",jwt)).isInstanceOf(UnauthorizedException.class);
        assertThatThrownBy(()->service.report(1L,"report","[]",0L,jwt)).isInstanceOf(UnauthorizedException.class);
        verifyNoInteractions(lifecycle,progress);
    }
}
