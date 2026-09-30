package com.clenzy.service;

import com.clenzy.dto.IssueDtos.IssueDto;
import com.clenzy.service.storage.ObjectStorageTransactions;
import com.clenzy.service.storage.StoredObject;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * Photos des signalements, sans transaction englobante (règle audit n°2) : les fichiers partent
 * directement au stockage (OVH en production) et seule leur clé est enregistrée en base ; à la
 * lecture, les métadonnées sont chargées en transaction et les octets lus ensuite, hors transaction.
 */
@Service
public class IssuePhotoService {

    private final IssueService issueService;
    private final PhotoStorageService storageService;

    public IssuePhotoService(IssueService issueService, PhotoStorageService storageService) {
        this.issueService = issueService;
        this.storageService = storageService;
    }

    /** Octets et type d'une photo de signalement. */
    public record PhotoBytes(byte[] bytes, String contentType) {
    }

    public IssueDto addPhotos(Long issueId, List<MultipartFile> files, String uploaderKeycloakId) {
        issueService.checkPhotoUpload(issueId, files);
        final List<StoredObject> stored = storeAll(files);
        final List<String> keys = stored.stream().map(StoredObject::key).toList();
        return ObjectStorageTransactions.persistOrDiscard(keys, storageService::delete,
                () -> issueService.attachPhotos(issueId, stored, uploaderKeycloakId));
    }

    /** Octets d'une photo, ou {@code null} si elle n'en a plus. */
    public PhotoBytes readPhoto(Long issueId, Long photoId) {
        final IssueService.IssuePhotoContent content = issueService.findPhotoContent(issueId, photoId);
        if (content.storageKey() != null) {
            return new PhotoBytes(storageService.retrieve(content.storageKey()), content.contentType());
        }
        if (content.inlineData() != null) {
            return new PhotoBytes(content.inlineData(), content.contentType());
        }
        return null;
    }

    private List<StoredObject> storeAll(List<MultipartFile> files) {
        final List<StoredObject> stored = new ArrayList<>();
        try {
            for (MultipartFile file : files) {
                if (file.isEmpty()) {
                    continue;
                }
                final String key = storageService.store(readBytes(file), file.getContentType(), file.getOriginalFilename());
                stored.add(new StoredObject(key, file.getContentType(), file.getSize(), file.getOriginalFilename()));
            }
        } catch (RuntimeException e) {
            ObjectStorageTransactions.discard(stored.stream().map(StoredObject::key).toList(), storageService::delete);
            throw e;
        }
        return stored;
    }

    private static byte[] readBytes(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (IOException e) {
            throw new IllegalArgumentException("Lecture du fichier impossible : " + e.getMessage(), e);
        }
    }
}
