package com.clenzy.controller;

import com.clenzy.dto.camera.CameraDto;
import com.clenzy.dto.camera.CreateCameraDto;
import com.clenzy.service.CameraService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("CameraController")
class CameraControllerTest {

    @Mock private CameraService cameraService;

    private CameraController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new CameraController(cameraService);
        jwt = Jwt.withTokenValue("t").header("alg", "RS256").claim("sub", "kc-user-1")
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(3600)).build();
    }

    private CameraDto dto() {
        return new CameraDto(1L, "Entree", 10L, "Villa", "Hall", "REOLINK", "ACTIVE",
                true, false, "cam_1", "/media/stream.html?src=cam_1",
                "/media/api/frame.jpeg?src=cam_1", LocalDateTime.now());
    }

    @Test
    @DisplayName("GET — retourne la liste de l'utilisateur")
    void list() {
        when(cameraService.getUserCameras("kc-user-1")).thenReturn(List.of(dto()));
        ResponseEntity<List<CameraDto>> resp = controller.getCameras(jwt);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).hasSize(1);
    }

    @Test
    @DisplayName("POST — 200 avec la camera creee")
    void create() {
        CreateCameraDto req = new CreateCameraDto("Entree", 10L, "Hall", "REOLINK", "rtsp://x", null);
        when(cameraService.createCamera("kc-user-1", req)).thenReturn(dto());
        ResponseEntity<?> resp = controller.createCamera(jwt, req);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("POST — propriete invalide -> 400")
    void create_badRequest() {
        CreateCameraDto req = new CreateCameraDto("X", 404L, null, null, "rtsp://x", null);
        when(cameraService.createCamera("kc-user-1", req)).thenThrow(new IllegalArgumentException("Propriete introuvable"));
        ResponseEntity<?> resp = controller.createCamera(jwt, req);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    @DisplayName("DELETE — 200 et delegue au service")
    void delete() {
        ResponseEntity<?> resp = controller.deleteCamera(jwt, 5L);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(cameraService).deleteCamera("kc-user-1", 5L);
    }
}
