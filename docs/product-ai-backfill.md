# NOVA Product Gemini Backfill Preparation

This is an approval-gated, read-only preparation for product visual analysis. The current implementation discovers and plans work; it does not call Gemini, write Firestore, or run automatically on application startup.

## `aiAttributes` contract

The proposed field is separate from all vendor-entered product fields:

```text
aiAttributes:
  schemaVersion: "1.0"
  status: "pending" | "complete" | "failed"
  source: "gemini" | "hybrid"
  model: string | null
  analyzedAt: ISO timestamp | null
  imageFingerprint: SHA-256 | null
  confidence: number | null
  visual:
    category
    subcategory
    gender
    primaryColor
    secondaryColors[]
    pattern
    texture
    visibleDetails[]
    fabric
    sleeveType
    neckType
    fit
    length
    silhouette
    styleTags[]
    occasionTags[]
    seasonTags[]
    formality
  error?: { code, message, at }
```

The values are mapped from the existing validated Gemini garment schema in [`server/wardrobeAnalyzer.ts`](../server/wardrobeAnalyzer.ts). Vendor fields remain untouched. The recommendation backend can consume `aiAttributes.visual` and use `imageFingerprint`, `model`, `schemaVersion`, and `confidence` for freshness and ranking.

## Dry-run command

```text
npx tsx scripts/product-ai-backfill-dry-run.ts --output=output/product-ai-backfill-dry-run.json
```

The command:

- reads the `products` collection;
- identifies current, missing, changed-image, failed, invalid, and missing-image records;
- estimates Gemini requests;
- records the configured primary/fallback models;
- writes only a local report;
- performs zero Gemini requests and zero Firestore writes.

The separate execution command exists but refuses to run unless both explicit flags are supplied. It was not run for this task.

## Processing controls for the approved execution phase

The planned execution interface should use:

```text
npx tsx scripts/product-ai-backfill.ts --execute --confirm-live-backfill --batch-size=5 --concurrency=2
```

Add `--retry-failed` to retry records whose previous `aiAttributes.status` is `failed`. The execution script writes only `aiAttributes` using `updateDoc`; it does not update any vendor, price, inventory, image, variant, or identity field.

Required behavior:

- default batch size: 5;
- default concurrency: 2;
- bounded inter-request delay;
- existing `GEMINI_MODEL` primary model;
- existing `gemini-3.1-flash-lite` fallback;
- skip `status=complete` records with the same image fingerprint;
- retry `status=failed` records only when requested;
- preserve previous successful attributes until replacement analysis succeeds;
- write only `aiAttributes`;
- fail closed unless an explicit confirmation flag is present;
- persist a local progress report after each batch.

The execution script is never imported by application startup and no live execution was performed during this task.

## Three-product pilot

The separately gated pilot selects exactly three valid existing products with usable images, in deterministic product-ID order. It does not use the full backfill planner and cannot process a fourth product:

```text
npx tsx scripts/product-ai-pilot.ts --execute --confirm-pilot
```

The pilot:

- reuses the existing Gemini primary/fallback cascade;
- analyzes exactly three selected products sequentially;
- writes only `aiAttributes`;
- records the model, timestamp, image fingerprint, status, and extracted visual attributes;
- rereads every document after writing;
- verifies that all non-`aiAttributes` fields are unchanged;
- prints each product ID and extracted attributes.

The command was added for controlled approval only and has not been run. Do not start it until the pilot is explicitly approved.

## New and updated products

The existing product routes are in [`server/productRouter.ts`](../server/productRouter.ts). They currently write product data directly and do not have a post-write analysis hook.

After approval, the safest lifecycle integration is:

1. Complete the product create/update write.
2. Return the normal product response immediately.
3. Enqueue a separate analysis job using the image fingerprint.
4. Write only `aiAttributes` when analysis succeeds.
5. On failure, write a failed status without changing vendor data.
6. On update, enqueue only when the effective image fingerprint changes.

This should not block product creation or update requests.

## Reporting requirements

The dry-run report provides:

- total products discovered;
- already analysed/current products;
- products requiring analysis;
- missing usable images;
- estimated Gemini requests;
- model/fallback configuration;
- per-product reason and image source field.

During approved execution, the report must additionally include:

- successfully analysed products;
- failed products and sanitized reasons;
- actual request count;
- retry/fallback counts;
- per-batch progress;
- no API keys or image payloads.

## Quota considerations

The initial estimate is one Gemini request per product requiring analysis, with additional attempts possible for transient retries and fallback models. The dry-run does not contact Gemini and therefore cannot measure quota consumption. A 57-document catalogue should be processed in small batches, with concurrency no higher than the approved limit and a pause between requests. Failed or unchanged-image records should not be repeatedly submitted.

## Safety status

- No live backfill was executed.
- No Gemini API request was made by the dry-run.
- No Firestore write was made.
- No product, vendor, price, inventory, image, or variant field was changed.
- No application startup behavior was changed.
