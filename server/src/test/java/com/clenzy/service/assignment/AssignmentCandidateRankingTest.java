package com.clenzy.service.assignment;

import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;

class AssignmentCandidateRankingTest {
    AssignmentCandidateRanking.Candidate candidate(long id,int score,int price,String currency,long load) {
        return new AssignmentCandidateRanking.Candidate(id,score,BigDecimal.valueOf(price),currency,load);
    }
    @Test void toleranceIsRelativeToBestScoreAndNeverChainsAcrossCandidates() {
        assertThat(AssignmentCandidateRanking.order(List.of(candidate(1,90,100,"EUR",4),
                candidate(2,81,100,"EUR",1),candidate(3,72,100,"EUR",0)))).containsExactly(2L,1L,3L);
    }
    @Test void equalQualityUsesCanonicalPriceMedianThenWorkload() {
        assertThat(AssignmentCandidateRanking.order(List.of(candidate(1,90,80,"EUR",0),
                candidate(2,90,100,"EUR",4),candidate(3,90,100,"EUR",1),candidate(4,90,120,"EUR",0))))
                .startsWith(3L);
    }
    @Test void differentCurrenciesNeverCompeteAsIfTheirAmountsWereComparable() {
        assertThat(AssignmentCandidateRanking.order(List.of(candidate(1,90,1000,"MAD",4),
                candidate(2,81,100,"EUR",0)))).startsWith(1L);
    }
}
