package com.clenzy.service.automation;

import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.Organization;
import com.clenzy.model.OwnerStatementDispatch;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.OwnerStatementDispatchRepository;
import com.clenzy.service.OwnerStatementService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneId;

/**
 * Executeur {@code SEND_OWNER_STATEMENT} du moteur AutomationRule (flux F9a) :
 * envoie au proprietaire (sujet {@link #SUBJECT_OWNER}) le releve de
 * reversements du mois ecoule via {@link OwnerStatementService}.
 *
 * <p>La periode vient du sujet ({@link #DATA_PERIOD_START} /
 * {@link #DATA_PERIOD_END}, poses par le capteur au declenchement) — repli :
 * mois civil precedent en Europe/Paris (les releves sont un agregat mensuel
 * org-level pour des conciergeries francaises, OwnerStatementService est FR).</p>
 *
 * <p><b>Filet d'idempotence metier</b> (en plus de l'idempotence generique du
 * moteur, qui ne porte pas la periode) : claim {@link OwnerStatementDispatch}
 * unique (org, owner, periode) validé AVANT l'envoi — un mois n'est JAMAIS
 * envoye deux fois, meme sur re-livraison ou re-execution.</p>
 *
 * <p>Le claim métier est validé dans la transaction courte du repository avant
 * l'envoi. Un échec ultérieur ne supprime pas ce claim ; le moteur conserve sa
 * tentative incertaine sans renvoi automatique.</p>
 */
@Service
public class SendOwnerStatementExecutor implements AutomationActionExecutor {

    /**
     * Type de sujet attendu par cet executeur. Sujet STABLE (ownerId) :
     * OWNER_MONTHLY_STATEMENT est un declencheur recurrent
     * ({@code dedupePerSubject=false}), le moteur ne deduplique pas — c'est le
     * claim {@code owner_statement_dispatch} (org x owner x periode) qui porte
     * l'idempotence par mois.
     */
    public static final String SUBJECT_OWNER = "OWNER";

    /** Periode du releve au format ISO-8601 (yyyy-MM-dd). */
    public static final String DATA_PERIOD_START = "periodStart";
    public static final String DATA_PERIOD_END = "periodEnd";

    static final ZoneId STATEMENT_ZONE = ZoneId.of("Europe/Paris");

    private static final Logger log = LoggerFactory.getLogger(SendOwnerStatementExecutor.class);

    private final OwnerStatementDispatchRepository dispatchRepository;
    private final OwnerStatementService ownerStatementService;
    private final OrganizationRepository organizationRepository;

    public SendOwnerStatementExecutor(OwnerStatementDispatchRepository dispatchRepository,
                                      OwnerStatementService ownerStatementService,
                                      OrganizationRepository organizationRepository) {
        this.dispatchRepository = dispatchRepository;
        this.ownerStatementService = ownerStatementService;
        this.organizationRepository = organizationRepository;
    }

    @Override
    public AutomationAction action() {
        return AutomationAction.SEND_OWNER_STATEMENT;
    }

    @Override
    public ExecutionResult execute(AutomationRule rule, AutomationActionContext ctx) {
        if (!SUBJECT_OWNER.equals(ctx.subjectType()) || ctx.subjectId() == null) {
            throw new IllegalStateException("SEND_OWNER_STATEMENT attend un sujet "
                    + SUBJECT_OWNER + ", recu : " + ctx.subjectType());
        }
        Long ownerId = ctx.subjectId();
        LocalDate from = periodStart(ctx);
        LocalDate to = periodEnd(ctx, from);

        // The engine holds no enclosing transaction: the repository commits the unique
        // claim before SMTP. A later error must never erase that claim.

        if (dispatchRepository.existsByOrganizationIdAndOwnerIdAndPeriodStart(ctx.orgId(), ownerId, from)) {
            return ExecutionResult.skipped("Releve deja traite pour owner " + ownerId
                    + " sur la periode " + from + " (idempotence)");
        }

        OwnerStatementDispatch dispatch = new OwnerStatementDispatch(ctx.orgId(), ownerId, from, to);
        try {
            dispatch = dispatchRepository.save(dispatch);
        } catch (DataIntegrityViolationException e) {
            throw new IllegalStateException("AUTOMATION_CLAIM_UNCONFIRMED");
        }

        String conciergerieName = organizationRepository.findById(ctx.orgId())
                .map(Organization::getName)
                .orElse(null);

        // An uncertain send keeps the committed claim and the engine attempt fenced.
        ownerStatementService.sendStatement(ownerId, ctx.orgId(), from, to, conciergerieName);

        dispatch.setSuccess(true);
        dispatchRepository.save(dispatch);
        log.info("Releve proprietaire envoye : org={}, owner={}, periode {} -> {}",
                ctx.orgId(), ownerId, from, to);
        return ExecutionResult.executed();
    }

    private LocalDate periodStart(AutomationActionContext ctx) {
        String raw = ctx.dataAsString(DATA_PERIOD_START);
        if (raw != null && !raw.isBlank()) {
            return LocalDate.parse(raw);
        }
        return LocalDate.now(STATEMENT_ZONE).minusMonths(1).withDayOfMonth(1);
    }

    private LocalDate periodEnd(AutomationActionContext ctx, LocalDate from) {
        String raw = ctx.dataAsString(DATA_PERIOD_END);
        if (raw != null && !raw.isBlank()) {
            return LocalDate.parse(raw);
        }
        return from.plusMonths(1).minusDays(1);
    }
}
