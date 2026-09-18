package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.EngagementMode;
import com.clenzy.marketplace.model.MarketplaceProvider;
import com.clenzy.marketplace.model.ProviderStatus;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Bornes de visibilite ajoutees a une recherche cote organisation.
 *
 * <p>Une specification JPA ne s'execute pas hors d'une base : ces tests
 * verifient donc QUELLES contraintes sont posees, pas leur resultat. C'est
 * suffisant pour ce qui compte ici — qu'aucune des trois ne soit oubliee, et que
 * chacune menage la fiche de l'organisation elle-meme.</p>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MarketplaceProviderSpecificationsVisibilityTest {

    @Mock private Root<MarketplaceProvider> root;
    @Mock private CriteriaQuery<?> query;
    @Mock private CriteriaBuilder cb;
    @Mock private Path<Object> path;
    @Mock private Predicate predicate;

    @Test
    void threeBoundsAreApplied_statusExclusivityAndHiddenIds() {
        givenBuilder();

        MarketplaceProviderSpecifications.visibleTo(7L, List.of(3L, 4L))
            .toPredicate(root, query, cb);

        // 1. seules les fiches ACTIVES
        verify(cb).equal(any(), eq(ProviderStatus.ACTIVE));
        // 2. pas de fiche EXCLUSIVE
        verify(cb).notEqual(any(), eq(EngagementMode.EXCLUSIVE));
        // 3. pas les fiches masquees
        verify(cb).not(any());
        // ... et chacune menagee par un OU sur l'organisation porteuse
        verify(cb, times(3)).or(any(), any());
    }

    @Test
    void withoutHiddenIds_onlyTwoBoundsAreApplied() {
        // Ne pas poser de NOT IN vide : certaines bases le traduisent mal, et
        // c'est de toute facon une contrainte qui ne dit rien.
        givenBuilder();

        MarketplaceProviderSpecifications.visibleTo(7L, List.of())
            .toPredicate(root, query, cb);

        verify(cb, never()).not(any());
        verify(cb, times(2)).or(any(), any());
    }

    @Test
    void withoutAnOrganisation_theOwnProviderEscapeHatchIsClosed() {
        // `disjunction()` = toujours faux : sans organisation resolue, aucune
        // fiche ne beneficie du rattrapage « c'est la mienne ».
        givenBuilder();

        MarketplaceProviderSpecifications.visibleTo(null, List.of())
            .toPredicate(root, query, cb);

        verify(cb).disjunction();
        verify(cb, never()).equal(any(), eq(7L));
    }

    private void givenBuilder() {
        doReturn(path).when(root).get(anyString());
        when(cb.equal(any(), any())).thenReturn(predicate);
        when(cb.notEqual(any(), any())).thenReturn(predicate);
        when(cb.or(any(), any())).thenReturn(predicate);
        when(cb.and(any(Predicate[].class))).thenReturn(predicate);
        when(cb.not(any())).thenReturn(predicate);
        when(cb.disjunction()).thenReturn(predicate);
        when(path.in(anyList())).thenReturn(predicate);
    }
}
