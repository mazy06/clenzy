package com.clenzy.service;

import com.clenzy.dto.camera.CameraDto;
import com.clenzy.dto.camera.CreateCameraDto;
import com.clenzy.model.Camera;
import com.clenzy.model.Camera.CameraStatus;
import com.clenzy.model.Property;
import com.clenzy.repository.CameraRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("CameraService")
class CameraServiceTest {

    private static final String USER = "kc-user-1";

    @Mock private CameraRepository cameraRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private TokenEncryptionService encryptionService;
    @Mock private CameraStreamService cameraStreamService;
    @Mock private TenantContext tenantContext;

    private CameraService service;

    @BeforeEach
    void setUp() {
        service = new CameraService(cameraRepository, propertyRepository, encryptionService, cameraStreamService, tenantContext);
    }

    @Test
    @DisplayName("createCamera — chiffre l'URL RTSP, genere un stream, enregistre cote go2rtc")
    void create_encryptsAndRegisters() {
        Property property = org.mockito.Mockito.mock(Property.class);
        when(property.getId()).thenReturn(10L);
        when(propertyRepository.findById(10L)).thenReturn(Optional.of(property));
        when(tenantContext.getRequiredOrganizationId()).thenReturn(99L);
        when(encryptionService.encrypt("rtsp://u:p@host/stream")).thenReturn("ENC");
        when(cameraStreamService.webrtcUrl(anyString())).thenReturn("/media/stream.html?src=x");
        when(cameraRepository.save(any(Camera.class))).thenAnswer(inv -> inv.getArgument(0));

        CameraDto dto = service.createCamera(USER,
                new CreateCameraDto("Entree", 10L, "Hall", "REOLINK", "rtsp://u:p@host/stream"));

        // URL RTSP chiffree (jamais en clair en base) + flux enregistre go2rtc avec l'URL claire
        verify(encryptionService).encrypt("rtsp://u:p@host/stream");
        verify(cameraStreamService).registerStream(anyString(), eq("rtsp://u:p@host/stream"));
        assertThat(dto.name()).isEqualTo("Entree");
        assertThat(dto.brand()).isEqualTo("REOLINK");
        assertThat(dto.webrtcUrl()).isEqualTo("/media/stream.html?src=x");
        assertThat(dto.streamName()).startsWith("cam_");
    }

    @Test
    @DisplayName("createCamera — propriete introuvable -> IllegalArgumentException")
    void create_unknownProperty() {
        when(propertyRepository.findById(404L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.createCamera(USER,
                new CreateCameraDto("X", 404L, null, null, "rtsp://x")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("deleteCamera — retire le flux go2rtc puis supprime")
    void delete_removesStream() {
        Camera camera = new Camera();
        camera.setId(5L);
        camera.setName("Entree");
        camera.setStreamName("cam_abc");
        when(cameraRepository.findById(5L)).thenReturn(Optional.of(camera));

        service.deleteCamera(USER, 5L);

        verify(cameraStreamService).removeStream("cam_abc");
        verify(cameraRepository).delete(camera);
    }

    @Test
    @DisplayName("getUserCameras — mappe entite -> DTO (webrtcUrl, online si ACTIVE)")
    void list_maps() {
        Camera camera = new Camera();
        camera.setId(1L);
        camera.setName("Entree");
        camera.setPropertyId(10L);
        camera.setStreamName("cam_abc");
        camera.setStatus(CameraStatus.ACTIVE);
        when(cameraRepository.findByStatus(CameraStatus.ACTIVE)).thenReturn(List.of(camera));
        when(cameraStreamService.webrtcUrl("cam_abc")).thenReturn("/media/stream.html?src=cam_abc");

        List<CameraDto> result = service.getUserCameras(USER);

        assertThat(result).singleElement().satisfies(d -> {
            assertThat(d.online()).isTrue();
            assertThat(d.webrtcUrl()).isEqualTo("/media/stream.html?src=cam_abc");
        });
    }
}
