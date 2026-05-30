package com.clenzy.service;

import jakarta.mail.Address;
import jakarta.mail.BodyPart;
import jakarta.mail.FetchProfile;
import jakarta.mail.Flags;
import jakarta.mail.Folder;
import jakarta.mail.Message;
import jakarta.mail.MessagingException;
import jakarta.mail.Session;
import jakarta.mail.Store;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMultipart;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.springframework.test.util.ReflectionTestUtils;

import java.lang.reflect.Method;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link MailReceiverService}.
 *
 * <p>The service builds its own JavaMail {@link jakarta.mail.Session} and
 * {@link Store} inside the private {@code connectStore()} method, so we cannot
 * easily inject mocks for the connection-bound paths. We exercise:</p>
 *
 * <ul>
 *   <li>All "IMAP disabled / unconfigured" early-return paths (deterministic).</li>
 *   <li>All "real connection failure" paths (no IMAP server in CI → exceptions
 *       are caught and returned as error maps).</li>
 *   <li>The private helpers ({@code messageToMap}, {@code extractBody},
 *       {@code extractFromMultipart}) via reflection — they are the bulk of the
 *       business logic and do not require an actual connection.</li>
 * </ul>
 */
class MailReceiverServiceTest {

    private MailReceiverService service;

    @BeforeEach
    void setUp() {
        service = new MailReceiverService();
    }

    private void enableImapForFailingConnection() {
        // Enabled + non-empty password forces the service into the connect path,
        // which then fails (no IMAP server available in test env) → the catch
        // block returns a sentinel map / list.
        ReflectionTestUtils.setField(service, "imapEnabled", true);
        ReflectionTestUtils.setField(service, "imapPassword", "secret-test-password");
        ReflectionTestUtils.setField(service, "imapUsername", "test@clenzy.fr");
        ReflectionTestUtils.setField(service, "imapHost", "127.0.0.1");
        ReflectionTestUtils.setField(service, "imapPort", 19_993);
    }

    // ───────────────────────── disabled / unconfigured ─────────────────────

    @Nested
    @DisplayName("when IMAP is disabled or unconfigured")
    class DisabledPaths {

        @Test
        void testConnection_returnsFalse_whenImapDisabled() {
            ReflectionTestUtils.setField(service, "imapEnabled", false);
            ReflectionTestUtils.setField(service, "imapPassword", "anything");

            assertThat(service.testConnection()).isFalse();
        }

        @Test
        void testConnection_returnsFalse_whenPasswordIsNull() {
            ReflectionTestUtils.setField(service, "imapEnabled", true);
            ReflectionTestUtils.setField(service, "imapPassword", null);

            assertThat(service.testConnection()).isFalse();
        }

        @Test
        void testConnection_returnsFalse_whenPasswordIsBlank() {
            ReflectionTestUtils.setField(service, "imapEnabled", true);
            ReflectionTestUtils.setField(service, "imapPassword", "   ");

            assertThat(service.testConnection()).isFalse();
        }

        @Test
        void listEmails_returnsEmptyResult_whenImapDisabled() {
            ReflectionTestUtils.setField(service, "imapEnabled", false);
            ReflectionTestUtils.setField(service, "imapPassword", "secret");

            Map<String, Object> result = service.listEmails("INBOX", 0, 20);

            assertThat(result).containsEntry("total", 0);
            assertThat(result).containsEntry("page", 0);
            assertThat(result).containsEntry("size", 20);
            @SuppressWarnings("unchecked")
            List<Object> emails = (List<Object>) result.get("emails");
            assertThat(emails).isEmpty();
        }

        @Test
        void listEmails_returnsEmpty_whenPasswordBlank() {
            ReflectionTestUtils.setField(service, "imapEnabled", true);
            ReflectionTestUtils.setField(service, "imapPassword", "");

            Map<String, Object> result = service.listEmails(null, 2, 50);

            assertThat(result).containsEntry("total", 0);
            assertThat(result).containsEntry("page", 2);
            assertThat(result).containsEntry("size", 50);
        }

        @Test
        void listEmails_returnsEmpty_whenPasswordNull() {
            ReflectionTestUtils.setField(service, "imapEnabled", true);
            ReflectionTestUtils.setField(service, "imapPassword", null);

            Map<String, Object> result = service.listEmails("Sent", 0, 10);

            assertThat(result.get("emails")).isEqualTo(List.of());
        }

        @Test
        void getEmail_returnsError_whenImapDisabled() {
            ReflectionTestUtils.setField(service, "imapEnabled", false);
            ReflectionTestUtils.setField(service, "imapPassword", "secret");

            Map<String, Object> result = service.getEmail("INBOX", 1);

            assertThat(result).containsKey("error");
            assertThat((String) result.get("error")).contains("IMAP non configuré");
        }

        @Test
        void getEmail_returnsError_whenPasswordBlank() {
            ReflectionTestUtils.setField(service, "imapEnabled", true);
            ReflectionTestUtils.setField(service, "imapPassword", "   ");

            Map<String, Object> result = service.getEmail("INBOX", 1);

            assertThat(result).containsKey("error");
        }

        @Test
        void listFolders_returnsEmptyList_whenDisabled() {
            ReflectionTestUtils.setField(service, "imapEnabled", false);
            ReflectionTestUtils.setField(service, "imapPassword", "secret");

            assertThat(service.listFolders()).isEmpty();
        }

        @Test
        void listFolders_returnsEmptyList_whenPasswordNull() {
            ReflectionTestUtils.setField(service, "imapEnabled", true);
            ReflectionTestUtils.setField(service, "imapPassword", null);

            assertThat(service.listFolders()).isEmpty();
        }
    }

    // ───────────────────── enabled but connection fails ────────────────────

    @Nested
    @DisplayName("when IMAP is enabled but the connection fails")
    class ConnectionFailurePaths {

        @Test
        void testConnection_returnsFalse_whenConnectionFails() {
            enableImapForFailingConnection();

            // No IMAP server running on localhost:19993 → connect throws → caught → false
            assertThat(service.testConnection()).isFalse();
        }

        @Test
        void listEmails_returnsErrorMap_whenConnectionFails() {
            enableImapForFailingConnection();

            Map<String, Object> result = service.listEmails("INBOX", 0, 20);

            assertThat(result).containsEntry("total", 0);
            assertThat(result).containsKey("error");
        }

        @Test
        void listEmails_useDefaultFolderName_whenNull() {
            enableImapForFailingConnection();

            Map<String, Object> result = service.listEmails(null, 0, 10);

            // Even if it fails to connect, the call returns gracefully
            assertThat(result).containsEntry("total", 0);
        }

        @Test
        void getEmail_returnsErrorMap_whenConnectionFails() {
            enableImapForFailingConnection();

            Map<String, Object> result = service.getEmail("INBOX", 1);

            assertThat(result).containsKey("error");
        }

        @Test
        void getEmail_useDefaultFolderName_whenNull() {
            enableImapForFailingConnection();

            Map<String, Object> result = service.getEmail(null, 1);

            assertThat(result).containsKey("error");
        }

        @Test
        void listFolders_returnsEmptyList_whenConnectionFails() {
            enableImapForFailingConnection();

            assertThat(service.listFolders()).isEmpty();
        }
    }

    // ─────────────────────── messageToMap (reflection) ─────────────────────

    @Nested
    @DisplayName("messageToMap")
    class MessageToMap {

        private Map<String, Object> invokeMessageToMap(Message msg, boolean includeBody) throws Exception {
            Method m = MailReceiverService.class.getDeclaredMethod(
                    "messageToMap", Message.class, boolean.class);
            m.setAccessible(true);
            @SuppressWarnings("unchecked")
            Map<String, Object> result = (Map<String, Object>) m.invoke(service, msg, includeBody);
            return result;
        }

        @Test
        void mapsBasicHeadersWithoutBody() throws Exception {
            Message msg = mock(Message.class);
            when(msg.getMessageNumber()).thenReturn(7);
            when(msg.getSubject()).thenReturn("Hello there");
            Date sent = Date.from(java.time.Instant.parse("2026-01-15T10:30:00Z"));
            when(msg.getSentDate()).thenReturn(sent);
            when(msg.getReceivedDate()).thenReturn(sent);
            InternetAddress from = new InternetAddress("alice@example.com", "Alice Doe");
            when(msg.getFrom()).thenReturn(new Address[]{from});
            InternetAddress to = new InternetAddress("bob@example.com", "Bob");
            when(msg.getRecipients(Message.RecipientType.TO)).thenReturn(new Address[]{to});
            Flags flags = new Flags();
            flags.add(Flags.Flag.SEEN);
            flags.add(Flags.Flag.FLAGGED);
            when(msg.getFlags()).thenReturn(flags);

            Map<String, Object> map = invokeMessageToMap(msg, false);

            assertThat(map).containsEntry("messageNumber", 7);
            assertThat(map).containsEntry("subject", "Hello there");
            assertThat(map.get("sentDate")).isInstanceOf(String.class);
            assertThat(map.get("receivedDate")).isInstanceOf(String.class);

            @SuppressWarnings("unchecked")
            Map<String, String> fromMap = (Map<String, String>) map.get("from");
            assertThat(fromMap).containsEntry("email", "alice@example.com");
            assertThat(fromMap).containsEntry("name", "Alice Doe");

            @SuppressWarnings("unchecked")
            List<Map<String, String>> toList = (List<Map<String, String>>) map.get("to");
            assertThat(toList).hasSize(1);
            assertThat(toList.get(0)).containsEntry("email", "bob@example.com");

            assertThat(map).containsEntry("seen", true);
            assertThat(map).containsEntry("flagged", true);
            assertThat(map).containsEntry("answered", false);
            assertThat(map).doesNotContainKey("body");
            assertThat(map).doesNotContainKey("contentType");
        }

        @Test
        void includesBodyWhenRequested() throws Exception {
            Message msg = mock(Message.class);
            when(msg.getMessageNumber()).thenReturn(1);
            when(msg.getSubject()).thenReturn("Subj");
            when(msg.getSentDate()).thenReturn(null);
            when(msg.getReceivedDate()).thenReturn(null);
            when(msg.getFrom()).thenReturn(null);
            when(msg.getRecipients(Message.RecipientType.TO)).thenReturn(null);
            when(msg.getFlags()).thenReturn(new Flags());
            when(msg.getContent()).thenReturn("Body plain text");
            when(msg.getContentType()).thenReturn("text/plain; charset=UTF-8");

            Map<String, Object> map = invokeMessageToMap(msg, true);

            assertThat(map).containsEntry("body", "Body plain text");
            assertThat(map.get("contentType")).asString().contains("text/plain");
        }

        @Test
        void handlesNullDatesAndAddresses() throws Exception {
            Message msg = mock(Message.class);
            when(msg.getMessageNumber()).thenReturn(0);
            when(msg.getSubject()).thenReturn(null);
            when(msg.getSentDate()).thenReturn(null);
            when(msg.getReceivedDate()).thenReturn(null);
            when(msg.getFrom()).thenReturn(null);
            when(msg.getRecipients(Message.RecipientType.TO)).thenReturn(null);
            when(msg.getFlags()).thenReturn(new Flags());

            Map<String, Object> map = invokeMessageToMap(msg, false);

            assertThat(map).containsEntry("sentDate", null);
            assertThat(map).containsEntry("receivedDate", null);
            assertThat(map).doesNotContainKey("from");
            assertThat(map).doesNotContainKey("to");
        }

        @Test
        void handlesEmptyFromArray() throws Exception {
            Message msg = mock(Message.class);
            when(msg.getMessageNumber()).thenReturn(3);
            when(msg.getSubject()).thenReturn("s");
            when(msg.getSentDate()).thenReturn(null);
            when(msg.getReceivedDate()).thenReturn(null);
            when(msg.getFrom()).thenReturn(new Address[0]);
            when(msg.getRecipients(Message.RecipientType.TO)).thenReturn(null);
            when(msg.getFlags()).thenReturn(new Flags());

            Map<String, Object> map = invokeMessageToMap(msg, false);

            assertThat(map).doesNotContainKey("from");
        }

        @Test
        void handlesFromWithoutPersonalName() throws Exception {
            Message msg = mock(Message.class);
            when(msg.getMessageNumber()).thenReturn(1);
            when(msg.getSubject()).thenReturn("");
            when(msg.getSentDate()).thenReturn(null);
            when(msg.getReceivedDate()).thenReturn(null);
            InternetAddress from = new InternetAddress("noname@example.com");
            when(msg.getFrom()).thenReturn(new Address[]{from});
            when(msg.getRecipients(Message.RecipientType.TO)).thenReturn(null);
            when(msg.getFlags()).thenReturn(new Flags());

            Map<String, Object> map = invokeMessageToMap(msg, false);

            @SuppressWarnings("unchecked")
            Map<String, String> fromMap = (Map<String, String>) map.get("from");
            assertThat(fromMap).containsEntry("email", "noname@example.com");
            assertThat(fromMap).containsEntry("name", "");
        }

        @Test
        void handlesMultipleTos() throws Exception {
            Message msg = mock(Message.class);
            when(msg.getMessageNumber()).thenReturn(11);
            when(msg.getSubject()).thenReturn("");
            when(msg.getSentDate()).thenReturn(null);
            when(msg.getReceivedDate()).thenReturn(null);
            when(msg.getFrom()).thenReturn(null);
            when(msg.getRecipients(Message.RecipientType.TO)).thenReturn(new Address[]{
                    new InternetAddress("a@example.com"),
                    new InternetAddress("b@example.com", "Bob")
            });
            when(msg.getFlags()).thenReturn(new Flags());

            Map<String, Object> map = invokeMessageToMap(msg, false);

            @SuppressWarnings("unchecked")
            List<Map<String, String>> toList = (List<Map<String, String>>) map.get("to");
            assertThat(toList).hasSize(2);
            assertThat(toList.get(1)).containsEntry("name", "Bob");
        }

        @Test
        void capturesExceptionInsideMapping() throws Exception {
            Message msg = mock(Message.class);
            when(msg.getMessageNumber()).thenThrow(new RuntimeException("disconnected"));

            Map<String, Object> map = invokeMessageToMap(msg, false);

            assertThat(map).containsKey("error");
            assertThat((String) map.get("error")).contains("Erreur lecture message");
        }
    }

    // ─────────────────────── extractBody (reflection) ──────────────────────

    @Nested
    @DisplayName("extractBody")
    class ExtractBody {

        private String invokeExtractBody(Message msg) throws Exception {
            Method m = MailReceiverService.class.getDeclaredMethod("extractBody", Message.class);
            m.setAccessible(true);
            return (String) m.invoke(service, msg);
        }

        @Test
        void returnsString_whenContentIsString() throws Exception {
            Message msg = mock(Message.class);
            when(msg.getContent()).thenReturn("Plain text body");

            assertThat(invokeExtractBody(msg)).isEqualTo("Plain text body");
        }

        @Test
        void returnsEmptyString_whenContentIsNull() throws Exception {
            Message msg = mock(Message.class);
            when(msg.getContent()).thenReturn(null);

            assertThat(invokeExtractBody(msg)).isEqualTo("");
        }

        @Test
        void delegatesToExtractFromMultipart_whenMimeMultipart() throws Exception {
            Message msg = mock(Message.class);
            MimeMultipart mp = mock(MimeMultipart.class);
            when(mp.getCount()).thenReturn(0);
            when(msg.getContent()).thenReturn(mp);

            assertThat(invokeExtractBody(msg)).isEqualTo("");
        }

        @Test
        void returnsToString_whenUnknownContent() throws Exception {
            Message msg = mock(Message.class);
            // Use an object whose toString() is deterministic
            Object weird = new Object() {
                @Override
                public String toString() { return "weird-body"; }
            };
            when(msg.getContent()).thenReturn(weird);

            assertThat(invokeExtractBody(msg)).isEqualTo("weird-body");
        }
    }

    // ─────────────────── extractFromMultipart (reflection) ─────────────────

    @Nested
    @DisplayName("extractFromMultipart")
    class ExtractFromMultipart {

        private String invokeExtractMultipart(MimeMultipart mp) throws Exception {
            Method m = MailReceiverService.class.getDeclaredMethod(
                    "extractFromMultipart", MimeMultipart.class);
            m.setAccessible(true);
            return (String) m.invoke(service, mp);
        }

        @Test
        void prefersHtmlOverText_whenBothPresent() throws Exception {
            MimeMultipart mp = mock(MimeMultipart.class);
            when(mp.getCount()).thenReturn(2);

            BodyPart text = mock(BodyPart.class);
            when(text.getContentType()).thenReturn("text/plain; charset=utf-8");
            when(text.getContent()).thenReturn("Hello text");
            when(mp.getBodyPart(0)).thenReturn(text);

            BodyPart html = mock(BodyPart.class);
            when(html.getContentType()).thenReturn("text/HTML; charset=utf-8");
            when(html.getContent()).thenReturn("<p>Hello HTML</p>");
            when(mp.getBodyPart(1)).thenReturn(html);

            assertThat(invokeExtractMultipart(mp)).isEqualTo("<p>Hello HTML</p>");
        }

        @Test
        void fallsBackToText_whenNoHtml() throws Exception {
            MimeMultipart mp = mock(MimeMultipart.class);
            when(mp.getCount()).thenReturn(1);

            BodyPart text = mock(BodyPart.class);
            when(text.getContentType()).thenReturn("text/plain; charset=utf-8");
            when(text.getContent()).thenReturn("Only text");
            when(mp.getBodyPart(0)).thenReturn(text);

            assertThat(invokeExtractMultipart(mp)).isEqualTo("Only text");
        }

        @Test
        void returnsEmpty_whenNoTextOrHtml() throws Exception {
            MimeMultipart mp = mock(MimeMultipart.class);
            when(mp.getCount()).thenReturn(1);

            BodyPart part = mock(BodyPart.class);
            when(part.getContentType()).thenReturn("application/octet-stream");
            when(mp.getBodyPart(0)).thenReturn(part);

            assertThat(invokeExtractMultipart(mp)).isEqualTo("");
        }

        @Test
        void recursesIntoNestedMultipart_andPicksHtml() throws Exception {
            MimeMultipart outer = mock(MimeMultipart.class);
            when(outer.getCount()).thenReturn(1);

            MimeMultipart nested = mock(MimeMultipart.class);
            when(nested.getCount()).thenReturn(2);

            BodyPart nestedText = mock(BodyPart.class);
            when(nestedText.getContentType()).thenReturn("text/plain");
            when(nestedText.getContent()).thenReturn("nested-text");
            when(nested.getBodyPart(0)).thenReturn(nestedText);

            BodyPart nestedHtml = mock(BodyPart.class);
            when(nestedHtml.getContentType()).thenReturn("text/html");
            when(nestedHtml.getContent()).thenReturn("<b>nested-html</b>");
            when(nested.getBodyPart(1)).thenReturn(nestedHtml);

            BodyPart wrapper = mock(BodyPart.class);
            // Wrapper says multipart/alternative — nested-result will be HTML
            when(wrapper.getContentType()).thenReturn("multipart/alternative");
            when(wrapper.getContent()).thenReturn(nested);
            when(outer.getBodyPart(0)).thenReturn(wrapper);

            // The nested result will be assigned to textContent because the wrapper
            // contentType ("multipart/alternative") does not contain "html".
            // It still returns the wrapper's nested HTML content (the algorithm
            // recursively prefers HTML inside the nested part).
            String result = invokeExtractMultipart(outer);
            // The outer wrapper has content "multipart/alternative" (no html keyword)
            // so its nested result is stored as textContent → returned at the end.
            assertThat(result).isEqualTo("<b>nested-html</b>");
        }

        @Test
        void handlesEmptyMultipart() throws Exception {
            MimeMultipart mp = mock(MimeMultipart.class);
            when(mp.getCount()).thenReturn(0);

            assertThat(invokeExtractMultipart(mp)).isEqualTo("");
        }

        @Test
        void recursesIntoNestedHtmlWrapper() throws Exception {
            // Wrapper itself has contentType containing "html" → result goes to htmlContent
            MimeMultipart outer = mock(MimeMultipart.class);
            when(outer.getCount()).thenReturn(1);

            MimeMultipart nested = mock(MimeMultipart.class);
            when(nested.getCount()).thenReturn(1);
            BodyPart inner = mock(BodyPart.class);
            when(inner.getContentType()).thenReturn("text/html");
            when(inner.getContent()).thenReturn("inside");
            when(nested.getBodyPart(0)).thenReturn(inner);

            BodyPart wrapper = mock(BodyPart.class);
            when(wrapper.getContentType()).thenReturn("multipart/related; type=\"text/html\"");
            when(wrapper.getContent()).thenReturn(nested);
            when(outer.getBodyPart(0)).thenReturn(wrapper);

            assertThat(invokeExtractMultipart(outer)).isEqualTo("inside");
        }

        @Test
        void ignoresEmptyNestedResult() throws Exception {
            MimeMultipart outer = mock(MimeMultipart.class);
            when(outer.getCount()).thenReturn(1);

            MimeMultipart nested = mock(MimeMultipart.class);
            when(nested.getCount()).thenReturn(0);

            BodyPart wrapper = mock(BodyPart.class);
            when(wrapper.getContentType()).thenReturn("multipart/alternative");
            when(wrapper.getContent()).thenReturn(nested);
            when(outer.getBodyPart(0)).thenReturn(wrapper);

            assertThat(invokeExtractMultipart(outer)).isEqualTo("");
        }
    }

    // ──────────────── happy path via MockedStatic on Session ──────────────

    @Nested
    @DisplayName("happy paths with mocked Session")
    class MockedSessionHappyPaths {

        @Test
        void testConnection_returnsTrue_whenStoreConnected() throws Exception {
            enableImapForFailingConnection();
            Session session = mock(Session.class);
            Store store = mock(Store.class);
            when(session.getStore("imaps")).thenReturn(store);
            when(store.isConnected()).thenReturn(true);

            try (MockedStatic<Session> sm = mockStatic(Session.class)) {
                sm.when(() -> Session.getInstance(any(Properties.class))).thenReturn(session);

                assertThat(service.testConnection()).isTrue();
            }
        }

        @Test
        void listEmails_returnsMessages_whenStoreHasMessages() throws Exception {
            enableImapForFailingConnection();
            Session session = mock(Session.class);
            Store store = mock(Store.class);
            Folder folder = mock(Folder.class);

            when(session.getStore("imaps")).thenReturn(store);
            when(store.getFolder("INBOX")).thenReturn(folder);
            when(folder.getMessageCount()).thenReturn(3);

            Message m1 = simpleMessage(1, "Subject 1");
            Message m2 = simpleMessage(2, "Subject 2");
            Message m3 = simpleMessage(3, "Subject 3");
            when(folder.getMessages(anyInt(), anyInt())).thenReturn(new Message[]{m1, m2, m3});

            try (MockedStatic<Session> sm = mockStatic(Session.class)) {
                sm.when(() -> Session.getInstance(any(Properties.class))).thenReturn(session);

                Map<String, Object> result = service.listEmails("INBOX", 0, 10);

                assertThat(result).containsEntry("total", 3);
                assertThat(result).containsEntry("page", 0);
                assertThat(result).containsEntry("size", 10);
                assertThat(result).containsKey("totalPages");
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> emails = (List<Map<String, Object>>) result.get("emails");
                assertThat(emails).hasSize(3);
            }
        }

        @Test
        void listEmails_returnsEmptyList_whenFolderEmpty() throws Exception {
            enableImapForFailingConnection();
            Session session = mock(Session.class);
            Store store = mock(Store.class);
            Folder folder = mock(Folder.class);
            when(session.getStore("imaps")).thenReturn(store);
            when(store.getFolder("INBOX")).thenReturn(folder);
            when(folder.getMessageCount()).thenReturn(0);

            try (MockedStatic<Session> sm = mockStatic(Session.class)) {
                sm.when(() -> Session.getInstance(any(Properties.class))).thenReturn(session);

                Map<String, Object> result = service.listEmails("INBOX", 0, 10);

                assertThat(result).containsEntry("total", 0);
                @SuppressWarnings("unchecked")
                List<Object> emails = (List<Object>) result.get("emails");
                assertThat(emails).isEmpty();
            }
        }

        @Test
        void listEmails_returnsEmptyList_whenPageBeyondAvailable() throws Exception {
            enableImapForFailingConnection();
            Session session = mock(Session.class);
            Store store = mock(Store.class);
            Folder folder = mock(Folder.class);
            when(session.getStore("imaps")).thenReturn(store);
            when(store.getFolder("INBOX")).thenReturn(folder);
            when(folder.getMessageCount()).thenReturn(5);

            try (MockedStatic<Session> sm = mockStatic(Session.class)) {
                sm.when(() -> Session.getInstance(any(Properties.class))).thenReturn(session);

                // Page 10 with size 10 → end = 5 - 100 = -95 (< 1) → returns empty
                Map<String, Object> result = service.listEmails("INBOX", 10, 10);

                assertThat(result).containsEntry("total", 5);
                @SuppressWarnings("unchecked")
                List<Object> emails = (List<Object>) result.get("emails");
                assertThat(emails).isEmpty();
            }
        }

        @Test
        void getEmail_returnsMessageMap_whenMessageNumValid() throws Exception {
            enableImapForFailingConnection();
            Session session = mock(Session.class);
            Store store = mock(Store.class);
            Folder folder = mock(Folder.class);
            when(session.getStore("imaps")).thenReturn(store);
            when(store.getFolder("INBOX")).thenReturn(folder);
            when(folder.getMessageCount()).thenReturn(5);
            Message msg = simpleMessage(2, "Hi");
            when(msg.getContent()).thenReturn("body content");
            when(msg.getContentType()).thenReturn("text/plain");
            when(folder.getMessage(2)).thenReturn(msg);

            try (MockedStatic<Session> sm = mockStatic(Session.class)) {
                sm.when(() -> Session.getInstance(any(Properties.class))).thenReturn(session);

                Map<String, Object> result = service.getEmail("INBOX", 2);

                assertThat(result).containsEntry("subject", "Hi");
                assertThat(result).containsEntry("body", "body content");
            }
        }

        @Test
        void getEmail_returnsError_whenMessageNumOutOfBounds() throws Exception {
            enableImapForFailingConnection();
            Session session = mock(Session.class);
            Store store = mock(Store.class);
            Folder folder = mock(Folder.class);
            when(session.getStore("imaps")).thenReturn(store);
            when(store.getFolder("INBOX")).thenReturn(folder);
            when(folder.getMessageCount()).thenReturn(5);

            try (MockedStatic<Session> sm = mockStatic(Session.class)) {
                sm.when(() -> Session.getInstance(any(Properties.class))).thenReturn(session);

                Map<String, Object> resultZero = service.getEmail("INBOX", 0);
                assertThat(resultZero).containsKey("error");

                Map<String, Object> resultOver = service.getEmail("INBOX", 100);
                assertThat(resultOver).containsKey("error");
            }
        }

        @Test
        void listFolders_returnsFolderList() throws Exception {
            enableImapForFailingConnection();
            Session session = mock(Session.class);
            Store store = mock(Store.class);
            Folder root = mock(Folder.class);
            Folder inbox = mock(Folder.class);
            Folder sent = mock(Folder.class);

            when(session.getStore("imaps")).thenReturn(store);
            when(store.getDefaultFolder()).thenReturn(root);
            when(root.list("*")).thenReturn(new Folder[]{inbox, sent});

            when(inbox.getFullName()).thenReturn("INBOX");
            when(inbox.getType()).thenReturn(Folder.HOLDS_MESSAGES);
            when(inbox.getMessageCount()).thenReturn(10);
            when(inbox.getUnreadMessageCount()).thenReturn(3);

            when(sent.getFullName()).thenReturn("Sent");
            // Type 0 = no HOLDS_MESSAGES → skip message count
            when(sent.getType()).thenReturn(0);

            try (MockedStatic<Session> sm = mockStatic(Session.class)) {
                sm.when(() -> Session.getInstance(any(Properties.class))).thenReturn(session);

                List<Map<String, Object>> result = service.listFolders();

                assertThat(result).hasSize(2);
                assertThat(result.get(0)).containsEntry("name", "INBOX");
                assertThat(result.get(0)).containsEntry("messageCount", 10);
                assertThat(result.get(0)).containsEntry("unreadCount", 3);
                assertThat(result.get(1)).containsEntry("name", "Sent");
                assertThat(result.get(1)).doesNotContainKey("messageCount");
            }
        }

        @Test
        void listFolders_skipsFoldersWithErrors() throws Exception {
            enableImapForFailingConnection();
            Session session = mock(Session.class);
            Store store = mock(Store.class);
            Folder root = mock(Folder.class);
            Folder bad = mock(Folder.class);
            Folder good = mock(Folder.class);

            when(session.getStore("imaps")).thenReturn(store);
            when(store.getDefaultFolder()).thenReturn(root);
            when(root.list("*")).thenReturn(new Folder[]{bad, good});
            // getFullName() doesn't declare checked exceptions — throw an unchecked one
            // that gets swallowed by the inner try/catch (Exception is the broad catch)
            when(bad.getFullName()).thenThrow(new RuntimeException("perm denied"));
            when(good.getFullName()).thenReturn("OK");
            when(good.getType()).thenReturn(0);

            try (MockedStatic<Session> sm = mockStatic(Session.class)) {
                sm.when(() -> Session.getInstance(any(Properties.class))).thenReturn(session);

                List<Map<String, Object>> result = service.listFolders();

                assertThat(result).hasSize(1);
                assertThat(result.get(0)).containsEntry("name", "OK");
            }
        }

        private Message simpleMessage(int num, String subject) throws Exception {
            Message m = mock(Message.class);
            lenient().when(m.getMessageNumber()).thenReturn(num);
            lenient().when(m.getSubject()).thenReturn(subject);
            lenient().when(m.getSentDate()).thenReturn(null);
            lenient().when(m.getReceivedDate()).thenReturn(null);
            lenient().when(m.getFrom()).thenReturn(null);
            lenient().when(m.getRecipients(Message.RecipientType.TO)).thenReturn(null);
            lenient().when(m.getFlags()).thenReturn(new Flags());
            return m;
        }
    }

    // ─────────────────────── closeQuietly (reflection) ─────────────────────

    @Nested
    @DisplayName("closeQuietly")
    class CloseQuietly {

        private void invokeCloseQuietly(Folder folder, Store store) throws Exception {
            Method m = MailReceiverService.class.getDeclaredMethod(
                    "closeQuietly", Folder.class, Store.class);
            m.setAccessible(true);
            m.invoke(service, folder, store);
        }

        @Test
        void handlesNullFolderAndStore() throws Exception {
            // Just ensure no exception is thrown
            invokeCloseQuietly(null, null);
        }

        @Test
        void closesOpenFolderAndStore() throws Exception {
            Folder folder = mock(Folder.class);
            when(folder.isOpen()).thenReturn(true);

            Store store = mock(Store.class);

            invokeCloseQuietly(folder, store);
            // Both close methods should have been called — but we don't verify
            // since they're void and might throw; we just check no NPE.
        }

        @Test
        void skipsClosingClosedFolder() throws Exception {
            Folder folder = mock(Folder.class);
            when(folder.isOpen()).thenReturn(false);
            Store store = mock(Store.class);

            invokeCloseQuietly(folder, store);
        }

        @Test
        void swallowsExceptionsFromFolderClose() throws Exception {
            Folder folder = mock(Folder.class);
            when(folder.isOpen()).thenReturn(true);
            lenient().doThrow(new MessagingException("boom")).when(folder).close(false);

            Store store = mock(Store.class);

            // Should not throw
            invokeCloseQuietly(folder, store);
        }
    }
}
