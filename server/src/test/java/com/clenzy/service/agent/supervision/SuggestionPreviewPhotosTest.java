package com.clenzy.service.agent.supervision;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Les pieces jointes au travail rendu, depliees pour la modale de controle.
 *
 * <p>Le champ prend deux formes selon que les photos vivent en base ou dans la
 * vieille colonne. N'en traiter qu'une n'echoue nulle part : la grille reste
 * vide, et le gestionnaire valide sans avoir rien regarde.</p>
 */
class SuggestionPreviewPhotosTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void whenPhotosStoredInDatabase_thenJsonArrayIsUnfolded() {
        // Arrange
        final String raw = "[\"data:image/jpeg;base64,AAA\",\"data:image/png;base64,BBB\"]";

        // Act
        final List<String> urls = SuggestionPreviewService.parsePhotoUrls(raw, objectMapper);

        // Assert
        assertThat(urls).containsExactly("data:image/jpeg;base64,AAA", "data:image/png;base64,BBB");
    }

    @Test
    void whenPhotosComeFromLegacyColumn_thenCommaSeparatedUrlsAreUnfolded() {
        // Arrange — la colonne d'origine, sans ligne dans intervention_photos.
        final String raw = "https://cdn/a.jpg, https://cdn/b.jpg";

        // Act
        final List<String> urls = SuggestionPreviewService.parsePhotoUrls(raw, objectMapper);

        // Assert
        assertThat(urls).containsExactly("https://cdn/a.jpg", "https://cdn/b.jpg");
    }

    @Test
    void whenNoPhotoIsAttached_thenNothingIsShown() {
        assertThat(SuggestionPreviewService.parsePhotoUrls(null, objectMapper)).isEmpty();
        assertThat(SuggestionPreviewService.parsePhotoUrls("   ", objectMapper)).isEmpty();
    }

    @Test
    void whenTheArrayIsCorrupt_thenTheOverviewStaysUsableWithoutPhotos() {
        // Arrange — un tableau tronque ne doit pas emporter l'apercu entier :
        // les faits, eux, restent affichables.
        final String raw = "[\"data:image/jpeg;base64,AAA\"";

        // Act & Assert
        assertThat(SuggestionPreviewService.parsePhotoUrls(raw, objectMapper)).isEmpty();
    }

    @Test
    void whenTooManyPhotosAreAttached_thenTheListIsCapped() {
        // Arrange — chaque piece pese quelques megaoctets en base64 : au-dela
        // d'une douzaine, la modale met plus de temps a s'ouvrir qu'a etre lue.
        final String raw = "[" + IntStream.range(0, 30)
                .mapToObj(i -> "\"data:image/jpeg;base64,P" + i + "\"")
                .collect(Collectors.joining(",")) + "]";

        // Act
        final List<String> urls = SuggestionPreviewService.parsePhotoUrls(raw, objectMapper);

        // Assert
        assertThat(urls).hasSize(12).first().isEqualTo("data:image/jpeg;base64,P0");
    }
}
