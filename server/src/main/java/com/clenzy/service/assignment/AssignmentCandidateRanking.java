package com.clenzy.service.assignment;

import com.clenzy.model.ServiceRequest;
import com.clenzy.repository.*;
import com.clenzy.service.pricing.HousekeeperScoreService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.util.*;

/** Classe les ressources éligibles sans modifier le destinataire d'une proposition déjà émise. */
@Service
public class AssignmentCandidateRanking {
    private final PricingConfigRepository configs;
    private final TeamRepository teams;
    private final HousekeeperScoreService scores;
    private final InterventionRepository missions;
    private final AssignmentCommercialTerms terms;
    private final ObjectMapper json;
    public AssignmentCandidateRanking(PricingConfigRepository configs,TeamRepository teams,
            HousekeeperScoreService scores,InterventionRepository missions,AssignmentCommercialTerms terms,ObjectMapper json) {
        this.configs=configs; this.teams=teams; this.scores=scores; this.missions=missions; this.terms=terms; this.json=json;
    }
    record Candidate(Long team,int score,BigDecimal price,String currency,long load) {}
    public List<Long> rank(ServiceRequest need,List<Long> eligible) {
        var config=configs.findTopByOrganizationIdOrderByIdDesc(need.getOrganizationId()).orElse(null);
        if (config==null || config.getCleaningEngineConfig()==null || !need.getServiceItemCode().startsWith("cleaning-")) return eligible;
        try { if (!json.readTree(config.getCleaningEngineConfig()).path("autoAssignBestPro").asBoolean(false)) return eligible; }
        catch (com.fasterxml.jackson.core.JsonProcessingException ex) { throw new IllegalStateException("Classement prestataires : configuration invalide",ex); }
        List<Candidate> candidates=new ArrayList<>();
        for (Long teamId:eligible) {
            var team=teams.findById(teamId).orElseThrow();
            Long user=team.getPersonalUserId();
            if (user==null) continue;
            var price=terms.resolve(need,"team",teamId);
            long load=need.getDesiredDate()==null?0:missions.countOpenOnDay(user,need.getOrganizationId(),
                    need.getDesiredDate().toLocalDate().atStartOfDay(),need.getDesiredDate().toLocalDate().plusDays(1).atStartOfDay());
            candidates.add(new Candidate(teamId,scores.computeScore(user,need.getOrganizationId()).score(),
                    price==null?null:price.amount(),price==null?null:price.currency(),load));
        }
        List<Long> ranked=order(candidates);
        eligible.stream().filter(id -> !ranked.contains(id)).forEach(ranked::add);
        return ranked;
    }
    static List<Long> order(List<Candidate> candidates) {
        var remaining=new ArrayList<>(candidates);
        var result=new ArrayList<Long>();
        while (!remaining.isEmpty()) {
            int best=remaining.stream().mapToInt(Candidate::score).max().orElseThrow();
            var cohort=remaining.stream().filter(c -> c.score()>=best-10).toList();
            // Des devises différentes ne se comparent jamais sans taux de change contractuel.
            boolean comparable=cohort.stream().allMatch(c -> c.price()!=null && c.currency()!=null)
                    && cohort.stream().map(Candidate::currency).distinct().count()==1;
            var prices=cohort.stream().map(Candidate::price).filter(Objects::nonNull).sorted().toList();
            BigDecimal median=prices.isEmpty()?BigDecimal.ZERO:prices.get(prices.size()/2);
            var winner=cohort.stream().min(Comparator
                    .comparing((Candidate c) -> comparable?c.price().subtract(median).abs():BigDecimal.valueOf(best-c.score()))
                    .thenComparingLong(Candidate::load).thenComparingLong(Candidate::team)).orElseThrow();
            result.add(winner.team()); remaining.remove(winner);
        }
        return result;
    }
}
