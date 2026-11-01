import { adminDb } from '../server/firebaseAdmin';

async function main() {
  if (!adminDb) {
    console.error('❌ Firebase Admin is not initialized. Please check your service account credentials in .env');
    process.exit(1);
  }

  try {
    const s = await adminDb.collection('orders').get();
    console.log('\n================ ROOT ORDERS COLLECTION ================');
    console.log(`Total orders in root 'orders' collection: ${s.size}\n`);

    if (s.empty) {
      console.log('No orders found.');
    } else {
      s.forEach(d => {
        const data = d.data();
        console.log(`• Order ID: ${d.id}`);
        console.log(`  Customer: ${data.customerName || 'N/A'}`);
        console.log(`  Product:  ${data.productName || 'N/A'}`);
        console.log(`  Amount:   ₹${data.amount ?? data.grandTotal ?? 0}`);
        console.log(`  Status:   ${data.status || 'Pending'}`);
        console.log(`  Date:     ${data.date || data.createdAt || 'N/A'}`);
        console.log('--------------------------------------------------------');
      });
    }
  } catch (error) {
    console.error('Error fetching orders:', error);
  }
}

main().catch(console.error);
