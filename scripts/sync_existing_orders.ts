import { adminDb } from '../server/firebaseAdmin.ts';
import { FieldValue } from 'firebase-admin/firestore';

async function syncExistingOrders() {
  console.log('🔄 Checking for user sub-orders that are missing from root "orders"...');

  const usersSnap = await adminDb.collection('users').get();
  let migratedCount = 0;

  for (const userDoc of usersSnap.docs) {
    const subOrdersSnap = await userDoc.ref.collection('orders').get();
    for (const subOrder of subOrdersSnap.docs) {
      const orderData = subOrder.data();
      const cleanDocId = subOrder.id.replace(/[^a-zA-Z0-9_-]/g, '');

      // Check if already in root orders
      const rootDoc = await adminDb.collection('orders').doc(cleanDocId).get();
      if (!rootDoc.exists) {
        console.log(`Copying missing order ${cleanDocId} to root "orders"...`);
        
        const addr = orderData.deliveryAddress || {};
        const customerName = addr.fullName || userDoc.data()?.name || 'Customer';
        const initials = customerName
          .split(' ')
          .filter(Boolean)
          .map((part: string) => part[0]?.toUpperCase() || '')
          .slice(0, 2)
          .join('') || 'C';

        const rawItems: any[] = Array.isArray(orderData.items) ? orderData.items : [];
        const flattenedItems = rawItems.map((item: any) => {
          const prod = item.product || {};
          const price = Number(prod.price ?? item.price ?? 0);
          const qty = Number(item.quantity ?? 1);
          return {
            productId: String(prod.id || prod.productId || item.productId || ''),
            productName: String(prod.name || item.productName || 'Fashion Item'),
            imageUrl: String(prod.imageUrl || prod.images?.[0] || item.imageUrl || ''),
            category: String(prod.category || item.category || 'Apparel'),
            vendorId: String(prod.vendorId || item.vendorId || 'VEN001'),
            vendorName: String(prod.vendorName || item.vendorName || 'Trendy Threads'),
            price,
            quantity: qty,
            amount: price * qty,
            status: 'Pending',
            color: String(item.color || prod.color || ''),
            size: String(item.size || 'M')
          };
        });

        const primaryItem = flattenedItems[0] || {};
        const totalQuantity = flattenedItems.reduce((sum: number, it: any) => sum + (it.quantity || 1), 0) || 1;
        const vendorIds = Array.from(new Set(flattenedItems.map((it: any) => it.vendorId).filter(Boolean)));
        if (vendorIds.length === 0) vendorIds.push('VEN001');

        const createdAtDate = orderData.createdAt ? new Date(orderData.createdAt) : new Date();
        const dateFormatted = createdAtDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });

        const rootPayload = {
          id: orderData.orderId || `#${cleanDocId}`,
          orderId: orderData.orderId || `#${cleanDocId}`,
          userId: userDoc.id,
          customerName,
          customerInitials: initials,
          customerAvatar: '',
          productName: primaryItem.productName || 'Fashion Item',
          productId: primaryItem.productId || '',
          quantity: totalQuantity,
          amount: Number(orderData.grandTotal ?? orderData.amount ?? 0),
          subtotal: Number(orderData.subtotal ?? 0),
          taxes: Number(orderData.taxes ?? 0),
          discount: Number(orderData.discount ?? 0),
          shipping: Number(orderData.shipping ?? 0),
          grandTotal: Number(orderData.grandTotal ?? orderData.amount ?? 0),
          paymentMethod: orderData.paymentMethod || 'cod',
          date: dateFormatted,
          status: 'Pending',
          salesEligible: true,
          vendorId: primaryItem.vendorId || 'VEN001',
          vendorName: primaryItem.vendorName || 'Trendy Threads',
          vendorIds,
          deliveryAddress: addr,
          items: flattenedItems,
          createdAt: orderData.createdAt ? new Date(orderData.createdAt) : FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        };

        await adminDb.collection('orders').doc(cleanDocId).set(rootPayload);
        migratedCount++;
        console.log(`  ✅ Successfully migrated ${cleanDocId} to root "orders"!`);
      }
    }
  }

  console.log(`\n🎉 Done! Migrated ${migratedCount} order(s) to root "orders".`);
}

syncExistingOrders().catch(console.error);

