package com.clenzy.service;

import com.clenzy.dto.RlsAuditSummaryDto;
import com.clenzy.model.RlsAuditFinding;
import com.clenzy.repository.RlsAuditFindingRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * Inventaire RLS — audit sécurité 2026-07-26, plan REM-T-01.
 *
 * <p>Le drapeau {@code mesureExploitable} est le cœur de ces tests. Sans lui, l'écran
 * afficherait un inventaire trompeur comme un vrai constat : c'est l'erreur qui a été
 * commise en production le 2026-07-26, l'instrumentation ayant tourné une heure avec
 * l'aspect inactif. Elle a remonté cinq chemins dont quatre étaient des faux positifs.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("RlsAuditService — validité de l'inventaire (REM-T-01)")
class RlsAuditServiceTest {

    @Mock private RlsAuditFindingRepository repository;

    private RlsAuditService service(boolean audit, boolean aspect, String contexts) {
        when(repository.findAllByOrderByOccurrencesDesc()).thenReturn(List.of());
        when(repository.countByResolvedAtIsNull()).thenReturn(0L);
        return new RlsAuditService(repository, audit, aspect, contexts);
    }

    @Test
    @DisplayName("audit sans aspect : la mesure est déclarée inexploitable")
    void auditSansAspect_mesureInexploitable() {
        RlsAuditSummaryDto etat = service(true, false, "!rls").etat();

        assertThat(etat.auditActif()).isTrue();
        // Sans aspect, aucune GUC n'est posee : TOUTES les requetes sont signalees.
        // Un inventaire abondant n'apprendrait rien, un inventaire vide non plus.
        assertThat(etat.mesureExploitable())
                .as("sans aspect, l'inventaire ne distingue pas les chemins a risque du reste")
                .isFalse();
    }

    @Test
    @DisplayName("audit et aspect actifs : la mesure est exploitable")
    void auditEtAspect_mesureExploitable() {
        assertThat(service(true, true, "!rls").etat().mesureExploitable()).isTrue();
    }

    @Test
    @DisplayName("audit à l'arrêt : la mesure n'est pas exploitable non plus")
    void auditArrete_mesureInexploitable() {
        RlsAuditSummaryDto etat = service(false, true, "!rls").etat();

        assertThat(etat.auditActif()).isFalse();
        assertThat(etat.mesureExploitable()).isFalse();
    }

    @Test
    @DisplayName("le contexte `!rls` ne doit pas être lu comme une RLS active")
    void contexteNegatif_nEstPasUneRlsActive() {
        // Piege : "!rls" contient la sous-chaine "rls". Le confondre afficherait une
        // alerte « la RLS est deja active » sur une production ou elle ne l'est pas.
        assertThat(service(true, true, "!rls").etat().rlsDejaActive()).isFalse();
        assertThat(service(true, true, "rls").etat().rlsDejaActive()).isTrue();
    }

    @Test
    @DisplayName("marquer traité conserve la ligne et l'horodate")
    void marquerTraite_conserveLaLigne() {
        RlsAuditFinding finding = new RlsAuditFinding();
        finding.setId(1L);
        finding.setOrigin("com.clenzy.service.X.m:1");
        finding.setTableName("reservations");
        when(repository.findById(1L)).thenReturn(Optional.of(finding));
        when(repository.save(finding)).thenReturn(finding);

        var resultat = new RlsAuditService(repository, true, true, "!rls").marquerTraite(1L);

        assertThat(resultat).isPresent();
        // La ligne est conservee, pas supprimee : si le chemin reapparait, lastSeenAt
        // repassera devant resolvedAt — c'est ce qui distingue « corrige » de « regresse ».
        assertThat(finding.getResolvedAt()).isNotNull().isBeforeOrEqualTo(LocalDateTime.now());
    }

    @Test
    @DisplayName("un identifiant inconnu ne lève pas")
    void identifiantInconnu_retourneVide() {
        when(repository.findById(99L)).thenReturn(Optional.empty());

        assertThat(new RlsAuditService(repository, true, true, "!rls").marquerTraite(99L))
                .isEmpty();
    }
}
