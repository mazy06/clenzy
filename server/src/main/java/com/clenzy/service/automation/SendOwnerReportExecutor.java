package com.clenzy.service.automation;

import com.clenzy.dto.report.ReportGroupBy;
import com.clenzy.dto.report.ReportProfile;
import com.clenzy.dto.report.ReportRequest;
import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.ReportDocument;
import com.clenzy.model.ReportDocumentStatus;
import com.clenzy.repository.ReportDocumentRepository;
import com.clenzy.service.report.ReportDocumentService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;

/**
 * Executeur {@code SEND_OWNER_REPORT} : le releve d'analyse mensuel, en PDF.
 *
 * <p>Distinct de {@link SendOwnerStatementExecutor}, qui envoie le releve de
 * REVERSEMENTS sous forme d'email auto-portant. Celui-ci produit le document
 * d'analyse complet — performance, occupation, compte de resultat, perspectives —
 * et le joint en PDF.</p>
 *
 * <p><b>Sans commentaire d'agent, et c'est deliberе.</b> Un rapport genere seul
 * la nuit du 1er n'a personne pour le relire ; or un texte redige par un modele
 * ne doit pas atteindre un proprietaire sans relecture. En le produisant
 * entierement deterministe — chaque ligne calculee, chaque constat derive des
 * chiffres — on peut l'envoyer sans garde humain. Une conciergerie qui veut le
 * commentaire genere a la main et relit.</p>
 *
 * <p><b>Idempotence metier</b> : un rapport deja ENVOYE pour ce proprietaire et
 * cette periode fait sauter l'execution. Le moteur porte l'idempotence
 * generique (regle x sujet) mais elle ne connait pas la periode, et
 * OWNER_MONTHLY_STATEMENT est un declencheur recurrent.</p>
 */
@Service
public class SendOwnerReportExecutor implements AutomationActionExecutor {

    private static final Logger log = LoggerFactory.getLogger(SendOwnerReportExecutor.class);

    private static final ZoneId REPORT_ZONE = ZoneId.of("Europe/Paris");

    private final ReportDocumentService reportDocumentService;
    private final ReportDocumentRepository repository;

    public SendOwnerReportExecutor(ReportDocumentService reportDocumentService,
                                   ReportDocumentRepository repository) {
        this.reportDocumentService = reportDocumentService;
        this.repository = repository;
    }

    @Override
    public AutomationAction action() {
        return AutomationAction.SEND_OWNER_REPORT;
    }

    @Override
    public ExecutionResult execute(AutomationRule rule, AutomationActionContext ctx) {
        final Long ownerId = ctx.subjectId();
        if (ownerId == null
                || !SendOwnerStatementExecutor.SUBJECT_OWNER.equals(ctx.subjectType())) {
            return ExecutionResult.skipped("sujet attendu : un proprietaire");
        }

        final LocalDate periodStart = periodStart(ctx);
        final LocalDate periodEnd = periodEnd(ctx, periodStart);
        final Long orgId = ctx.orgId();

        if (repository.existsByOrganizationIdAndRecipientUserIdAndPeriodStartAndPeriodEndAndStatus(
                orgId, ownerId, periodStart, periodEnd, ReportDocumentStatus.SENT)) {
            return ExecutionResult.skipped("rapport deja envoye pour cette periode");
        }

        final ReportRequest request = new ReportRequest(
                ReportProfile.OWNER, ReportGroupBy.OWNER, periodStart, periodEnd,
                Set.of(ownerId), Set.of(), List.of(),
                // Deterministe : voir le pourquoi dans la javadoc de la classe.
                false);

        final List<ReportDocument> produced =
                reportDocumentService.generate(request, orgId, "automation");
        if (produced.isEmpty()) {
            return ExecutionResult.skipped("aucun bien rattache a ce proprietaire");
        }

        final ReportDocument document = produced.get(0);
        if (document.getRecipientEmail() == null || document.getRecipientEmail().isBlank()) {
            // Le document reste en base, consultable : c'est l'ENVOI qui est
            // impossible, pas la production.
            return ExecutionResult.skipped("aucune adresse pour ce proprietaire");
        }

        // L'envoi vaut relecture : l'etape « marquer relu » n'existe plus.
        reportDocumentService.send(document.getId(), orgId, "automation", java.util.List.of());

        log.info("Rapport {} envoye automatiquement pour la periode {} → {}",
                document.getDocumentNumber(), periodStart, periodEnd);
        return ExecutionResult.executed(document.getId());
    }

    /**
     * Debut de periode.
     *
     * <p>Repli sur le mois civil precedent en Europe/Paris, le meme referentiel
     * que le capteur : une execution differee doit envoyer le bon mois, pas le
     * mois ou le drain a eu lieu.</p>
     */
    private LocalDate periodStart(AutomationActionContext ctx) {
        final String raw = ctx.dataAsString(SendOwnerStatementExecutor.DATA_PERIOD_START);
        if (raw != null) {
            try {
                return LocalDate.parse(raw);
            } catch (RuntimeException e) {
                log.warn("Periode de rapport illisible ({}), repli sur le mois precedent", raw);
            }
        }
        return YearMonth.now(REPORT_ZONE).minusMonths(1).atDay(1);
    }

    private LocalDate periodEnd(AutomationActionContext ctx, LocalDate start) {
        final String raw = ctx.dataAsString(SendOwnerStatementExecutor.DATA_PERIOD_END);
        if (raw != null) {
            try {
                return LocalDate.parse(raw);
            } catch (RuntimeException e) {
                log.warn("Fin de periode illisible ({}), repli sur la fin du mois", raw);
            }
        }
        return YearMonth.from(start).atEndOfMonth();
    }
}
