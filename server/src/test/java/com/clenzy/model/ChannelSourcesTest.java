package com.clenzy.model;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Resolution du canal depuis un nom libre.
 *
 * <p>Ce nom vient d'un hote qui baptise son flux iCal comme il veut, ou d'un
 * channel manager qui renvoie l'OTA vendeuse. C'est desormais lui qui decide de
 * la valeur ecrite dans {@code Reservation.source} : une regression ici range du
 * chiffre d'affaires dans le mauvais canal, en silence.</p>
 */
class ChannelSourcesTest {

    @Test
    void whenNameCarriesTheOta_thenTheChannelIsRecognised() {
        assertThat(ChannelSources.fromName("Airbnb")).isEqualTo("airbnb");
        assertThat(ChannelSources.fromName("Booking.com")).isEqualTo("booking");
        assertThat(ChannelSources.fromName("Vrbo")).isEqualTo("vrbo");
        assertThat(ChannelSources.fromName("Expedia")).isEqualTo("expedia");
    }

    /**
     * L'elargissement lui-meme : Vrbo et HomeAway etaient replies sur « other »,
     * leur chiffre d'affaires atterrissait dans « Autre ».
     */
    @Test
    void whenNameIsAVrboAlias_thenItResolvesToVrbo() {
        assertThat(ChannelSources.fromName("Abritel")).isEqualTo("vrbo");
        assertThat(ChannelSources.fromName("HomeAway")).isEqualTo("vrbo");
    }

    /** Un hote ecrit « Calendrier Airbnb Appart 3 », pas « airbnb ». */
    @Test
    void whenTheOtaIsBuriedInAFreeformName_thenItIsStillFound() {
        assertThat(ChannelSources.fromName("Calendrier AIRBNB — appart 3")).isEqualTo("airbnb");
        assertThat(ChannelSources.fromName("flux booking 2026")).isEqualTo("booking");
    }

    @Test
    void whenNothingIsRecognised_thenItStaysAChannelAllTheSame() {
        // Jamais null : une reservation vient toujours de quelque part, meme
        // innommable — et « other » est traite comme un canal qui encaisse.
        assertThat(ChannelSources.fromName("Calendrier perso")).isEqualTo(ChannelSources.OTHER);
        assertThat(ChannelSources.fromName(null)).isEqualTo(ChannelSources.OTHER);
        assertThat(ChannelSources.fromName("  ")).isEqualTo(ChannelSources.OTHER);
    }

    /**
     * Le lien avec la facturation : chaque canal reconnu doit etre classe du bon
     * cote de l'encaissement. Sans cela, elargir le vocabulaire ferait basculer
     * des sejours OTA en « reste a payer » — exactement ce que la phase 1 visait
     * a rendre impossible.
     */
    @Test
    void whenChannelIsWidened_thenItsCollectionRegimeIsKnown() {
        assertThat(OtaPaidSources.contains(ChannelSources.fromName("Vrbo"))).isTrue();
        assertThat(OtaPaidSources.contains(ChannelSources.fromName("Expedia"))).isTrue();
        assertThat(OtaPaidSources.contains(ChannelSources.fromName("Abritel"))).isTrue();
        assertThat(OtaPaidSources.contains(ChannelSources.fromName("Direct"))).isFalse();
    }
}
