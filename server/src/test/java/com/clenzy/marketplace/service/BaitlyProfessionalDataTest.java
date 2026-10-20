package com.clenzy.marketplace.service;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
class BaitlyProfessionalDataTest {
    final ObjectMapper mapper=new ObjectMapper();
    final BaitlyProfessionalData.Business business=new BaitlyProfessionalData.Business("12345678900011","Atlas Services","12 rue du Port","Nantes","44000","81.21Z",47.2,-1.5);
    @Test void onlyActiveDiffusibleEstablishmentsAreDeduplicated() throws Exception {
        var root=mapper.readTree("""
          {"results":[{"nom_complet":"Atlas","statut_diffusion":"O","etat_administratif":"A","matching_etablissements":[
            {"siret":"12345678900011","statut_diffusion_etablissement":"O","etat_administratif":"A","latitude":"47.2"},
            {"siret":"12345678900011","statut_diffusion_etablissement":"O","etat_administratif":"A"},
            {"siret":"12345678900012","statut_diffusion_etablissement":"P","etat_administratif":"A"},
            {"siret":"12345678900013","statut_diffusion_etablissement":"O","etat_administratif":"F"}]}]}
          """);
        var rows=BaitlyProfessionalData.businesses(root);assertThat(rows).hasSize(1);assertThat(rows.getFirst().latitude()).isEqualTo(47.2);
    }
    @Test void unknownDiffusionIsRejected() throws Exception {
        assertThat(BaitlyProfessionalData.businesses(mapper.readTree("{\"results\":[{}]}"))).isEmpty();
    }
    @Test void exactSiretResultsStillRespectSelectedCityAndService() throws Exception {
        var root=mapper.readTree("""
            {"results":[{"nom_complet":"Atlas","statut_diffusion":"O","etat_administratif":"A","matching_etablissements":[
              {"siret":"12345678900011","statut_diffusion_etablissement":"O","etat_administratif":"A","commune":"44109","activite_principale":"81.21Z"},
              {"siret":"12345678900012","statut_diffusion_etablissement":"O","etat_administratif":"A","commune":"75056","activite_principale":"81.21Z"},
              {"siret":"12345678900013","statut_diffusion_etablissement":"O","etat_administratif":"A","commune":"44109","activite_principale":"43.21A"}]}]}
            """);
        var rows=BaitlyProfessionalData.businesses(root,java.util.Set.of("44109"),BaitlyProfessionalSearchFilters.activities("CLEANING"),"");
        assertThat(rows).extracting(BaitlyProfessionalData.Business::siret).containsExactly("12345678900011");
        assertThat(BaitlyProfessionalSearchFilters.communes("75056")).hasSize(20).contains("75101","75120");
        assertThatThrownBy(()->BaitlyProfessionalSearchFilters.activities("UNKNOWN")).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void rejectsExplicitSiretMismatchAndInvalidCoordinates() throws Exception {
        var root=mapper.readTree("""
          {"elements":[{"type":"node","id":1,"lat":47.2,"lon":-1.5,"tags":{"name":"Atlas Services","ref:FR:SIRET":"99999999900011"}},
            {"type":"node","id":2,"lat":999,"lon":-1.5,"tags":{"name":"Atlas Services"}}]}
          """);assertThat(BaitlyProfessionalData.places(root,business)).isEmpty();
    }
    @Test void ranksSiretFirstWithoutInventingCertainty() throws Exception {
        var root=mapper.readTree("""
          {"elements":[{"type":"node","id":1,"lat":47.2,"lon":-1.5,"tags":{"name":"Atlas Services","addr:postcode":"44000"}},
            {"type":"way","id":2,"center":{"lat":47.2,"lon":-1.5},"tags":{"name":"Atlas","ref:FR:SIRET":"12345678900011","contact:email":"hello@example.com","contact:website":"https://example.com"}}]}
          """);var rows=BaitlyProfessionalData.places(root,business);
        assertThat(rows.getFirst().key()).isEqualTo("way/2");assertThat(rows.getFirst().signals()).containsExactly("SIRET");
        assertThat(rows.getFirst().email()).isEqualTo("hello@example.com");assertThat(rows.get(1).signals()).containsExactly("NAME","POSTAL_CODE");
    }
    @Test void rejectsExecutableAndPrivateLinks(){
        assertThat(BaitlyProfessionalData.website("javascript:alert(1)")).isEmpty();assertThat(BaitlyProfessionalData.website("http://example.com")).isEmpty();
        assertThat(BaitlyProfessionalData.website("https://127.0.0.1/path")).isEmpty();assertThat(BaitlyProfessionalData.website("https://user:secret@example.com")).isEmpty();
    }
}
