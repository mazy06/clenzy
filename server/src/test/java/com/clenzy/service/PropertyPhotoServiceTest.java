package com.clenzy.service;

import com.clenzy.dto.PropertyPhotoDto;
import com.clenzy.model.Property;
import com.clenzy.model.PropertyPhoto;
import com.clenzy.repository.PropertyPhotoRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PropertyPhotoServiceTest {

    @Mock private PropertyPhotoRepository photoRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private PhotoStorageService storageService;

    private TenantContext tenantContext;
    private PropertyPhotoService service;

    private static final Long ORG_ID = 1L;
    private static final Long PROPERTY_ID = 100L;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);
        service = new PropertyPhotoService(photoRepository, propertyRepository,
                storageService, tenantContext);
    }

    private Property buildProperty() {
        Property p = new Property();
        p.setId(PROPERTY_ID);
        p.setOrganizationId(ORG_ID);
        return p;
    }

    private PropertyPhoto buildPhoto(Long id, int sortOrder) {
        PropertyPhoto photo = new PropertyPhoto();
        photo.setId(id);
        photo.setOrganizationId(ORG_ID);
        photo.setProperty(buildProperty());
        photo.setOriginalFilename("photo-" + id + ".jpg");
        photo.setContentType("image/jpeg");
        photo.setFileSize(1024L);
        photo.setSortOrder(sortOrder);
        photo.setData(new byte[]{1, 2, 3});
        photo.setSource(PropertyPhoto.PhotoSource.MANUAL);
        return photo;
    }

    private MultipartFile validImageFile() {
        return new MockMultipartFile("file", "test.jpg", "image/jpeg", new byte[]{1, 2, 3, 4});
    }

    @Nested
    @DisplayName("listPhotos")
    class ListPhotos {

        @Test
        void whenNoPhotos_thenReturnsEmptyList() {
            when(photoRepository.findByPropertyIdOrderBySortOrderAsc(PROPERTY_ID))
                    .thenReturn(List.of());

            List<PropertyPhotoDto> result = service.listPhotos(PROPERTY_ID);

            assertThat(result).isEmpty();
        }

        @Test
        void whenPhotosExist_thenMapsToDtos() {
            PropertyPhoto p1 = buildPhoto(1L, 0);
            PropertyPhoto p2 = buildPhoto(2L, 1);
            when(photoRepository.findByPropertyIdOrderBySortOrderAsc(PROPERTY_ID))
                    .thenReturn(List.of(p1, p2));

            List<PropertyPhotoDto> result = service.listPhotos(PROPERTY_ID);

            assertThat(result).hasSize(2);
            assertThat(result.get(0).id()).isEqualTo(1L);
            assertThat(result.get(0).originalFilename()).isEqualTo("photo-1.jpg");
            assertThat(result.get(0).propertyId()).isEqualTo(PROPERTY_ID);
            assertThat(result.get(0).source()).isEqualTo("MANUAL");
        }

        @Test
        void whenPhotoHasNoSource_thenDtoSourceIsNull() {
            PropertyPhoto p = buildPhoto(1L, 0);
            p.setSource(null);
            when(photoRepository.findByPropertyIdOrderBySortOrderAsc(PROPERTY_ID))
                    .thenReturn(List.of(p));

            List<PropertyPhotoDto> result = service.listPhotos(PROPERTY_ID);

            assertThat(result.get(0).source()).isNull();
        }
    }

    @Nested
    @DisplayName("uploadPhoto - validation")
    class UploadValidation {

        @Test
        void whenFileIsNull_thenThrows() {
            assertThatThrownBy(() -> service.uploadPhoto(PROPERTY_ID, null, "caption"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("empty");
        }

        @Test
        void whenFileIsEmpty_thenThrows() {
            MultipartFile empty = new MockMultipartFile("file", "x.jpg", "image/jpeg", new byte[]{});
            assertThatThrownBy(() -> service.uploadPhoto(PROPERTY_ID, empty, null))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("empty");
        }

        @Test
        void whenFileTooBig_thenThrows() throws IOException {
            MultipartFile big = mock(MultipartFile.class);
            when(big.isEmpty()).thenReturn(false);
            when(big.getSize()).thenReturn(11L * 1024L * 1024L);

            assertThatThrownBy(() -> service.uploadPhoto(PROPERTY_ID, big, null))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("10 MB");
        }

        @Test
        void whenContentTypeIsNull_thenThrows() {
            MultipartFile noType = new MockMultipartFile("file", "x", null, new byte[]{1});

            assertThatThrownBy(() -> service.uploadPhoto(PROPERTY_ID, noType, null))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("image");
        }

        @Test
        void whenContentTypeNotImage_thenThrows() {
            MultipartFile pdf = new MockMultipartFile("file", "doc.pdf",
                    "application/pdf", new byte[]{1, 2, 3});

            assertThatThrownBy(() -> service.uploadPhoto(PROPERTY_ID, pdf, null))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("image");
        }

        @Test
        void whenPhotoLimitReached_thenThrows() {
            when(photoRepository.countByPropertyId(PROPERTY_ID)).thenReturn(50);

            assertThatThrownBy(() -> service.uploadPhoto(PROPERTY_ID, validImageFile(), null))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Maximum");
        }

        @Test
        void whenPropertyNotFound_thenThrows() {
            when(photoRepository.countByPropertyId(PROPERTY_ID)).thenReturn(0);
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.uploadPhoto(PROPERTY_ID, validImageFile(), null))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Property not found");
        }

        @Test
        void whenFileGetBytesThrows_thenWrapsInIllegalState() throws IOException {
            MultipartFile broken = mock(MultipartFile.class);
            when(broken.isEmpty()).thenReturn(false);
            when(broken.getSize()).thenReturn(100L);
            when(broken.getContentType()).thenReturn("image/png");
            lenient().when(broken.getOriginalFilename()).thenReturn("broken.png");
            when(broken.getBytes()).thenThrow(new IOException("io error"));
            when(photoRepository.countByPropertyId(PROPERTY_ID)).thenReturn(0);
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(buildProperty()));

            assertThatThrownBy(() -> service.uploadPhoto(PROPERTY_ID, broken, null))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Failed");
        }
    }

    @Nested
    @DisplayName("uploadPhoto - happy path")
    class UploadHappyPath {

        @Test
        void whenValid_thenSavesAndSetsStorageKey() {
            when(photoRepository.countByPropertyId(PROPERTY_ID)).thenReturn(2);
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(buildProperty()));
            // Simulate JPA save: assigns ID
            when(photoRepository.save(any(PropertyPhoto.class))).thenAnswer(inv -> {
                PropertyPhoto p = inv.getArgument(0);
                if (p.getId() == null) p.setId(77L);
                return p;
            });

            PropertyPhotoDto result = service.uploadPhoto(PROPERTY_ID, validImageFile(), "Beautiful view");

            assertThat(result.id()).isEqualTo(77L);
            assertThat(result.caption()).isEqualTo("Beautiful view");
            // Saved twice: once to get the ID, once to persist storageKey
            verify(photoRepository, times(2)).save(any(PropertyPhoto.class));
        }

        @Test
        void whenValid_thenSetsSortOrderToCount() {
            when(photoRepository.countByPropertyId(PROPERTY_ID)).thenReturn(5);
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(buildProperty()));
            ArgumentCaptor<PropertyPhoto> captor = ArgumentCaptor.forClass(PropertyPhoto.class);
            when(photoRepository.save(captor.capture())).thenAnswer(inv -> {
                PropertyPhoto p = inv.getArgument(0);
                if (p.getId() == null) p.setId(11L);
                return p;
            });

            service.uploadPhoto(PROPERTY_ID, validImageFile(), null);

            PropertyPhoto saved = captor.getAllValues().get(0);
            assertThat(saved.getSortOrder()).isEqualTo(5);
            assertThat(saved.getSource()).isEqualTo(PropertyPhoto.PhotoSource.MANUAL);
            assertThat(saved.getOrganizationId()).isEqualTo(ORG_ID);
        }

        @Test
        void whenContentTypeMissing_thenDefaultsToImageJpeg() throws IOException {
            MultipartFile noType = mock(MultipartFile.class);
            when(noType.isEmpty()).thenReturn(false);
            when(noType.getSize()).thenReturn(10L);
            when(noType.getContentType()).thenReturn("image/png").thenReturn(null);
            when(noType.getOriginalFilename()).thenReturn("png-file");
            when(noType.getBytes()).thenReturn(new byte[]{1});
            when(photoRepository.countByPropertyId(PROPERTY_ID)).thenReturn(0);
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(buildProperty()));
            ArgumentCaptor<PropertyPhoto> captor = ArgumentCaptor.forClass(PropertyPhoto.class);
            when(photoRepository.save(captor.capture())).thenAnswer(inv -> {
                PropertyPhoto p = inv.getArgument(0);
                if (p.getId() == null) p.setId(1L);
                return p;
            });

            service.uploadPhoto(PROPERTY_ID, noType, "x");

            PropertyPhoto saved = captor.getAllValues().get(0);
            // Validation accepts contentType (returned the 1st time),
            // but inside service the 2nd call returns null -> defaults to image/jpeg
            assertThat(saved.getContentType()).isEqualTo("image/jpeg");
        }
    }

    @Nested
    @DisplayName("getPhotoData / getPhotoContentType")
    class GetPhoto {

        @Test
        void whenPhotoNotFound_thenThrowsForData() {
            when(photoRepository.findByIdAndPropertyId(1L, PROPERTY_ID))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.getPhotoData(PROPERTY_ID, 1L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Photo not found");
        }

        @Test
        void whenPhotoHasStorageKey_thenDelegatesToStorageService() {
            PropertyPhoto photo = buildPhoto(1L, 0);
            photo.setStorageKey("storage-1");
            when(photoRepository.findByIdAndPropertyId(1L, PROPERTY_ID))
                    .thenReturn(Optional.of(photo));
            when(storageService.retrieve("storage-1")).thenReturn(new byte[]{9, 9, 9});

            byte[] data = service.getPhotoData(PROPERTY_ID, 1L);

            assertThat(data).isEqualTo(new byte[]{9, 9, 9});
            verify(storageService).retrieve("storage-1");
        }

        @Test
        void whenPhotoHasNoStorageKey_thenReturnsInlineData() {
            PropertyPhoto photo = buildPhoto(1L, 0);
            photo.setStorageKey(null);
            photo.setData(new byte[]{1, 2, 3});
            when(photoRepository.findByIdAndPropertyId(1L, PROPERTY_ID))
                    .thenReturn(Optional.of(photo));

            byte[] data = service.getPhotoData(PROPERTY_ID, 1L);

            assertThat(data).isEqualTo(new byte[]{1, 2, 3});
            verify(storageService, never()).retrieve(any());
        }

        @Test
        void whenPhotoExists_thenReturnsContentType() {
            PropertyPhoto photo = buildPhoto(1L, 0);
            photo.setContentType("image/png");
            when(photoRepository.findByIdAndPropertyId(1L, PROPERTY_ID))
                    .thenReturn(Optional.of(photo));

            assertThat(service.getPhotoContentType(PROPERTY_ID, 1L)).isEqualTo("image/png");
        }

        @Test
        void whenPhotoMissing_thenContentTypeDefaultsToJpeg() {
            when(photoRepository.findByIdAndPropertyId(1L, PROPERTY_ID))
                    .thenReturn(Optional.empty());

            assertThat(service.getPhotoContentType(PROPERTY_ID, 1L)).isEqualTo("image/jpeg");
        }
    }

    @Nested
    @DisplayName("deletePhoto")
    class DeletePhoto {

        @Test
        void whenPhotoNotFound_thenThrows() {
            when(photoRepository.findByIdAndPropertyId(1L, PROPERTY_ID))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.deletePhoto(PROPERTY_ID, 1L))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void whenStorageKeyPresent_thenDeletesFromStorageAndDb() {
            PropertyPhoto photo = buildPhoto(1L, 0);
            photo.setStorageKey("key-1");
            when(photoRepository.findByIdAndPropertyId(1L, PROPERTY_ID))
                    .thenReturn(Optional.of(photo));

            service.deletePhoto(PROPERTY_ID, 1L);

            verify(storageService).delete("key-1");
            verify(photoRepository).deleteByIdAndPropertyId(1L, PROPERTY_ID);
        }

        @Test
        void whenStorageKeyMissing_thenSkipsStorageDelete() {
            PropertyPhoto photo = buildPhoto(1L, 0);
            photo.setStorageKey(null);
            when(photoRepository.findByIdAndPropertyId(1L, PROPERTY_ID))
                    .thenReturn(Optional.of(photo));

            service.deletePhoto(PROPERTY_ID, 1L);

            verify(storageService, never()).delete(any());
            verify(photoRepository).deleteByIdAndPropertyId(1L, PROPERTY_ID);
        }
    }

    @Nested
    @DisplayName("reorderPhotos")
    class ReorderPhotos {

        @Test
        void whenCalled_thenAssignsSortOrderByIndex() {
            PropertyPhoto a = buildPhoto(1L, 0);
            PropertyPhoto b = buildPhoto(2L, 1);
            PropertyPhoto c = buildPhoto(3L, 2);
            when(photoRepository.findByPropertyIdOrderBySortOrderAsc(PROPERTY_ID))
                    .thenReturn(List.of(a, b, c));

            service.reorderPhotos(PROPERTY_ID, List.of(3L, 1L, 2L));

            assertThat(c.getSortOrder()).isEqualTo(0);
            assertThat(a.getSortOrder()).isEqualTo(1);
            assertThat(b.getSortOrder()).isEqualTo(2);
            verify(photoRepository).saveAll(anyList());
        }

        @Test
        void whenUnknownIdInList_thenIgnoresGracefully() {
            PropertyPhoto a = buildPhoto(1L, 0);
            when(photoRepository.findByPropertyIdOrderBySortOrderAsc(PROPERTY_ID))
                    .thenReturn(List.of(a));

            service.reorderPhotos(PROPERTY_ID, List.of(99L, 1L));

            // 1L gets sortOrder=1 (index 1 in the list)
            assertThat(a.getSortOrder()).isEqualTo(1);
        }

        @Test
        void whenEmptyList_thenNoChanges() {
            PropertyPhoto a = buildPhoto(1L, 5);
            when(photoRepository.findByPropertyIdOrderBySortOrderAsc(PROPERTY_ID))
                    .thenReturn(List.of(a));

            service.reorderPhotos(PROPERTY_ID, List.of());

            assertThat(a.getSortOrder()).isEqualTo(5);
            verify(photoRepository).saveAll(anyList());
        }
    }
}
