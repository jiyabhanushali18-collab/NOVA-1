import assert from 'assert';
import { backButtonService } from './backButtonService';

console.log('======================================================');
console.log('🧪 RUNNING NOVA GLOBAL BACK BUTTON HANDLING TEST SUITE');
console.log('======================================================\n');

// Mock Screen Navigation State Engine
class MockNavigationEngine {
  public currentScreen: string = 'splash';
  public screenHistory: string[] = ['splash'];
  public isWishlistOpen = false;
  public isQuickHubOpen = false;
  public showExitConfirm = false;
  public appExited = false;
  public arSessionStopped = false;
  public arCameraTracksStopped = 0;
  public cartStep: 'cart' | 'address' | 'payment' | 'completed' = 'cart';
  public profileModalOpen: string | null = null;
  public wardrobeOverlayOpen: string | null = null;
  public arOverlayOpen: string | null = null;

  public navigate(to: string) {
    if (this.currentScreen !== to) {
      this.screenHistory.push(to);
      this.currentScreen = to;
    }
  }

  public registerHandlers() {
    // Priority 110: Exit confirmation modal
    backButtonService.register('exit-confirm-dialog', () => {
      if (this.showExitConfirm) {
        this.showExitConfirm = false;
        return true;
      }
      return false;
    }, 110);

    // Priority 100: Top-level Modals & Feature Overlays
    backButtonService.register('app-wishlist-modal', () => {
      if (this.isWishlistOpen) {
        this.isWishlistOpen = false;
        return true;
      }
      return false;
    }, 100);

    backButtonService.register('app-quickhub-modal', () => {
      if (this.isQuickHubOpen) {
        this.isQuickHubOpen = false;
        return true;
      }
      return false;
    }, 100);

    backButtonService.register('profile-modals', () => {
      if (this.profileModalOpen) {
        this.profileModalOpen = null;
        return true;
      }
      return false;
    }, 100);

    backButtonService.register('wardrobe-overlays', () => {
      if (this.wardrobeOverlayOpen) {
        this.wardrobeOverlayOpen = null;
        return true;
      }
      return false;
    }, 100);

    backButtonService.register('ar-tryon-overlays', () => {
      if (this.arOverlayOpen) {
        this.arOverlayOpen = null;
        return true;
      }
      return false;
    }, 100);

    // Priority 40: Cart checkout steps
    backButtonService.register('cart-steps', () => {
      if (this.currentScreen === 'cart') {
        if (this.cartStep === 'completed') {
          this.cartStep = 'cart';
          this.navigate('home');
          return true;
        }
        if (this.cartStep === 'payment') {
          this.cartStep = 'address';
          return true;
        }
        if (this.cartStep === 'address') {
          this.cartStep = 'cart';
          return true;
        }
        if (this.cartStep === 'cart') {
          this.navigate('home');
          return true;
        }
      }
      return false;
    }, 40);

    // Priority 30: Nested sub-screen navigation
    backButtonService.register('app-nested-screens', () => {
      if (this.currentScreen === 'tryon-result') {
        this.navigate('ar-tryon');
        return true;
      }
      if (this.currentScreen === 'product-details') {
        this.navigate('showroom');
        return true;
      }
      if (this.currentScreen === 'scan-outfit') {
        this.navigate('ar-tryon');
        return true;
      }
      if (this.currentScreen === 'outfit-builder') {
        this.navigate('wardrobe');
        return true;
      }
      if (['terms', 'privacy', 'faq', 'profile-analysis', 'setup-preferences'].includes(this.currentScreen)) {
        this.navigate('profile');
        return true;
      }
      return false;
    }, 30);

    // Priority 20: AR Try-On specific exit with resource cleanup
    backButtonService.register('ar-tryon-root-exit', () => {
      if (this.currentScreen === 'ar-tryon') {
        // Tear down live WebRTC and camera stream
        this.arSessionStopped = true;
        this.arCameraTracksStopped = 2; // video + preview
        this.navigate('home');
        return true;
      }
      return false;
    }, 20);

    // Priority 10: Root Feature screens -> Home
    backButtonService.register('app-root-features', () => {
      const rootFeatures = [
        'wardrobe',
        'virtual-wardrobe',
        'camera-scan',
        'chat',
        'showroom',
        'profile',
        'cart',
        'login',
        'signup'
      ];
      if (rootFeatures.includes(this.currentScreen)) {
        this.navigate('home');
        return true;
      }
      return false;
    }, 10);

    // Priority 0: Home screen -> Exit Confirmation Modal
    backButtonService.register('app-home-exit', () => {
      if (this.currentScreen === 'home') {
        this.showExitConfirm = true;
        return true;
      }
      return false;
    }, 0);
  }
}

const engine = new MockNavigationEngine();
engine.registerHandlers();

// ----------------------------------------------------
// TEST 1: Modals take priority over screen navigation
// ----------------------------------------------------
console.log('▶ Test 1: Priority 1 — Open modals close first without navigating');
engine.currentScreen = 'profile';
engine.profileModalOpen = 'isAddressesModalOpen';

let handled = backButtonService.executeBack();
assert.strictEqual(handled, true, 'Back event should be handled by open modal');
assert.strictEqual(engine.profileModalOpen, null, 'Address modal should be closed');
assert.strictEqual(engine.currentScreen, 'profile', 'User must stay on Profile screen when modal closes');
console.log('  ✓ Priority 1: Modal closed, user preserved on current screen.');

// ----------------------------------------------------
// TEST 2: Nested screen navigation
// ----------------------------------------------------
console.log('\n▶ Test 2: Priority 2 — Nested screens navigate one level backward');
engine.currentScreen = 'tryon-result';
handled = backButtonService.executeBack();
assert.strictEqual(handled, true);
assert.strictEqual(engine.currentScreen, 'ar-tryon', 'tryon-result should navigate back to ar-tryon');
console.log('  ✓ tryon-result -> ar-tryon verified');

engine.currentScreen = 'product-details';
handled = backButtonService.executeBack();
assert.strictEqual(handled, true);
assert.strictEqual(engine.currentScreen, 'showroom', 'product-details should navigate back to showroom');
console.log('  ✓ product-details -> showroom verified');

engine.currentScreen = 'terms';
handled = backButtonService.executeBack();
assert.strictEqual(handled, true);
assert.strictEqual(engine.currentScreen, 'profile', 'terms should navigate back to profile');
console.log('  ✓ terms -> profile verified');

// ----------------------------------------------------
// TEST 3: Feature root screens return to Home
// ----------------------------------------------------
console.log('\n▶ Test 3: Priority 3 — Feature root screens return to Home');

const testRoots = [
  { screen: 'wardrobe', name: 'Virtual Wardrobe' },
  { screen: 'camera-scan', name: 'Camera Scan' },
  { screen: 'chat', name: 'AI Stylist / Chat' },
  { screen: 'showroom', name: 'Showroom' },
  { screen: 'profile', name: 'Profile' }
];

for (const { screen, name } of testRoots) {
  engine.currentScreen = screen;
  handled = backButtonService.executeBack();
  assert.strictEqual(handled, true);
  assert.strictEqual(engine.currentScreen, 'home', `${name} (${screen}) should return to home`);
  console.log(`  ✓ ${name} -> Home verified`);
}

// ----------------------------------------------------
// TEST 4: AR Try-On exit & resource cleanup
// ----------------------------------------------------
console.log('\n▶ Test 4: AR Try-On safely stops camera & WebRTC before returning to Home');
engine.currentScreen = 'ar-tryon';
engine.arSessionStopped = false;
engine.arCameraTracksStopped = 0;

handled = backButtonService.executeBack();
assert.strictEqual(handled, true);
assert.strictEqual(engine.currentScreen, 'home', 'AR Try-On must return to Home');
assert.strictEqual(engine.arSessionStopped, true, 'WebRTC session must be terminated');
assert.strictEqual(engine.arCameraTracksStopped > 0, true, 'Camera media tracks must be stopped');
console.log('  ✓ AR Try-On cleanly terminated WebRTC and camera tracks on Back press.');

// ----------------------------------------------------
// TEST 5: Cart step-by-step back navigation
// ----------------------------------------------------
console.log('\n▶ Test 5: Cart step-by-step backward progression');
engine.currentScreen = 'cart';
engine.cartStep = 'payment';

// Back from payment -> address
handled = backButtonService.executeBack();
assert.strictEqual(engine.cartStep, 'address');
console.log('  ✓ Cart: payment -> address');

// Back from address -> cart
handled = backButtonService.executeBack();
assert.strictEqual(engine.cartStep, 'cart');
console.log('  ✓ Cart: address -> cart items');

// Back from cart items -> home
handled = backButtonService.executeBack();
assert.strictEqual(engine.currentScreen, 'home');
console.log('  ✓ Cart: cart items -> home');

// ----------------------------------------------------
// TEST 6: Home screen exit confirmation
// ----------------------------------------------------
console.log('\n▶ Test 6: Priority 4 — Back on Home triggers exit confirmation dialog');
engine.currentScreen = 'home';
engine.showExitConfirm = false;

handled = backButtonService.executeBack();
assert.strictEqual(handled, true);
assert.strictEqual(engine.showExitConfirm, true, 'Exit confirmation dialog must be shown');
assert.strictEqual(engine.currentScreen, 'home', 'Must remain on Home while dialog is shown');
console.log('  ✓ Back on Home displayed Exit Confirmation without exiting app.');

// Back while exit confirmation dialog is open -> Cancels/Dismisses dialog!
handled = backButtonService.executeBack();
assert.strictEqual(handled, true);
assert.strictEqual(engine.showExitConfirm, false, 'Back press must dismiss exit dialog');
assert.strictEqual(engine.currentScreen, 'home', 'Must remain on Home after cancelling exit');
console.log('  ✓ Back while Exit Confirmation is visible safely cancels dialog.');

// ----------------------------------------------------
// TEST 7: Debounce protection against rapid taps
// ----------------------------------------------------
console.log('\n▶ Test 7: Debounce protection against rapid multiple back taps');
let tapCount = 0;
const testHandlerId = 'debounce-test';
backButtonService.register(testHandlerId, () => {
  tapCount++;
  return true;
}, 999);

// First tap
backButtonService.triggerBack();
assert.strictEqual(tapCount, 1, 'First tap should register');

// Second tap within 10ms (simulating fast jitter/double press)
backButtonService.triggerBack();
assert.strictEqual(tapCount, 1, 'Rapid second tap within 280ms must be throttled');

backButtonService.unregister(testHandlerId);
console.log('  ✓ Rapid double-press properly throttled by debounce filter.');

console.log('\n======================================================');
console.log('🎉 ALL 7 GLOBAL BACK BUTTON HANDLING TESTS PASSED!');
console.log('======================================================');
