package com.clenzy.service.automation;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.EmailService;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.service.report.ReportDocumentService;
import com.clenzy.service.report.render.ReportPdfService;
import com.clenzy.service.smartlock.*;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

import static com.clenzy.service.automation.BaitlyExternalEffectJournal.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

/** Real SQL migration/transactions (PostgreSQL in CI), synthetic providers only. */
class BaitlyLockReportTransactionsTest extends BaitlyAutomationFixture {
    private static final String PRIVATE = "synthetic-private-provider-diagnostic";
    private BaitlyExternalEffectJournal effects;
    private SmartLockAccessCodeService locks;
    private SmartLockCodeProvisioner provider;
    private SmartLockAccessCodeRepository codes;
    private SmartLockDevice device;
    private SmartLockCodeDelivery delivery;
    private ReportDocumentService reports;
    private ReportDocumentRepository documents;
    private ReportPdfService pdf;
    private EmailService mail;
    private AtomicInteger removals, creations, emails, renders;
    private AtomicBoolean failCodeCommit, failReportCommit;
    private AtomicLong newCodeId;
    private AtomicReference<String> snapshot;

    @BeforeEach void legacySetup() {
        effects = new BaitlyExternalEffectJournal(db, manager);
        // Do not bind the observer to the transaction manager's DataSource, even in
        // Spring's non-transactional synchronization scope around NOT_SUPPORTED.
        observer = new org.springframework.jdbc.core.JdbcTemplate(new org.springframework.jdbc.datasource.DriverManagerDataSource(
            source.getUrl(), source.getUsername(), source.getPassword()));
        db.execute("CREATE TABLE baitly_lock_fixture(id BIGINT PRIMARY KEY,status VARCHAR(20))");
        db.update("INSERT INTO baitly_lock_fixture VALUES (51,'ACTIVE')");
        db.execute("CREATE TABLE baitly_report_fixture(id BIGINT PRIMARY KEY,status VARCHAR(20))");
        db.update("INSERT INTO baitly_report_fixture VALUES (80,'DRAFT')");
        removals = new AtomicInteger(); creations = new AtomicInteger(); emails = new AtomicInteger(); renders = new AtomicInteger();
        failCodeCommit = new AtomicBoolean(); failReportCommit = new AtomicBoolean();
        newCodeId = new AtomicLong(60);
        device = new SmartLockDevice(); device.setId(50L); device.setPropertyId(20L); device.setOrganizationId(7L); device.setExternalDeviceId("synthetic-device");
        var devices = mock(SmartLockDeviceRepository.class);
        when(devices.findById(50L)).thenReturn(Optional.of(device));
        var tenant = mock(TenantContext.class); when(tenant.getOrganizationId()).thenReturn(7L);
        var access = new OrganizationAccessGuard(tenant);
        codes = mock(SmartLockAccessCodeRepository.class);
        when(codes.findByDeviceIdAndStatus(50L, SmartLockAccessCode.CodeStatus.ACTIVE)).thenAnswer(call -> db.query(
            "SELECT id,status FROM baitly_lock_fixture WHERE status='ACTIVE'", (rs, index) -> code(rs.getLong(1), rs.getString(2))));
        when(codes.findByReservationIdAndStatus(100L, SmartLockAccessCode.CodeStatus.REVOKED)).thenAnswer(call -> db.query(
            "SELECT id,status FROM baitly_lock_fixture WHERE status='REVOKED'", (rs, index) -> code(rs.getLong(1), rs.getString(2))));
        when(codes.findById(anyLong())).thenAnswer(call -> db.query("SELECT id,status FROM baitly_lock_fixture WHERE id=?",
            (rs, index) -> code(rs.getLong(1), rs.getString(2)), (Long) call.getArgument(0)).stream().findFirst());
        when(codes.save(any())).thenAnswer(call -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isTrue();
            SmartLockAccessCode code = call.getArgument(0);
            if (code.getId() == null) { code.setId(newCodeId.getAndIncrement()); db.update("INSERT INTO baitly_lock_fixture VALUES (?,?)", code.getId(), code.getStatus().name()); }
            else db.update("UPDATE baitly_lock_fixture SET status=? WHERE id=?", code.getStatus().name(), code.getId());
            if (failCodeCommit.get()) throw new IllegalStateException(PRIVATE);
            return code;
        });
        provider = mock(SmartLockCodeProvisioner.class);
        doAnswer(call -> { outside(Kind.LOCK, 50); removals.incrementAndGet(); return null; }).when(provider).remove(any(), any());
        when(provider.place(any(), any(), any(), any(), any())).thenAnswer(call -> {
            outside(Kind.LOCK, 50); creations.incrementAndGet(); return new SmartLockCodeProvisioner.PlacedCode("synthetic-pin", "synthetic-code");
        });
        delivery = mock(SmartLockCodeDelivery.class);
        var stayContext = mock(SmartLockStayContext.class);
        when(stayContext.zoneOf(any())).thenReturn(java.time.ZoneOffset.UTC);
        locks = proxy(new SmartLockAccessCodeService(codes, devices, access, provider, mock(SmartLockAccessCodeJournal.class),
            delivery, stayContext, effects, manager, reservations));
        stay.setCheckIn(LocalDate.of(2026, 10, 1)); stay.setCheckOut(LocalDate.of(2026, 10, 2));
        Property stayProperty = new Property(); stayProperty.setId(20L); stayProperty.setOrganizationId(7L); stay.setProperty(stayProperty);

        snapshot = new AtomicReference<>("{\"meta\":{\"title\":\"Synthetic\",\"issuerName\":\"Baitly\",\"currency\":\"EUR\",\"profile\":\"OWNER\",\"version\":1,\"scopeLabels\":[]},\"kpis\":[],\"sections\":[]}");
        documents = mock(ReportDocumentRepository.class);
        when(documents.findById(80L)).thenAnswer(call -> db.query("SELECT status FROM baitly_report_fixture WHERE id=80", (rs, index) -> {
            ReportDocument document = new ReportDocument(); document.setId(80L); document.setOrganizationId(7L);
            document.setStatus(ReportDocumentStatus.valueOf(rs.getString(1))); document.setTitle("Synthetic");
            document.setDocumentNumber("R-synthetic"); document.setRecipientEmail("recipe@example.invalid");
            document.setPeriodStart(LocalDate.of(2026, 9, 1)); document.setPeriodEnd(LocalDate.of(2026, 9, 30));
            document.setSnapshotJson(snapshot.get()); return document;
        }).stream().findFirst());
        when(documents.save(any())).thenAnswer(call -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isTrue();
            ReportDocument document = call.getArgument(0);
            db.update("UPDATE baitly_report_fixture SET status=? WHERE id=80", document.getStatus().name());
            if (failReportCommit.get()) throw new IllegalStateException(PRIVATE);
            return document;
        });
        pdf = mock(ReportPdfService.class);
        when(pdf.toPdf(any(), any(), anyBoolean())).thenAnswer(call -> {
            outside(Kind.REPORT, 80); renders.incrementAndGet(); return new byte[]{1, 2, 3};
        });
        mail = mock(EmailService.class);
        doAnswer(call -> { outside(Kind.REPORT, 80); emails.incrementAndGet(); return null; })
            .when(mail).sendDocumentEmail(any(), any(), any(), any(), any(), any(), any());
        reports = proxy(new ReportDocumentService(null, null, pdf, documents, null, null, null,
            access, mail, new ObjectMapper(), effects, manager));
    }

    private SmartLockAccessCode code(long id, String status) {
        SmartLockAccessCode code = new SmartLockAccessCode(); code.setId(id); code.setOrganizationId(7L);
        code.setDeviceId(50L); code.setPropertyId(20L); code.setTuyaPasswordId("synthetic-code");
        code.setStatus(SmartLockAccessCode.CodeStatus.valueOf(status)); return code;
    }
    @SuppressWarnings("unchecked") private <T> T proxy(T target) {
        ProxyFactory factory = new ProxyFactory(target); factory.setProxyTargetClass(true);
        factory.addAdvice(new TransactionInterceptor(manager, new AnnotationTransactionAttributeSource())); return (T) factory.getProxy();
    }
    private Scope lockScope(String occurrence) { return new Scope(7, Kind.LOCK, 50, Operation.CREATE, occurrence); }
    private void outside(Kind kind, long id) {
        assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
        assertThat(TransactionSynchronizationManager.hasResource(source)).isFalse();
        assertThat(observer.queryForObject("SELECT count(*) FROM baitly_external_effect_attempts WHERE kind=? AND resource_id=? AND state='STARTED'", Long.class, kind.name(), id)).isEqualTo(1);
        // A separate connection acquires the guard: no lock survives the intention commit.
        observer.queryForObject("SELECT resource_id FROM baitly_external_effect_guards WHERE organization_id=7 AND kind=? AND resource_id=? FOR UPDATE NOWAIT", Long.class, kind.name(), id);
    }
    private String effectState(Kind kind) { return db.queryForObject("SELECT state FROM baitly_external_effect_attempts WHERE kind=?", String.class, kind.name()); }
    private void send() { reports.send(80L, 7L, "synthetic-actor", List.of()); }

    @Test void migrationIsRepeatableAndStoresNoSensitiveColumns() {
        assertThat(db.queryForList("SELECT column_name FROM information_schema.columns WHERE lower(table_name)='baitly_external_effect_attempts'", String.class))
            .noneMatch(name -> name.matches("(?i).*(pin|email|payload|message|exception|recipient|content).*"));
    }
    @Test void startedFenceBlocksEveryNewOperationOnSameLock() {
        effects.claim(lockScope("reservation:100"));
        assertThatThrownBy(() -> effects.claim(new Scope(7, Kind.LOCK, 50, Operation.REVOKE, "51")))
            .hasMessage("EXTERNAL_EFFECT_RECONCILIATION_REQUIRED");
    }
    @Test void unknownFenceNeverExpiresOrRearms() {
        var ticket = effects.claim(lockScope("reservation:100")); effects.uncertain(ticket);
        db.update("UPDATE baitly_external_effect_attempts SET attempted_at=?", now.minusYears(20));
        assertThatThrownBy(() -> effects.claim(lockScope("reservation:101"))).hasMessage("EXTERNAL_EFFECT_RECONCILIATION_REQUIRED");
    }
    @Test void completedOccurrenceIsIdempotentWithOriginalReference() {
        var ticket = effects.claim(lockScope("reservation:100")); effects.complete(ticket, () -> 60L, value -> value);
        var existing = effects.claim(lockScope("reservation:100")); assertThat(existing.done()).isTrue(); assertThat(existing.reference()).isEqualTo(60L);
    }
    @Test void failedBusinessCommitDoesNotCompleteTheFence() {
        var ticket = effects.claim(lockScope("reservation:100"));
        assertThatThrownBy(() -> effects.complete(ticket, () -> { db.update("UPDATE baitly_lock_fixture SET status='REVOKED'"); throw new IllegalStateException("SYNTHETIC"); }, value -> 60L));
        assertThat(effectState(Kind.LOCK)).isEqualTo("STARTED");
        assertThat(db.queryForObject("SELECT status FROM baitly_lock_fixture", String.class)).isEqualTo("ACTIVE");
    }
    @Test void missingBusinessReferenceCannotCreateATerminalProof() {
        var ticket = effects.claim(lockScope("reservation:100"));
        assertThatThrownBy(() -> effects.complete(ticket, () -> {
            db.update("UPDATE baitly_lock_fixture SET status='REVOKED'"); return 60L;
        }, value -> null));
        assertThat(effectState(Kind.LOCK)).isEqualTo("STARTED");
        assertThat(db.queryForObject("SELECT status FROM baitly_lock_fixture", String.class)).isEqualTo("ACTIVE");
    }
    @Test void forgedScopeCannotCompleteOrRecordProgress() {
        var ticket = effects.claim(lockScope("reservation:100"));
        var foreign = new Ticket(new Scope(8, Kind.LOCK, 50, Operation.CREATE, "reservation:100"), ticket.token(), false, null);
        AtomicBoolean invoked = new AtomicBoolean();
        assertThatThrownBy(() -> effects.complete(foreign, () -> { invoked.set(true); return 60L; }, value -> value));
        assertThatThrownBy(() -> effects.progress(foreign)); effects.uncertain(foreign);
        assertThat(invoked.get()).isFalse(); assertThat(effectState(Kind.LOCK)).isEqualTo("STARTED");
    }
    @Test void concurrentClaimsHaveExactlyOneWinner() throws Exception {
        var pool = Executors.newFixedThreadPool(2); var start = new CountDownLatch(1);
        try {
            Callable<Boolean> claim = () -> { start.await(); try { effects.claim(lockScope("reservation:100")); return true; } catch (IllegalStateException blocked) { return false; } };
            var first = pool.submit(claim); var second = pool.submit(claim); start.countDown();
            assertThat(List.of(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS))).containsExactlyInAnyOrder(true, false);
        } finally { pool.shutdownNow(); pool.awaitTermination(5, TimeUnit.SECONDS); }
    }
    @Test void revocationIsCommittedOnlyAfterPositiveProviderReturn() {
        locks.revokeForDevice(50L, "system"); locks.revokeForDevice(50L, "system");
        assertThat(removals.get()).isEqualTo(1); assertThat(effectState(Kind.LOCK)).isEqualTo("DONE");
        assertThat(db.queryForObject("SELECT status FROM baitly_lock_fixture", String.class)).isEqualTo("REVOKED");
    }
    @Test void revocationTimeoutDoesNotLieOrReplay() {
        doAnswer(call -> { outside(Kind.LOCK, 50); removals.incrementAndGet(); throw new IllegalStateException(PRIVATE); }).when(provider).remove(any(), any());
        assertThatThrownBy(() -> locks.revokeForDevice(50L, "system")).hasMessage("LOCK_REVOCATION_UNCONFIRMED").hasNoCause();
        assertThatThrownBy(() -> locks.revokeForDevice(50L, "system"));
        assertThat(removals.get()).isEqualTo(1); assertThat(effectState(Kind.LOCK)).isEqualTo("UNKNOWN");
        assertThat(db.queryForObject("SELECT status FROM baitly_lock_fixture", String.class)).isEqualTo("ACTIVE");
    }
    @Test void revocationCommitLostDoesNotRepeatProvider() {
        failCodeCommit.set(true);
        assertThatThrownBy(() -> locks.revokeForDevice(50L, "system")); assertThatThrownBy(() -> locks.revokeForDevice(50L, "system"));
        assertThat(removals.get()).isEqualTo(1); assertThat(effectState(Kind.LOCK)).isEqualTo("UNKNOWN");
        assertThat(db.queryForObject("SELECT status FROM baitly_lock_fixture", String.class)).isEqualTo("ACTIVE");
    }
    @Test void staleLocalActiveStatusCannotRepeatAConfirmedRevocation() {
        locks.revokeForDevice(50L, "system");
        db.update("UPDATE baitly_lock_fixture SET status='ACTIVE'");
        locks.revokeForDevice(50L, "system");
        assertThat(removals.get()).isEqualTo(1); assertThat(effectState(Kind.LOCK)).isEqualTo("DONE");
    }
    @Test void creationReturnsExistingCodeWithoutProviderOrDeliveryReplay() {
        locks.generateForReservation(stay, device, SmartLockAccessCode.CodeSource.AUTO_RESERVATION);
        locks.generateForReservation(stay, device, SmartLockAccessCode.CodeSource.AUTO_RESERVATION);
        assertThat(creations.get()).isEqualTo(1); verify(delivery, times(1)).deliver(any(), any(), any(), any());
    }
    @Test void creationCommitLostBlocksNextAttempt() {
        failCodeCommit.set(true);
        assertThat(locks.generateForReservation(stay, device, SmartLockAccessCode.CodeSource.AUTO_RESERVATION)).isNull();
        assertThatThrownBy(() -> locks.generateForReservation(stay, device, SmartLockAccessCode.CodeSource.AUTO_RESERVATION));
        assertThat(creations.get()).isEqualTo(1); assertThat(effectState(Kind.LOCK)).isEqualTo("UNKNOWN");
        verifyNoInteractions(delivery);
    }
    @Test void creationForAnotherPropertyCannotReachProviderOrClaim() {
        stay.getProperty().setId(21L);
        assertThatThrownBy(() -> locks.generateForReservation(stay, device, SmartLockAccessCode.CodeSource.AUTO_RESERVATION))
            .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verifyNoInteractions(provider);
        assertThat(db.queryForObject("SELECT count(*) FROM baitly_external_effect_attempts", Integer.class)).isZero();
    }
    @Test void changedReservationWindowIsANewOperationAfterConfirmedPreviousOutcome() {
        locks.generateForReservation(stay, device, SmartLockAccessCode.CodeSource.AUTO_RESERVATION);
        stay.setCheckOut(stay.getCheckOut().plusDays(1));
        locks.generateForReservation(stay, device, SmartLockAccessCode.CodeSource.AUTO_RESERVATION);
        assertThat(creations.get()).isEqualTo(2);
        assertThat(db.queryForObject("SELECT count(*) FROM baitly_external_effect_attempts WHERE state='DONE'", Integer.class)).isEqualTo(2);
    }
    @Test void confirmedRevocationAllowsANewCodeForTheSameStayWindow() {
        locks.generateForReservation(stay, device, SmartLockAccessCode.CodeSource.AUTO_RESERVATION);
        locks.revokeForDevice(50L, "system");
        locks.generateForReservation(stay, device, SmartLockAccessCode.CodeSource.AUTO_RESERVATION);
        assertThat(creations.get()).isEqualTo(2); assertThat(removals.get()).isEqualTo(2);
    }
    @Test void partialRotationNeverRepeatsConfirmedRemovalOrAmbiguousCreation() {
        doAnswer(call -> { outside(Kind.LOCK, 50); creations.incrementAndGet(); throw new IllegalStateException(PRIVATE); }).when(provider).place(any(), any(), any(), any(), any());
        assertThatThrownBy(() -> locks.rotateManual(50L, null, null, null, "system"));
        assertThatThrownBy(() -> locks.rotateManual(50L, null, null, null, "system"));
        assertThat(removals.get()).isEqualTo(1); assertThat(creations.get()).isEqualTo(1);
        assertThat(effectState(Kind.LOCK)).isEqualTo("UNKNOWN");
    }
    @Test void lockProviderRunsOutsideCallerTransactionAndRestoresIt() {
        new TransactionTemplate(manager).executeWithoutResult(status -> {
            locks.revokeForDevice(50L, "system"); assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isTrue(); status.setRollbackOnly();
        });
        assertThat(effectState(Kind.LOCK)).isEqualTo("DONE");
    }
    @Test void reportIsSentOnlyAfterAllSmtpReturnsAndFinalCommit() {
        send(); assertThat(effectState(Kind.REPORT)).isEqualTo("DONE"); assertThat(emails.get()).isEqualTo(1);
        assertThat(db.queryForObject("SELECT status FROM baitly_report_fixture", String.class)).isEqualTo("SENT");
        assertThatThrownBy(this::send); assertThat(emails.get()).isEqualTo(1);
    }
    @Test void partialReportKeepsAcceptedCountAndDoesNotReplayOrSendRemainingAddresses() {
        doAnswer(call -> { outside(Kind.REPORT, 80); if (emails.incrementAndGet() == 2) throw new IllegalStateException(PRIVATE); return null; })
            .when(mail).sendDocumentEmail(any(), any(), any(), any(), any(), any(), any());
        assertThatThrownBy(() -> reports.send(80L, 7L, "synthetic", List.of("one@example.invalid", "two@example.invalid", "three@example.invalid")))
            .hasMessage("REPORT_DELIVERY_UNCONFIRMED").hasNoCause();
        assertThatThrownBy(this::send); assertThat(emails.get()).isEqualTo(2); assertThat(renders.get()).isEqualTo(1);
        assertThat(effectState(Kind.REPORT)).isEqualTo("UNKNOWN");
        assertThat(db.queryForObject("SELECT completed_count FROM baitly_external_effect_attempts", Integer.class)).isEqualTo(1);
        assertThat(db.queryForObject("SELECT status FROM baitly_report_fixture", String.class)).isEqualTo("DRAFT");
    }
    @Test void reportFinalCommitFailureDoesNotRepeatSmtp() {
        failReportCommit.set(true); assertThatThrownBy(this::send); assertThatThrownBy(this::send);
        assertThat(emails.get()).isEqualTo(1); assertThat(effectState(Kind.REPORT)).isEqualTo("UNKNOWN");
        assertThat(db.queryForObject("SELECT status FROM baitly_report_fixture", String.class)).isEqualTo("DRAFT");
    }
    @Test void staleDraftCannotResendAConfirmedReport() {
        send(); db.update("UPDATE baitly_report_fixture SET status='DRAFT'");
        assertThatThrownBy(this::send).hasMessage("REPORT_ALREADY_TRANSMITTED");
        assertThat(emails.get()).isEqualTo(1); assertThat(renders.get()).isEqualTo(1);
        assertThat(effectState(Kind.REPORT)).isEqualTo("DONE");
    }
    @Test void reportPdfFailureDoesNotSendOrRearm() {
        doThrow(new IllegalStateException(PRIVATE)).when(pdf).toPdf(any(), any(), anyBoolean());
        assertThatThrownBy(this::send); assertThatThrownBy(this::send);
        verifyNoInteractions(mail); assertThat(effectState(Kind.REPORT)).isEqualTo("UNKNOWN");
    }
    @Test void reportSnapshotChangedDuringExternalWorkCannotConfirmStaleSnapshot() {
        doAnswer(call -> { outside(Kind.REPORT, 80); snapshot.set(snapshot.get() + " "); emails.incrementAndGet(); return null; })
            .when(mail).sendDocumentEmail(any(), any(), any(), any(), any(), any(), any());
        assertThatThrownBy(this::send); assertThatThrownBy(this::send);
        assertThat(effectState(Kind.REPORT)).isEqualTo("UNKNOWN"); assertThat(emails.get()).isEqualTo(1);
    }
    @Test void uncertainReportCannotBeDeletedToEraseFence() {
        doThrow(new IllegalStateException(PRIVATE)).when(pdf).toPdf(any(), any(), anyBoolean());
        assertThatThrownBy(this::send);
        assertThatThrownBy(() -> reports.delete(80L, 7L)).hasMessage("EXTERNAL_EFFECT_HISTORY_PROTECTED");
        verify(documents, never()).delete(any());
    }
    @Test void foreignReportCannotRenderSendOrCreateFence() {
        assertThatThrownBy(() -> reports.send(80L, 8L, "synthetic", List.of()));
        assertThat(db.queryForObject("SELECT count(*) FROM baitly_external_effect_attempts", Integer.class)).isZero();
        verifyNoInteractions(pdf, mail);
    }
    @Test void reportProviderRunsOutsideCallerTransactionAndRestoresIt() {
        new TransactionTemplate(manager).executeWithoutResult(status -> {
            send(); assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isTrue(); status.setRollbackOnly();
        });
        assertThat(effectState(Kind.REPORT)).isEqualTo("DONE");
    }

    @Test void actualProvisionerRejectsMissingOrNegativeRevocationEvidence() {
        var tuya = mock(com.clenzy.integration.tuya.service.TuyaApiService.class);
        var actual = new SmartLockCodeProvisioner(tuya, mock(SmartLockProviderRegistry.class), mock(SmartLockPinPolicy.class));
        when(tuya.deleteTemporaryPassword(any(), any())).thenReturn(Map.of("result", false), null);
        assertThatThrownBy(() -> actual.remove(device, "synthetic-code")).hasMessage("LOCK_REVOCATION_UNCONFIRMED").hasNoCause();
        assertThatThrownBy(() -> actual.remove(device, "synthetic-code")).hasMessage("LOCK_REVOCATION_UNCONFIRMED").hasNoCause();
    }

    @Test void actualProvisionerRejectsProviderCallsInAnyActiveTransaction() {
        var tuya = mock(com.clenzy.integration.tuya.service.TuyaApiService.class);
        var actual = new SmartLockCodeProvisioner(tuya, mock(SmartLockProviderRegistry.class), mock(SmartLockPinPolicy.class));
        new TransactionTemplate(manager).executeWithoutResult(status -> {
            assertThatThrownBy(() -> actual.remove(device, "synthetic-code")).hasMessage("EXTERNAL_EFFECT_TRANSACTION_FORBIDDEN");
            assertThatThrownBy(() -> actual.place(device, "Synthetic", now, now.plusDays(1), java.time.ZoneOffset.UTC))
                .hasMessage("EXTERNAL_EFFECT_TRANSACTION_FORBIDDEN");
        });
        verifyNoInteractions(tuya);
    }

    @Test void reportPreviewPdfAlsoSuspendsCallerTransaction() {
        doAnswer(call -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            return new byte[]{1, 2, 3};
        }).when(pdf).toPdf(any(), any(), anyBoolean());
        new TransactionTemplate(manager).executeWithoutResult(status -> {
            reports.pdf(80L, 7L);
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isTrue();
        });
        verifyNoInteractions(mail);
    }

    @Test void reportGenerationPreparesAndPersistsInShortTransactionsButNarratesOutside() throws Exception {
        var properties = mock(PropertyRepository.class);
        Property property = new Property(); property.setId(20L); property.setOrganizationId(7L);
        User owner = new User(); owner.setId(70L); owner.setEmail("recipe@example.invalid"); property.setOwner(owner);
        when(properties.findByOrganizationId(7L)).thenAnswer(call -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isTrue(); return List.of(property);
        });
        var snapshots = mock(com.clenzy.service.report.snapshot.ReportSnapshotBuilder.class);
        var frozen = new ObjectMapper().readValue(snapshot.get(), com.clenzy.dto.report.ReportSnapshot.class);
        when(snapshots.build(any(), any(), any(), any(), any())).thenAnswer(call -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isTrue(); return frozen;
        });
        var narrative = mock(com.clenzy.service.report.narrative.ReportNarrativeService.class);
        when(narrative.narrate(any(), anyLong())).thenAnswer(call -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            assertThat(TransactionSynchronizationManager.hasResource(source)).isFalse();
            return com.clenzy.dto.report.ReportNarrative.empty();
        });
        var tenant = mock(TenantContext.class); when(tenant.getOrganizationId()).thenReturn(7L);
        var generating = proxy(new ReportDocumentService(snapshots, narrative, pdf, documents, properties,
            mock(UserRepository.class), mock(OrganizationRepository.class), new OrganizationAccessGuard(tenant),
            mail, new ObjectMapper(), effects, manager));
        var request = new com.clenzy.dto.report.ReportRequest(com.clenzy.dto.report.ReportProfile.OWNER,
            com.clenzy.dto.report.ReportGroupBy.NONE, LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30),
            Set.of(), Set.of(), List.of(), true);
        new TransactionTemplate(manager).executeWithoutResult(status -> {
            assertThat(generating.generate(request, 7L, "synthetic")).hasSize(1);
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isTrue();
        });
        verify(narrative, times(1)).narrate(any(), eq(7L)); verifyNoInteractions(mail);
    }
}
