package com.clenzy.service;

import com.clenzy.model.DeviceToken;
import com.clenzy.repository.DeviceTokenRepository;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class DeviceTokenService {

    private static final Logger log = LoggerFactory.getLogger(DeviceTokenService.class);

    private final DeviceTokenRepository deviceTokenRepository;
    private final TenantContext tenantContext;

    public DeviceTokenService(DeviceTokenRepository deviceTokenRepository, TenantContext tenantContext) {
        this.deviceTokenRepository = deviceTokenRepository;
        this.tenantContext = tenantContext;
    }

    /**
     * Enregistre ou met a jour un token push pour un utilisateur.
     * Si le token existe deja (meme appareil), on met a jour le userId (changement de compte).
     */
    public DeviceToken register(String userId, String token, String platform) {
        DeviceToken existing = deviceTokenRepository.findByToken(token).orElse(null);

        if (existing != null) {
            // Token existe deja — mettre a jour l'utilisateur (nouveau login sur meme appareil)
            if (!existing.getUserId().equals(userId)) {
                existing.setUserId(userId);
                existing.setOrganizationId(tenantContext.getOrganizationId());
                existing = deviceTokenRepository.save(existing);
                log.info("Token push reassigne a l'utilisateur {}", userId);
            }
            return existing;
        }

        DeviceToken deviceToken = new DeviceToken(userId, token, platform);
        deviceToken.setOrganizationId(tenantContext.getOrganizationId());
        deviceToken = deviceTokenRepository.save(deviceToken);
        log.info("Token push enregistre pour l'utilisateur {} ({})", userId, platform);
        return deviceToken;
    }

    /**
     * Desenregistre un token push (logout ou desinstallation).
     */
    public void unregister(String token) {
        deviceTokenRepository.deleteByToken(token);
        log.debug("Token push desenregistre: {}", token);
    }

    /**
     * Supprime tous les tokens d'un utilisateur (suppression compte).
     */
    public void removeAllForUser(String userId) {
        int count = deviceTokenRepository.deleteAllByUserId(userId);
        log.info("{} tokens push supprimes pour l'utilisateur {}", count, userId);
    }

    /**
     * Recupere tous les tokens d'un utilisateur pour envoyer des push.
     */
    @Transactional(readOnly = true)
    public List<DeviceToken> getTokensForUser(String userId) {
        return deviceTokenRepository.findByUserId(userId);
    }

    /**
     * Recupere les tokens pour une liste d'utilisateurs.
     */
    @Transactional(readOnly = true)
    public List<DeviceToken> getTokensForUsers(List<String> userIds) {
        return userIds.stream()
                .flatMap(userId -> deviceTokenRepository.findByUserId(userId).stream())
                .toList();
    }
}
