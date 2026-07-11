package com.clenzy.service;

import com.clenzy.dto.PaymentOrchestrationResult;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Intervention;
import com.clenzy.model.Invoice;
import com.clenzy.model.Reservation;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.InvoiceRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.util.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Envoi par email d'un lien de paiement Stripe pour une facture impayée —
 * action « Envoyer un lien de paiement » de la modale facture du feed
 * constellation (relances de paiement).
 *
 * <p>Volontairement SANS {@code @Transactional} de classe : la création de la
 * session de paiement (appel HTTP Stripe via l'orchestrateur) passe par le
 * proxy de {@link InvoicePaymentService} (sa propre transaction), puis l'email
 * part hors transaction (règle audit n°2 : pas d'appel externe en transaction).</p>
 */
@Service
public class InvoicePaymentLinkService {

    private static final Logger log = LoggerFactory.getLogger(InvoicePaymentLinkService.class);

    private final InvoicePaymentService invoicePaymentService;
    private final InvoiceRepository invoiceRepository;
    private final ReservationRepository reservationRepository;
    private final InterventionRepository interventionRepository;
    private final EmailService emailService;
    private final OrganizationAccessGuard organizationAccessGuard;

    public InvoicePaymentLinkService(InvoicePaymentService invoicePaymentService,
                                     InvoiceRepository invoiceRepository,
                                     ReservationRepository reservationRepository,
                                     InterventionRepository interventionRepository,
                                     EmailService emailService,
                                     OrganizationAccessGuard organizationAccessGuard) {
        this.invoicePaymentService = invoicePaymentService;
        this.invoiceRepository = invoiceRepository;
        this.reservationRepository = reservationRepository;
        this.interventionRepository = interventionRepository;
        this.emailService = emailService;
        this.organizationAccessGuard = organizationAccessGuard;
    }

    /**
     * Génère une session de paiement pour la facture et envoie le lien au client
     * concerné (voyageur de la réservation liée, sinon demandeur de l'intervention).
     *
     * @return l'adresse email destinataire (affichée en confirmation côté UI)
     * @throws NotFoundException     facture inconnue
     * @throws IllegalStateException destinataire non résolvable ou lien non généré
     */
    public String sendPaymentLink(Long invoiceId) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new NotFoundException("Facture introuvable : " + invoiceId));
        // findById contourne le filtre org (règle audit n°3) → garde explicite.
        organizationAccessGuard.requireSameOrganization(
                invoice.getOrganizationId(), "Facture hors de votre organisation");

        Recipient recipient = resolveRecipient(invoice);
        if (recipient == null) {
            throw new IllegalStateException(
                    "Aucun email client résolvable pour la facture " + invoice.getInvoiceNumber());
        }

        // Session Stripe via l'orchestrateur (mêmes gardes de statut que le
        // paiement direct : SENT / ISSUED / OVERDUE). URLs par défaut du provider.
        PaymentOrchestrationResult result = invoicePaymentService.payInvoice(invoiceId, null, null, null);
        String paymentUrl = result.isSuccess() && result.paymentResult() != null
                ? result.paymentResult().redirectUrl()
                : null;
        if (paymentUrl == null || paymentUrl.isBlank()) {
            throw new IllegalStateException(
                    "Lien de paiement non généré pour la facture " + invoice.getInvoiceNumber());
        }

        emailService.sendContactMessage(
                recipient.email(), recipient.name(), null, null,
                buildSubject(invoice),
                buildHtmlBody(invoice, recipient.name(), paymentUrl),
                List.of());

        log.info("Lien de paiement envoyé pour la facture {} à {}", invoice.getInvoiceNumber(),
                com.clenzy.util.PiiMasker.maskEmail(recipient.email()));
        return recipient.email();
    }

    private record Recipient(String email, String name) {}

    /**
     * Email du client : voyageur de la réservation liée, sinon demandeur de
     * l'intervention liée. (Même résolution que InvoiceReminderExecutor — 2ᵉ
     * occurrence, extraction différée à la 3ᵉ per règle DRY.)
     */
    private Recipient resolveRecipient(Invoice invoice) {
        if (invoice.getReservationId() != null) {
            Reservation reservation = reservationRepository.findById(invoice.getReservationId()).orElse(null);
            if (reservation != null
                    && invoice.getOrganizationId().equals(reservation.getOrganizationId())
                    && reservation.getGuest() != null
                    && reservation.getGuest().getEmail() != null
                    && !reservation.getGuest().getEmail().isBlank()) {
                return new Recipient(reservation.getGuest().getEmail(), reservation.getGuest().getFullName());
            }
        }
        if (invoice.getInterventionId() != null) {
            Intervention intervention = interventionRepository.findById(invoice.getInterventionId()).orElse(null);
            if (intervention != null
                    && invoice.getOrganizationId().equals(intervention.getOrganizationId())
                    && intervention.getRequestor() != null
                    && intervention.getRequestor().getEmail() != null
                    && !intervention.getRequestor().getEmail().isBlank()) {
                var requestor = intervention.getRequestor();
                String name = ((requestor.getFirstName() != null ? requestor.getFirstName() : "") + " "
                        + (requestor.getLastName() != null ? requestor.getLastName() : "")).trim();
                return new Recipient(requestor.getEmail(), name.isBlank() ? null : name);
            }
        }
        return null;
    }

    private static String buildSubject(Invoice invoice) {
        return "Paiement de la facture " + invoice.getInvoiceNumber() + " — lien de règlement";
    }

    private static String buildHtmlBody(Invoice invoice, String recipientName, String paymentUrl) {
        String name = StringUtils.escapeHtml(
                recipientName != null && !recipientName.isBlank() ? recipientName : "Madame, Monsieur");
        String number = StringUtils.escapeHtml(invoice.getInvoiceNumber());
        String amount = StringUtils.escapeHtml(
                invoice.getTotalTtc() != null ? invoice.getTotalTtc().toPlainString() : "-");
        String currency = StringUtils.escapeHtml(invoice.getCurrency() != null ? invoice.getCurrency() : "EUR");
        String seller = StringUtils.escapeHtml(invoice.getSellerName() != null ? invoice.getSellerName() : "");
        String url = StringUtils.escapeHtml(paymentUrl);

        return "<p>Bonjour " + name + ",</p>"
                + "<p>Vous pouvez régler la facture <strong>" + number + "</strong> d'un montant de "
                + "<strong>" + amount + " " + currency + "</strong> en toute sécurité via le lien ci-dessous :</p>"
                + "<p><a href=\"" + url + "\">Payer la facture " + number + "</a></p>"
                + "<p>Si le paiement a déjà été effectué, merci de ne pas tenir compte de ce message.</p>"
                + (seller.isBlank() ? "" : "<p>Cordialement,<br/>" + seller + "</p>");
    }
}
