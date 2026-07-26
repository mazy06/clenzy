package com.clenzy.config;

import com.clenzy.tenant.TenantContext;
import org.apache.kafka.clients.consumer.Consumer;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.listener.RecordInterceptor;
import org.springframework.stereotype.Component;

/**
 * Garantit qu'un message Kafka ne démarre jamais avec le contexte tenant d'un message
 * précédent, et n'en laisse jamais fuir vers le suivant.
 *
 * <h2>Pourquoi</h2>
 * <p>Audit 2026-07 (REM-S1-05) : {@link TenantContext} est un {@code ThreadLocal}. Les threads
 * de consommation Kafka sont réutilisés d'un message à l'autre, et aucun des 18
 * {@code @KafkaListener} ne nettoyait ce contexte. Il suffisait donc qu'un traitement le
 * positionne — directement, ou via un service appelé en profondeur — pour que le message
 * suivant, traité sur le même thread, hérite silencieusement de l'organisation du précédent.
 * Un incident d'autant plus difficile à diagnostiquer qu'il dépend de l'ordre des messages et
 * de l'affectation des partitions aux threads.</p>
 *
 * <p>Cet intercepteur est <b>générique</b> : il couvre les 18 listeners d'un coup, sans
 * toucher à leur code, là où l'enrobage par {@code TenantScopedExecutor} doit être fait
 * listener par listener (chacun résout son organisation à sa façon, souvent tard dans le
 * traitement).</p>
 *
 * <h2>Ce qu'il ne fait pas</h2>
 * <p>Il ne <b>pose</b> pas l'organisation — il ne peut pas la connaître, elle dépend du
 * payload et de la base. Un listener qui a besoin d'un contexte tenant doit toujours passer
 * par {@code TenantScopedExecutor.runAsOrganization(...)} avec une organisation
 * <b>re-dérivée de la base</b>, comme le font désormais {@code DocumentEventService} et
 * {@code PaymentEventConsumer}. Cet intercepteur garantit seulement le point de départ propre
 * et l'absence de fuite.</p>
 */
@Component
public class TenantIsolatingRecordInterceptor implements RecordInterceptor<String, Object> {

    private static final Logger log = LoggerFactory.getLogger(TenantIsolatingRecordInterceptor.class);

    private final TenantContext tenantContext;

    public TenantIsolatingRecordInterceptor(TenantContext tenantContext) {
        this.tenantContext = tenantContext;
    }

    @Override
    public ConsumerRecord<String, Object> intercept(ConsumerRecord<String, Object> record,
                                                    Consumer<String, Object> consumer) {
        clearLeakedContext(record, "avant");
        return record;
    }

    @Override
    public void afterRecord(ConsumerRecord<String, Object> record, Consumer<String, Object> consumer) {
        clearLeakedContext(record, "apres");
    }

    /**
     * Le nettoyage est inconditionnel ; le log ne se déclenche que si un contexte était
     * réellement présent — c'est-à-dire exactement les cas de fuite à instruire.
     */
    private void clearLeakedContext(ConsumerRecord<String, Object> record, String moment) {
        Long leaked = tenantContext.getOrganizationId();
        if (leaked != null) {
            log.warn("Contexte tenant residuel (org={}) {} le traitement de {}[{}] — nettoyage. "
                    + "Un traitement Kafka ne doit pas laisser de TenantContext sur son thread.",
                    leaked, moment, record.topic(), record.partition());
        }
        tenantContext.clear();
    }
}
