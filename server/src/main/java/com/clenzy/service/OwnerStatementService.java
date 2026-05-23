package com.clenzy.service;

import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.model.User;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.util.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

/**
 * Service de generation et envoi de releves de reversement aux proprietaires.
 *
 * <p>Le releve est un email HTML auto-portant (pas de piece jointe) qui resume
 * les reversements effectues sur une periode pour un proprietaire donne.</p>
 *
 * <p>C'est un differenciateur cle de Clenzy pour les conciergeries : leurs
 * proprietaires recoivent un rapport mensuel transparent et professionnel,
 * sans que la conciergerie ait a le construire manuellement.</p>
 */
@Service
public class OwnerStatementService {

    private static final Logger log = LoggerFactory.getLogger(OwnerStatementService.class);

    /** Locale FR par defaut. Les conciergeries cibles sont francaises. */
    private static final Locale FR = Locale.FRANCE;

    private static final DateTimeFormatter LONG_DATE = DateTimeFormatter.ofPattern("d MMMM yyyy", FR);
    private static final DateTimeFormatter SHORT_DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy", FR);

    private final OwnerPayoutRepository payoutRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;

    public OwnerStatementService(OwnerPayoutRepository payoutRepository,
                                  UserRepository userRepository,
                                  EmailService emailService) {
        this.payoutRepository = payoutRepository;
        this.userRepository = userRepository;
        this.emailService = emailService;
    }

    /**
     * Envoie un releve de reversement au proprietaire pour la periode demandee.
     *
     * @param ownerId        ID du proprietaire (User)
     * @param orgId          Organisation
     * @param from           Debut de la periode (inclus)
     * @param to             Fin de la periode (inclus)
     * @param conciergerieName Nom de l'organisation (a inclure dans la signature)
     * @return resume des donnees envoyees pour confirmation API
     */
    @Transactional(readOnly = true)
    public OwnerStatementResult sendStatement(Long ownerId, Long orgId,
                                                LocalDate from, LocalDate to,
                                                String conciergerieName) {
        User owner = userRepository.findById(ownerId)
            .orElseThrow(() -> new IllegalArgumentException("Proprietaire introuvable : " + ownerId));
        String email = owner.getEmail();
        if (email == null || email.isBlank()) {
            throw new IllegalStateException("Le proprietaire " + ownerId + " n'a pas d'email renseigne");
        }

        // On envoie un releve uniquement sur les reversements VERSES (PAID).
        // Inclure PENDING/APPROVED creerait de la confusion ("je n'ai pas recu ce montant").
        List<OwnerPayout> payouts = payoutRepository.findByOwnerId(ownerId, orgId).stream()
            .filter(p -> p.getStatus() == PayoutStatus.PAID)
            .filter(p -> !p.getPeriodEnd().isBefore(from) && !p.getPeriodStart().isAfter(to))
            .sorted((a, b) -> b.getPeriodEnd().compareTo(a.getPeriodEnd()))
            .toList();

        BigDecimal totalPaid = payouts.stream()
            .map(OwnerPayout::getNetAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .setScale(2, RoundingMode.HALF_UP);

        BigDecimal totalGross = payouts.stream()
            .map(OwnerPayout::getGrossRevenue)
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .setScale(2, RoundingMode.HALF_UP);

        BigDecimal totalCommission = payouts.stream()
            .map(OwnerPayout::getCommissionAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .setScale(2, RoundingMode.HALF_UP);

        BigDecimal totalExpenses = payouts.stream()
            .map(OwnerPayout::getExpenses)
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .setScale(2, RoundingMode.HALF_UP);

        String ownerName = StringUtils.escapeHtml(
            (owner.getFirstName() != null ? owner.getFirstName() : "") + " "
            + (owner.getLastName() != null ? owner.getLastName() : "")
        ).trim();
        if (ownerName.isEmpty()) ownerName = "Proprietaire";

        String safeConciergerieName = StringUtils.escapeHtml(
            conciergerieName != null && !conciergerieName.isBlank() ? conciergerieName : "Votre conciergerie"
        );

        String subject = String.format(FR,
            "Releve de reversements — %s au %s",
            from.format(SHORT_DATE), to.format(SHORT_DATE));

        String html = buildHtml(ownerName, safeConciergerieName, from, to,
            payouts, totalPaid, totalGross, totalCommission, totalExpenses);

        emailService.sendSimpleHtmlEmail(email, subject, html);

        log.info("Owner statement sent: ownerId={}, orgId={}, period={}-{}, payouts={}, totalPaid={}",
            ownerId, orgId, from, to, payouts.size(), totalPaid);

        return new OwnerStatementResult(
            email, ownerName, payouts.size(), totalPaid, totalGross, totalCommission, totalExpenses
        );
    }

    private String buildHtml(String ownerName, String conciergerieName,
                              LocalDate from, LocalDate to,
                              List<OwnerPayout> payouts,
                              BigDecimal totalPaid, BigDecimal totalGross,
                              BigDecimal totalCommission, BigDecimal totalExpenses) {
        StringBuilder rows = new StringBuilder();
        if (payouts.isEmpty()) {
            rows.append("<tr><td colspan='5' style='padding:18px;text-align:center;color:#718096;'>")
                .append("Aucun reversement effectue sur la periode.")
                .append("</td></tr>");
        } else {
            for (OwnerPayout p : payouts) {
                rows.append("<tr style='border-top:1px solid #E2E8F0;'>")
                    .append("<td style='padding:10px 8px;font-size:13px;color:#2D3748;'>")
                    .append(p.getPeriodStart().format(SHORT_DATE)).append(" → ").append(p.getPeriodEnd().format(SHORT_DATE))
                    .append("</td>")
                    .append("<td style='padding:10px 8px;font-size:13px;color:#4A5568;text-align:right;font-variant-numeric:tabular-nums;'>")
                    .append(formatAmount(p.getGrossRevenue())).append(" €")
                    .append("</td>")
                    .append("<td style='padding:10px 8px;font-size:13px;color:#4A5568;text-align:right;font-variant-numeric:tabular-nums;'>")
                    .append("-").append(formatAmount(p.getCommissionAmount())).append(" €")
                    .append("</td>")
                    .append("<td style='padding:10px 8px;font-size:13px;color:#4A5568;text-align:right;font-variant-numeric:tabular-nums;'>")
                    .append(p.getExpenses() != null && p.getExpenses().signum() > 0
                        ? "-" + formatAmount(p.getExpenses()) + " €"
                        : "—")
                    .append("</td>")
                    .append("<td style='padding:10px 8px;font-size:13px;color:#2D3748;font-weight:600;text-align:right;font-variant-numeric:tabular-nums;'>")
                    .append(formatAmount(p.getNetAmount())).append(" €")
                    .append("</td>")
                    .append("</tr>");
            }
        }

        return ""
            + "<!DOCTYPE html>"
            + "<html lang='fr'><head><meta charset='UTF-8'></head>"
            + "<body style='margin:0;padding:0;background:#F7FAFC;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;color:#2D3748;'>"
            + "<table width='100%' cellpadding='0' cellspacing='0' style='background:#F7FAFC;padding:32px 16px;'>"
            +   "<tr><td align='center'>"
            +     "<table width='600' cellpadding='0' cellspacing='0' style='background:white;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(15,23,42,0.06);'>"
            +       "<tr><td style='background:#6B8A9A;padding:24px 32px;'>"
            +         "<div style='color:white;font-size:22px;font-weight:700;letter-spacing:-0.01em;'>Releve de reversements</div>"
            +         "<div style='color:#D6E2E8;font-size:13px;margin-top:6px;'>" + from.format(LONG_DATE) + " — " + to.format(LONG_DATE) + "</div>"
            +       "</td></tr>"
            +       "<tr><td style='padding:28px 32px 8px 32px;'>"
            +         "<p style='font-size:15px;color:#2D3748;margin:0 0 12px 0;'>Bonjour " + ownerName + ",</p>"
            +         "<p style='font-size:14px;line-height:1.6;color:#4A5568;margin:0 0 18px 0;'>"
            +           "Voici le recapitulatif des reversements effectues par <strong>" + conciergerieName + "</strong> sur la periode du "
            +           from.format(LONG_DATE) + " au " + to.format(LONG_DATE) + "."
            +         "</p>"
            +       "</td></tr>"
            +       "<tr><td style='padding:0 32px 8px 32px;'>"
            +         "<table width='100%' cellpadding='0' cellspacing='0' style='background:#F7FAFC;border-radius:6px;padding:16px;'>"
            +           "<tr>"
            +             "<td style='padding:12px;'>"
            +               "<div style='font-size:11px;color:#718096;text-transform:uppercase;letter-spacing:0.06em;'>Total verse</div>"
            +               "<div style='font-size:26px;font-weight:800;color:#4A9B8E;margin-top:4px;font-variant-numeric:tabular-nums;'>" + formatAmount(totalPaid) + " €</div>"
            +               "<div style='font-size:12px;color:#718096;margin-top:2px;'>" + payouts.size() + " reversement" + (payouts.size() > 1 ? "s" : "") + "</div>"
            +             "</td>"
            +           "</tr>"
            +         "</table>"
            +       "</td></tr>"
            +       "<tr><td style='padding:16px 32px 0 32px;'>"
            +         "<div style='font-size:13px;font-weight:700;color:#2D3748;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;'>Detail par periode</div>"
            +         "<table width='100%' cellpadding='0' cellspacing='0' style='border-collapse:collapse;'>"
            +           "<tr style='background:#EDF2F7;'>"
            +             "<th align='left' style='padding:8px;font-size:11px;color:#4A5568;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;'>Periode</th>"
            +             "<th align='right' style='padding:8px;font-size:11px;color:#4A5568;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;'>Brut</th>"
            +             "<th align='right' style='padding:8px;font-size:11px;color:#4A5568;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;'>Commission</th>"
            +             "<th align='right' style='padding:8px;font-size:11px;color:#4A5568;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;'>Frais</th>"
            +             "<th align='right' style='padding:8px;font-size:11px;color:#4A5568;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;'>Net</th>"
            +           "</tr>"
            +           rows
            +         "</table>"
            +       "</td></tr>"
            +       "<tr><td style='padding:24px 32px 8px 32px;'>"
            +         "<table width='100%' cellpadding='0' cellspacing='0'>"
            +           "<tr>"
            +             "<td style='padding:6px 0;font-size:13px;color:#718096;'>Revenu brut total</td>"
            +             "<td style='padding:6px 0;font-size:13px;color:#4A5568;text-align:right;font-variant-numeric:tabular-nums;'>" + formatAmount(totalGross) + " €</td>"
            +           "</tr>"
            +           "<tr>"
            +             "<td style='padding:6px 0;font-size:13px;color:#718096;'>Commission de gestion</td>"
            +             "<td style='padding:6px 0;font-size:13px;color:#4A5568;text-align:right;font-variant-numeric:tabular-nums;'>-" + formatAmount(totalCommission) + " €</td>"
            +           "</tr>"
            +           "<tr>"
            +             "<td style='padding:6px 0;font-size:13px;color:#718096;'>Frais deduits</td>"
            +             "<td style='padding:6px 0;font-size:13px;color:#4A5568;text-align:right;font-variant-numeric:tabular-nums;'>"
            +               (totalExpenses.signum() > 0 ? "-" + formatAmount(totalExpenses) + " €" : "—")
            +             "</td>"
            +           "</tr>"
            +           "<tr style='border-top:2px solid #4A9B8E;'>"
            +             "<td style='padding:10px 0 4px 0;font-size:14px;font-weight:700;color:#2D3748;'>Total net verse</td>"
            +             "<td style='padding:10px 0 4px 0;font-size:16px;font-weight:800;color:#4A9B8E;text-align:right;font-variant-numeric:tabular-nums;'>" + formatAmount(totalPaid) + " €</td>"
            +           "</tr>"
            +         "</table>"
            +       "</td></tr>"
            +       "<tr><td style='padding:16px 32px 28px 32px;'>"
            +         "<p style='font-size:13px;line-height:1.6;color:#4A5568;margin:0;'>"
            +           "Pour toute question sur ce releve, n'hesitez pas a contacter " + conciergerieName + "."
            +         "</p>"
            +         "<p style='font-size:12px;color:#A0AEC0;margin:18px 0 0 0;'>"
            +           "Email genere automatiquement via Clenzy."
            +         "</p>"
            +       "</td></tr>"
            +     "</table>"
            +   "</td></tr>"
            + "</table>"
            + "</body></html>";
    }

    private String formatAmount(BigDecimal amount) {
        if (amount == null) return "0,00";
        return String.format(FR, "%,.2f", amount.setScale(2, RoundingMode.HALF_UP));
    }

    /** Resume du releve envoye, retourne au controller pour confirmation API. */
    public record OwnerStatementResult(
        String emailSentTo,
        String ownerName,
        int payoutsCount,
        BigDecimal totalPaid,
        BigDecimal totalGross,
        BigDecimal totalCommission,
        BigDecimal totalExpenses
    ) {}
}
