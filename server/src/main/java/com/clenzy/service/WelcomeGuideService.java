package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.WelcomeGuideRepository;
import com.clenzy.repository.WelcomeGuideTokenRepository;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class WelcomeGuideService {

    private static final Logger log = LoggerFactory.getLogger(WelcomeGuideService.class);

    private final WelcomeGuideRepository guideRepository;
    private final WelcomeGuideTokenRepository tokenRepository;
    private final PropertyRepository propertyRepository;

    @Value("${clenzy.guide.base-url:https://app.clenzy.fr/guide}")
    private String guideBaseUrl;

    public WelcomeGuideService(WelcomeGuideRepository guideRepository,
                                WelcomeGuideTokenRepository tokenRepository,
                                PropertyRepository propertyRepository) {
        this.guideRepository = guideRepository;
        this.tokenRepository = tokenRepository;
        this.propertyRepository = propertyRepository;
    }

    @Transactional
    public WelcomeGuide createGuide(Long orgId, Long propertyId, String title,
                                      String language, String sections,
                                      String brandingColor, String logoUrl) {
        Property property = propertyRepository.findById(propertyId)
            .orElseThrow(() -> new IllegalArgumentException("Propriete introuvable: " + propertyId));

        WelcomeGuide guide = new WelcomeGuide();
        guide.setOrganizationId(orgId);
        guide.setProperty(property);
        guide.setTitle(title);
        guide.setLanguage(language != null ? language : "fr");
        guide.setSections(sections != null ? sections : "[]");
        if (brandingColor != null) guide.setBrandingColor(brandingColor);
        if (logoUrl != null) guide.setLogoUrl(logoUrl);

        return guideRepository.save(guide);
    }

    @Transactional
    public WelcomeGuide updateGuide(Long guideId, Long orgId, String title,
                                      String sections, String brandingColor,
                                      String logoUrl, Boolean published) {
        WelcomeGuide guide = guideRepository.findByIdAndOrganizationId(guideId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Guide introuvable: " + guideId));

        if (title != null) guide.setTitle(title);
        if (sections != null) guide.setSections(sections);
        if (brandingColor != null) guide.setBrandingColor(brandingColor);
        if (logoUrl != null) guide.setLogoUrl(logoUrl);
        if (published != null) guide.setPublished(published);

        return guideRepository.save(guide);
    }

    public Optional<WelcomeGuide> getById(Long id, Long orgId) {
        return guideRepository.findByIdAndOrganizationId(id, orgId);
    }

    public List<WelcomeGuide> getAll(Long orgId) {
        return guideRepository.findByOrganizationIdOrderByCreatedAtDesc(orgId);
    }

    public List<WelcomeGuide> getByProperty(Long propertyId, Long orgId) {
        return guideRepository.findByPropertyIdAndOrganizationId(propertyId, orgId);
    }

    @Transactional
    public WelcomeGuideToken generateToken(Long guideId, Long orgId, Reservation reservation) {
        WelcomeGuide guide = guideRepository.findByIdAndOrganizationId(guideId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Guide introuvable: " + guideId));

        WelcomeGuideToken token = new WelcomeGuideToken();
        token.setOrganizationId(orgId);
        token.setGuide(guide);
        token.setReservation(reservation);
        token.setToken(UUID.randomUUID());
        token.setExpiresAt(LocalDateTime.now().plusDays(60));

        return tokenRepository.save(token);
    }

    public Optional<WelcomeGuide> getPublicGuide(UUID token) {
        return tokenRepository.findByToken(token)
            .filter(t -> t.getExpiresAt().isAfter(LocalDateTime.now()))
            .map(WelcomeGuideToken::getGuide);
    }

    public String generateGuideLink(WelcomeGuideToken token) {
        return guideBaseUrl + "/" + token.getToken().toString();
    }

    public byte[] generateQrCode(String url, int width, int height) {
        try {
            QRCodeWriter writer = new QRCodeWriter();
            BitMatrix matrix = writer.encode(url, BarcodeFormat.QR_CODE, width, height);
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(matrix, "PNG", outputStream);
            return outputStream.toByteArray();
        } catch (Exception e) {
            log.error("Erreur generation QR code: {}", e.getMessage());
            throw new RuntimeException("Erreur generation QR code", e);
        }
    }

    @Transactional
    public void deleteGuide(Long guideId, Long orgId) {
        WelcomeGuide guide = guideRepository.findByIdAndOrganizationId(guideId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Guide introuvable: " + guideId));
        guideRepository.delete(guide);
    }
}
