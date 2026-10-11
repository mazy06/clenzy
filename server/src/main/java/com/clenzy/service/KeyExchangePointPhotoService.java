package com.clenzy.service;

import com.clenzy.dto.keyexchange.KeyExchangePointPhotoDto;
import com.clenzy.service.KeyExchangePointPhotoRegistry.PhotoCandidate;
import com.clenzy.service.storage.ObjectStorageTransactions;
import com.clenzy.service.storage.StoredObject;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * Photos d'emplacement des points de remise des clés, sans transaction
 * englobante (règle audit n°2) : les fichiers partent directement au stockage
 * et seule leur clé est enregistrée ({@link KeyExchangePointPhotoRegistry}) ; à
 * la lecture, la clé est chargée en transaction puis les octets lus ensuite.
 */
@Service
public class KeyExchangePointPhotoService {

    private final KeyExchangePointPhotoRegistry registry;
    private final PhotoStorageService storageService;

    public KeyExchangePointPhotoService(KeyExchangePointPhotoRegistry registry, PhotoStorageService storageService) {
        this.registry = registry;
        this.storageService = storageService;
    }

    /** Octets et type d'une photo. */
    public record PhotoBytes(byte[] bytes, String contentType) {
    }

    public List<KeyExchangePointPhotoDto> addPhotos(Long pointId, List<MultipartFile> files, String uploaderKeycloakId) {
        final List<MultipartFile> photos = files.stream().filter(file -> !file.isEmpty()).toList();
        registry.checkUpload(pointId, photos.stream()
                .map(file -> new PhotoCandidate(file.getSize(), file.getContentType())).toList());
        final List<StoredObject> stored = storeAll(photos);
        final List<String> keys = stored.stream().map(StoredObject::key).toList();
        return ObjectStorageTransactions.persistOrDiscard(keys, storageService::delete,
                () -> registry.attach(pointId, stored, uploaderKeycloakId));
    }

    public PhotoBytes readPhoto(Long pointId, Long photoId) {
        final KeyExchangePointPhotoRegistry.PhotoContent content = registry.findContent(pointId, photoId);
        return new PhotoBytes(storageService.retrieve(content.storageKey()), content.contentType());
    }

    public void deletePhoto(Long pointId, Long photoId) {
        registry.remove(pointId, photoId, storageService::delete);
    }

    private List<StoredObject> storeAll(List<MultipartFile> files) {
        final List<StoredObject> stored = new ArrayList<>();
        try {
            for (MultipartFile file : files) {
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
