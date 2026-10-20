package com.clenzy.service;

import com.clenzy.service.email.ContactEmailComposer;
import com.clenzy.service.messaging.*;
import jakarta.mail.*;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.Properties;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class BaitlyCrmCampaignMailTest {
    JavaMailSender sender=mock(JavaMailSender.class);PlatformSettingsService settings=mock(PlatformSettingsService.class);EmailService emails;
    @BeforeEach void setup(){
        @SuppressWarnings("unchecked") ObjectProvider<JavaMailSender> provider=mock(ObjectProvider.class);when(provider.getIfAvailable()).thenReturn(sender);
        emails=new EmailService(provider,mock(SystemEmailTemplateService.class),new TemplateInterpolationService(mock(TranslationService.class)),new EmailWrapperService(),settings);
        ReflectionTestUtils.setField(emails,"fromAddress","sender@example.com");when(settings.getSenderEmail()).thenReturn("sender@example.com");when(settings.getSenderName()).thenReturn("Baitly");
    }
    @Test void usesExistingTransportWithScopedOneClickHeadersAndSanitizedSubject()throws Exception{
        var message=new MimeMessage(Session.getInstance(new Properties()));when(sender.createMimeMessage()).thenReturn(message);
        emails.sendCrmCampaignMessage("alice@example.com","Alice","Maison\r\nInjected","verified@example.com","Hello\r\nBcc: evil","<script>unsafe</script>","https://baitly.fr/campagnes/reponse#token","https://app.baitly.fr/api/public/baitly-campaign-replies/token/unsubscribe","fr");
        verify(sender).send(message);assertThat(message.getHeader("List-Unsubscribe",null)).contains("/token/unsubscribe");assertThat(message.getHeader("List-Unsubscribe-Post",null)).isEqualTo("List-Unsubscribe=One-Click");assertThat(message.getHeader("Bcc",null)).isNull();assertThat(message.getReplyTo()[0].toString()).isEqualTo("verified@example.com");
    }
    @Test void campaignHtmlEscapesUserInputIncludingTheLinkAttribute(){
        String html=new ContactEmailComposer().renderCrmCampaignBody("Alice","<img src=x>","<script>unsafe</script>","https://baitly.fr/#' onclick='x","fr");
        assertThat(html).contains("&lt;script&gt;","&lt;img").doesNotContain("<script>","<img src=x>","href='https://baitly.fr/#' onclick");
    }
}
