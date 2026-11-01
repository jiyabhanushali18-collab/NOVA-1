import { adminDb } from '../server/firebaseAdmin.ts';

async function main() {
  const s = await adminDb.collection('orders').get();
  console.log('Total root orders now:', s.size);
  s.forEach(d => console.log(' - Doc ID:', d.id, '| Customer:', d.data().customerName, '| Amount: ₹' + d.data().amount, '| Date:', d.data().date));
}

main().catch(console.error);
