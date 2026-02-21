package com.clenzy.service;

import com.clenzy.exception.DocumentGenerationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;

import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Service de conversion ODT → PDF via Gotenberg (LibreOffice headless, multi-arch amd64/arm64).
 * <p>
 * Endpoint : POST /forms/libreoffice/convert  (multipart "files")
 * Health   : GET /health
 * Docs     : https://gotenberg.dev
 * <p>
 * Envoie le fichier .odt au container Gotenberg via POST REST et recoit le PDF en reponse.
 */
@Service
public class LibreOfficeConversionService {

    private static final Logger log = LoggerFactory.getLogger(LibreOfficeConversionService.class);

    private final String libreOfficeUrl;
    private final RestTemplate restTemplate;

    public LibreOfficeConversionService(
            @Value("${clenzy.libreoffice.url:http://clenzy-libreoffice:3000}") String libreOfficeUrl
    ) {
        this.libreOfficeUrl = libreOfficeUrl;
        this.restTemplate = new RestTemplate();
    }

    /**
     * Convertit un fichier ODT en PDF via Gotenberg (LibreOffice).
     *
     * @param odtBytes Contenu du fichier .odt rempli
     * @param filename Nom du fichier (pour les logs)
     * @return Contenu du PDF genere
     */
    @CircuitBreaker(name = "gotenberg")
    @Retry(name = "gotenberg")
    public byte[] convertToPdf(byte[] odtBytes, String filename) {
        log.info("Converting ODT to PDF via Gotenberg: {} ({} bytes)", filename, odtBytes.length);

        try {
            String url = libreOfficeUrl + "/forms/libreoffice/convert";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            ByteArrayResource resource = new ByteArrayResource(odtBytes) {
                @Override
                public String getFilename() {
                    return filename != null ? filename : "document.odt";
                }
            };
            body.add("files", resource);

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

            ResponseEntity<byte[]> response = restTemplate.exchange(
                    url, HttpMethod.POST, requestEntity, byte[].class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                MediaType contentType = response.getHeaders().getContentType();
                if (contentType != null && !contentType.toString().contains("application/pdf")) {
                    throw new DocumentGenerationException("Expected PDF response, got: " + contentType);
                }
                log.info("PDF conversion successful: {} → {} bytes", filename, response.getBody().length);
                return response.getBody();
            }

            throw new DocumentGenerationException("Gotenberg conversion failed with status: " + response.getStatusCode());

        } catch (Exception e) {
            log.error("Gotenberg conversion failed for {}: {}", filename, e.getMessage());
            throw new DocumentGenerationException("Conversion ODT → PDF echouee. "
                    + "Verifiez que le service Gotenberg est disponible sur " + libreOfficeUrl, e);
        }
    }

    /**
     * Convertit un fichier ODT depuis le disque en PDF.
     *
     * @param odtPath Chemin absolu du fichier .odt
     * @return Contenu du PDF genere
     */
    public byte[] convertToPdf(Path odtPath) {
        try {
            byte[] odtBytes = Files.readAllBytes(odtPath);
            return convertToPdf(odtBytes, odtPath.getFileName().toString());
        } catch (Exception e) {
            throw new DocumentGenerationException("Failed to read ODT file for conversion: " + odtPath, e);
        }
    }

    /**
     * Verifie si le service Gotenberg est disponible.
     */
    public boolean isAvailable() {
        try {
            String url = libreOfficeUrl + "/health";
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
            return response.getStatusCode().is2xxSuccessful();
        } catch (Exception e) {
            log.debug("Gotenberg service not available: {}", e.getMessage());
            return false;
        }
    }
}
