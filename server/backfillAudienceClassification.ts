import 'dotenv/config';
import { adminDb } from './firebaseAdmin';
import {
  fetchImageForVision,
  classifyProductWithGemini,
  ProductAuditItem,
  AudienceClassificationResult
} from './geminiAudienceClassifier';

/**
 * Audit all products in Firestore and optionally run Gemini audience classification.
 * Usage:
 *   npx tsx server/backfillAudienceClassification.ts --dry-run
 *   npx tsx server/backfillAudienceClassification.ts --live
 */
async function main() {
  const isLive = process.argv.includes('--live');
  const modeLabel = isLive ? 'LIVE FIRESTORE WRITE' : 'DRY-RUN (AUDIT & CLASSIFICATION SIMULATION)';

  console.log(`=======================================================`);
  console.log(`NOVA AI GEMINI PRODUCT AUDIENCE CLASSIFICATION`);
  console.log(`MODE: ${modeLabel}`);
  console.log(`=======================================================\n`);

  if (!adminDb) {
    console.error('❌ Firebase Admin DB is not initialized. Check service account settings.');
    process.exit(1);
  }

  // 1. Fetch current collection
  console.log('Fetching live Firestore products collection...');
  const snapshot = await adminDb.collection('products').get();
  const totalProducts = snapshot.size;
  console.log(`Total documents found in 'products' collection: ${totalProducts}\n`);

  if (totalProducts === 0) {
    console.log('No products found in Firestore.');
    process.exit(0);
  }

  const items: ProductAuditItem[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data() || {};
    const aiAttributes = data.aiAttributes || {};
    const visual = aiAttributes.visual || {};
    const existingAudience = aiAttributes.audienceClassification;

    const rawImageUrl = String(data.imageUrl || data.image || data.mainImage || data.img1 || '');

    items.push({
      id: doc.id,
      name: String(data.name || data.title || doc.id),
      category: String(data.category || 'General'),
      subcategory: String(data.subcategory || data.type || 'Garment'),
      description: String(data.description || data.details || ''),
      imageUrl: rawImageUrl,
      existingRawGender: data.gender || data.Gender || data.targetGender || undefined,
      existingAiGender: visual.gender || undefined,
      existingAudienceClassification: existingAudience,
      imageAccessible: false
    });
  }

  console.log(`Starting visual analysis and validation of ${items.length} products...\n`);

  const breakdown: Record<string, number> = {
    Women: 0,
    Men: 0,
    Unisex: 0,
    Unknown: 0
  };

  const statusBreakdown: Record<string, number> = {
    verified: 0,
    unknown: 0
  };

  const inaccessibleImages: Array<{ id: string; name: string; url: string; error: string }> = [];
  const uncertainProducts: Array<{ id: string; name: string; reason: string; confidence: number }> = [];
  const successfulClassifications: Array<{ id: string; name: string; result: AudienceClassificationResult }> = [];

  // Controlled concurrency: process in serial/low-concurrency to avoid Gemini rate limits
  let processedCount = 0;

  for (const item of items) {
    processedCount++;
    console.log(`[${processedCount}/${totalProducts}] Processing: "${item.name}" (ID: ${item.id})`);

    // 1. Image accessibility check
    let imagePayload: { base64: string; mimeType: string; byteSize: number } | null = null;
    try {
      imagePayload = await fetchImageForVision(item.imageUrl);
      item.imageAccessible = true;
      item.imageByteSize = imagePayload.byteSize;
    } catch (err: any) {
      item.imageAccessible = false;
      item.imageError = err.message;
      inaccessibleImages.push({
        id: item.id,
        name: item.name,
        url: item.imageUrl.slice(0, 80),
        error: err.message
      });
      console.warn(`  ⚠️ Image inaccessible: ${err.message}`);
    }

    // 2. Classify with Gemini if image is accessible
    let classification: AudienceClassificationResult;

    if (!item.imageAccessible || !imagePayload) {
      classification = {
        gender: 'Unknown',
        confidence: 0,
        reason: `Image inaccessible or broken (${item.imageError || 'download failed'}). Intended clothing audience cannot be visually verified.`,
        classificationStatus: 'unknown',
        analyzedAt: new Date().toISOString()
      };
    } else {
      try {
        classification = await classifyProductWithGemini(
          item.name,
          item.category,
          item.subcategory,
          item.description,
          imagePayload
        );
      } catch (err: any) {
        console.error(`  ❌ Gemini classification failed: ${err.message}`);
        classification = {
          gender: 'Unknown',
          confidence: 0,
          reason: `Gemini visual analysis failed: ${err.message}`,
          classificationStatus: 'unknown',
          analyzedAt: new Date().toISOString()
        };
      }
    }

    item.classification = classification;
    breakdown[classification.gender] = (breakdown[classification.gender] || 0) + 1;
    statusBreakdown[classification.classificationStatus] = (statusBreakdown[classification.classificationStatus] || 0) + 1;

    if (classification.gender === 'Unknown' || classification.classificationStatus === 'unknown') {
      uncertainProducts.push({
        id: item.id,
        name: item.name,
        reason: classification.reason,
        confidence: classification.confidence
      });
    } else {
      successfulClassifications.push({
        id: item.id,
        name: item.name,
        result: classification
      });
    }

    console.log(`  -> Classification: ${classification.gender} (${classification.confidence}% confidence, ${classification.classificationStatus})`);
    console.log(`     Reason: ${classification.reason}\n`);

    // 3. Live write with read-back verification if in live mode
    if (isLive) {
      try {
        const docRef = adminDb.collection('products').doc(item.id);
        // Use field dot notation update to strictly modify ONLY aiAttributes.audienceClassification
        // without touching aiAttributes.visual or any other existing fields
        await docRef.update({
          'aiAttributes.audienceClassification': classification
        });

        // Read-back verification
        const verifyDoc = await docRef.get();
        const data = verifyDoc.data();
        const stored = data?.aiAttributes?.audienceClassification;
        if (!stored || stored.gender !== classification.gender) {
          throw new Error('Read-back verification mismatch');
        }
        console.log(`  ✅ Stored & verified in Firestore for ${item.id} (aiAttributes.visual preserved: ${Boolean(data?.aiAttributes?.visual)})\n`);
      } catch (writeErr: any) {
        console.error(`  ❌ Failed to write/verify ${item.id} in Firestore: ${writeErr.message}\n`);
      }
    }

    // Rate-limiting delay (500ms between calls)
    await new Promise((resolve) => setTimeout(resolve, 600));
  }

  // Summary Report
  console.log(`\n=======================================================`);
  console.log(`CLASSIFICATION AUDIT SUMMARY (${modeLabel})`);
  console.log(`=======================================================`);
  console.log(`Total Catalogue Products Processed: ${totalProducts}`);
  console.log(`Audience Classification Breakdown:`);
  console.log(`  - Women:   ${breakdown.Women}`);
  console.log(`  - Men:     ${breakdown.Men}`);
  console.log(`  - Unisex:  ${breakdown.Unisex}`);
  console.log(`  - Unknown: ${breakdown.Unknown}`);
  console.log(`\nStatus Breakdown:`);
  console.log(`  - Verified: ${statusBreakdown.verified}`);
  console.log(`  - Unknown:  ${statusBreakdown.unknown}`);

  console.log(`\nInaccessible / Broken Images (${inaccessibleImages.length}):`);
  if (inaccessibleImages.length === 0) {
    console.log('  None. All images accessible.');
  } else {
    for (const img of inaccessibleImages) {
      console.log(`  - [${img.id}] "${img.name}": ${img.error} (URL: ${img.url})`);
    }
  }

  console.log(`\nUncertain / Unverified Products (${uncertainProducts.length}):`);
  if (uncertainProducts.length === 0) {
    console.log('  None.');
  } else {
    for (const unc of uncertainProducts) {
      console.log(`  - [${unc.id}] "${unc.name}" (${unc.confidence}%): ${unc.reason}`);
    }
  }

  console.log(`\nVerified Classifications (${successfulClassifications.length}):`);
  for (const s of successfulClassifications) {
    console.log(`  - [${s.id}] "${s.name}": ${s.result.gender} (${s.result.confidence}%) - ${s.result.reason}`);
  }

  console.log(`\n=======================================================`);
  if (!isLive) {
    console.log(`DRY-RUN COMPLETE. NO WRITES WERE MADE TO FIRESTORE.`);
    console.log(`Awaiting user approval before live execution.`);
  } else {
    console.log(`LIVE BACKFILL COMPLETE. All classifications persisted & verified.`);
  }
  console.log(`=======================================================`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
