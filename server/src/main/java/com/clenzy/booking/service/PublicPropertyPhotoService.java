package com.clenzy.booking.service;

import com.clenzy.exception.NotFoundException;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.Property;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.PropertyPhotoService;
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
    private final PropertyPhotoService photoService;
    private final ChannexPropertyMappingRepository channexMappingRepository;

    public PublicPropertyPhotoService(PropertyRepository propertyRepository,
                                      PropertyPhotoService photoService,
                                      ChannexPropertyMappingRepository channexMappingRepository) {
        this.propertyRepository = propertyRepository;
        this.photoService = photoService;
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
        byte[] data = photoService.getPhotoData(propertyId, photoId);
        String contentType = photoService.getPhotoContentType(propertyId, photoId);
        return new PublicPhoto(data, contentType);
    }
}
