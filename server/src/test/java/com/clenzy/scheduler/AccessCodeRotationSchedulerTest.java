package com.clenzy.scheduler;

import com.clenzy.model.CheckInInstructions;
import com.clenzy.model.Intervention;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.CheckInInstructionsRepository;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.NotificationService;
import com.clenzy.service.access.AccessCodeGenerator;
import com.clenzy.service.agent.supervision.SupervisionActivityService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AccessCodeRotationSchedulerTest {

    @Mock private CheckInInstructionsRepository instructionsRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private InterventionRepository interventionRepository;
    @Mock private NotificationService notificationService;
    @Mock private SupervisionActivityService supervisionActivityService;
    private final AccessCodeGenerator generator = new AccessCodeGenerator();
    private AccessCodeRotationScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new AccessCodeRotationScheduler(
            instructionsRepository, reservationRepository, interventionRepository, generator,
            notificationService, supervisionActivityService);
    }

    private CheckInInstructions autoRotateInstructions() {
        Property p = new Property();
        p.setId(10L);
        p.setName("Studio");
        p.setTimezone("Europe/Paris");
        CheckInInstructions ci = new CheckInInstructions(p, 1L);
        ci.setAccessCode("4827");
        ci.setAccessCodeAutoRotate(true);
        ci.setAccessCodeFormat("{\"pattern\":[\"digits\",\"digits\",\"digits\",\"digits\"]}");
        return ci;
    }

    private Reservation checkoutYesterday(Property p) {
        Reservation r = new Reservation();
        r.setProperty(p);
        r.setOrganizationId(1L);
        r.setStatus("confirmed");
        r.setCheckOut(LocalDate.now().minusDays(1));
        r.setCheckOutTime("11:00");
        return r;
    }

    private Intervention visit(long id, String type) {
        Intervention i = new Intervention();
        i.setId(id);
        i.setType(type);
        return i;
    }

    @Test
    void rotatesCodeAfterPastCheckout() {
        CheckInInstructions ci = autoRotateInstructions();
        when(instructionsRepository.findAutoRotateWithProperty()).thenReturn(List.of(ci));
        when(reservationRepository.findRecentCheckoutsByProperty(eq(10L), any(), any(), eq(1L)))
            .thenReturn(List.of(checkoutYesterday(ci.getProperty())));

        scheduler.rotateAfterCheckout();

        assertThat(ci.getAccessCode()).hasSize(4).matches("\\d{4}");
        assertThat(ci.getAccessCodeRotatedAt()).isNotNull();
        verify(instructionsRepository).save(ci);
        // La notification porte le logement — son nom pour l'afficher, son
        // identifiant pour que la fiche aille lire le code EN VIGUEUR — et
        // surtout PAS le code lui-meme, qui reste dans le corps du message.
        // Aucune visite n'etant prevue, aucune n'est nommee : un fait absent
        // vaut mieux qu'un identifiant invente.
        // `containsExactly` : ce qui compte ici est autant ce qui est absent.
        ArgumentCaptor<Map<String, Object>> facts = ArgumentCaptor.forClass(Map.class);
        verify(notificationService).notifyAdminsAndManagersByOrgId(
            eq(1L), eq(NotificationKey.ACCESS_CODE_ROTATED), anyString(), anyString(), anyString(),
            facts.capture());
        assertThat(facts.getValue()).containsExactly(
            Map.entry("property", ci.getProperty().getName()),
            Map.entry("propertyId", ci.getProperty().getId()));
    }

    @Test
    void namesTheCleaningThatWillUseTheNewCode() {
        // C'est POUR le menage que le code tourne au depart du voyageur : meme
        // quand une autre mission est prevue plus tot, c'est lui qui trouvera
        // la boite a cles, et lui que la fiche doit nommer.
        CheckInInstructions ci = autoRotateInstructions();
        when(instructionsRepository.findAutoRotateWithProperty()).thenReturn(List.of(ci));
        when(reservationRepository.findRecentCheckoutsByProperty(eq(10L), any(), any(), eq(1L)))
            .thenReturn(List.of(checkoutYesterday(ci.getProperty())));
        when(interventionRepository.findUpcomingByProperty(eq(10L), any(), eq(1L), any(Pageable.class)))
            .thenReturn(List.of(visit(77L, "PLUMBING_REPAIR"), visit(412L, "DEEP_CLEANING")));

        scheduler.rotateAfterCheckout();

        ArgumentCaptor<Map<String, Object>> facts = ArgumentCaptor.forClass(Map.class);
        verify(notificationService).notifyAdminsAndManagersByOrgId(
            eq(1L), eq(NotificationKey.ACCESS_CODE_ROTATED), anyString(), anyString(), anyString(),
            facts.capture());
        assertThat(facts.getValue()).containsEntry("interventionId", 412L);
    }

    @Test
    void namesTheFirstVisitWhenNoCleaningIsPlanned() {
        // A defaut de menage, la premiere visite prevue : quelle qu'elle soit,
        // c'est elle qui se servira du code.
        CheckInInstructions ci = autoRotateInstructions();
        when(instructionsRepository.findAutoRotateWithProperty()).thenReturn(List.of(ci));
        when(reservationRepository.findRecentCheckoutsByProperty(eq(10L), any(), any(), eq(1L)))
            .thenReturn(List.of(checkoutYesterday(ci.getProperty())));
        when(interventionRepository.findUpcomingByProperty(eq(10L), any(), eq(1L), any(Pageable.class)))
            .thenReturn(List.of(visit(88L, "INSPECTION"), visit(91L, "GARDENING")));

        scheduler.rotateAfterCheckout();

        ArgumentCaptor<Map<String, Object>> facts = ArgumentCaptor.forClass(Map.class);
        verify(notificationService).notifyAdminsAndManagersByOrgId(
            eq(1L), eq(NotificationKey.ACCESS_CODE_ROTATED), anyString(), anyString(), anyString(),
            facts.capture());
        assertThat(facts.getValue()).containsEntry("interventionId", 88L);
    }

    @Test
    void rotatesAnywayWhenTheVisitCannotBeResolved() {
        // Le code est deja tourne et sauvegarde : une resolution impossible ne
        // doit pas faire perdre la notification, seulement le fait.
        CheckInInstructions ci = autoRotateInstructions();
        when(instructionsRepository.findAutoRotateWithProperty()).thenReturn(List.of(ci));
        when(reservationRepository.findRecentCheckoutsByProperty(eq(10L), any(), any(), eq(1L)))
            .thenReturn(List.of(checkoutYesterday(ci.getProperty())));
        when(interventionRepository.findUpcomingByProperty(eq(10L), any(), eq(1L), any(Pageable.class)))
            .thenThrow(new IllegalStateException("indisponible"));

        scheduler.rotateAfterCheckout();

        ArgumentCaptor<Map<String, Object>> facts = ArgumentCaptor.forClass(Map.class);
        verify(notificationService).notifyAdminsAndManagersByOrgId(
            eq(1L), eq(NotificationKey.ACCESS_CODE_ROTATED), anyString(), anyString(), anyString(),
            facts.capture());
        assertThat(facts.getValue()).doesNotContainKey("interventionId");
        verify(instructionsRepository).save(ci);
    }

    @Test
    void doesNotRotateWhenAlreadyRotatedAfterCheckout() {
        CheckInInstructions ci = autoRotateInstructions();
        ci.setAccessCodeRotatedAt(LocalDateTime.now()); // déjà tourné après le départ d'hier
        when(instructionsRepository.findAutoRotateWithProperty()).thenReturn(List.of(ci));
        when(reservationRepository.findRecentCheckoutsByProperty(eq(10L), any(), any(), eq(1L)))
            .thenReturn(List.of(checkoutYesterday(ci.getProperty())));

        scheduler.rotateAfterCheckout();

        assertThat(ci.getAccessCode()).isEqualTo("4827");
        verify(instructionsRepository, never()).save(any());
        verify(notificationService, never()).notifyAdminsAndManagersByOrgId(
            any(), any(), any(), any(), any(), any());
    }

    @Test
    void doesNothingWhenNoAutoRotateProperties() {
        when(instructionsRepository.findAutoRotateWithProperty()).thenReturn(List.of());
        scheduler.rotateAfterCheckout();
        verify(instructionsRepository, never()).save(any());
    }
}
