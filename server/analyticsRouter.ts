import express, { Request, Response } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  Timestamp,
  QueryConstraint
} from 'firebase/firestore';
import { adminDb } from './firebaseAdmin';
import { firestore } from './firebase';

const router = express.Router();

if (!adminDb) {
  console.warn('[Analytics] Firestore persistence is disabled: configure Firebase Admin credentials; analytics events remain in memory only.');
}

export type AnalyticsEventType =
  | 'product_impression'
  | 'product_view'
  | 'search_submitted'
  | 'search_click'
  | 'category_selected'
  | 'filter_applied'
  | 'wishlist_add'
  | 'wishlist_remove'
  | 'ar_tryon_started'
  | 'ar_tryon_succeeded'
  | 'ar_tryon_failed'
  | 'ar_tryon_ended'
  | 'ar_tryon_product_selected'
  | 'ar_tryon_product_changed'
  | 'ar_tryon_result_saved'
  | 'cart_add'
  | 'cart_remove'
  | 'cart_quantity_update'
  | 'checkout_started'
  | 'purchase_completed'
  | 'saved_look_created';

export interface AnalyticsEventRecord {
  event_id: string;
  event_type: AnalyticsEventType;
  occurred_at: string;
  received_at: string;
  product_id?: string;
  vendor_id?: string;
  vendor_name?: string;
  session_id: string;
  user_id?: string;
  category_id?: string;
  source_screen?: string;
  metadata?: Record<string, any>;
  schema_version: '1.0';
}

// Fallback authoritative catalog for vendor resolution when offline or in dev
const KNOWN_CATALOG_VENDORS: Record<string, { vendorId: string; vendorName: string; category: string; price: number; name: string }> = {
  'lavender-hoodie': { vendorId: 'vendor_urban_style', vendorName: 'Urban Style Studios', category: 'Streetwear', price: 1499, name: 'Lavender Hoodie' },
  'cargo-pants': { vendorId: 'vendor_urban_style', vendorName: 'Urban Style Studios', category: 'Casual', price: 1899, name: 'Cargo Pants' },
  'white-sneakers': { vendorId: 'vendor_kicks_lab', vendorName: 'Kicks Lab', category: 'Footwear', price: 2999, name: 'White Sneakers' },
  'crossbody-bag': { vendorId: 'vendor_atelier_luxe', vendorName: 'Atelier Luxe', category: 'Accessories', price: 2199, name: 'Crossbody Bag' },
  'grey-jacket': { vendorId: 'vendor_nordic_apparel', vendorName: 'Nordic Apparel', category: 'Outerwear', price: 3499, name: 'Grey Jacket' },
  'denim-jacket': { vendorId: 'vendor_urban_style', vendorName: 'Urban Style Studios', category: 'Streetwear', price: 2799, name: 'Streetwear Denim Jacket' },
  'beige-shirt': { vendorId: 'vendor_nordic_apparel', vendorName: 'Nordic Apparel', category: 'Smart Casual', price: 1599, name: 'Smart Casual Beige Shirt' },
};

// In-memory sliding window store & idempotency set
const processedEventIds = new Set<string>();
const inMemoryEvents: AnalyticsEventRecord[] = [];
const MAX_IN_MEMORY_EVENTS = 10000;

// Clean LRU for event IDs
function recordProcessedId(eventId: string) {
  if (processedEventIds.size > 20000) {
    const firstItems = Array.from(processedEventIds).slice(0, 5000);
    firstItems.forEach((id) => processedEventIds.delete(id));
  }
  processedEventIds.add(eventId);
}

/**
 * Authoritatively resolve vendor and category for a product ID.
 * Queries Firestore 'products' collection or fallback catalog.
 * Never trusts client-supplied vendor_id blindly.
 */
async function resolveAuthoritativeProductVendor(productId?: string): Promise<{
  vendorId?: string;
  vendorName?: string;
  category?: string;
  name?: string;
  price?: number;
}> {
  if (!productId) return {};

  // 1. Try local catalog first for immediate response
  const localMatch = KNOWN_CATALOG_VENDORS[productId];
  if (localMatch) {
    return {
      vendorId: localMatch.vendorId,
      vendorName: localMatch.vendorName,
      category: localMatch.category,
      name: localMatch.name,
      price: localMatch.price
    };
  }

  // 2. Query Firestore 'products' document
  try {
    const docRef = doc(firestore, 'products', productId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        vendorId: data.vendorId ? String(data.vendorId) : 'vendor_nova_official',
        vendorName: data.vendorName ? String(data.vendorName) : 'NOVA Official',
        category: data.category ? String(data.category) : undefined,
        name: data.name ? String(data.name) : undefined,
        price: typeof data.price === 'number' ? data.price : undefined
      };
    }
  } catch (err) {
    console.warn(`[Analytics] Firestore product lookup for ${productId} warning:`, err);
  }

  // Default fallback if unknown product
  return {
    vendorId: 'vendor_nova_official',
    vendorName: 'NOVA Official'
  };
}

/**
 * Sanitize event metadata to prevent sensitive or bloated payloads
 */
function sanitizeMetadata(metadata?: Record<string, any>): Record<string, any> | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;

  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(metadata)) {
    // Strip forbidden or oversized properties
    if (
      key.toLowerCase().includes('password') ||
      key.toLowerCase().includes('token') ||
      key.toLowerCase().includes('credit') ||
      key.toLowerCase().includes('card') ||
      key.toLowerCase().includes('cvv') ||
      key.toLowerCase().includes('auth') ||
      key.toLowerCase().includes('secret')
    ) {
      continue;
    }

    // Reject base64 images or oversized strings
    if (typeof val === 'string') {
      if (val.startsWith('data:image') || val.length > 500) {
        continue;
      }
      sanitized[key] = val.trim();
    } else if (typeof val === 'number' || typeof val === 'boolean') {
      sanitized[key] = val;
    } else if (Array.isArray(val) && val.length <= 20) {
      sanitized[key] = val.slice(0, 20);
    }
  }

  return sanitized;
}

/**
 * Validate and normalize incoming raw event payload
 */
async function processRawEvent(raw: any): Promise<{ valid: boolean; record?: AnalyticsEventRecord; error?: string }> {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Invalid payload: event must be a JSON object' };
  }

  const {
    event_id,
    event_type,
    occurred_at,
    product_id,
    session_id,
    user_id,
    category_id,
    source_screen,
    metadata,
    schema_version
  } = raw;

  if (!event_id || typeof event_id !== 'string') {
    return { valid: false, error: 'Missing or invalid event_id' };
  }

  if (!event_type || typeof event_type !== 'string') {
    return { valid: false, error: 'Missing or invalid event_type' };
  }

  if (!session_id || typeof session_id !== 'string') {
    return { valid: false, error: 'Missing or invalid session_id' };
  }

  // Idempotency: return existing without error
  if (processedEventIds.has(event_id)) {
    return { valid: true }; // already processed
  }

  // Authoritatively derive vendor and product metadata
  const resolved = await resolveAuthoritativeProductVendor(product_id);

  const cleanRecord: AnalyticsEventRecord = {
    event_id: String(event_id).trim(),
    event_type: event_type as AnalyticsEventType,
    occurred_at: occurred_at && !isNaN(Date.parse(occurred_at)) ? new Date(occurred_at).toISOString() : new Date().toISOString(),
    received_at: new Date().toISOString(),
    product_id: product_id ? String(product_id).trim() : undefined,
    vendor_id: resolved.vendorId || (raw.vendor_id ? String(raw.vendor_id).trim() : undefined),
    vendor_name: resolved.vendorName,
    session_id: String(session_id).trim(),
    user_id: user_id ? String(user_id).trim() : undefined,
    category_id: resolved.category || (category_id ? String(category_id).trim() : undefined),
    source_screen: source_screen ? String(source_screen).trim() : undefined,
    metadata: sanitizeMetadata(metadata),
    schema_version: '1.0'
  };

  recordProcessedId(cleanRecord.event_id);

  // Store in memory
  inMemoryEvents.unshift(cleanRecord);
  if (inMemoryEvents.length > MAX_IN_MEMORY_EVENTS) {
    inMemoryEvents.pop();
  }

  // Use Admin SDK so server-side analytics writes do not depend on client Firestore rules.
  if (adminDb) {
    try {
      const firestorePayload = Object.fromEntries(
        Object.entries({
          ...cleanRecord,
          createdAt: FieldValue.serverTimestamp()
        }).filter(([_, v]) => v !== undefined)
      );
      void adminDb.collection('analytics_events').add(firestorePayload).catch((fsErr) => {
        // Non-blocking; in-memory aggregation remains available if persistence fails.
        console.warn('[Analytics] Firestore event write warning:', fsErr?.message || fsErr);
      });
    } catch (fsErr) {
      console.warn('[Analytics] Firestore event write error:', fsErr);
    }
  }

  return { valid: true, record: cleanRecord };
}

// =========================================================================
// INGESTION ENDPOINTS
// =========================================================================

/**
 * POST /api/analytics/events - Ingest a single customer analytics event
 */
router.post('/analytics/events', async (req: Request, res: Response) => {
  try {
    const result = await processRawEvent(req.body);
    if (!result.valid) {
      return res.status(400).json({ success: false, error: result.error });
    }

    return res.status(200).json({
      success: true,
      event_id: req.body?.event_id,
      deduplicated: !result.record
    });
  } catch (err: any) {
    console.error('[Analytics Ingest Error]:', err);
    return res.status(500).json({ success: false, error: 'Internal analytics error' });
  }
});

/**
 * POST /api/analytics/events/batch - Ingest a batch of customer analytics events (max 50)
 */
router.post('/analytics/events/batch', async (req: Request, res: Response) => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events)) {
      return res.status(400).json({ success: false, error: 'Expected { events: [...] } array' });
    }

    if (events.length > 100) {
      return res.status(400).json({ success: false, error: 'Batch size limit is 100 events' });
    }

    const results = await Promise.all(events.map((e) => processRawEvent(e)));
    const acceptedCount = results.filter((r) => r.valid).length;

    return res.status(200).json({
      success: true,
      received: events.length,
      accepted: acceptedCount
    });
  } catch (err: any) {
    console.error('[Analytics Batch Error]:', err);
    return res.status(500).json({ success: false, error: 'Internal analytics batch error' });
  }
});

// =========================================================================
// VENDOR MARKET INSIGHTS & ANALYTICS QUERY ENDPOINTS
// =========================================================================

/**
 * Helper to compute vendor dashboard summary
 */
function computeVendorSummary(vendorId: string, sinceDate?: Date) {
  const filtered = inMemoryEvents.filter((e) => {
    if (vendorId !== 'all' && e.vendor_id !== vendorId) return false;
    if (sinceDate && new Date(e.occurred_at) < sinceDate) return false;
    return true;
  });

  // Funnel counts
  let impressions = 0;
  let productViews = 0;
  let arAttempts = 0;
  let arSuccesses = 0;
  let arFails = 0;
  let wishlistAdds = 0;
  let cartAdds = 0;
  let checkouts = 0;
  let ordersCount = 0;
  let grossRevenue = 0;

  // Product aggregations
  const productStats: Record<string, {
    productId: string;
    name: string;
    category: string;
    impressions: number;
    views: number;
    arTryons: number;
    arSuccesses: number;
    wishlistAdds: number;
    cartAdds: number;
    purchases: number;
    revenue: number;
  }> = {};

  // Search queries leading to this vendor
  const searchCounts: Record<string, { query: string; count: number; clicks: number }> = {};
  const zeroResultSearches: Record<string, number> = {};

  // Category demand
  const categoryDemand: Record<string, { views: number; tryons: number; cartAdds: number; orders: number }> = {};

  for (const e of filtered) {
    const pId = e.product_id;
    const cat = e.category_id || 'General';

    // Init category
    if (!categoryDemand[cat]) {
      categoryDemand[cat] = { views: 0, tryons: 0, cartAdds: 0, orders: 0 };
    }

    // Init product
    if (pId) {
      if (!productStats[pId]) {
        const known = KNOWN_CATALOG_VENDORS[pId];
        productStats[pId] = {
          productId: pId,
          name: known?.name || e.metadata?.productName || pId,
          category: cat,
          impressions: 0,
          views: 0,
          arTryons: 0,
          arSuccesses: 0,
          wishlistAdds: 0,
          cartAdds: 0,
          purchases: 0,
          revenue: 0
        };
      }
    }

    switch (e.event_type) {
      case 'product_impression':
        impressions++;
        if (pId && productStats[pId]) productStats[pId].impressions++;
        break;

      case 'product_view':
        productViews++;
        categoryDemand[cat].views++;
        if (pId && productStats[pId]) productStats[pId].views++;
        break;

      case 'ar_tryon_started':
        arAttempts++;
        categoryDemand[cat].tryons++;
        if (pId && productStats[pId]) productStats[pId].arTryons++;
        break;

      case 'ar_tryon_succeeded':
        arSuccesses++;
        if (pId && productStats[pId]) productStats[pId].arSuccesses++;
        break;

      case 'ar_tryon_failed':
        arFails++;
        break;

      case 'wishlist_add':
        wishlistAdds++;
        if (pId && productStats[pId]) productStats[pId].wishlistAdds++;
        break;

      case 'cart_add':
        cartAdds++;
        categoryDemand[cat].cartAdds++;
        if (pId && productStats[pId]) productStats[pId].cartAdds++;
        break;

      case 'checkout_started':
        checkouts++;
        break;

      case 'purchase_completed': {
        ordersCount++;
        categoryDemand[cat].orders++;
        const itemPrice = Number(e.metadata?.price || productStats[pId]?.revenue || KNOWN_CATALOG_VENDORS[pId || '']?.price || 0);
        const qty = Number(e.metadata?.quantity || 1);
        const orderRev = itemPrice * qty;
        grossRevenue += orderRev;
        if (pId && productStats[pId]) {
          productStats[pId].purchases += qty;
          productStats[pId].revenue += orderRev;
        }
        break;
      }

      case 'search_submitted': {
        const q = String(e.metadata?.query || '').trim().toLowerCase();
        const resultsCount = Number(e.metadata?.result_count || 0);
        if (q) {
          if (!searchCounts[q]) searchCounts[q] = { query: q, count: 0, clicks: 0 };
          searchCounts[q].count++;
          if (resultsCount === 0) {
            zeroResultSearches[q] = (zeroResultSearches[q] || 0) + 1;
          }
        }
        break;
      }

      case 'search_click': {
        const q = String(e.metadata?.query || '').trim().toLowerCase();
        if (q && searchCounts[q]) {
          searchCounts[q].clicks++;
        }
        break;
      }
    }
  }

  // Calculate rates
  const safeRate = (num: number, den: number) => (den > 0 ? Number(((num / den) * 100).toFixed(1)) : 0);

  const topProducts = Object.values(productStats).map((p) => ({
    ...p,
    conversion_rate: safeRate(p.purchases, p.views)
  })).sort((a, b) => b.views - a.views);

  const mostTriedProducts = [...topProducts]
    .filter((p) => p.arTryons > 0)
    .sort((a, b) => b.arTryons - a.arTryons);

  // Products frequently tried but rarely added to cart
  const triedButAbandoned = mostTriedProducts
    .filter((p) => p.arTryons >= 2 && safeRate(p.cartAdds, p.arTryons) < 30)
    .map((p) => ({
      productId: p.productId,
      name: p.name,
      try_ons: p.arTryons,
      cart_adds: p.cartAdds,
      cart_conversion_rate: safeRate(p.cartAdds, p.arTryons)
    }));

  return {
    vendorId,
    total_events_analyzed: filtered.length,
    funnel: {
      impressions,
      product_views: productViews,
      ar_tryon_attempts: arAttempts,
      ar_tryon_successes: arSuccesses,
      ar_tryon_failures: arFails,
      wishlist_adds: wishlistAdds,
      cart_adds: cartAdds,
      checkouts_started: checkouts,
      orders_count: ordersCount,
      gross_revenue: grossRevenue,
      conversion_rates: {
        impression_to_view_pct: safeRate(productViews, impressions),
        view_to_ar_tryon_pct: safeRate(arAttempts, productViews),
        ar_success_pct: safeRate(arSuccesses, arAttempts),
        tryon_to_cart_pct: safeRate(cartAdds, arSuccesses || arAttempts),
        cart_to_purchase_pct: safeRate(ordersCount, cartAdds),
        overall_view_to_purchase_pct: safeRate(ordersCount, productViews)
      }
    },
    top_products: topProducts.slice(0, 20),
    ar_insights: {
      most_tried_products: mostTriedProducts.slice(0, 10),
      tried_but_abandoned: triedButAbandoned.slice(0, 5)
    },
    search_insights: {
      top_search_queries: Object.values(searchCounts).sort((a, b) => b.count - a.count).slice(0, 10),
      zero_result_searches: Object.entries(zeroResultSearches).map(([query, count]) => ({ query, count })).slice(0, 10)
    },
    category_demand: Object.entries(categoryDemand).map(([category, stats]) => ({
      category,
      ...stats
    }))
  };
}

/**
 * GET /api/analytics/vendor/:vendorId/summary - Vendor Market Insights & Analytics Dashboard API
 */
router.get('/analytics/vendor/:vendorId/summary', async (req: Request, res: Response) => {
  try {
    const { vendorId } = req.params;
    const { period } = req.query; // '7d' | '30d' | 'all'

    if (!vendorId) {
      return res.status(400).json({ success: false, error: 'Vendor ID is required' });
    }

    let sinceDate: Date | undefined;
    if (period === '7d') {
      sinceDate = new Date(Date.now() - 7 * 86400000);
    } else if (period === '30d') {
      sinceDate = new Date(Date.now() - 30 * 86400000);
    }

    const summary = computeVendorSummary(vendorId, sinceDate);
    return res.json({
      success: true,
      vendorId,
      period: period || 'all',
      summary
    });
  } catch (err: any) {
    console.error('[Analytics Vendor Summary Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to compute vendor summary' });
  }
});

/**
 * GET /api/analytics/vendor/:vendorId/events - Filtered raw event stream for vendor analysis
 */
router.get('/analytics/vendor/:vendorId/events', (req: Request, res: Response) => {
  try {
    const { vendorId } = req.params;
    const { event_type, product_id, limit = 50 } = req.query;

    if (!vendorId) {
      return res.status(400).json({ success: false, error: 'Vendor ID is required' });
    }

    const maxLimit = Math.min(Number(limit) || 50, 200);

    let filtered = inMemoryEvents.filter((e) => vendorId === 'all' || e.vendor_id === vendorId);

    if (event_type && typeof event_type === 'string') {
      filtered = filtered.filter((e) => e.event_type === event_type);
    }

    if (product_id && typeof product_id === 'string') {
      filtered = filtered.filter((e) => e.product_id === product_id);
    }

    return res.json({
      success: true,
      vendorId,
      total_matched: filtered.length,
      events: filtered.slice(0, maxLimit)
    });
  } catch (err: any) {
    console.error('[Analytics Vendor Events Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve vendor events' });
  }
});

/**
 * GET /api/analytics/health - Health & buffer monitoring
 */
router.get('/analytics/health', (_req: Request, res: Response) => {
  return res.json({
    status: 'healthy',
    in_memory_event_count: inMemoryEvents.length,
    dedup_cache_size: processedEventIds.size,
    timestamp: new Date().toISOString()
  });
});

export default router;

export { resolveAuthoritativeProductVendor };
