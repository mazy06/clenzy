package com.clenzy.booking.service;

import com.clenzy.exception.NotFoundException;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.Property;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.PropertyPhotoRepository;
import com.clenzy.service.PhotoStorageService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Sert les photos de propriété PUBLIQUEMENT (sans clé) pour le booking engine : une balise
 * &lt;img&gt; ne peut pas envoyer le header X-Booking-Key. La garde = la propriété doit être
 * {@code bookingEngineVisible} (contenu marketing public) <b>OU mappée Channex</b> — les photos
 * sont alors destinées à la distribution OTA publique : Channex les re-télécharge depuis cette
 * URL stable pour les pousser vers Airbnb/Booking, qui les publient de toute façon. Pas de
 * scope org (endpoint keyless) : cette visibilité marketing EST le contrôle d'accès.
 * {@code findById} contourne le filtre org mais c'est volontaire ici (photo publique d'un bien
 * exposé à la distribution).
 */
@Service
public class PublicPropertyPhotoService {

    private final PropertyRepository propertyRepository;
    private final PropertyPhotoRepository photoRepository;
    private final PhotoStorageService storageService;
    private final ChannexPropertyMappingRepository channexMappingRepository;

    public PublicPropertyPhotoService(PropertyRepository propertyRepository,
                                      PropertyPhotoRepository photoRepository,
                                      PhotoStorageService storageService,
                                      ChannexPropertyMappingRepository channexMappingRepository) {
        this.propertyRepository = propertyRepository;
        this.photoRepository = photoRepository;
        this.storageService = storageService;
        this.channexMappingRepository = channexMappingRepository;
    }

    public record PublicPhoto(byte[] data, String contentType) {}

    @Transactional(readOnly = true)
    public PublicPhoto getVisiblePhoto(Long propertyId, Long photoId) {
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new NotFoundException("Propriété introuvable"));
        boolean marketingPublic = property.isBookingEngineVisible()
                || channexMappingRepository.existsByClenzyPropertyIdAnyOrg(propertyId);
        if (!marketingPublic) {
            throw new NotFoundException("Photo non disponible");
        }
        // The marketing guard above replaces the private organization guard on this public path.
        // Keep the photo bound to the approved property, including when resolving object storage.
        var photo = photoRepository.findByIdAndPropertyId(photoId, propertyId)
                .orElseThrow(() -> new NotFoundException("Photo non disponible"));
        byte[] data = photo.getStorageKey() == null ? photo.getData() : storageService.retrieve(photo.getStorageKey());
        String contentType = photo.getContentType() == null ? "image/jpeg" : photo.getContentType();
        return new PublicPhoto(data, contentType);
    }
}
