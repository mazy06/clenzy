package com.clenzy.service;

import com.clenzy.model.ServiceQuote;
import com.clenzy.model.User;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.function.BiConsumer;

/**
 * Effets externes d'un devis, executes APRES la transaction qui l'enregistre.
 *
 * <p>{@code @Async} : personne n'attend ce travail. Le rendu du PDF passe par
 * Gotenberg et prend une vingtaine de secondes ; tant qu'il s'executait sur le
 * thread de la requete, l'intervenant regardait tourner son bouton
 * « Enregistrer » alors que son devis etait deja enregistre. L'executeur du
 * projet ({@code AsyncConfig}) porte TenantContext, SecurityContext et MDC sur
 * le thread virtuel — sans quoi le filtre multi-tenant serait inerte.</p>
 *
 * <p>Bean separe, et non une methode privee de {@code ServiceQuoteService} :
 * un {@code @Transactional} appele depuis la meme classe ne passe pas par le
 * proxy Spring (regle audit n°6). Et {@code REQUIRES_NEW} est indispensable —
 * pendant la phase de completion d'une transaction, une propagation REQUIRED
 * rejoint celle qui se termine, d'ou le « Query requires transaction be in
 * progress » qui faisait echouer la generation du PDF et l'ouverture de la
 * discussion.</p>
 */
@Service
public class ServiceQuotePublisher {

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void publish(ServiceQuote quote, User provider, BiConsumer<ServiceQuote, User> work) {
        // `provider` peut etre nul : l'approbation n'a pas d'auteur prestataire,
        // le travail le resout lui-meme.
        work.accept(quote, provider);
    }
}
