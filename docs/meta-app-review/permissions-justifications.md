# Permissions — Justifications pour Meta Review

> À copier-coller dans le formulaire Meta App Review > Permissions and Features. Chaque permission a un champ "Description" (~500 chars) + un champ "How will you use this permission?" (~1000 chars).

---

## `whatsapp_business_management`

### Description (champ Meta)

Clenzy is a property management SaaS for short-term rental managers. We use `whatsapp_business_management` to provision WhatsApp Business Accounts on behalf of our customers during onboarding (Embedded Signup flow), and to submit pre-approved utility message templates that our customers use to communicate with their guests (booking confirmations, check-in instructions, checkout reminders).

### How will you use this permission? (champ Meta)

After a Clenzy customer completes the Embedded Signup flow, we use this permission to:

1. **Read their WhatsApp Business Accounts** via `GET /me/businesses` and `GET /{waba_id}` — to match the WABA they just connected to their Clenzy organization.

2. **List their phone numbers** via `GET /{waba_id}/phone_numbers` — to store the `phone_number_id` they want to use for sending messages.

3. **Submit pre-approved message templates** via `POST /{waba_id}/message_templates` — Clenzy provides 5 standardized templates (booking confirmation, check-in instructions, arrival code, checkout reminder, review request) that we auto-submit to their WABA. The host can then customize them in their Clenzy dashboard.

4. **Check template approval status** via `GET /{waba_id}/message_templates` — to notify the host when templates are approved by Meta.

We do NOT use this permission to access other Business Accounts, modify settings unrelated to messaging, or perform any cross-tenant operations. All API calls are scoped to the authenticated user's BMs via the System User Token.

---

## `whatsapp_business_messaging`

### Description (champ Meta)

Clenzy uses `whatsapp_business_messaging` to send transactional utility messages from our customers (vacation rental property managers) to their guests, and to receive guest replies via webhooks. Use cases include booking confirmations, check-in instructions, access codes, checkout reminders, and 2-way messaging through a unified inbox in the Clenzy PMS.

### How will you use this permission? (champ Meta)

1. **Outbound utility messages** (template-based): for each booking, Clenzy sends 5 pre-approved utility templates at specific times:
   - 7 days before arrival: booking confirmation
   - 1 day before arrival: check-in instructions
   - Day of arrival, 2pm: arrival code + WiFi
   - Day of checkout, 9am: checkout reminder
   - 1 day after departure: review request

   All sends use `POST /{phone_number_id}/messages` with `type=template`. Templates are pre-approved by Meta. Volume: ~10-30 messages/month/property.

2. **2-way conversations**: when a guest replies to a Clenzy-sent message, the reply arrives via Meta webhooks. We display it in the Clenzy inbox, and the property manager replies through Clenzy. Their reply is sent via `POST /{phone_number_id}/messages` with `type=text` or `type=image`.

3. **Mark messages as read** via `POST /{phone_number_id}/messages` with `status=read` for the guest UX.

We do NOT use this permission for marketing/promotional messages (no marketing templates in v1), bulk broadcasts, or any unsolicited outreach. Guests always opt-in via the booking process and can opt-out via Clenzy preferences or by replying STOP.

---

## `business_management`

### Description (champ Meta)

Clenzy uses `business_management` to read the list of Business Accounts associated with our customer during the Embedded Signup flow, so we can correctly match the WhatsApp Business Account they just provisioned to their Clenzy organization. Read-only usage, no writes to Business settings.

### How will you use this permission? (champ Meta)

When a Clenzy customer completes the Embedded Signup flow, the OAuth callback gives us a short-lived access token. We use `business_management` to call:

1. `GET /me/businesses` — list the user's Business Accounts.

2. `GET /{business_id}/owned_whatsapp_business_accounts` — filter to find the WABA they just created or selected during signup.

This is necessary because a single Facebook user can be admin of multiple Business Managers, each potentially with multiple WABAs. We need to identify which one corresponds to the WhatsApp Business Account they connected to Clenzy.

We do NOT write to Business settings, modify roles, add users, or perform any action beyond the read calls listed above. All data accessed is limited to the BMs of the authenticated user (no cross-tenant access).

---

## Embedded Signup Configuration

### Configuration ID

Will be created in App Dashboard > WhatsApp > Configurations after approval. To be added to Clenzy env: `META_EMBEDDED_SIGNUP_CONFIG_ID`.

### Configuration parameters

- **Feature type** : `whatsapp_business_app_onboarding`
- **Solution ID** : (Clenzy's WhatsApp Business Solution ID after Tech Provider activation)
- **Setup logo** : Clenzy mark (1024×1024, brand color #6B8A9A)
- **Setup title** : "Connectez votre WhatsApp Business à Clenzy"
- **Setup description** : "En quelques clics, autorisez Clenzy à envoyer des messages WhatsApp à vos voyageurs depuis votre numéro Business."

---

## Data Use Checkup

À cocher dans le formulaire Meta :

- [x] **Personal data accessed via this app** : `whatsapp_business_management` accesses WABA IDs, phone number IDs, message template content. `whatsapp_business_messaging` accesses message contents sent/received. `business_management` accesses Business Account IDs and names.
- [x] **Data shared with third parties** : NO. Clenzy does not share user data with third parties beyond what is necessary to operate the service (e.g., Meta itself for sending messages, AWS S3 for media storage with encryption-at-rest, Brevo for transactional email).
- [x] **Data retention** : 90 days for message logs by default, customizable per organization. WABA credentials retained as long as the integration is active. On account deletion, all data is purged within 30 days (RGPD compliant).
- [x] **Data deletion endpoint** : `DELETE /api/users/me` purges all user data including WhatsApp conversations.
- [x] **Privacy policy URL** : https://clenzy.fr/confidentialite
- [x] **Terms of service URL** : https://clenzy.fr/cgu
