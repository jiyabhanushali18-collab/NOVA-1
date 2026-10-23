import { ProductItem, CartItem, OrderRecord } from '../types';

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

export interface AnalyticsEvent {
  event_id: string;
  event_type: AnalyticsEventType;
  occurred_at: string;
  product_id?: string;
  vendor_id?: string;
  session_id: string;
  user_id?: string;
  category_id?: string;
  source_screen?: string;
  metadata?: Record<string, any>;
  schema_version: '1.0';
}

const STORAGE_QUEUE_KEY = 'nova_analytics_queue_v1';
const SESSION_STORAGE_KEY = 'nova_analytics_session_id';
const MAX_QUEUE_SIZE = 150;
const FLUSH_INTERVAL_MS = 3000;
const IMPRESSION_COOLDOWN_MS = 15 * 60 * 1000; // 15 mins cooldown per screen:product to avoid rerender spam

// Generate safe RFC-compliant UUIDv4
function generateEventId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'evt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
}

// Session management
function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return 'server_session';
  try {
    let sid = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!sid) {
      sid = 'ses_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
      sessionStorage.setItem(SESSION_STORAGE_KEY, sid);
    }
    return sid;
  } catch {
    return 'ses_' + Date.now();
  }
}

class AnalyticsService {
  private sessionId: string;
  private userId?: string;
  private queue: AnalyticsEvent[] = [];
  private flushTimer: any = null;
  private isFlushing = false;
  // Deduplication map for product impressions: `${sourceScreen}:${productId}` -> timestamp
  private recentImpressions = new Map<string, number>();

  constructor() {
    this.sessionId = getOrCreateSessionId();
    this.loadPersistedQueue();
    this.setupLifecycleHooks();
    this.startFlushInterval();
  }

  public setUserId(uid?: string) {
    this.userId = uid || undefined;
  }

  private loadPersistedQueue() {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(STORAGE_QUEUE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this.queue = parsed.slice(0, MAX_QUEUE_SIZE);
        }
      }
    } catch {}
  }

  private persistQueue() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_QUEUE_KEY, JSON.stringify(this.queue.slice(0, MAX_QUEUE_SIZE)));
    } catch {}
  }

  private setupLifecycleHooks() {
    if (typeof window === 'undefined') return;

    const handleFlushOnHide = () => {
      this.flush(true);
    };

    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        handleFlushOnHide();
      }
    });

    window.addEventListener('pagehide', handleFlushOnHide);
  }

  private startFlushInterval() {
    if (typeof window === 'undefined') return;
    if (this.flushTimer) clearInterval(this.flushTimer);

    this.flushTimer = setInterval(() => {
      if (this.queue.length > 0 && !this.isFlushing) {
        this.flush();
      }
    }, FLUSH_INTERVAL_MS);
  }

  /**
   * Enqueue a raw analytics event
   */
  public enqueue(
    eventType: AnalyticsEventType,
    params: {
      productId?: string;
      vendorId?: string;
      categoryId?: string;
      sourceScreen?: string;
      metadata?: Record<string, any>;
      immediate?: boolean;
    }
  ) {
    const event: AnalyticsEvent = {
      event_id: generateEventId(),
      event_type: eventType,
      occurred_at: new Date().toISOString(),
      session_id: this.sessionId,
      user_id: this.userId,
      product_id: params.productId,
      vendor_id: params.vendorId,
      category_id: params.categoryId,
      source_screen: params.sourceScreen,
      metadata: params.metadata,
      schema_version: '1.0'
    };

    this.queue.push(event);
    if (this.queue.length > MAX_QUEUE_SIZE) {
      this.queue.shift(); // Drop oldest if queue overflows
    }

    this.persistQueue();

    // Flush immediately for critical conversion events or when batch reaches threshold
    if (params.immediate || this.queue.length >= 10) {
      this.flush();
    }
  }

  /**
   * Flush queue to the backend `/api/analytics/events/batch`
   */
  public async flush(useBeacon = false): Promise<boolean> {
    if (this.queue.length === 0 || this.isFlushing) return true;

    const batch = [...this.queue];
    const endpoint = '/api/analytics/events/batch';

    // When page is unloading, try sendBeacon if supported
    if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      try {
        const blob = new Blob([JSON.stringify({ events: batch })], { type: 'application/json' });
        const queued = navigator.sendBeacon(endpoint, blob);
        if (queued) {
          this.queue = [];
          this.persistQueue();
          return true;
        }
      } catch {}
    }

    this.isFlushing = true;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch }),
        keepalive: true
      });

      if (response.ok) {
        // Remove dispatched items
        this.queue = this.queue.slice(batch.length);
        this.persistQueue();
        return true;
      }
    } catch (err) {
      // Keep in queue for next flush retry (network failure resilience)
    } finally {
      this.isFlushing = false;
    }

    return false;
  }

  // =========================================================================
  // HIGH-LEVEL CONVENIENCE TRACKING METHODS
  // =========================================================================

  /**
   * Track visible product impression with automatic deduplication
   * Avoids counting React rerenders as new impressions
   */
  public trackProductImpression(
    product: { id: string; category?: string; vendorId?: string; name?: string },
    sourceScreen: string
  ) {
    if (!product || !product.id) return;
    const dedupeKey = `${sourceScreen}:${product.id}`;
    const lastSeen = this.recentImpressions.get(dedupeKey);
    const now = Date.now();

    if (lastSeen && now - lastSeen < IMPRESSION_COOLDOWN_MS) {
      return; // Deduplicated, within cooldown
    }

    this.recentImpressions.set(dedupeKey, now);
    if (this.recentImpressions.size > 1000) {
      // Trim dedupe cache periodically
      const cutoff = now - IMPRESSION_COOLDOWN_MS;
      for (const [k, v] of this.recentImpressions.entries()) {
        if (v < cutoff) this.recentImpressions.delete(k);
      }
    }

    this.enqueue('product_impression', {
      productId: product.id,
      vendorId: product.vendorId,
      categoryId: product.category,
      sourceScreen,
      metadata: { productName: product.name }
    });
  }

  /**
   * Track product detail view
   */
  public trackProductView(
    product: { id: string; category?: string; vendorId?: string; name?: string; price?: number },
    sourceScreen: string
  ) {
    if (!product || !product.id) return;
    this.enqueue('product_view', {
      productId: product.id,
      vendorId: product.vendorId,
      categoryId: product.category,
      sourceScreen,
      metadata: {
        productName: product.name,
        price: product.price
      },
      immediate: true
    });
  }

  /**
   * Track customer search query and results count
   */
  public trackSearch(query: string, resultCount: number, sourceScreen = 'showroom') {
    const cleanQuery = query.trim().slice(0, 100);
    if (!cleanQuery) return;

    this.enqueue('search_submitted', {
      sourceScreen,
      metadata: {
        query: cleanQuery,
        result_count: resultCount,
        has_results: resultCount > 0
      }
    });
  }

  /**
   * Track click on a product from search results
   */
  public trackSearchClick(
    product: { id: string; category?: string; vendorId?: string; name?: string },
    query: string,
    sourceScreen = 'showroom'
  ) {
    if (!product?.id) return;
    this.enqueue('search_click', {
      productId: product.id,
      vendorId: product.vendorId,
      categoryId: product.category,
      sourceScreen,
      metadata: {
        query: query.trim().slice(0, 100),
        productName: product.name
      }
    });
  }

  /**
   * Track category selection
   */
  public trackCategorySelected(category: string, sourceScreen = 'home') {
    if (!category) return;
    this.enqueue('category_selected', {
      categoryId: category,
      sourceScreen,
      metadata: { category }
    });
  }

  /**
   * Track filter application
   */
  public trackFilterApplied(filterType: string, filterValue: string, sourceScreen = 'showroom', metadata?: Record<string, any>) {
    this.enqueue('filter_applied', {
      sourceScreen,
      metadata: { filter_type: filterType, filter_value: filterValue, ...(metadata || {}) }
    });
  }

  /**
   * Track wishlist add
   */
  public trackWishlistAdd(
    product: { id: string; category?: string; vendorId?: string; name?: string; price?: number },
    sourceScreen = 'product_details'
  ) {
    if (!product?.id) return;
    this.enqueue('wishlist_add', {
      productId: product.id,
      vendorId: product.vendorId,
      categoryId: product.category,
      sourceScreen,
      metadata: { productName: product.name, price: product.price },
      immediate: true
    });
  }

  /**
   * Track wishlist remove
   */
  public trackWishlistRemove(
    product: { id: string; category?: string; vendorId?: string; name?: string },
    sourceScreen = 'product_details'
  ) {
    if (!product?.id) return;
    this.enqueue('wishlist_remove', {
      productId: product.id,
      vendorId: product.vendorId,
      categoryId: product.category,
      sourceScreen,
      metadata: { productName: product.name }
    });
  }

  /**
   * Track AR try-on started
   */
  public trackArTryOnStarted(productId: string, garmentName?: string, sourceScreen = 'ar_tryon') {
    this.enqueue('ar_tryon_started', {
      productId,
      sourceScreen,
      metadata: { garmentName }
    });
  }

  /**
   * Track AR try-on confirmed success (only when stream/AI connects successfully)
   */
  public trackArTryOnSucceeded(productId: string, garmentName?: string, durationMs?: number) {
    this.enqueue('ar_tryon_succeeded', {
      productId,
      sourceScreen: 'ar_tryon',
      metadata: { garmentName, duration_ms: durationMs },
      immediate: true
    });
  }

  /**
   * Track AR try-on failure with standardized safe error category
   */
  public trackArTryOnFailed(productId: string, errorCategory: string, garmentName?: string) {
    this.enqueue('ar_tryon_failed', {
      productId,
      sourceScreen: 'ar_tryon',
      metadata: { garmentName, error_category: errorCategory }
    });
  }

  /**
   * Track AR try-on session ended
   */
  public trackArTryOnEnded(productId: string, durationMs?: number) {
    this.enqueue('ar_tryon_ended', {
      productId,
      sourceScreen: 'ar_tryon',
      metadata: { duration_ms: durationMs }
    });
  }

  /**
   * Track AR try-on product changed in carousel
   */
  public trackArTryOnProductChanged(newProductId: string, prevProductId?: string) {
    this.enqueue('ar_tryon_product_changed', {
      productId: newProductId,
      sourceScreen: 'ar_tryon',
      metadata: { previous_product_id: prevProductId }
    });
  }

  /**
   * Track AR try-on look saved (metadata only, zero image bytes)
   */
  public trackArTryOnResultSaved(productId: string, garmentName?: string) {
    this.enqueue('ar_tryon_result_saved', {
      productId,
      sourceScreen: 'ar_tryon',
      metadata: { garmentName },
      immediate: true
    });
  }

  /**
   * Track item added to cart
   */
  public trackCartAdd(
    product: { id: string; category?: string; vendorId?: string; name?: string; price?: number },
    color: string,
    size: string,
    quantity = 1,
    sourceScreen = 'cart'
  ) {
    if (!product?.id) return;
    this.enqueue('cart_add', {
      productId: product.id,
      vendorId: product.vendorId,
      categoryId: product.category,
      sourceScreen,
      metadata: {
        productName: product.name,
        price: product.price,
        color,
        size,
        quantity
      },
      immediate: true
    });
  }

  /**
   * Track item removed from cart
   */
  public trackCartRemove(
    product: { id: string; category?: string; vendorId?: string; name?: string; price?: number },
    color?: string,
    size?: string
  ) {
    if (!product?.id) return;
    this.enqueue('cart_remove', {
      productId: product.id,
      vendorId: product.vendorId,
      categoryId: product.category,
      sourceScreen: 'cart',
      metadata: {
        productName: product.name,
        color,
        size
      }
    });
  }

  /**
   * Track cart quantity change
   */
  public trackCartQuantityUpdate(
    product: { id: string; category?: string; vendorId?: string },
    oldQty: number,
    newQty: number
  ) {
    if (!product?.id) return;
    this.enqueue('cart_quantity_update', {
      productId: product.id,
      vendorId: product.vendorId,
      categoryId: product.category,
      sourceScreen: 'cart',
      metadata: { old_quantity: oldQty, new_quantity: newQty }
    });
  }

  /**
   * Track checkout flow started
   */
  public trackCheckoutStarted(items: CartItem[], totalAmount: number, itemCount: number) {
    const productIds = items.map((i) => i.product.id);
    this.enqueue('checkout_started', {
      sourceScreen: 'checkout',
      metadata: {
        product_ids: productIds,
        item_count: itemCount,
        grand_total: totalAmount
      },
      immediate: true
    });
  }

  /**
   * Track authoritative order purchase completed
   * Dispatches line-item events per product to correctly attribute multi-vendor orders
   */
  public trackPurchaseCompleted(order: OrderRecord) {
    if (!order?.orderId || !Array.isArray(order.items)) return;

    // Line-item events per product
    for (const item of order.items) {
      const p = item.product;
      this.enqueue('purchase_completed', {
        productId: p.id,
        vendorId: p.vendorId,
        categoryId: p.category,
        sourceScreen: 'checkout_completed',
        metadata: {
          order_id: order.orderId,
          product_name: p.name,
          price: p.price,
          quantity: item.quantity,
          subtotal: p.price * item.quantity,
          color: item.color,
          size: item.size,
          payment_method: order.paymentMethod
        },
        immediate: true
      });
    }
  }

  /**
   * Track saved look created in profile (metadata only, zero image content)
   */
  public trackSavedLookCreated(metadata: { garmentName: string; category?: string; garmentId?: string }) {
    this.enqueue('saved_look_created', {
      productId: metadata.garmentId,
      categoryId: metadata.category,
      sourceScreen: 'saved_looks',
      metadata: { garmentName: metadata.garmentName }
    });
  }
}

// Global Singleton Export
export const analytics = new AnalyticsService();
