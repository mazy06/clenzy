package com.clenzy.service.agent.concierge;

import com.clenzy.dto.ConversationAnalysisDto;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Classifieur concierge (C2) : conservateur. N'autorise l'auto-envoi QUE pour une
 * intention FAQ claire, sans aucun signal de risque.
 */
class ConciergeIntentClassifierTest {

    private final ConciergeIntentClassifier classifier = new ConciergeIntentClassifier();
    private static final ConversationAnalysisDto POSITIVE = new ConversationAnalysisDto("POSITIVE", 0.8, false);

    @Test
    void faqQuestion_isAutoSendSafe() {
        ConciergeDecision d = classifier.classify("Bonjour, quel est le code wifi ?", POSITIVE);
        assertThat(d.autoSendSafe()).isTrue();
        assertThat(d.reason()).isEqualTo("faq");
    }

    @Test
    void checkInTimeQuestion_isAutoSendSafe() {
        assertThat(classifier.classify("À quelle heure le check-in ?", POSITIVE).autoSendSafe()).isTrue();
    }

    @Test
    void refundRequest_isNotSafe_evenIfWorded_asQuestion() {
        ConciergeDecision d = classifier.classify("Comment obtenir un remboursement ?", POSITIVE);
        assertThat(d.autoSendSafe()).isFalse();
        assertThat(d.reason()).isEqualTo("risk_or_negative");
    }

    @Test
    void negativeSentiment_isNeverSafe() {
        ConversationAnalysisDto negative = new ConversationAnalysisDto("NEGATIVE", 0.1, false);
        assertThat(classifier.classify("Le code wifi ?", negative).autoSendSafe()).isFalse();
    }

    @Test
    void urgent_isNeverSafe() {
        ConversationAnalysisDto urgent = new ConversationAnalysisDto("NEUTRAL", 0.5, true);
        assertThat(classifier.classify("Le code wifi ?", urgent).autoSendSafe()).isFalse();
    }

    @Test
    void lateCheckout_isCrossDomain_notSafe_despiteContainingCheckout() {
        // « checkout » est un mot FAQ, mais « late checkout » engage l'ops → hard-stop.
        ConciergeDecision d = classifier.classify("Est-il possible d'avoir un late checkout ?", POSITIVE);
        assertThat(d.autoSendSafe()).isFalse();
        assertThat(d.reason()).isEqualTo("cross_domain");
    }

    @Test
    void extraNightRequest_isCrossDomain() {
        ConciergeDecision d = classifier.classify("Je voudrais une nuit supplémentaire.", POSITIVE);
        assertThat(d.autoSendSafe()).isFalse();
        assertThat(d.reason()).isEqualTo("cross_domain");
    }

    @Test
    void unknownIntent_isNotSafe() {
        ConciergeDecision d = classifier.classify("Je réfléchis encore à mon séjour.", POSITIVE);
        assertThat(d.autoSendSafe()).isFalse();
        assertThat(d.reason()).isEqualTo("not_whitelisted");
    }

    @Test
    void broadenedFaq_restaurantRecommendation_isAutoSendSafe() {
        assertThat(classifier.classify("Un bon restaurant à proximité ?", POSITIVE).autoSendSafe()).isTrue();
    }

    @Test
    void nullMessage_isNotSafe() {
        assertThat(classifier.classify(null, POSITIVE).autoSendSafe()).isFalse();
    }
}
