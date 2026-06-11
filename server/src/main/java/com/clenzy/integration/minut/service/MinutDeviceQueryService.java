package com.clenzy.integration.minut.service;

import com.clenzy.repository.NoiseDeviceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lectures des devices bruit lies a un utilisateur pour l'integration Minut
 * — refactor T-ARCH-01 : plus aucun repository dans les controllers.
 *
 * <p>L'ownership est valide par {@code userId} (subject du JWT) : les devices
 * et homes d'un autre utilisateur sont invisibles — il n'y a aucun chargement
 * par ID brut sans scoping.</p>
 */
@Service
public class MinutDeviceQueryService {

    private final NoiseDeviceRepository noiseDeviceRepository;

    public MinutDeviceQueryService(NoiseDeviceRepository noiseDeviceRepository) {
        this.noiseDeviceRepository = noiseDeviceRepository;
    }

    /** Nombre de capteurs lies a l'utilisateur (ecran de statut de connexion). */
    @Transactional(readOnly = true)
    public long countDevicesForUser(String userId) {
        return noiseDeviceRepository.countByUserId(userId);
    }

    /** Verifie que l'utilisateur possede un device avec l'externalDeviceId donne. */
    @Transactional(readOnly = true)
    public boolean userOwnsDevice(String userId, String externalDeviceId) {
        return noiseDeviceRepository.findByUserId(userId).stream()
                .anyMatch(d -> externalDeviceId.equals(d.getExternalDeviceId()));
    }

    /** Verifie que l'utilisateur possede un device lie au homeId Minut donne. */
    @Transactional(readOnly = true)
    public boolean userOwnsHome(String userId, String externalHomeId) {
        return noiseDeviceRepository.findByUserId(userId).stream()
                .anyMatch(d -> externalHomeId.equals(d.getExternalHomeId()));
    }
}
