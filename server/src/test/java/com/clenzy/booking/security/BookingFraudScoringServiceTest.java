package com.clenzy.booking.security;

import com.clenzy.repository.ReservationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.math.BigDecimal;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookingFraudScoringServiceTest {

    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;
    @Mock private ReservationRepository reservationRepository;

    private BookingFraudScoringProperties props;
    private BookingFraudScoringService service;

    private static final Long ORG = 10L;
    private static final Long PROPERTY = 42L;

    @BeforeEach
    void setUp() {
        props = new BookingFraudScoringProperties();
        props.setEnabled(true); // service ne calcule que si activé (l'appelant gère le no-op)
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOps);
        service = new BookingFraudScoringService(redisTemplate, reservationRepository, props);
    }

    private BookingFraudScoringService.FraudSignalInput input(String ip, String email, BigDecimal total) {
        return new BookingFraudScoringService.FraudSignalInput(ORG, PROPERTY, ip, email, total, null, null);
    }

    /** Compteur de vélocité sous le seuil → aucune contribution. */
    private void velocityUnderThreshold() {
        when(valueOps.increment(anyString())).thenReturn(1L);
    }

    @Test
    @DisplayName("Signaux neutres → score 0, niveau LOW, aucune raison")
    void whenNoSignals_thenLowScore() {
        velocityUnderThreshold();
        when(reservationRepository.averageTotalPriceByProperty(eq(PROPERTY), eq(ORG)))
            .thenReturn(new BigDecimal("100.00"));

        RiskAssessment result = service.score(input("8.8.8.8", "alice@gmail.com", new BigDecimal("120.00")));

        assertThat(result.score()).isZero();
        assertThat(result.level()).isEqualTo(RiskLevel.LOW);
        assertThat(result.reasons()).isEmpty();
    }

    @Test
    @DisplayName("Vélocité IP élevée → score atteint MEDIUM (caution exigée par l'appelant)")
    void whenHighIpVelocity_thenMedium() {
        // Au-delà du seuil (5) → +35 pts (velocityIpPoints) = niveau MEDIUM (seuil 40 non atteint par IP seule ?)
        // velocityIpPoints=35 < mediumThreshold=40 → on combine IP + email pour franchir le seuil.
        when(valueOps.increment(anyString())).thenReturn(9L); // IP et email tous deux > seuil
        lenient().when(reservationRepository.averageTotalPriceByProperty(anyLong(), anyLong())).thenReturn(null);

        RiskAssessment result = service.score(input("1.2.3.4", "bob@gmail.com", new BigDecimal("100.00")));

        // 35 (IP) + 35 (email) = 70 → HIGH par défaut ; vérifie au moins MEDIUM+ et la raison vélocité.
        assertThat(result.isMediumOrAbove()).isTrue();
        assertThat(result.reasons()).anyMatch(r -> r.contains("Vélocité IP"));
    }

    @Test
    @DisplayName("Email jetable → le score remonte avec une raison dédiée")
    void whenDisposableEmail_thenScoreRises() {
        velocityUnderThreshold();
        lenient().when(reservationRepository.averageTotalPriceByProperty(anyLong(), anyLong())).thenReturn(null);

        RiskAssessment result = service.score(input("8.8.8.8", "scam@mailinator.com", new BigDecimal("100.00")));

        assertThat(result.score()).isEqualTo(props.getDisposableEmailPoints());
        assertThat(result.reasons()).anyMatch(r -> r.contains("Email jetable"));
    }

    @Test
    @DisplayName("Montant atypique (> 3× moyenne serveur) → score remonte")
    void whenAtypicalAmount_thenScoreRises() {
        velocityUnderThreshold();
        when(reservationRepository.averageTotalPriceByProperty(eq(PROPERTY), eq(ORG)))
            .thenReturn(new BigDecimal("100.00"));

        // 500 > 3 × 100 = 300 → signal montant atypique
        RiskAssessment result = service.score(input("8.8.8.8", "alice@gmail.com", new BigDecimal("500.00")));

        assertThat(result.score()).isEqualTo(props.getAtypicalAmountPoints());
        assertThat(result.reasons()).anyMatch(r -> r.contains("Montant atypique"));
    }

    @Test
    @DisplayName("Montant proche de la moyenne → pas de signal montant")
    void whenAmountNearAverage_thenNoAmountSignal() {
        velocityUnderThreshold();
        when(reservationRepository.averageTotalPriceByProperty(eq(PROPERTY), eq(ORG)))
            .thenReturn(new BigDecimal("100.00"));

        RiskAssessment result = service.score(input("8.8.8.8", "alice@gmail.com", new BigDecimal("250.00")));

        assertThat(result.reasons()).noneMatch(r -> r.contains("Montant atypique"));
    }

    @Test
    @DisplayName("Redis indisponible → fail-open (vélocité = 0), aucune erreur propagée")
    void whenRedisDown_thenFailOpen() {
        when(valueOps.increment(anyString())).thenThrow(new RuntimeException("redis down"));
        lenient().when(reservationRepository.averageTotalPriceByProperty(anyLong(), anyLong())).thenReturn(null);

        RiskAssessment result = service.score(input("1.2.3.4", "alice@gmail.com", new BigDecimal("100.00")));

        assertThat(result.level()).isEqualTo(RiskLevel.LOW);
        assertThat(result.score()).isZero();
    }

    @Test
    @DisplayName("Score borné à 100 même en cumulant tous les signaux")
    void whenAllSignals_thenScoreBoundedTo100() {
        when(valueOps.increment(anyString())).thenReturn(50L); // IP + email au-dessus du seuil
        when(reservationRepository.averageTotalPriceByProperty(eq(PROPERTY), eq(ORG)))
            .thenReturn(new BigDecimal("10.00"));

        RiskAssessment result = service.score(
            new BookingFraudScoringService.FraudSignalInput(
                ORG, PROPERTY, "1.2.3.4", "scam@mailinator.com", new BigDecimal("9999.00"), "US", "FR"));

        assertThat(result.score()).isLessThanOrEqualTo(100);
        assertThat(result.level()).isEqualTo(RiskLevel.HIGH);
    }

    @Test
    @DisplayName("Mismatch pays IP vs déclaré → signal pays")
    void whenCountryMismatch_thenSignal() {
        velocityUnderThreshold();
        lenient().when(reservationRepository.averageTotalPriceByProperty(anyLong(), anyLong())).thenReturn(null);

        RiskAssessment result = service.score(
            new BookingFraudScoringService.FraudSignalInput(
                ORG, PROPERTY, "8.8.8.8", "alice@gmail.com", new BigDecimal("100.00"), "RU", "FR"));

        assertThat(result.reasons()).anyMatch(r -> r.contains("Pays IP"));
        assertThat(result.score()).isEqualTo(props.getCountryMismatchPoints());
    }

    @Test
    @DisplayName("Vélocité : EXPIRE posé uniquement à la première incrémentation")
    void whenFirstHit_thenExpireSet() {
        when(valueOps.increment(anyString())).thenReturn(1L);
        lenient().when(reservationRepository.averageTotalPriceByProperty(anyLong(), anyLong())).thenReturn(null);

        service.score(input("1.2.3.4", "alice@gmail.com", new BigDecimal("100.00")));

        // 1ère incrémentation (IP) ET (email) → EXPIRE appelé sur chaque clé.
        org.mockito.Mockito.verify(redisTemplate, org.mockito.Mockito.atLeastOnce())
            .expire(anyString(), any(Duration.class));
    }
}
