import { adminDb } from '../server/firebaseAdmin';
import { products as staticProducts } from '../src/data';

if (!adminDb) {
  throw new Error('Firestore Admin is unavailable; try-on review backfill stopped.');
}

const [reviewSnapshot, productSnapshot, vendorSnapshot] = await Promise.all([
  adminDb.collection('product_reviews').where('source', '==', 'tryon').get(),
  adminDb.collection('products').get(),
  adminDb.collection('vendors').get()
]);

const productsById = new Map<string, Record<string, any>>();
productSnapshot.forEach((doc: any) => {
  const data = doc.data();
  productsById.set(doc.id, { ...data, id: doc.id });
  if (data.productId) productsById.set(String(data.productId), { ...data, id: doc.id });
});
for (const product of Object.values(staticProducts)) {
  productsById.set(String(product.id), product as Record<string, any>);
  if (product.productId) productsById.set(String(product.productId), product as Record<string, any>);
}

const vendorsById = new Map<string, Record<string, any>>();
vendorSnapshot.forEach((doc: any) => {
  vendorsById.set(doc.id, { ...doc.data(), id: doc.id });
});

const batch = adminDb.batch();
let updated = 0;
let alreadyLinked = 0;
let unresolved = 0;

for (const reviewDoc of reviewSnapshot.docs) {
  const review = reviewDoc.data();
  if (typeof review.vendorId === 'string' && review.vendorId.trim()) {
    alreadyLinked++;
    continue;
  }

  const product = productsById.get(String(review.productId || ''));
  const vendorId = String(product?.vendorId || '').trim();
  if (!product || !vendorId) {
    unresolved++;
    continue;
  }

  const vendor = vendorsById.get(vendorId);
  batch.update(reviewDoc.ref, {
    vendorId,
    vendorProductId: product.productId || product.id || review.productId,
    vendorName: review.vendorName || product.vendorName || product.brandName || product.companyName || vendor?.vendorName || vendor?.name || null,
    productName: review.productName || product.name || product.productName || null
  });
  updated++;
}

if (updated > 0) await batch.commit();
console.log(`Try-on review vendor backfill complete. Updated: ${updated}; already linked: ${alreadyLinked}; unresolved: ${unresolved}. Review contents were not changed.`);
