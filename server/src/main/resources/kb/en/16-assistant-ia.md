# The Baitly AI assistant

## What can the AI assistant do?

The Baitly AI assistant is accessible from the application's "Assistant" menu. It is a conversational copilot that knows your organization's data: it answers your questions about your reservations, your properties, your occupancy rate, your revenue, your cleaning or maintenance interventions, and your financial indicators. It can also produce summaries (dashboard summary, property performance, booking trends, occupancy forecasts, portfolio analysis). Beyond questions, the assistant can act: list or cancel a reservation, block a day in the calendar, create or assign an intervention, simulate a rate change, send a message to a guest, or suggest the application page where you can complete a task. It can also look up a city's weather forecast and local events, useful for anticipating demand. Sensitive actions (cancellation, sending a message, blocking the calendar) are always presented to you for confirmation before execution.

## How do I ask a question about my data?

Open the assistant from the "Assistant" menu and write your question in natural language, for example "What is my occupancy rate this month?", "List my reservations for next week" or "Which cleaning interventions are pending?". The assistant queries your organization's data directly and answers with real figures. You can chain questions within the same conversation: the assistant keeps the context. A side panel lists your past conversations, which you can resume at any time. The assistant also has a long-term memory: you can ask it to remember an important fact ("remember that Villa Azur is closed in January") and it will recall it in your future conversations. You can also ask it to forget.

## Can I send images to the assistant?

Yes. You can attach up to 3 images per message in the assistant chat. Each image must be at most 5 MB, in JPEG, PNG, GIF or WebP format. Images that are too large are automatically compressed in the browser before sending. The assistant analyzes the content of the images: you can, for example, show it a photo of a property, of damage or of a document and ask questions about it. Image analysis consumes AI budget, just like text conversations.

## What is the assistant's knowledge base?

The assistant can cite documentation thanks to a built-in document search. Two types of documents are indexed: global Baitly documents (the product documentation, accessible to all organizations) and your organization's own documents (your internal procedures, instructions, guides), which are private and visible only to your team. When you ask a question, the assistant automatically searches this base for relevant passages and uses them to answer. To manage these documents, go to Settings, "AI" tab, "Documentation" section: you will see the list of indexed documents with their scope ("Global Baitly" or "My organization"), you can upload new ones in Markdown format (.md, 2 MB maximum per file) and delete those that are no longer up to date. Uploading organization documents is open to owners and administrators; global documents are reserved for the Baitly platform team.

## How do action cards and autonomy levels work?

Baitly distinguishes three autonomy levels for its AI agents (visible in the agent supervisor settings): "Suggest" (the agents propose, you decide), "Act then notify" (they act and keep you informed) and "Auto" (they manage fully autonomously). In suggestion mode, proposals appear as cards to validate: for example a rate adjustment on slow slots, a follow-up on a failed payment or the scheduling of a missing cleaning. You accept or dismiss each card. In the chat, when you confirm the same action several times, the assistant may offer you a "trust rule" so it no longer asks for confirmation; these rules are managed in the autonomy settings (accept, dismiss, revoke). A monthly credit cap frames premium proactive actions; at the cap, you choose between "notify only" or pausing autonomy.

## What are the assistant's briefings?

The assistant can produce briefings: concise situation updates on your activity, which bring together in a single message the essentials of what lies ahead — upcoming reservations, arrivals and departures, the day's operations (cleanings, interventions), and points of attention requiring a decision. Briefing-related settings are found in Settings, "AI" tab, "Briefings" section. You can also simply ask for a situation update in the assistant chat, for example "give me a briefing of my day" or "summarize what happened this week".

## Frequently asked questions

**Can the assistant modify my data without my consent?**
Not by default: sensitive actions require your confirmation in the chat. An action only becomes automatic if you explicitly enable a trust rule or a higher autonomy level in the settings.

**How many images can I send in a message?**
Up to 3 images per message, of 5 MB maximum each, in JPEG, PNG, GIF or WebP format.

**How do I add my own documents to the assistant?**
In Settings, AI tab, Documentation section: upload a Markdown file (.md, 2 MB max). It will be indexed for your organization only and the assistant will be able to cite it.

**Does the assistant know the weather?**
Yes, it can look up a city's weather forecast as well as local events, which helps anticipate demand and plan operations.

**Is my AI usage limited?**
Yes, each organization has a monthly budget. You track your consumption (tokens, cost) in Settings, AI tab, Consumption section, with a configurable alert threshold.
