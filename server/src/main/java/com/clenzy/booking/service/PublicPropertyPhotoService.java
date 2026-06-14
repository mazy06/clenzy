package com.clenzy.booking.service;

import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Property;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.PropertyPhotoService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Sert les photos de propriété PUBLIQUEMENT (sans clé) pour le booking engine : une balise
 * &lt;img&gt; ne peut pas envoyer le header X-Booking-Key. La garde = la propriété doit être
 * {@code bookingEngineVisible} (contenu marketing public). Pas de scope org (endpoint keyless) :
 * la visibilité booking engine EST le contrôle d'accès. {@code findById} contourne le filtre org
 * mais c'est volontaire ici (photo publique d'un bien exposé à la réservation directe).
 */
@Service
public class PublicPropertyPhotoService {

    private final PropertyRepository propertyRepository;
    private final PropertyPhotoService photoService;

    public PublicPropertyPhotoService(PropertyRepository propertyRepository,
                                      PropertyPhotoService photoService) {
        this.propertyRepository = propertyRepository;
        this.photoService = photoService;
    }

    public record PublicPhoto(byte[] data, String contentType) {}

    @Transactional(readOnly = true)
    public PublicPhoto getVisiblePhoto(Long propertyId, Long photoId) {
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new NotFoundException("Propriété introuvable"));
        if (!property.isBookingEngineVisible()) {
            throw new NotFoundException("Photo non disponible");
        }
        byte[] data = photoService.getPhotoData(propertyId, photoId);
        String contentType = photoService.getPhotoContentType(propertyId, photoId);
        return new PublicPhoto(data, contentType);
    }
}
