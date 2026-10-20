import type { ReviewedPortrait } from './portrait';

/** Secondary photo-resource review only; never person/equivalence authority.
 * Exact receipts: portrait analysis 2026-10-20, portrait-identity-bindings.json.
 * Excludes resources requiring dedicated crops (LL2 650 and group photo 915).
 * Ordinary future people need no entry: their attached provider media is primary. */
export const reviewedPortraits: readonly ReviewedPortrait[] = [
  {
    "provider": {
      "source": "LAUNCH_LIBRARY_2",
      "entityKind": "PERSON",
      "externalKey": "649"
    },
    "authority": "NASA",
    "sourceResource": "NASA_IMAGE:anna-kikina-portrait_52232656702_o",
    "sourcePage": "https://images.nasa.gov/details/anna-kikina-portrait_52232656702_o",
    "sourceAssetSha256": "534563c50203d588abdd525ea9a4a38223d746464fddc2acb07603d4ac8ab45f",
    "reviewedAt": "2026-10-20",
    "rightsNote": "Suitable for factual educational/informational MISSION1 use with stated source credit, faithful derivative, and no endorsement. CSA is limited to noncommercial use; this is not an unrestricted code/asset license.",
    "media": {
      "url": "https://images-assets.nasa.gov/image/anna-kikina-portrait_52232656702_o/anna-kikina-portrait_52232656702_o~orig.jpg",
      "thumbnailUrl": null,
      "credit": "NASA/Josh Valcarcel",
      "licenseName": "NASA Image and Media Guidelines",
      "licenseUrl": "https://www.nasa.gov/nasa-brand-center/images-and-media/",
      "singleUse": null
    }
  },
  {
    "provider": {
      "source": "LAUNCH_LIBRARY_2",
      "entityKind": "PERSON",
      "externalKey": "713"
    },
    "authority": "NASA",
    "sourceResource": "NASA_CMS:people:40775;media:34232",
    "sourcePage": "https://www.nasa.gov/people/nasa-astronaut-anil-menon/",
    "sourceAssetSha256": "1850462b3103a2754d5e650c2975404b9744d4da5fab7c35f16e5abb6fe92b80",
    "reviewedAt": "2026-10-20",
    "rightsNote": "Suitable for factual educational/informational MISSION1 use with stated source credit, faithful derivative, and no endorsement. CSA is limited to noncommercial use; this is not an unrestricted code/asset license.",
    "media": {
      "url": "https://www.nasa.gov/wp-content/uploads/2021/12/astronaut_candidate_anil_menon.jpg",
      "thumbnailUrl": null,
      "credit": "NASA/Robert Markowitz",
      "licenseName": "NASA Image and Media Guidelines",
      "licenseUrl": "https://www.nasa.gov/nasa-brand-center/images-and-media/",
      "singleUse": null
    }
  },
  {
    "provider": {
      "source": "LAUNCH_LIBRARY_2",
      "entityKind": "PERSON",
      "externalKey": "582"
    },
    "authority": "NASA",
    "sourceResource": "NASA_CMS:people:88101;media:107678",
    "sourcePage": "https://www.nasa.gov/people/jessica-watkins/",
    "sourceAssetSha256": "3a0824a3115b1eb7571268bb8aa4f25ddee83f87f1a5889534d0b5ea7a5ad57c",
    "reviewedAt": "2026-10-20",
    "rightsNote": "Suitable for factual educational/informational MISSION1 use with stated source credit, faithful derivative, and no endorsement. CSA is limited to noncommercial use; this is not an unrestricted code/asset license.",
    "media": {
      "url": "https://www.nasa.gov/wp-content/uploads/2020/06/jsc2017e118354_0.jpg",
      "thumbnailUrl": null,
      "credit": "NASA/Bill Stafford",
      "licenseName": "NASA Image and Media Guidelines",
      "licenseUrl": "https://www.nasa.gov/nasa-brand-center/images-and-media/",
      "singleUse": null
    }
  },
  {
    "provider": {
      "source": "LAUNCH_LIBRARY_2",
      "entityKind": "PERSON",
      "externalKey": "710"
    },
    "authority": "NASA",
    "sourceResource": "NASA_CMS:people:129838;media:130843",
    "sourcePage": "https://www.nasa.gov/people/nasa-astronaut-luke-delaney/",
    "sourceAssetSha256": "f56719ec30a4af692bd29a8b248bcb17300ef5a75008858ca1a60f927093a1ed",
    "reviewedAt": "2026-10-20",
    "rightsNote": "Suitable for factual educational/informational MISSION1 use with stated source credit, faithful derivative, and no endorsement. CSA is limited to noncommercial use; this is not an unrestricted code/asset license.",
    "media": {
      "url": "https://www.nasa.gov/wp-content/uploads/2021/12/astronaut_candidate_luke_delaney.jpg",
      "thumbnailUrl": null,
      "credit": "NASA/Robert Markowitz",
      "licenseName": "NASA Image and Media Guidelines",
      "licenseUrl": "https://www.nasa.gov/nasa-brand-center/images-and-media/",
      "singleUse": null
    }
  },
  {
    "provider": {
      "source": "LAUNCH_LIBRARY_2",
      "entityKind": "PERSON",
      "externalKey": "642"
    },
    "authority": "CSA",
    "sourceResource": "CSA_MEDIA:19916",
    "sourcePage": "https://www.asc-csa.gc.ca/eng/multimedia/search/image/19916",
    "sourceAssetSha256": "b2b21d458ae472311ada8eb3537a8e26c9993eff9c299b9e66537de9e679eb0a",
    "reviewedAt": "2026-10-20",
    "rightsNote": "Suitable for factual educational/informational MISSION1 use with stated source credit, faithful derivative, and no endorsement. CSA is limited to noncommercial use; this is not an unrestricted code/asset license.",
    "media": {
      "url": "https://www.asc-csa.gc.ca/images/recherche//hi-res/18e5c301-82e1-4894-9408-e14590d7a4ee.jpg",
      "thumbnailUrl": null,
      "credit": "Canadian Space Agency",
      "licenseName": "CSA terms of use",
      "licenseUrl": "https://www.asc-csa.gc.ca/eng/terms.asp#copyright-reproduce",
      "singleUse": null
    }
  }
];
