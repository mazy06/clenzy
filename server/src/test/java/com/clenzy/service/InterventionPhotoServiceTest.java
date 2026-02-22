package com.clenzy.service;

import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionPhoto;
import com.clenzy.repository.InterventionPhotoRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InterventionPhotoServiceTest {

    @Mock private InterventionPhotoRepository interventionPhotoRepository;

    private TenantContext tenantContext;
    private InterventionPhotoService service;
    private static final Long ORG_ID = 1L;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);
        service = new InterventionPhotoService(interventionPhotoRepository, tenantContext);
    }

    private Intervention buildIntervention(Long id) {
        Intervention intervention = new Intervention();
        intervention.setId(id);
        return intervention;
    }

    // ===== SAVE PHOTOS =====

    @Nested
    class SavePhotos {

        @Test
        void whenBeforePhotos_thenSavesWithBeforeType() throws Exception {
            Intervention intervention = buildIntervention(1L);
            MultipartFile file = mock(MultipartFile.class);
            when(file.isEmpty()).thenReturn(false);
            when(file.getBytes()).thenReturn(new byte[]{1, 2, 3});
            when(file.getContentType()).thenReturn("image/png");
            when(file.getOriginalFilename()).thenReturn("photo.png");

            service.savePhotos(intervention, List.of(file), "before");

            ArgumentCaptor<InterventionPhoto> captor = ArgumentCaptor.forClass(InterventionPhoto.class);
            verify(interventionPhotoRepository).save(captor.capture());
            InterventionPhoto saved = captor.getValue();

            assertThat(saved.getPhotoType()).isEqualTo("BEFORE");
            assertThat(saved.getContentType()).isEqualTo("image/png");
            assertThat(saved.getPhotoData()).hasSize(3);
        }

        @Test
        void whenAfterPhotos_thenSavesWithAfterType() throws Exception {
            Intervention intervention = buildIntervention(1L);
            MultipartFile file = mock(MultipartFile.class);
            when(file.isEmpty()).thenReturn(false);
            when(file.getBytes()).thenReturn(new byte[]{4, 5});
            when(file.getContentType()).thenReturn("image/jpeg");
            when(file.getOriginalFilename()).thenReturn("after.jpg");

            service.savePhotos(intervention, List.of(file), "after");

            ArgumentCaptor<InterventionPhoto> captor = ArgumentCaptor.forClass(InterventionPhoto.class);
            verify(interventionPhotoRepository).save(captor.capture());
            assertThat(captor.getValue().getPhotoType()).isEqualTo("AFTER");
        }

        @Test
        void whenEmptyFile_thenSkips() throws Exception {
            Intervention intervention = buildIntervention(1L);
            MultipartFile file = mock(MultipartFile.class);
            when(file.isEmpty()).thenReturn(true);

            service.savePhotos(intervention, List.of(file), "before");

            verify(interventionPhotoRepository, never()).save(any());
        }

        @Test
        void whenNullContentType_thenDefaultsToJpeg() throws Exception {
            Intervention intervention = buildIntervention(1L);
            MultipartFile file = mock(MultipartFile.class);
            when(file.isEmpty()).thenReturn(false);
            when(file.getBytes()).thenReturn(new byte[]{1});
            when(file.getContentType()).thenReturn(null);
            when(file.getOriginalFilename()).thenReturn("photo");

            service.savePhotos(intervention, List.of(file), "before");

            ArgumentCaptor<InterventionPhoto> captor = ArgumentCaptor.forClass(InterventionPhoto.class);
            verify(interventionPhotoRepository).save(captor.capture());
            assertThat(captor.getValue().getContentType()).isEqualTo("image/jpeg");
        }

        @Test
        void whenIOException_thenThrowsRuntime() throws Exception {
            Intervention intervention = buildIntervention(1L);
            MultipartFile file = mock(MultipartFile.class);
            when(file.isEmpty()).thenReturn(false);
            when(file.getBytes()).thenThrow(new IOException("Read error"));

            assertThatThrownBy(() -> service.savePhotos(intervention, List.of(file), "before"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("photo");
        }
    }

    // ===== CONVERT PHOTOS TO BASE64 =====

    @Nested
    class ConvertPhotosToBase64 {

        @Test
        void whenPhotosExist_thenReturnsJsonArray() {
            Intervention intervention = buildIntervention(1L);
            InterventionPhoto photo = new InterventionPhoto();
            photo.setPhotoData(new byte[]{1, 2, 3});
            photo.setContentType("image/png");

            when(interventionPhotoRepository.findAllByInterventionId(1L, ORG_ID))
                    .thenReturn(List.of(photo));

            String result = service.convertPhotosToBase64Urls(intervention);

            assertThat(result).startsWith("[\"data:image/png;base64,");
            assertThat(result).endsWith("\"]");
        }

        @Test
        void whenNoPhotos_thenFallsBackToLegacy() {
            Intervention intervention = buildIntervention(1L);
            intervention.setPhotos("legacy-urls");

            when(interventionPhotoRepository.findAllByInterventionId(1L, ORG_ID))
                    .thenReturn(List.of());

            String result = service.convertPhotosToBase64Urls(intervention);

            assertThat(result).isEqualTo("legacy-urls");
        }
    }

    // ===== CONVERT PHOTOS BY TYPE =====

    @Nested
    class ConvertPhotosByType {

        @Test
        void whenBeforePhotosExist_thenReturnsBase64() {
            Intervention intervention = buildIntervention(1L);
            InterventionPhoto photo = new InterventionPhoto();
            photo.setPhotoData(new byte[]{10, 20});
            photo.setContentType("image/jpeg");

            when(interventionPhotoRepository.findByInterventionIdAndPhotoTypeOrderByCreatedAtAsc(1L, "BEFORE", ORG_ID))
                    .thenReturn(List.of(photo));

            String result = service.convertPhotosToBase64UrlsByType(intervention, "before");

            assertThat(result).contains("data:image/jpeg;base64,");
        }

        @Test
        void whenNoPhotosForType_thenFallsBackToLegacyField() {
            Intervention intervention = buildIntervention(1L);
            intervention.setBeforePhotosUrls("before-legacy");

            when(interventionPhotoRepository.findByInterventionIdAndPhotoTypeOrderByCreatedAtAsc(1L, "BEFORE", ORG_ID))
                    .thenReturn(List.of());

            String result = service.convertPhotosToBase64UrlsByType(intervention, "before");

            assertThat(result).isEqualTo("before-legacy");
        }
    }
}
