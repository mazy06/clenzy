package com.clenzy.config;

import com.clenzy.service.device.DeviceEventListener;
import com.clenzy.service.device.DeviceRealtimePublisher;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;

/**
 * Abonne CETTE instance au canal pub/sub des changements d'objets connectés, pour
 * qu'un webhook reçu par n'importe quelle instance atteigne tous les hubs ouverts.
 * Réutilise la {@link RedisConnectionFactory} existante — même motif que
 * {@link SupervisionRealtimeConfig}.
 */
@Configuration
public class DeviceRealtimeConfig {

    @Bean
    public RedisMessageListenerContainer deviceEventListenerContainer(
            RedisConnectionFactory redisConnectionFactory,
            DeviceEventListener listener) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(redisConnectionFactory);
        container.addMessageListener(listener, new ChannelTopic(DeviceRealtimePublisher.CHANNEL));
        return container;
    }
}
