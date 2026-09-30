package com.clenzy.service;

import com.clenzy.dto.IssueDtos.IssueDto;
import com.clenzy.service.storage.StoredObject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Photos de signalement : elles partent directement au stockage (OVH en production), seule leur
 * clé est enregistrée, et un enregistrement qui échoue ne laisse pas d'objet orphelin.
 */
@ExtendWith(MockitoExtension.class)
class IssuePhotoServiceTest {

    @Mock private IssueService issueService;
    @Mock private PhotoStorageService storageService;

    private IssuePhotoService service;

    @BeforeEach
    void setUp() {
        service = new IssuePhotoService(issueService, storageService);
    }

    private MultipartFile photo(String name) {
        return new MockMultipartFile("photos", name, "image/jpeg", new byte[]{1, 2, 3});
    }

    @Test
    void whenUploading_thenStoresEachPhotoAndAttachesOnlyTheKeys() {
        when(storageService.store(any(), eq("image/jpeg"), eq("a.jpg"))).thenReturn("org/1/photos/a");
        IssueDto dto = mock(IssueDto.class);
        when(issueService.attachPhotos(eq(5L), anyList(), eq("kc-1"))).thenReturn(dto);

        assertThat(service.addPhotos(5L, List.of(photo("a.jpg")), "kc-1")).isSameAs(dto);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<StoredObject>> captor = ArgumentCaptor.forClass(List.class);
        verify(issueService).attachPhotos(eq(5L), captor.capture(), eq("kc-1"));
        assertThat(captor.getValue()).containsExactly(new StoredObject("org/1/photos/a", "image/jpeg", 3L, "a.jpg"));
    }

    @Test
    void whenAttachingFails_thenDeletesTheStoredObjects() {
        when(storageService.store(any(), any(), any())).thenReturn("org/1/photos/a");
        when(issueService.attachPhotos(any(), anyList(), any())).thenThrow(new IllegalStateException("db down"));

        assertThatThrownBy(() -> service.addPhotos(5L, List.of(photo("a.jpg")), "kc-1"))
                .isInstanceOf(IllegalStateException.class);

        verify(storageService).delete("org/1/photos/a");
    }

    @Test
    void whenTheUploadIsRefused_thenNothingIsStored() {
        doThrow(new IllegalArgumentException("Maximum 6 photos")).when(issueService).checkPhotoUpload(any(), anyList());

        assertThatThrownBy(() -> service.addPhotos(5L, List.of(photo("a.jpg")), "kc-1"))
                .isInstanceOf(IllegalArgumentException.class);

        verify(storageService, never()).store(any(), any(), any());
    }

    @Test
    void whenReadingAStoredPhoto_thenReadsTheObject() {
        when(issueService.findPhotoContent(5L, 9L))
                .thenReturn(new IssueService.IssuePhotoContent("org/1/photos/a", null, "image/png"));
        when(storageService.retrieve("org/1/photos/a")).thenReturn(new byte[]{7});

        IssuePhotoService.PhotoBytes photo = service.readPhoto(5L, 9L);

        assertThat(photo.bytes()).containsExactly(7);
        assertThat(photo.contentType()).isEqualTo("image/png");
    }

    @Test
    void whenReadingAnOldPhoto_thenReturnsItsInlineBytes() {
        when(issueService.findPhotoContent(5L, 9L))
                .thenReturn(new IssueService.IssuePhotoContent(null, new byte[]{8}, "image/jpeg"));

        assertThat(service.readPhoto(5L, 9L).bytes()).containsExactly(8);
        verify(storageService, never()).retrieve(any());
    }
}
