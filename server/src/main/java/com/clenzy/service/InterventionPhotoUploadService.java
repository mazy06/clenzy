package com.clenzy.service;

import com.clenzy.dto.InterventionResponse;
import com.clenzy.service.storage.ObjectStorageTransactions;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Objects;

/**
 * Envoi de photos d'intervention, sans transaction englobante (règle audit n°2) : refus anticipé,
 * écriture des fichiers sur le stockage (OVH en production), puis enregistrement de leurs clés dans
 * une transaction courte. Si l'enregistrement échoue, les objets écrits sont supprimés.
 */
@Service
public class InterventionPhotoUploadService {

    private final InterventionService interventionService;
    private final InterventionPhotoService photoService;

    public InterventionPhotoUploadService(InterventionService interventionService,
                                          InterventionPhotoService photoService) {
        this.interventionService = interventionService;
        this.photoService = photoService;
    }

    public InterventionResponse addPhotos(Long id, List<MultipartFile> photos, String photoType, Jwt jwt) {
        interventionService.checkPhotoUpload(id, photos.size(), photoType, jwt);
        final List<InterventionPhotoService.PreparedPhoto> prepared = photoService.preparePhotos(photos);
        final List<String> writtenKeys = prepared.stream()
                .map(InterventionPhotoService.PreparedPhoto::storageKey)
                .filter(Objects::nonNull)
                .toList();
        return ObjectStorageTransactions.persistOrDiscard(writtenKeys, photoService::deleteStoredObject,
                () -> interventionService.attachPhotos(id, prepared, photoType, jwt));
    }
}
