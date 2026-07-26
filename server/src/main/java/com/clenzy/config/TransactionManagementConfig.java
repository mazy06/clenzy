package com.clenzy.config;

import com.clenzy.tenant.RlsTenantGucAspect;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.transaction.annotation.EnableTransactionManagement;

/**
 * Fixe l'ordre de l'advisor transactionnel de Spring, pour garantir qu'il s'exécute
 * <b>avant</b> {@link RlsTenantGucAspect} (audit 2026-07, défaut R2).
 *
 * <h2>Pourquoi cette classe existe</h2>
 * <p>{@code RlsGuc} pose ses variables de session en <b>LOCAL</b>
 * ({@code set_config(..., true)}), ce qui suppose une transaction <b>déjà ouverte</b> :
 * hors transaction, l'instruction est silencieusement sans effet. L'aspect est donc annoté
 * {@code @Order(LOWEST_PRECEDENCE)} pour s'exécuter au plus profond de la chaîne d'advisors.</p>
 *
 * <p>Problème : le {@code TransactionInterceptor} de Spring est <b>lui aussi</b> à
 * {@code LOWEST_PRECEDENCE} par défaut, et le projet ne déclarait aucun
 * {@code @EnableTransactionManagement} explicite (Spring Boot l'auto-configurait). À égalité
 * d'ordre, la position relative de deux advisors n'est pas garantie par contrat — elle
 * dépend de l'ordre d'enregistrement des beans. Si l'aspect passait en premier, les GUC
 * seraient posées hors transaction, donc perdues, et la RLS renverrait 0 ligne partout
 * (fail-closed : une panne, pas une fuite).</p>
 *
 * <p>Le Javadoc d'origine de l'aspect notait « Ce positionnement DOIT être validé en
 * staging ». Il n'existe pas de staging, et une validation par observation ne vaut pas un
 * contrat : l'ordre est désormais explicite et verrouillé par
 * {@code TransactionAdvisorOrderTest}.</p>
 *
 * <h2>Points d'attention</h2>
 * <ul>
 *   <li>{@code proxyTargetClass = true} reproduit le défaut de Spring Boot
 *       ({@code spring.aop.proxy-target-class}). Sans lui, la déclaration explicite
 *       ferait retomber sur des proxies JDK — donc sur interfaces uniquement — et
 *       casserait tous les beans transactionnels sans interface.</li>
 *   <li>Déclarer {@code @EnableTransactionManagement} désactive
 *       {@code TransactionAutoConfiguration} de Boot, qui est conditionnelle à son absence.
 *       Le comportement reste identique puisque les deux paramètres qui comptent sont
 *       repris ici.</li>
 * </ul>
 */
@Configuration
@EnableTransactionManagement(
        // Priorité plus haute (valeur plus faible) que l'aspect RLS : l'advisor transactionnel
        // est donc plus externe, et la transaction est ouverte avant la pose des GUC.
        order = Ordered.LOWEST_PRECEDENCE - 100,
        proxyTargetClass = true)
public class TransactionManagementConfig {
}
