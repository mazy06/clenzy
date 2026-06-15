package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.model.NoiseAlert.AlertSeverity;
import com.clenzy.model.NoiseAlert.AlertSource;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.WhatsAppConfigRepository;
import com.clenzy.service.messaging.SystemEmailTemplateService;
import com.clenzy.service.messaging.TemplateInterpolationService;
import com.clenzy.service.messaging.TranslationService;
import com.clenzy.service.messaging.whatsapp.WhatsAppProvider;
import com.clenzy.service.messaging.whatsapp.WhatsAppProviderResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NoiseAlertNotificationServiceTest {

    @Mock private NotificationService notificationService;
    @Mock private EmailService emailService;
    @Mock private PropertyRepository propertyRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private SystemEmailTemplateService systemEmailTemplateService;
    @Mock private WhatsAppProviderResolver whatsAppProviderResolver;
    @Mock private WhatsAppConfigRepository whatsAppConfigRepository;
    @Mock private WhatsAppProvider whatsAppProvider;

    // Pas un mock — service pur sans IO, on l'instancie avec un TranslationService
    // mock car on n'invoque pas interpolateAndTranslate dans NoiseAlert flow.
    private TemplateInterpolationService templateInterpolationService;

    @InjectMocks
    private NoiseAlertNotificationService service;

    private NoiseAlert alert;
    private NoiseAlertConfig config;
    private Property property;
    private User owner;
    private WhatsAppConfig whatsAppConfig;

    @BeforeEach
    void setUp() {
        // Construit le service manuellement pour pouvoir injecter le vrai
        // TemplateInterpolationService (pas mockable proprement) en plus des mocks.
        // On contourne @InjectMocks pour ce service.
        templateInterpolationService = new TemplateInterpolationService(org.mockito.Mockito.mock(TranslationService.class));
        service = new NoiseAlertNotificationService(
            notificationService, emailService, propertyRepository, reservationRepository,
            systemEmailTemplateService, templateInterpolationService,
            new com.clenzy.service.messaging.EmailWrapperService(),
            whatsAppProviderResolver, whatsAppConfigRepository);

        // Config WhatsApp active par defaut (lenient — seuls les tests guest-message
        // l'utilisent). Re-stubbable a Optional.empty() pour le cas "non configure".
        whatsAppConfig = new WhatsAppConfig();
        whatsAppConfig.setEnabled(true);
        org.mockito.Mockito.lenient().when(whatsAppConfigRepository.findByOrganizationId(10L))
            .thenReturn(Optional.of(whatsAppConfig));
        org.mockito.Mockito.lenient().when(whatsAppProviderResolver.resolve(any()))
            .thenReturn(whatsAppProvider);

        // Stub default : retourne un template systeme minimal avec le subject+body
        // necessaires pour interpoler. Tests sont lenient car certains n'appellent
        // pas dispatchEmail/dispatchGuestMessage.
        SystemEmailTemplate ownerTpl = new SystemEmailTemplate();
        ownerTpl.setTemplateKey("noise_alert_owner");
        ownerTpl.setLanguage("fr");
        ownerTpl.setSubject("[Baitly] Alerte bruit {severityLabel} — {propertyName}");
        ownerTpl.setBody("<p>{propertyName} {measuredDb}/{thresholdDb} dB</p>");
        ownerTpl.setSystem(true);

        SystemEmailTemplate guestTpl = new SystemEmailTemplate();
        guestTpl.setTemplateKey("noise_alert_guest");
        guestTpl.setLanguage("fr");
        guestTpl.setSubject("Information importante concernant le bruit — {propertyName}");
        guestTpl.setBody("<p>Bonjour {guestName}, le logement {propertyName} ...</p>");
        guestTpl.setSystem(true);

        org.mockito.Mockito.lenient().when(systemEmailTemplateService.resolve(any(), eq("noise_alert_owner"), any()))
            .thenReturn(Optional.of(ownerTpl));
        org.mockito.Mockito.lenient().when(systemEmailTemplateService.resolve(any(), eq("noise_alert_guest"), any()))
            .thenReturn(Optional.of(guestTpl));

        owner = new User();
        owner.setKeycloakId("owner-kc-id");
        owner.setEmail("owner@example.com");

        property = new Property();
        property.setId(100L);
        property.setName("Studio Paris");
        property.setOwner(owner);

        alert = new NoiseAlert();
        alert.setId(1L);
        alert.setOrganizationId(10L);
        alert.setPropertyId(100L);
        alert.setDeviceId(5L);
        alert.setSeverity(AlertSeverity.WARNING);
        alert.setMeasuredDb(75.0);
        alert.setThresholdDb(70);
        alert.setTimeWindowLabel("Jour");
        alert.setSource(AlertSource.WEBHOOK);

        config = new NoiseAlertConfig();
        config.setNotifyInApp(true);
        config.setNotifyEmail(true);
        config.setNotifyGuestMessage(false);
    }

    @Test
    void whenNotifyInAppEnabled_thenSendsInAppNotification() {
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));

        service.dispatch(alert, config);

        verify(notificationService).send(
            eq("owner-kc-id"),
            eq(NotificationKey.NOISE_ALERT_WARNING),
            contains("Studio Paris"),
            contains("75 dB"),
            contains("/connected-objects/property/")
        );
        assertTrue(alert.isNotifiedInApp());
    }

    @Test
    void whenCriticalAlert_thenUsesCriticalNotificationKey() {
        alert.setSeverity(AlertSeverity.CRITICAL);
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));

        service.dispatch(alert, config);

        verify(notificationService).send(
            eq("owner-kc-id"),
            eq(NotificationKey.NOISE_ALERT_CRITICAL),
            contains("critique"),
            anyString(),
            contains("/connected-objects/property/")
        );
    }

    @Test
    void whenNotifyEmailEnabled_thenSendsEmail() {
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));

        service.dispatch(alert, config);

        verify(emailService).sendContactMessage(
            eq("owner@example.com"),
            isNull(),
            isNull(),
            isNull(),
            contains("Studio Paris"),
            contains("75"),
            anyList()
        );
        assertTrue(alert.isNotifiedEmail());
    }

    @Test
    void whenGuestMessageEnabled_andActiveReservation_thenSendsGuestEmail() {
        config.setNotifyGuestMessage(true);
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));

        Guest guest = new Guest();
        guest.setFirstName("Marie");
        guest.setLastName("Martin");
        guest.setEmail("marie@guest.com");

        Reservation reservation = new Reservation();
        reservation.setId(50L);
        reservation.setGuest(guest);

        when(reservationRepository.findActiveByPropertyIdAndDate(eq(100L), any(LocalDate.class), eq(10L)))
            .thenReturn(Optional.of(reservation));

        service.dispatch(alert, config);

        verify(emailService).sendContactMessage(
            eq("marie@guest.com"),
            eq("Marie Martin"),
            isNull(),
            isNull(),
            contains("bruit"),
            contains("Studio Paris"),
            anyList()
        );
        assertTrue(alert.isNotifiedGuest());
    }

    @Test
    void whenGuestMessageEnabled_butNoActiveReservation_thenNoGuestMessage() {
        config.setNotifyGuestMessage(true);
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
        when(reservationRepository.findActiveByPropertyIdAndDate(eq(100L), any(LocalDate.class), eq(10L)))
            .thenReturn(Optional.empty());

        service.dispatch(alert, config);

        assertFalse(alert.isNotifiedGuest());
        // Email to owner should still work
        verify(emailService).sendContactMessage(
            eq("owner@example.com"),
            isNull(), isNull(), isNull(),
            anyString(), anyString(), anyList()
        );
    }

    @Test
    void whenNotifyInAppDisabled_thenSkipsInApp() {
        config.setNotifyInApp(false);
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));

        service.dispatch(alert, config);

        verifyNoInteractions(notificationService);
        assertFalse(alert.isNotifiedInApp());
    }

    @Test
    void whenGuestMessageEnabled_andGuestHasPhone_thenSendsWhatsApp() {
        config.setNotifyInApp(false);
        config.setNotifyEmail(false);
        config.setNotifyGuestMessage(true);
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));

        Guest guest = new Guest();
        guest.setFirstName("Marie");
        guest.setLastName("Martin");
        guest.setPhone("+33612345678");

        Reservation reservation = new Reservation();
        reservation.setId(50L);
        reservation.setGuest(guest);

        when(reservationRepository.findActiveByPropertyIdAndDate(eq(100L), any(LocalDate.class), eq(10L)))
            .thenReturn(Optional.of(reservation));

        service.dispatch(alert, config);

        verify(whatsAppProvider).sendTemplateMessage(
            any(WhatsAppConfig.class), eq("+33612345678"), eq("clenzy_noise_alert_v1"), anyString(), anyList());
        verify(whatsAppProvider, never()).sendTextMessage(any(), anyString(), anyString());
        assertTrue(alert.isNotifiedWhatsapp());
    }

    @Test
    void whenGuestHasNoPhone_thenNoWhatsApp() {
        config.setNotifyInApp(false);
        config.setNotifyEmail(false);
        config.setNotifyGuestMessage(true);
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));

        Guest guest = new Guest();
        guest.setFirstName("Marie");

        Reservation reservation = new Reservation();
        reservation.setGuest(guest);

        when(reservationRepository.findActiveByPropertyIdAndDate(eq(100L), any(LocalDate.class), eq(10L)))
            .thenReturn(Optional.of(reservation));

        service.dispatch(alert, config);

        verify(whatsAppProvider, never()).sendTemplateMessage(any(), anyString(), anyString(), anyString(), anyList());
    }

    @Test
    void whenWhatsAppNotConfigured_thenSkippedGracefully() {
        // Aucune config WhatsApp pour l'org : l'envoi est ignore sans bloquer.
        config.setNotifyInApp(false);
        config.setNotifyEmail(false);
        config.setNotifyGuestMessage(true);
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
        when(whatsAppConfigRepository.findByOrganizationId(10L)).thenReturn(Optional.empty());

        Guest guest = new Guest();
        guest.setFirstName("Marie");
        guest.setPhone("+33612345678");

        Reservation reservation = new Reservation();
        reservation.setId(50L);
        reservation.setGuest(guest);

        when(reservationRepository.findActiveByPropertyIdAndDate(eq(100L), any(LocalDate.class), eq(10L)))
            .thenReturn(Optional.of(reservation));

        // Ne doit pas lever : WhatsApp est simplement ignore.
        service.dispatch(alert, config);

        verify(whatsAppProvider, never()).sendTemplateMessage(any(), anyString(), anyString(), anyString(), anyList());
        verify(whatsAppProvider, never()).sendTextMessage(any(), anyString(), anyString());
        assertFalse(alert.isNotifiedWhatsapp());
    }

    @Test
    void whenProviderDoesNotSupportTemplates_thenFallsBackToText() {
        config.setNotifyInApp(false);
        config.setNotifyEmail(false);
        config.setNotifyGuestMessage(true);
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));

        Guest guest = new Guest();
        guest.setFirstName("Marie");
        guest.setPhone("+33612345678");

        Reservation reservation = new Reservation();
        reservation.setId(50L);
        reservation.setGuest(guest);

        when(reservationRepository.findActiveByPropertyIdAndDate(eq(100L), any(LocalDate.class), eq(10L)))
            .thenReturn(Optional.of(reservation));
        // Provider type OpenWA : les templates Meta ne sont pas supportes -> fallback texte.
        when(whatsAppProvider.sendTemplateMessage(any(), anyString(), anyString(), anyString(), anyList()))
            .thenThrow(new UnsupportedOperationException("OpenWA"));

        service.dispatch(alert, config);

        verify(whatsAppProvider).sendTextMessage(any(), eq("+33612345678"), anyString());
        assertTrue(alert.isNotifiedWhatsapp());
    }
}
