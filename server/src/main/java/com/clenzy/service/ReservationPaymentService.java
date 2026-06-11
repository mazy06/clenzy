package com.clenzy.service;

import com.clenzy.model.MessageChannelType;
import com.clenzy.model.MessageTemplate;
import com.clenzy.model.MessageTemplateType;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.Reservation;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.MessageTemplateRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.messaging.GuestMessagingService;
import com.clenzy.tenant.TenantContext;
import com.clenzy.util.StringUtils;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Lien de paiement et verification de paiement Stripe d'une reservation.
 *
 * <p>Logique deplacee de ReservationController (T-ARCH-01) : le controller ne
 * garde que validation d'acces + mapping DTO. PAS de @Transactional ici : les
 * methodes font des appels HTTP externes (Stripe, email) — chaque save()
 * repository ouvre sa propre transaction courte, comme avant le refactor.</p>
 */
@Service
public class ReservationPaymentService {

    private static final Logger log = LoggerFactory.getLogger(ReservationPaymentService.class);

    private final ReservationRepository reservationRepository;
    private final StripeService stripeService;
    private final StripeGateway stripeGateway;
    private final EmailService emailService;
    private final GuestMessagingService guestMessagingService;
    private final MessageTemplateRepository messageTemplateRepository;
    private final TenantContext tenantContext;

    public ReservationPaymentService(ReservationRepository reservationRepository,
                                     StripeService stripeService,
                                     StripeGateway stripeGateway,
                                     EmailService emailService,
                                     GuestMessagingService guestMessagingService,
                                     MessageTemplateRepository messageTemplateRepository,
                                     TenantContext tenantContext) {
        this.reservationRepository = reservationRepository;
        this.stripeService = stripeService;
        this.stripeGateway = stripeGateway;
        this.emailService = emailService;
        this.guestMessagingService = guestMessagingService;
        this.messageTemplateRepository = messageTemplateRepository;
        this.tenantContext = tenantContext;
    }

    /**
     * Cree une session Stripe Checkout pour le montant de la reservation et
     * envoie le lien par email au guest (template PAYMENT_LINK si configure,
     * sinon email de repli). Met a jour le tracking sur la reservation.
     *
     * @param reservation    reservation deja chargee (fetch-all) et dont l'acces a ete valide
     * @param requestedEmail adresse de destination optionnelle (repli : email du guest)
     * @return la reservation rechargee avec toutes ses relations
     * @throws IllegalArgumentException si aucune adresse email ou montant invalide
     */
    public Reservation sendPaymentLink(Reservation reservation, String requestedEmail) {
        String email = resolveRecipientEmail(reservation, requestedEmail);

        BigDecimal amount = reservation.getTotalPrice();
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Le montant de la reservation doit etre superieur a 0");
        }

        try {
            // Create Stripe checkout session for the reservation
            Session session = stripeService.createReservationCheckoutSession(
                    reservation.getId(), amount, email, reservation.getGuestName(),
                    reservation.getProperty().getName());

            String paymentUrl = session.getUrl();
            Long orgId = tenantContext.getRequiredOrganizationId();

            // Try to use a PAYMENT_LINK messaging template if one is configured
            List<MessageTemplate> paymentTemplates = messageTemplateRepository
                    .findByOrganizationIdAndTypeAndIsActiveTrue(orgId, MessageTemplateType.PAYMENT_LINK);

            if (!paymentTemplates.isEmpty()) {
                // Use the first active PAYMENT_LINK template via GuestMessagingService
                MessageTemplate template = paymentTemplates.get(0);
                String currency = reservation.getCurrency() != null ? reservation.getCurrency() : "EUR";
                String paymentButton = "<a href=\"" + paymentUrl
                        + "\" style=\"background-color: #6B8A9A; color: white; padding: 12px 30px; "
                        + "text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;\">"
                        + "Payer maintenant</a>";

                Map<String, String> extraVars = Map.of(
                        "paymentLink", paymentButton,
                        "paymentAmount", amount.toPlainString(),
                        "paymentCurrency", currency
                );

                guestMessagingService.sendForReservationViaChannel(
                        reservation, template, orgId, MessageChannelType.EMAIL, extraVars);
            } else {
                // Fallback: send hardcoded email if no template is configured
                String subject = "Lien de paiement - Reservation " + reservation.getProperty().getName();
                String htmlBody = buildPaymentEmailBody(
                        reservation.getGuestName(), reservation.getProperty().getName(),
                        reservation.getCheckIn().toString(), reservation.getCheckOut().toString(),
                        amount.toPlainString(), reservation.getCurrency(), paymentUrl);

                emailService.sendSimpleHtmlEmail(email, subject, htmlBody);
            }

            // Update reservation tracking
            reservation.setPaymentLinkSentAt(LocalDateTime.now());
            reservation.setPaymentLinkEmail(email);
            reservation.setStripeSessionId(session.getId());
            reservationRepository.save(reservation);

            // Re-load with all relations
            return reservationRepository.findByIdFetchAll(reservation.getId()).orElse(reservation);

        } catch (Exception e) {
            throw new RuntimeException("Erreur lors de l'envoi du lien de paiement: " + e.getMessage(), e);
        }
    }

    /**
     * Verifie directement aupres de Stripe (via StripeGateway, sans mutation de
     * l'etat statique Stripe.apiKey) si le paiement a ete effectue. Utile quand
     * le webhook n'a pas ete recu (dev, timeout, etc.).
     *
     * @param reservation reservation deja chargee et dont l'acces a ete valide
     * @return corps de reponse (paymentStatus / message / paidAt)
     */
    public Map<String, String> checkPaymentStatus(Reservation reservation) throws StripeException {
        // Already paid?
        if (reservation.getPaymentStatus() == PaymentStatus.PAID) {
            return Map.of(
                    "paymentStatus", "PAID",
                    "paidAt", reservation.getPaidAt() != null ? reservation.getPaidAt().toString() : "",
                    "message", "Paiement deja confirme"
            );
        }

        String sessionId = reservation.getStripeSessionId();
        if (sessionId == null || sessionId.isBlank()) {
            return Map.of(
                    "paymentStatus", "NO_SESSION",
                    "message", "Aucune session de paiement Stripe associee"
            );
        }

        Session stripeSession = stripeGateway.retrieveSession(sessionId);
        String stripePaymentStatus = stripeSession.getPaymentStatus();

        log.info("Check payment reservation {}: Stripe session {} paymentStatus={}",
                reservation.getId(), sessionId, stripePaymentStatus);

        if ("paid".equals(stripePaymentStatus)) {
            // Webhook missed — confirm manually via the same service method
            stripeService.confirmReservationPayment(sessionId);

            // Reload
            Reservation reloaded = reservationRepository.findByIdFetchAll(reservation.getId())
                    .orElse(reservation);
            return Map.of(
                    "paymentStatus", "PAID",
                    "paidAt", reloaded.getPaidAt() != null ? reloaded.getPaidAt().toString() : "",
                    "message", "Paiement confirme (webhook rattrape)"
            );
        }

        return Map.of(
                "paymentStatus", stripePaymentStatus != null ? stripePaymentStatus.toUpperCase() : "UNKNOWN",
                "message", "Paiement non encore confirme sur Stripe"
        );
    }

    private String resolveRecipientEmail(Reservation reservation, String requestedEmail) {
        if (requestedEmail != null && !requestedEmail.isBlank()) {
            return requestedEmail;
        }
        if (reservation.getGuest() != null && reservation.getGuest().getEmail() != null) {
            return reservation.getGuest().getEmail();
        }
        throw new IllegalArgumentException("Aucune adresse email disponible pour ce guest");
    }

    private String buildPaymentEmailBody(String guestName, String propertyName,
                                         String checkIn, String checkOut,
                                         String amount, String currency, String paymentUrl) {
        return """
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #6B8A9A;">Lien de paiement</h2>
                <p>Bonjour %s,</p>
                <p>Veuillez trouver ci-dessous le lien pour proceder au paiement de votre reservation :</p>
                <table style="width: 100%%; border-collapse: collapse; margin: 20px 0;">
                    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Logement</strong></td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">%s</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Check-in</strong></td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">%s</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Check-out</strong></td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">%s</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Montant</strong></td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">%s %s</td></tr>
                </table>
                <p style="text-align: center; margin: 30px 0;">
                    <a href="%s" style="background-color: #6B8A9A; color: white; padding: 12px 30px;
                       text-decoration: none; border-radius: 6px; font-weight: bold;">
                       Payer maintenant
                    </a>
                </p>
                <p style="color: #888; font-size: 12px;">
                    Ce lien est securise et vous redirigera vers la plateforme de paiement Stripe.
                </p>
            </div>
            """.formatted(StringUtils.escapeHtml(guestName), StringUtils.escapeHtml(propertyName),
                    checkIn, checkOut, amount, StringUtils.escapeHtml(currency), paymentUrl);
    }
}
