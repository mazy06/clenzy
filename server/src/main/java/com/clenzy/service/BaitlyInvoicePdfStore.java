package com.clenzy.service;

import com.clenzy.model.*;
import jakarta.persistence.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static com.clenzy.service.BaitlyRefundSeries.require;

/** Transactions courtes autour du rendu PDF, qui reste hors transaction dans Finance. */
@Service @Transactional
public class BaitlyInvoicePdfStore {
    private final EntityManager em;
    private final DocumentStorageService storage;
    public BaitlyInvoicePdfStore(EntityManager em,DocumentStorageService storage){this.em=em;this.storage=storage;}
    @Transactional(readOnly=true) public byte[] existing(Long org,Long id) {
        var i=invoice(org,id,false);var found=find(org,id);
        if(!found.isEmpty())return verified(i,found.getFirst());
        if(i.getDocumentGenerationId()==null)return null;
        var d=em.find(DocumentGeneration.class,i.getDocumentGenerationId());
        require(d!=null && org.equals(d.getOrganizationId()) && Objects.equals(i.getInvoiceNumber(),d.getLegalNumber()),"PDF historique différent de la facture : rapprochement requis dans Conformité");
        require(d.isLocked() && d.getDocumentHash()!=null && d.getFilePath()!=null,"Preuve d'archivage PDF incomplète");
        byte[] bytes=storage.loadAsBytes(d.getFilePath());
        require(BaitlyInvoiceChecks.hash(bytes).equals(d.getDocumentHash()),"Intégrité du PDF historique invalide");return bytes;
    }
    public byte[] archive(Long org,Long id,String sourceHash,byte[] bytes) {
        var i=invoice(org,id,true);var found=find(org,id);
        if(!found.isEmpty())return verified(i,found.getFirst());
        require(i.getStatus()!=InvoiceStatus.DRAFT && i.isImmutable(),"Émettez le document avant son archivage");
        require(Objects.equals(sourceHash,BaitlyInvoiceChecks.fingerprint(i)),"Le document a changé pendant le rendu");
        BaitlyPdfEngine.validate(bytes);
        em.persist(new BaitlyInvoicePdfArchive(org,id,sourceHash,BaitlyInvoiceChecks.hash(bytes),bytes));em.flush();return bytes;
    }
    private byte[] verified(Invoice i,BaitlyInvoicePdfArchive archive){require(BaitlyInvoiceChecks.fingerprint(i).equals(archive.getSourceHash()) && BaitlyInvoiceChecks.hash(archive.getContent()).equals(archive.getDocumentHash()),"L'archive a divergé du document : rapprochement requis");return archive.getContent();}
    private Invoice invoice(Long org,Long id,boolean lock){var i=lock?em.find(Invoice.class,id,LockModeType.PESSIMISTIC_WRITE):em.find(Invoice.class,id);require(i!=null && org!=null && org.equals(i.getOrganizationId()),"Facture inaccessible");i.getLines().size();return i;}
    private List<BaitlyInvoicePdfArchive> find(Long org,Long id){return em.createQuery("from BaitlyInvoicePdfArchive where organizationId=:org and invoiceId=:id",BaitlyInvoicePdfArchive.class).setParameter("org",org).setParameter("id",id).getResultList();}
}
