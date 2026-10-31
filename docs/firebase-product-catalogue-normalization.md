# NOVA Firebase Product Catalogue Normalization

This document describes the isolated, read-only catalogue migration preparation tooling.

## Canonical schema

The schema is defined in [`scripts/catalogueSchema.ts`](../scripts/catalogueSchema.ts). It separates:

- vendor/commercial fields from AI-generated fields;
- primary, additional, and variant images;
- raw source data from the proposed canonical representation;
- observed source values from future Gemini values with confidence and provenance.

The proposed product shape contains identity, classification, visual attributes, construction, fashion intelligence, commercial data, media, and `aiMetadata`. Existing vendor, price, inventory, and variant values are carried into the proposed representation; no live values are changed.

## Field mapping

The normalizer in [`scripts/catalogueMigration.ts`](../scripts/catalogueMigration.ts) maps:

| Source fields | Canonical field |
|---|---|
| `name`, `Name`, `productName`, `namde` | `name` |
| `category`, `Category` | `category` |
| `colors`, `Colors`, `Collors`, `color` | `primaryColor`, `secondaryColors` |
| `sizes`, `Sizes`, `size` | `sizes` |
| `originalPrice`, `Original Price`, `OriginalPrice`, `originalprice` | `originalPrice` |
| `discountedPrice`, `discountPrice` | `discountedPrice` |
| `imageUrl`, `mainImage`, `imageurl`, `imageurl1`, `image` | primary `imageUrl` |
| `images`, `imageUrls`, `imageUrl2`, `imageurl2`, `image2` | `images[]` |
| `vendorId`, `vendorId ` | `vendorId` |
| `stock`, `stockQuantity` | `stock` |
| `styleTags`, `style`, `tags` | `styleTags` |
| `occasionTags`, `occasion` | `occasionTags` |
| `seasonTags`, `season` | `seasonTags` |

When more than one alias is populated with different values, the record receives a conflict entry. The raw document is retained in the report and no value is silently discarded.

## Gemini enrichment design

The existing Gemini garment architecture in [`server/wardrobeAnalyzer.ts`](../server/wardrobeAnalyzer.ts) already requests structured category, subcategory, visual, construction, material, style, usage, and matching data. Catalogue enrichment should reuse that contract and model boundary, with these rules:

1. Vendor values remain authoritative by default.
2. Gemini values are stored under `aiMetadata.normalized`, with `source: "gemini"`.
3. Every value includes confidence and unknown values remain `null`, `[]`, or `"Unknown"` according to the field contract.
4. Visually observed facts (colour, pattern, visible construction) are separated from inferences (fabric, occasion, season, formality).
5. A conflict is flagged for review rather than silently overwriting vendor data.
6. Only a later, explicitly authorized migration may write enrichment results.

The existing `gemini-2.5-flash` flow is not modified by this preparation work.

## Image audit

The dry-run script identifies primary, additional, and variant images, detects duplicate URLs, recognizes inline data images, validates URL syntax, and optionally performs read-only `HEAD` requests. It never replaces or deletes an image.

## Dry-run usage

With the existing Firebase web configuration available through environment variables:

```text
npx tsx scripts/catalogue-migration-dry-run.ts --output=output/catalogue-migration-dry-run.json
```

To avoid network image checks while still reading and normalizing Firestore:

```text
npx tsx scripts/catalogue-migration-dry-run.ts --skip-image-check
```

The script has an explicit `writesPerformed: 0` report field and contains no Firestore write API calls.

## Recommendation readiness

The normalized fields support future:

- category/subcategory filtering;
- wardrobe-to-product attribute matching;
- colour compatibility and outfit pairing;
- occasion, season, formality, and style ranking;
- text embeddings over canonical searchable metadata;
- image embeddings over verified primary images;
- combined image/text ranking with confidence penalties for inferred or missing attributes.

Before recommendation productionization, populate canonical taxonomy values, repair unreachable media through an approved process, generate versioned text/image embeddings, and use a weighted ranker that penalizes missing or low-confidence attributes. The current exact category pairing in [`src/services/productMetadataService.ts`](../src/services/productMetadataService.ts) should consume canonical taxonomy values rather than raw legacy category spellings.

## Static catalogue reconciliation

[`src/data.ts`](../src/data.ts) contains seven independent demo/fallback products with IDs that do not match the live Firestore IDs. They should remain available as an explicit offline fallback, but Firestore should be the production authority. Recommendation candidates should carry a source identifier and deduplicate by canonical `productId` (not display name). No static product was deleted or modified.

## Safety and scope

This tooling:

- reads only the `products` collection;
- preserves every raw document in the generated report;
- performs no Firestore writes;
- does not modify authentication, user isolation, the wardrobe flow, or the existing Gemini integration;
- does not alter vendor, price, inventory, or variant records.

