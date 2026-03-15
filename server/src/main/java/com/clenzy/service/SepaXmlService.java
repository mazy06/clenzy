package com.clenzy.service;

import com.clenzy.model.Organization;
import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayoutConfig;
import org.springframework.stereotype.Service;
import org.w3c.dom.Document;
import org.w3c.dom.Element;

import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import java.io.StringWriter;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

/**
 * Generates SEPA pain.001.001.03 XML files for batch credit transfers.
 * The generated XML can be uploaded to any SEPA-compliant bank portal.
 */
@Service
public class SepaXmlService {

    private static final String NAMESPACE = "urn:iso:std:iso:20022:tech:xsd:pain.001.001.03";
    private static final String XSI_NAMESPACE = "http://www.w3.org/2001/XMLSchema-instance";
    private static final DateTimeFormatter ISO_DATETIME = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    public String generatePain001(Organization org, List<OwnerPayout> payouts,
                                   Map<Long, OwnerPayoutConfig> configsByOwnerId) {
        validateInputs(org, payouts, configsByOwnerId);

        try {
            Document doc = DocumentBuilderFactory.newInstance().newDocumentBuilder().newDocument();
            doc.setXmlStandalone(true);

            Element document = createRootElement(doc);
            Element custCdtTrfInitn = appendElement(doc, document, "CstmrCdtTrfInitn");

            BigDecimal totalAmount = payouts.stream()
                    .map(OwnerPayout::getNetAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            String msgId = buildMessageId(org.getId());

            appendGroupHeader(doc, custCdtTrfInitn, msgId, payouts.size(), totalAmount, org);
            appendPaymentInfo(doc, custCdtTrfInitn, msgId, payouts, totalAmount, org, configsByOwnerId);

            return serializeToString(doc);
        } catch (Exception e) {
            throw new IllegalStateException("Erreur lors de la generation du fichier SEPA XML: " + e.getMessage(), e);
        }
    }

    private void validateInputs(Organization org, List<OwnerPayout> payouts,
                                 Map<Long, OwnerPayoutConfig> configsByOwnerId) {
        if (org.getSepaDebtorIban() == null || org.getSepaDebtorIban().isBlank()) {
            throw new IllegalArgumentException(
                    "L'IBAN debiteur de l'organisation n'est pas configure. "
                    + "Allez dans Parametres > Reversements pour le renseigner.");
        }
        if (org.getSepaDebtorBic() == null || org.getSepaDebtorBic().isBlank()) {
            throw new IllegalArgumentException("Le BIC debiteur de l'organisation n'est pas configure.");
        }
        if (org.getSepaDebtorName() == null || org.getSepaDebtorName().isBlank()) {
            throw new IllegalArgumentException("Le nom du debiteur de l'organisation n'est pas configure.");
        }
        if (payouts.isEmpty()) {
            throw new IllegalArgumentException("Aucun payout a inclure dans le fichier SEPA.");
        }

        for (OwnerPayout payout : payouts) {
            OwnerPayoutConfig config = configsByOwnerId.get(payout.getOwnerId());
            if (config == null) {
                throw new IllegalArgumentException("Configuration manquante pour le proprietaire " + payout.getOwnerId());
            }
            if (config.getIban() == null || config.getIban().isBlank()) {
                throw new IllegalArgumentException("IBAN manquant pour le proprietaire " + payout.getOwnerId());
            }
            if (config.getBic() == null || config.getBic().isBlank()) {
                throw new IllegalArgumentException("BIC manquant pour le proprietaire " + payout.getOwnerId());
            }
        }
    }

    private Element createRootElement(Document doc) {
        Element root = doc.createElementNS(NAMESPACE, "Document");
        root.setAttribute("xmlns:xsi", XSI_NAMESPACE);
        doc.appendChild(root);
        return root;
    }

    private String buildMessageId(Long orgId) {
        return "CLENZY-" + orgId + "-" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
    }

    private void appendGroupHeader(Document doc, Element parent, String msgId,
                                    int nbOfTxs, BigDecimal ctrlSum, Organization org) {
        Element grpHdr = appendElement(doc, parent, "GrpHdr");
        appendTextElement(doc, grpHdr, "MsgId", msgId);
        appendTextElement(doc, grpHdr, "CreDtTm", LocalDateTime.now().format(ISO_DATETIME));
        appendTextElement(doc, grpHdr, "NbOfTxs", String.valueOf(nbOfTxs));
        appendTextElement(doc, grpHdr, "CtrlSum", ctrlSum.toPlainString());

        Element initgPty = appendElement(doc, grpHdr, "InitgPty");
        appendTextElement(doc, initgPty, "Nm", truncate(org.getSepaDebtorName(), 70));
    }

    private void appendPaymentInfo(Document doc, Element parent, String msgId,
                                    List<OwnerPayout> payouts, BigDecimal ctrlSum,
                                    Organization org, Map<Long, OwnerPayoutConfig> configs) {
        Element pmtInf = appendElement(doc, parent, "PmtInf");
        appendTextElement(doc, pmtInf, "PmtInfId", "PMT-" + msgId);
        appendTextElement(doc, pmtInf, "PmtMtd", "TRF");
        appendTextElement(doc, pmtInf, "NbOfTxs", String.valueOf(payouts.size()));
        appendTextElement(doc, pmtInf, "CtrlSum", ctrlSum.toPlainString());

        Element pmtTpInf = appendElement(doc, pmtInf, "PmtTpInf");
        Element svcLvl = appendElement(doc, pmtTpInf, "SvcLvl");
        appendTextElement(doc, svcLvl, "Cd", "SEPA");

        appendTextElement(doc, pmtInf, "ReqdExctnDt", LocalDate.now().toString());

        Element dbtr = appendElement(doc, pmtInf, "Dbtr");
        appendTextElement(doc, dbtr, "Nm", truncate(org.getSepaDebtorName(), 70));

        Element dbtrAcct = appendElement(doc, pmtInf, "DbtrAcct");
        Element dbtrAcctId = appendElement(doc, dbtrAcct, "Id");
        appendTextElement(doc, dbtrAcctId, "IBAN", org.getSepaDebtorIban().replaceAll("\\s", ""));

        Element dbtrAgt = appendElement(doc, pmtInf, "DbtrAgt");
        Element dbtrFinInstnId = appendElement(doc, dbtrAgt, "FinInstnId");
        appendTextElement(doc, dbtrFinInstnId, "BIC", org.getSepaDebtorBic().replaceAll("\\s", ""));

        appendTextElement(doc, pmtInf, "ChrgBr", "SLEV");

        for (OwnerPayout payout : payouts) {
            appendCreditTransfer(doc, pmtInf, payout, configs.get(payout.getOwnerId()));
        }
    }

    private void appendCreditTransfer(Document doc, Element pmtInf,
                                       OwnerPayout payout, OwnerPayoutConfig config) {
        Element cdtTrfTxInf = appendElement(doc, pmtInf, "CdtTrfTxInf");

        Element pmtId = appendElement(doc, cdtTrfTxInf, "PmtId");
        appendTextElement(doc, pmtId, "EndToEndId", "PAYOUT-" + payout.getId());

        Element amt = appendElement(doc, cdtTrfTxInf, "Amt");
        Element instdAmt = doc.createElement("InstdAmt");
        instdAmt.setAttribute("Ccy", payout.getCurrency() != null ? payout.getCurrency() : "EUR");
        instdAmt.setTextContent(payout.getNetAmount().setScale(2).toPlainString());
        amt.appendChild(instdAmt);

        Element cdtrAgt = appendElement(doc, cdtTrfTxInf, "CdtrAgt");
        Element cdtrFinInstnId = appendElement(doc, cdtrAgt, "FinInstnId");
        appendTextElement(doc, cdtrFinInstnId, "BIC", config.getBic().replaceAll("\\s", ""));

        Element cdtr = appendElement(doc, cdtTrfTxInf, "Cdtr");
        String holderName = config.getBankAccountHolder() != null ? config.getBankAccountHolder() : "N/A";
        appendTextElement(doc, cdtr, "Nm", truncate(holderName, 70));

        Element cdtrAcct = appendElement(doc, cdtTrfTxInf, "CdtrAcct");
        Element cdtrAcctId = appendElement(doc, cdtrAcct, "Id");
        appendTextElement(doc, cdtrAcctId, "IBAN", config.getIban().replaceAll("\\s", ""));

        Element rmtInf = appendElement(doc, cdtTrfTxInf, "RmtInf");
        String description = "Reversement #" + payout.getId();
        if (payout.getPeriodStart() != null && payout.getPeriodEnd() != null) {
            description += " - " + payout.getPeriodStart() + " au " + payout.getPeriodEnd();
        }
        appendTextElement(doc, rmtInf, "Ustrd", truncate(description, 140));
    }

    private String serializeToString(Document doc) throws Exception {
        Transformer transformer = TransformerFactory.newInstance().newTransformer();
        transformer.setOutputProperty(OutputKeys.INDENT, "yes");
        transformer.setOutputProperty(OutputKeys.ENCODING, "UTF-8");
        transformer.setOutputProperty("{http://xml.apache.org/xslt}indent-amount", "2");

        StringWriter writer = new StringWriter();
        transformer.transform(new DOMSource(doc), new StreamResult(writer));
        return writer.toString();
    }

    private Element appendElement(Document doc, Element parent, String name) {
        Element el = doc.createElement(name);
        parent.appendChild(el);
        return el;
    }

    private void appendTextElement(Document doc, Element parent, String name, String text) {
        Element el = doc.createElement(name);
        el.setTextContent(text);
        parent.appendChild(el);
    }

    private String truncate(String value, int maxLength) {
        if (value == null) return "";
        return value.length() > maxLength ? value.substring(0, maxLength) : value;
    }
}
