package com.clenzy.service;

import com.clenzy.integration.geo.BanGeocodingClient.AddressMatch;
import com.clenzy.marketplace.service.BaitlyProfessionalData.Business;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.assertj.core.api.Assertions.*;

class BaitlyCrmAddressGeocodingTest {
    Business business=new Business("39950664100402","Atalian","110 RUE DE L'OURCQ 75019 PARIS","PARIS","75019","81.22Z",null,null);
    AddressMatch point(double score,String type,String number,String street,String postal,String city) {
        return new AddressMatch("75119_6980_00110","110 Rue de l'Ourcq 75019 Paris",type,number,street,postal,city,score,48.894309,2.371479);
    }
    @Test void aUniqueExactHouseNumberAndHighScoreAllowsAutomaticPlacement(){
        assertThat(BaitlyCrmAddressGeocoding.complete(business)).isTrue();
        assertThat(BaitlyCrmAddressGeocoding.reliable(business,List.of(point(.98,"housenumber","110","Rue de l’Ourcq","75019","Paris")))).isTrue();
    }
    @Test void aNearbyAlternativeRequiresManualReviewEvenWithHighScores(){
        assertThat(BaitlyCrmAddressGeocoding.reliable(business,List.of(point(.98,"housenumber","110","Rue de l'Ourcq","75019","Paris"),
            point(.94,"housenumber","110","Rue de l'Ourcq","75019","Paris")))).isFalse();
    }
    @Test void lowScoresWrongComponentsAndStreetOnlyResultsAreNeverAutomaticallyConfirmed(){
        for(var candidate:List.of(point(.84,"housenumber","110","Rue de l'Ourcq","75019","Paris"),
            point(.99,"street","","Rue de l'Ourcq","75019","Paris"),
            point(.99,"housenumber","110 bis","Rue de l'Ourcq","75019","Paris"),
            point(.99,"housenumber","110","Rue de l'Ourcq","75018","Paris"),
            point(.99,"housenumber","110","Rue d'Ourcq","75019","Paris"),
            point(.99,"housenumber","110","Rue de l'Ourcq","75019","Pantin")))
            assertThat(BaitlyCrmAddressGeocoding.reliable(business,List.of(candidate))).isFalse();
        assertThat(BaitlyCrmAddressGeocoding.reliable(business,List.of())).isFalse();
    }
    @Test void incompleteOrInconsistentImportedAddressesAreNotSentForAutomaticGeocoding(){
        for(var address:List.of("Paris","RUE DE L'OURCQ 75019 PARIS","110 RUE DE L'OURCQ 75018 PARIS","110 RUE DE L'OURCQ 75019 PANTIN"))
            assertThat(BaitlyCrmAddressGeocoding.complete(new Business(business.siret(),business.name(),address,"PARIS","75019",business.activity(),null,null))).isFalse();
    }
}
