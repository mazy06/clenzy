package com.clenzy.config;

import com.clenzy.tenant.RlsTenantGucAspect;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.annotation.Order;
import org.springframework.transaction.annotation.EnableTransactionManagement;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verrouille l'ordre relatif de l'advisor transactionnel de Spring et de
 * {@link RlsTenantGucAspect}.
 *
 * <h2>Le defaut R2 de l'audit 2026-07</h2>
 * <p>{@code RlsGuc} pose ses GUC en <b>LOCAL</b> ({@code set_config(..., true)}), ce qui
 * exige une transaction <b>deja ouverte</b> : hors transaction, l'instruction est
 * silencieusement sans effet. L'aspect est donc annote
 * {@code @Order(LOWEST_PRECEDENCE)} pour s'executer au plus profond, apres l'ouverture de
 * transaction.</p>
 *
 * <p>Mais le {@code TransactionInterceptor} de Spring est <b>lui aussi</b> a
 * {@code LOWEST_PRECEDENCE} par defaut, et le projet ne declarait aucun
 * {@code @EnableTransactionManagement} explicite. A egalite d'ordre, la position relative
 * de deux advisors n'est pas garantie par contrat. Si l'aspect passait en premier, les GUC
 * seraient posees hors transaction — donc perdues — et la RLS renverrait 0 ligne partout.</p>
 *
 * <p>Le Javadoc d'origine de l'aspect reconnaissait le probleme : « Ce positionnement DOIT
 * etre valide en staging ». Il n'y a pas de staging, et une validation par observation ne
 * vaut pas un contrat : {@link TransactionManagementConfig} fixe desormais l'ordre, et ce
 * test l'empeche de rederiver.</p>
 *
 * <p><b>Portee</b> : test de contrat sur les valeurs d'ordre declarees. La validation
 * comportementale de bout en bout (GUC effectivement posee dans la transaction) releve de
 * {@code RlsEnforcementIT} avec la RLS activee.</p>
 */
class TransactionAdvisorOrderTest {

    @Test
    @DisplayName("l'advisor transactionnel s'execute AVANT l'aspect RLS (defaut R2)")
    void transactionAdvisorOrdersBeforeRlsAspect() {
        EnableTransactionManagement enableTx =
                TransactionManagementConfig.class.getAnnotation(EnableTransactionManagement.class);
        Order aspectOrder = RlsTenantGucAspect.class.getAnnotation(Order.class);

        assertThat(enableTx)
                .as("l'ordre de l'advisor transactionnel doit etre fixe explicitement : "
                        + "le defaut de Spring est LOWEST_PRECEDENCE, a egalite avec l'aspect RLS")
                .isNotNull();
        assertThat(aspectOrder).isNotNull();

        assertThat(enableTx.order())
                .as("un ordre plus faible = priorite plus haute = advisor plus externe : "
                        + "la transaction doit etre ouverte avant que l'aspect ne pose les GUC")
                .isLessThan(aspectOrder.value());
    }

    /**
     * Spring Boot proxifie par CGLIB ({@code spring.aop.proxy-target-class=true} par defaut).
     * Declarer {@code @EnableTransactionManagement} sans le preciser ferait retomber sur des
     * proxies JDK — donc sur interfaces uniquement — et casserait tous les beans
     * transactionnels sans interface.
     */
    @Test
    @DisplayName("la declaration explicite conserve les proxies CGLIB de Spring Boot")
    void explicitDeclarationKeepsBootProxyStrategy() {
        EnableTransactionManagement enableTx =
                TransactionManagementConfig.class.getAnnotation(EnableTransactionManagement.class);

        assertThat(enableTx.proxyTargetClass())
                .as("aligner sur le defaut de Spring Boot, sinon bascule en proxies JDK")
                .isTrue();
    }
}
