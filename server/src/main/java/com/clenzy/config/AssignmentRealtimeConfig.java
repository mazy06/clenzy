package com.clenzy.config;

import com.clenzy.service.assignment.AssignmentRealtime;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;

@Configuration
public class AssignmentRealtimeConfig {
    @Bean public RedisMessageListenerContainer assignmentEventListenerContainer(
            RedisConnectionFactory connection,AssignmentRealtime listener) {
        var container=new RedisMessageListenerContainer();
        container.setConnectionFactory(connection);
        container.addMessageListener(listener,new ChannelTopic(AssignmentRealtime.CHANNEL));
        return container;
    }
}
