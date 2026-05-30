package com.clenzy.controller;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminAttributionControllerTest {

    @Mock private EntityManager entityManager;

    private AdminAttributionController controller;

    @BeforeEach
    void setUp() throws Exception {
        controller = new AdminAttributionController();
        Field f = AdminAttributionController.class.getDeclaredField("entityManager");
        f.setAccessible(true);
        f.set(controller, entityManager);
    }

    @Test
    void bySource_returnsResults() {
        Query query = mock(Query.class);
        when(entityManager.createNativeQuery(org.mockito.ArgumentMatchers.contains("referral_source"))).thenReturn(query);
        when(query.getResultList()).thenReturn(List.of(
                new Object[]{"Google", 42L},
                new Object[]{"Friend", 17L}
        ));

        ResponseEntity<List<Map<String, Object>>> response = controller.getInscriptionsBySource();

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        List<Map<String, Object>> body = response.getBody();
        assertThat(body).hasSize(2);
        assertThat(body.get(0)).containsEntry("source", "Google");
        assertThat(body.get(0)).containsEntry("count", 42L);
    }

    @Test
    void bySource_empty() {
        Query query = mock(Query.class);
        when(entityManager.createNativeQuery(org.mockito.ArgumentMatchers.contains("referral_source"))).thenReturn(query);
        when(query.getResultList()).thenReturn(List.of());

        ResponseEntity<List<Map<String, Object>>> response = controller.getInscriptionsBySource();
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isEmpty();
    }

    @Test
    void byPromoCode_returnsResults() {
        Query query = mock(Query.class);
        when(entityManager.createNativeQuery(org.mockito.ArgumentMatchers.contains("promo_code"))).thenReturn(query);
        when(query.getResultList()).thenReturn(List.of(
                new Object[]{"SUMMER10", 100L},
                new Object[]{"WELCOME", 50L}
        ));

        ResponseEntity<List<Map<String, Object>>> response = controller.getInscriptionsByPromoCode();

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        List<Map<String, Object>> body = response.getBody();
        assertThat(body).hasSize(2);
        assertThat(body.get(0)).containsEntry("promoCode", "SUMMER10");
        assertThat(body.get(0)).containsEntry("count", 100L);
    }

    @Test
    void byPromoCode_empty() {
        Query query = mock(Query.class);
        when(entityManager.createNativeQuery(org.mockito.ArgumentMatchers.contains("promo_code"))).thenReturn(query);
        when(query.getResultList()).thenReturn(List.of());

        ResponseEntity<List<Map<String, Object>>> response = controller.getInscriptionsByPromoCode();
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isEmpty();
    }

    @Test
    void summary_returnsAggregations() {
        Query qTotal = mock(Query.class);
        when(qTotal.getSingleResult()).thenReturn((Number) 1000L);
        when(entityManager.createNativeQuery("SELECT COUNT(*) FROM users")).thenReturn(qTotal);

        Query qNewsletter = mock(Query.class);
        when(qNewsletter.getSingleResult()).thenReturn((Number) 250L);
        when(entityManager.createNativeQuery("SELECT COUNT(*) FROM users WHERE newsletter_opt_in = true"))
                .thenReturn(qNewsletter);

        Query qPromo = mock(Query.class);
        when(qPromo.getSingleResult()).thenReturn((Number) 130L);
        when(entityManager.createNativeQuery("SELECT COUNT(*) FROM users WHERE promo_code IS NOT NULL"))
                .thenReturn(qPromo);

        Query qReferral = mock(Query.class);
        when(qReferral.getSingleResult()).thenReturn((Number) 480L);
        when(entityManager.createNativeQuery("SELECT COUNT(*) FROM users WHERE referral_source IS NOT NULL"))
                .thenReturn(qReferral);

        ResponseEntity<Map<String, Object>> response = controller.getSummary();

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        Map<String, Object> body = response.getBody();
        assertThat(body).containsEntry("totalUsers", 1000L);
        assertThat(body).containsEntry("newsletterOptIns", 250L);
        assertThat(body).containsEntry("withPromoCode", 130L);
        assertThat(body).containsEntry("withReferralSource", 480L);
        assertThat(body).containsEntry("newsletterOptInRate", 25.0);
    }

    @Test
    void summary_whenZeroTotal_rateIsZero() {
        Query qTotal = mock(Query.class);
        when(qTotal.getSingleResult()).thenReturn((Number) 0L);
        when(entityManager.createNativeQuery("SELECT COUNT(*) FROM users")).thenReturn(qTotal);

        Query qOther = mock(Query.class);
        lenient().when(qOther.getSingleResult()).thenReturn((Number) 0L);
        when(entityManager.createNativeQuery("SELECT COUNT(*) FROM users WHERE newsletter_opt_in = true")).thenReturn(qOther);
        when(entityManager.createNativeQuery("SELECT COUNT(*) FROM users WHERE promo_code IS NOT NULL")).thenReturn(qOther);
        when(entityManager.createNativeQuery("SELECT COUNT(*) FROM users WHERE referral_source IS NOT NULL")).thenReturn(qOther);

        ResponseEntity<Map<String, Object>> response = controller.getSummary();
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        Map<String, Object> body = response.getBody();
        assertThat(body).containsEntry("totalUsers", 0L);
        assertThat(body).containsEntry("newsletterOptInRate", 0.0);
    }
}
