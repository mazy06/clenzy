package com.clenzy.architecture;

import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;

import java.util.Set;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.methods;

/**
 * Toute methode {@code @Scheduled} doit soit porter un {@code @SchedulerLock}, soit figurer
 * dans l'inventaire ci-dessous des exemptions <b>deliberees</b>.
 *
 * <p>Motivation : l'application tourne en mono-instance faute de verrou distribue. ShedLock a
 * ete introduit pour lever ce blocage, mais un verrou ne protege que les jobs qui le portent —
 * et rien n'empechait d'ajouter un nouveau job a effet externe sans y penser. Cette regle rend
 * l'oubli impossible : un job non verrouille doit etre justifie ici, explicitement.</p>
 *
 * <p>Ce n'est pas une regle « tout doit etre verrouille ». Certains jobs ne DOIVENT surtout pas
 * l'etre — ceux qui entretiennent un etat local a l'instance (metriques, caches en memoire).
 * Les verrouiller casserait leur fonction sur toutes les instances sauf une.</p>
 */
@AnalyzeClasses(packages = "com.clenzy", importOptions = ImportOption.DoNotIncludeTests.class)
class SchedulerLockCoverageTest {

    /**
     * Jobs sans verrou, par categorie. Format {@code SimpleClassName#methodName}.
     *
     * <p><b>A — etat local a l'instance : NE PAS verrouiller.</b> Chaque instance doit executer
     * ce job pour elle-meme ; un verrou global en priverait toutes les autres.</p>
     * <p><b>B — at-least-once assume et documente</b> dans la classe concernee.</p>
     * <p><b>C — sans effet externe</b> : ecriture idempotente, purge bornee, lecture ou log.
     * Un doublon y coute au pire du travail refait, jamais un effet visible chez un tiers.</p>
     */
    private static final Set<String> EXEMPTIONS_DELIBEREES = Set.of(
            // A — etat local a l'instance
            "AbstractFileStorageService#updateStorageMetrics",
            "ContactFileStorageService#updateStorageMetrics",
            "TokenCleanupService#scheduledTokenCleanup",
            "ChannexAriBatcher#flush",

            // B — at-least-once par design (voir OutboxRelay, javadoc de classe)
            "OutboxRelay#relayPendingEvents",
            "OutboxRelay#retryFailedEvents",
            "OutboxRelay#cleanupSentEvents",

            // C — sans effet externe
            "AirbnbSyncScheduler#cleanupOldWebhookEvents",
            "AssistantMemoryCleanupScheduler#runWeekly",
            "CalendarPartitionManager#createFuturePartitions",
            "CalendarSnapshotScheduler#runDaily",
            "ChannelPromotionService#scheduledExpirePromotions",
            "CreditReconciliationScheduler#monthlyReport",
            "CreditReconciliationScheduler#reconcileHotBalances",
            "ElasticityRecomputeScheduler#runWeekly",
            "FunnelRetentionScheduler#runDaily",
            "KbIndexTuningScheduler#runDaily",
            "OnlineCheckInService#expireOldCheckIns",
            "PendingActionExpiryScheduler#expireOverduePendingActions",
            "SnapshotRetentionScheduler#runWeekly");

    @ArchTest
    static final ArchRule tout_job_planifie_declare_son_verrouillage =
            methods().that().areAnnotatedWith(Scheduled.class)
                    .should(new ArchCondition<JavaMethod>(
                            "porter @SchedulerLock ou figurer dans les exemptions deliberees") {
                        @Override
                        public void check(JavaMethod method, ConditionEvents events) {
                            if (method.isAnnotatedWith(SchedulerLock.class)) {
                                return;
                            }
                            final String id = method.getOwner().getSimpleName() + "#" + method.getName();
                            if (EXEMPTIONS_DELIBEREES.contains(id)) {
                                return;
                            }
                            events.add(SimpleConditionEvent.violated(method,
                                    "Le job planifie " + id + " n'a pas de @SchedulerLock. "
                                            + "S'il produit un effet externe (email, SMS, push, appel API tiers, "
                                            + "paiement, ecriture non idempotente), ajouter "
                                            + "@SchedulerLock(name = \"...\", lockAtMostFor = \"...\"). "
                                            + "Sinon, l'inscrire dans EXEMPTIONS_DELIBEREES "
                                            + "(" + SchedulerLockCoverageTest.class.getSimpleName() + ") "
                                            + "avec la categorie qui convient."));
                        }
                    });

    /**
     * Un nom de verrou duplique ferait que deux jobs distincts s'excluent mutuellement : le
     * second ne s'executerait jamais tant que le premier detient le verrou. Silencieux et
     * difficile a diagnostiquer, donc verifie ici.
     */
    @ArchTest
    static final ArchRule les_noms_de_verrou_sont_uniques =
            methods().that().areAnnotatedWith(SchedulerLock.class)
                    .should(new ArchCondition<JavaMethod>("porter un nom de verrou unique") {
                        private final java.util.Map<String, String> vus = new java.util.HashMap<>();

                        @Override
                        public void check(JavaMethod method, ConditionEvents events) {
                            final String name = method.getAnnotationOfType(SchedulerLock.class).name();
                            final String id = method.getOwner().getSimpleName() + "#" + method.getName();
                            final String precedent = vus.putIfAbsent(name, id);
                            if (precedent != null && !precedent.equals(id)) {
                                events.add(SimpleConditionEvent.violated(method,
                                        "Le nom de verrou \"" + name + "\" est utilise par " + precedent
                                                + " ET " + id + ". Deux jobs partageant un nom s'excluent "
                                                + "mutuellement : le second ne tournera jamais."));
                            }
                        }
                    });
}
