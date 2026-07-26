package com.clenzy.service;

import com.clenzy.dto.MediaAssetDto;
import com.clenzy.model.MediaAsset;
import com.clenzy.repository.MediaAssetRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * Jeton public opaque des médias — audit sécurité 2026-07-26, constat P1-06.
 *
 * <p>{@code GET /api/public/media/{id}} est anonyme et l'identifiant est séquentiel : la
 * médiathèque de toutes les organisations était parcourable de proche en proche. Un filtre
 * par organisation est impossible sur cette route (hors {@code TenantFilter}, aucune
 * organisation courante), d'où un identifiant public non devinable.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("MediaLibraryService — jeton public (P1-06)")
class MediaLibraryServicePublicTokenTest {

    @Mock private MediaAssetRepository repository;
    @Mock private PhotoStorageService storage;
    @InjectMocks private MediaLibraryService service;

    private MediaAsset media(UUID token) {
        MediaAsset m = new MediaAsset();
        m.setId(1L);
        m.setOrganizationId(7L);
        m.setPublicToken(token);
        m.setStorageKey("cle-de-stockage");
        m.setContentType("image/png");
        m.setFileName("visuel.png");
        m.setFileSize(1024L);
        return m;
    }

    @Test
    @DisplayName("un média est servi depuis son jeton")
    void serveByToken_sertLeBinaire() {
        UUID token = UUID.randomUUID();
        when(repository.findByPublicToken(token)).thenReturn(Optional.of(media(token)));
        when(storage.retrieve("cle-de-stockage")).thenReturn(new byte[] {1, 2, 3});

        MediaLibraryService.ServedMedia served = service.serveByToken(token);

        assertThat(served).isNotNull();
        assertThat(served.contentType()).isEqualTo("image/png");
        assertThat(served.data()).containsExactly(1, 2, 3);
    }

    @Test
    @DisplayName("un jeton inconnu ne sert rien")
    void serveByToken_jetonInconnuRetourneNull() {
        UUID inconnu = UUID.randomUUID();
        when(repository.findByPublicToken(inconnu)).thenReturn(Optional.empty());

        assertThat(service.serveByToken(inconnu)).isNull();
    }

    @Test
    @DisplayName("l'URL exposée porte le jeton et jamais l'identifiant")
    void dto_exposeLeJetonEtPasLIdentifiant() {
        UUID token = UUID.randomUUID();

        MediaAssetDto dto = MediaAssetDto.from(media(token));

        assertThat(dto.url()).isEqualTo("/api/public/media/t/" + token);
        // Le coeur du correctif : plus aucune URL produite ne contient l'identifiant,
        // sans quoi l'enumeration resterait ouverte pour tout lien neuf.
        assertThat(dto.url()).doesNotContain("/media/1");
    }

    @Test
    @DisplayName("un média neuf reçoit un jeton sans intervention")
    void nouveauMedia_recoitUnJetonUnique() {
        // Le jeton est pose par l'entite : un media ne peut pas exister sans, meme si un
        // appelant oublie de l'initialiser.
        assertThat(new MediaAsset().getPublicToken()).isNotNull();
        assertThat(new MediaAsset().getPublicToken()).isNotEqualTo(new MediaAsset().getPublicToken());
    }

    @Test
    @DisplayName("la route héritée par identifiant reste servie (pages déjà publiées)")
    @SuppressWarnings("deprecation")
    void serve_parIdentifiantResteFonctionnel() {
        // Non-regression volontaire : retirer cette route casserait les pages publiees
        // avant l'introduction du jeton. Elle sera supprimee une fois celles-ci republiees.
        when(repository.findById(1L)).thenReturn(Optional.of(media(UUID.randomUUID())));
        when(storage.retrieve("cle-de-stockage")).thenReturn(new byte[] {9});

        assertThat(service.serve(1L)).isNotNull();
    }
}
