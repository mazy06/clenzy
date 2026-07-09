package com.clenzy.config;

import com.clenzy.service.agent.supervision.SupervisionEventListener;
import com.clenzy.service.agent.supervision.SupervisionRealtimePublisher;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;

/**
 * Abonne CETTE instance au canal pub/sub des événements de supervision, pour que le
 * temps réel (feed / résolutions) atteigne tous les opérateurs quelle que soit l'instance
 * qui a produit l'événement. Réutilise la {@link RedisConnectionFactory} existante
 * (aucune config Redis supplémentaire). Même pattern que l'invalidation de cache L1.
 */
@Configuration
public class SupervisionRealtimeConfig {

    @Bean
    public RedisMessageListenerContainer supervisionEventListenerContainer(
            RedisConnectionFactory redisConnectionFactory,
            SupervisionEventListener listener) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(redisConnectionFactory);
        container.addMessageListener(listener, new ChannelTopic(SupervisionRealtimePublisher.CHANNEL));
        return container;
    }
}
