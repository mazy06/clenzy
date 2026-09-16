package com.clenzy.config;

import java.util.Collection;
import java.util.Map;
import com.clenzy.service.assignment.AssignmentDeadlineDispatcher;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.clients.consumer.Consumer;
import org.apache.kafka.common.TopicPartition;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.listener.ConsumerAwareRebalanceListener;
import org.springframework.kafka.listener.ContainerProperties;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.FixedBackOff;

@Configuration
@ConditionalOnProperty(name="clenzy.kafka.enabled",havingValue="true",matchIfMissing=true)
public class AssignmentConsumerConfig {
    public static final String TOPIC="baitly.assignment.jobs";
    @Bean public NewTopic assignmentJobsTopic() { return TopicBuilder.name(TOPIC).partitions(3).replicas(1).build(); }
    @Bean public ConcurrentKafkaListenerContainerFactory<String,Object> assignmentKafkaFactory(
            ConsumerFactory<String,Object> consumers,ApplicationEventPublisher events,
            TenantIsolatingRecordInterceptor interceptor) {
        var factory=new ConcurrentKafkaListenerContainerFactory<String,Object>();
        factory.setConsumerFactory(consumers);
        factory.setRecordInterceptor(interceptor);
        factory.getContainerProperties().setAckMode(ContainerProperties.AckMode.RECORD);
        factory.setCommonErrorHandler(new DefaultErrorHandler(new FixedBackOff(5000,FixedBackOff.UNLIMITED_ATTEMPTS)));
        factory.getContainerProperties().setConsumerRebalanceListener(new ConsumerAwareRebalanceListener() {
            @Override public void onPartitionsAssigned(Consumer<?,?> consumer,Collection<TopicPartition> partitions) {
                if (!partitions.isEmpty()) events.publishEvent(new AssignmentDeadlineDispatcher.RecoveryRequested());
            }
        });
        return factory;
    }
    @Bean public AssignmentJobConsumer assignmentJobConsumer(AssignmentDeadlineDispatcher dispatcher) {
        return new AssignmentJobConsumer(dispatcher);
    }
    public static class AssignmentJobConsumer {
        private final AssignmentDeadlineDispatcher dispatcher;
        public AssignmentJobConsumer(AssignmentDeadlineDispatcher dispatcher) { this.dispatcher=dispatcher; }
        @KafkaListener(topics=TOPIC,groupId="baitly-assignment-jobs",containerFactory="assignmentKafkaFactory")
        public void consume(Map<String,Object> payload) { dispatcher.wake(((Number)payload.get("jobId")).longValue()); }
    }
}
