# Documents and contracts in Baitly

## How do I generate PDF documents (quotes, invoices, work orders)?

The "Documents & Communications" module, accessible from the menu of the same name, centralizes your organization's PDF document generation. Baitly handles eight document types: quote, invoice, work order, end-of-mission validation, payment receipt, refund receipt, works authorization and management mandate. Most are generated automatically along the business cycle: a quote is produced when a service request is approved, a works authorization when the quote is accepted, an invoice and a payment receipt when the payment is confirmed, a work order when the intervention starts, an end-of-mission validation when it ends. Each generated document can be sent automatically by email to its recipient (client, technician) with the PDF attached. You can also generate a document manually via the "Generate document" button. The "History" tab lists all generations with the date, the legal number, the type, the file and the status, and lets you download each PDF.

## How do document templates work?

The "Document templates" tab of the Documents & Communications module manages your templates. A template is a file in ODT format (word processing) containing dynamic tags that are replaced at generation time: information about the company, the client, the technician, the property, the intervention, the payment, etc. The "Variables & Tags" tab lists all available tags, sorted by category. You upload a template, Baitly automatically detects its tags, then you activate it: only one active template per document type. The module also manages message templates (email, WhatsApp) for guest communication, in dedicated tabs. Each document template can define the subject and body of the sending email.

## Are invoices and quotes compliant with regulations?

Yes. Invoices and quotes receive a sequential, gapless legal numbering (for example FAC-2025-00001, DEV-2025-00001). Once generated, they are locked and their integrity is guaranteed by a digital fingerprint: a verification button lets you confirm at any time that the document has not been altered. The "Compliance" tab of the Documents module displays statistics (documents generated, documents locked, invoices locked, average compliance score), checks that your templates contain the mandatory legal notices for their type, flags missing notices, and lets you search for a document by its legal number. If there is an error on an invoice, you do not modify it: you issue a corrective document (credit note) linked to it. Access to compliance is restricted to administrators.

## How do I create a management contract (mandate) with an owner?

The "Management Contracts" menu manages the contracts between owners and your property management company. A contract sets the collection mode, the commission rate and drives the automatic distribution of revenue between the owner, the platform and the property manager (a preview of the distribution is displayed while entering the details). Click "New contract", choose the property and the owner, the contract type, the commission rate, the period (an empty end date means an indefinite duration), and the options: automatic renewal, cleaning included, maintenance included, minimum stay in nights, notice period in days. A contract goes through statuses: you can activate it, suspend it or terminate it (termination is irreversible). If a property is operated without an active management contract, Baitly displays it with a "Missing contract" badge and applies the organization's default distribution until a contract is established.

## How does electronic signature of contracts work?

When a management contract is created, a signature link is automatically sent to the owner by email. The owner opens this secure link and signs the document online, without creating an account. The signature is timestamped and accompanied by evidence (declared identity, document fingerprint), and a signature certificate is affixed to the final PDF. In the contract list, the signature status is visible: "Awaiting signature" as long as the owner has not signed, "Signature link expired" if the deadline has passed. In that case, use the "Resend signature link" action (the owner must have an email address on file). Connections to external signature providers can be configured in Settings, Integrations tab, depending on your plan.

## Frequently asked questions

**Can I modify an invoice that has already been generated?**
No: invoices are locked after generation to guarantee their compliance. To correct an error, generate a corrective document (credit note) linked to the original invoice.

**Where can I find all the documents sent to a client?**
In the Documents & Communications menu, History tab: it lists the generated documents and sent messages, with recipient, channel, status, and PDF download.

**Does the owner need a Baitly account to sign their mandate?**
No. They receive a signature link by email and sign online directly. If the link has expired, resend it from the contract's detail page.

**What happens if a property has no management contract?**
A banner and a "Missing contract" badge flag it, and the revenue distribution applies the organization's default setting until a contract is activated.

**Who decides the distribution of a reservation's revenue?**
The property's active management contract: its collection mode and commission rate automatically determine the owner, platform and property manager shares.
