import { ScreenId } from '../types';

export interface FAQCategory {
  id: string;
  label: string;
  icon: string;
}

export interface FAQItem {
  id: string;
  categoryId: string;
  question: string;
  answer: string;
  points?: string[];
  steps?: string[];
  keywords: string[];
  actionLink?: {
    label: string;
    screen: ScreenId;
  };
}

export const FAQ_CATEGORIES: FAQCategory[] = [
  { id: 'all', label: 'All Questions', icon: 'apps' },
  { id: 'getting-started', label: 'Getting Started', icon: 'rocket_launch' },
  { id: 'account-security', label: 'Account & Security', icon: 'shield_person' },
  { id: 'ai-stylist', label: 'AI Stylist', icon: 'auto_awesome' },
  { id: 'ar-tryon', label: 'AR Try-On', icon: 'view_in_ar' },
  { id: 'virtual-wardrobe', label: 'Virtual Wardrobe', icon: 'checkroom' },
  { id: 'products-shopping', label: 'Products & Shopping', icon: 'storefront' },
  { id: 'cart-orders-payments', label: 'Cart, Orders & Payments', icon: 'shopping_bag' },
  { id: 'shipping-addresses', label: 'Shipping & Addresses', icon: 'local_shipping' },
  { id: 'vendors-products', label: 'Vendors & Products', icon: 'inventory_2' },
  { id: 'notifications-offers', label: 'Notifications & Offers', icon: 'notifications_active' },
  { id: 'privacy-data', label: 'Privacy & Data', icon: 'lock' },
  { id: 'technical-support', label: 'Technical Support', icon: 'support_agent' },
];

export const FAQ_ITEMS: FAQItem[] = [
  // ==========================================
  // A. Getting Started (5 questions)
  // ==========================================
  {
    id: 'gs-1',
    categoryId: 'getting-started',
    question: 'What is NOVA?',
    answer:
      'NOVA is an intelligent AI and Augmented Reality (AR) fashion styling assistant designed to reinvent personal style and online apparel shopping. It integrates interactive real-time AR Try-On (powered by Decart), a conversational AI Stylist chat engine, a digital Virtual Wardrobe with automated background removal, and a synchronized multi-vendor showroom catalog into one cohesive mobile experience.',
    points: [
      'Real-time AR Try-On with neural garment warping and lighting adaptation',
      'Conversational Stylist AI for custom outfit recommendations and occasion styling',
      'Virtual Wardrobe with AI background isolation for cataloging your own clothes',
      'Curated Showroom drops from boutique fashion labels and independent designers'
    ],
    keywords: ['nova', 'what is', 'overview', 'fashion', 'ai', 'ar', 'try on', 'about', 'introduction'],
    actionLink: { label: 'Explore Home', screen: 'home' }
  },
  {
    id: 'gs-2',
    categoryId: 'getting-started',
    question: 'How do I create a NOVA account?',
    answer:
      'Creating a NOVA account is quick, secure, and passwordless using our Firebase email verification service:',
    steps: [
      'Open NOVA and tap "Sign Up" from the initial screen.',
      'Enter your Full Name, Email Address, optional Phone Number, and Delivery Address.',
      'Review and accept NOVA\'s Terms & Conditions and Privacy Policy.',
      'Tap "Create Account" to receive a secure 6-digit OTP in your inbox delivered via Brevo.',
      'Enter the 6-digit OTP to instantly verify your email and unlock your full account.'
    ],
    keywords: ['create account', 'sign up', 'register', 'new user', 'registration', 'otp', 'email code', 'brevo'],
    actionLink: { label: 'Go to Profile', screen: 'profile' }
  },
  {
    id: 'gs-3',
    categoryId: 'getting-started',
    question: 'Can I use NOVA without registering?',
    answer:
      'Yes! NOVA features an expansive Guest Mode. You can tap "Continue as Guest" from the sign-in screen to immediately explore trending collections, test AR Try-On with your camera, upload garments to your Virtual Wardrobe, and consult with Stylist AI. You will only be prompted to register an account when placing an order or syncing your measurements across devices.',
    points: [
      'Guest access to AR Try-On, Showroom browsing, and Stylist AI',
      'Local storage of your guest preferences and wardrobe items on your device',
      'Seamless account upgrade whenever you are ready to complete a purchase'
    ],
    keywords: ['guest', 'without registering', 'guest mode', 'anonymous', 'no account', 'browse only', 'preview']
  },
  {
    id: 'gs-4',
    categoryId: 'getting-started',
    question: 'How do I navigate the application?',
    answer:
      'NOVA provides a convenient bottom navigation bar and a centered quick-action Hub for effortless navigation across the app:',
    points: [
      'Home: Daily fashion drops, trending collections, and category highlights.',
      'Scan / AR: Real-time AR Try-On camera and garment color scanning.',
      'Stylist AI: Direct conversational fashion consultations and style advice.',
      'Profile: Body measurements, saved looks, delivery addresses, and account settings.',
      'Center Hub Modal: Tap the center glowing action button to quickly open Cart, Showroom, and Virtual Wardrobe.'
    ],
    keywords: ['navigation', 'how to navigate', 'bottom bar', 'tabs', 'hub', 'dock', 'screens', 'menu'],
    actionLink: { label: 'Go to Home', screen: 'home' }
  },
  {
    id: 'gs-5',
    categoryId: 'getting-started',
    question: 'Which features require an account?',
    answer:
      'While guests can freely explore fashion drops, chat with AI, and test AR try-ons, certain advanced features require a verified account:',
    points: [
      'Placing orders, payment processing, and package delivery tracking',
      'Cloud synchronization of your body measurements and style preferences',
      'Permanent cloud backup of your Virtual Wardrobe and custom saved looks',
      'Order history records and verified customer product reviews'
    ],
    keywords: ['account required', 'guest limitations', 'features', 'registered user', 'checkout requirement']
  },

  // ==========================================
  // B. Account & Security (6 questions)
  // ==========================================
  {
    id: 'as-1',
    categoryId: 'account-security',
    question: 'How do I update my profile?',
    answer:
      'You can update your personal profile information anytime in the Profile tab. Tap your profile card or the edit button to update your Full Name, Email, Phone Number, or Profile Photo. NOVA supports uploading a custom photo or selecting generated avatar styles.',
    steps: [
      'Navigate to the Profile tab using the bottom navigation bar.',
      'Tap your profile card or the Edit Profile button.',
      'Modify your personal details or choose a new profile photo.',
      'Tap "Save Changes" to apply updates immediately across the app.'
    ],
    keywords: ['update profile', 'edit profile', 'change name', 'profile picture', 'avatar', 'phone', 'email'],
    actionLink: { label: 'Open Profile', screen: 'profile' }
  },
  {
    id: 'as-2',
    categoryId: 'account-security',
    question: 'How do I update my body measurements?',
    answer:
      'Keeping your body measurements up-to-date ensures Stylist AI and AR Try-On recommend garments that fit your silhouette comfortably:',
    steps: [
      'Go to the Profile tab and scroll to the "Measurements" section.',
      'Adjust the sliders or enter exact numerical values for Height (cm), Weight (kg), Chest (in), Waist (in), and Inseam (in).',
      'Tap "Save Measurements" to store your dimensions locally and sync them with your sizing profile.'
    ],
    keywords: ['measurements', 'height', 'weight', 'chest', 'waist', 'inseam', 'sizing', 'fit', 'body dimensions'],
    actionLink: { label: 'Go to Profile', screen: 'profile' }
  },
  {
    id: 'as-3',
    categoryId: 'account-security',
    question: 'What should I do if I do not receive my email OTP?',
    answer:
      'NOVA sends 6-digit OTP codes via Brevo. If your verification code does not arrive within a few seconds:',
    points: [
      'Check your email\'s Spam, Junk, Promotions, or Updates folders.',
      'Verify that the email address was spelled accurately without trailing spaces.',
      'Wait for the 60-second cooldown timer on screen before tapping "Resend OTP".',
      'Ensure your mobile device or computer has an active internet connection.',
      'Add notifications@nova.ai or the Brevo sender address to your safe contacts list.'
    ],
    keywords: ['otp', 'verification code', 'not received', 'email otp', 'resend code', 'brevo', 'spam folder']
  },
  {
    id: 'as-4',
    categoryId: 'account-security',
    question: 'What if my email is already registered?',
    answer:
      'If you see a message stating that your email address is already registered, you do not need to sign up again. Simply switch to the "Sign In" tab, enter your registered email address, and verify using the 6-digit OTP sent to your inbox to restore your saved profile and data.',
    keywords: ['already registered', 'email exists', 'sign in instead', 'account exists', 'duplicate email']
  },
  {
    id: 'as-5',
    categoryId: 'account-security',
    question: 'How do I change my phone number or delivery address?',
    answer:
      'You can manage your contact details and multiple delivery addresses conveniently in Profile > Addresses:',
    points: [
      'Tap "Addresses" in Profile to view all saved shipping locations.',
      'Tap "Add New Address" or tap "Edit" next to an existing address.',
      'Update your house/flat number, street, area, city, state, and 6-digit Indian PIN code.',
      'Set an address as your "Default Address" for fast one-tap checkout.'
    ],
    keywords: ['change phone', 'update address', 'delivery address', 'shipping address', 'edit address', 'pin code'],
    actionLink: { label: 'Manage in Profile', screen: 'profile' }
  },
  {
    id: 'as-6',
    categoryId: 'account-security',
    question: 'How can I recover access to my account?',
    answer:
      'Because NOVA utilizes passwordless email OTP authentication through Firebase, you never need to remember or reset complex passwords. Simply navigate to the Login screen, enter your registered email address, and verify with the 6-digit OTP code sent directly to your inbox.',
    keywords: ['recover account', 'forgot password', 'reset password', 'cannot login', 'restore access', 'login help']
  },

  // ==========================================
  // C. AI Stylist (5 questions)
  // ==========================================
  {
    id: 'ais-1',
    categoryId: 'ai-stylist',
    question: 'What is Stylist AI?',
    answer:
      'Stylist AI is NOVA\'s specialized conversational fashion consultant. Powered by advanced fashion-tuned language models, Stylist AI understands personal aesthetics, color palettes, seasonal dressing, formal dress codes, and your saved wardrobe pieces to craft personalized outfit ideas and styling advice.',
    points: [
      'Personalized fashion advice tailored to your aesthetic preferences',
      'Occasion-specific styling for weddings, business meetings, dates, and everyday wear',
      'Direct garment pairing suggestions using items available in the NOVA Showroom',
      'Cross-referencing with items cataloged in your Virtual Wardrobe'
    ],
    keywords: ['stylist ai', 'what is stylist', 'fashion consultant', 'ai chat', 'personal stylist', 'advisor'],
    actionLink: { label: 'Chat with Stylist', screen: 'chat' }
  },
  {
    id: 'ais-2',
    categoryId: 'ai-stylist',
    question: 'How do I get personalised outfit recommendations?',
    answer:
      'Getting tailored advice from Stylist AI is conversational and intuitive:',
    steps: [
      'Tap the "Stylist AI" tab in the bottom navigation bar.',
      'Type any question naturally (e.g. "What should I wear for a rooftop dinner party in Mumbai?") or tap one of the suggested style prompts.',
      'Stylist AI will analyze your prompt alongside your saved measurements and color preferences.',
      'Tap on any recommended Showroom item to view product details or test it in AR Try-On.'
    ],
    keywords: ['personalized recommendations', 'outfit ideas', 'what to wear', 'styling advice', 'prompts'],
    actionLink: { label: 'Open Stylist AI', screen: 'chat' }
  },
  {
    id: 'ais-3',
    categoryId: 'ai-stylist',
    question: 'Can NOVA suggest outfits for different occasions?',
    answer:
      'Yes! Stylist AI is trained on styling rules across diverse social, professional, and cultural contexts:',
    points: [
      'Traditional & Festive: Indian festive celebrations, Diwali, Eid, and weddings.',
      'Corporate & Formal: Business meetings, boardroom presentations, and job interviews.',
      'Casual & Streetwear: Weekend brunches, coffee dates, and relaxed airport looks.',
      'Evening & Party: Cocktail receptions, gala dinners, and nightlife events.',
      'Athleisure & Travel: Comfortable transit fits, gym ensembles, and travel capsules.'
    ],
    keywords: ['occasions', 'wedding', 'interview', 'party', 'brunch', 'festive', 'traditional', 'formal', 'casual']
  },
  {
    id: 'ais-4',
    categoryId: 'ai-stylist',
    question: 'Why might an AI recommendation be inaccurate or unavailable?',
    answer:
      'Stylist AI performs best when provided with specific context (such as the event, venue, weather, or preferred fit). If your query is ambiguous or asks for unlisted niche items, the recommendations may be generalized. Furthermore, if the primary AI inference server is busy, NOVA activates an intelligent fallback styling system to provide reliable fashion guidance.',
    keywords: ['inaccurate', 'unavailable', 'ai error', 'generic answer', 'fallback system', 'inference']
  },
  {
    id: 'ais-5',
    categoryId: 'ai-stylist',
    question: 'What should I do if Stylist AI is not responding?',
    answer:
      'If Stylist AI experiences a temporary delay:',
    points: [
      'Verify your device has an active internet connection.',
      'Try shortening your query or breaking it into more specific questions.',
      'Tap the refresh button in the chat header or re-open the Stylist tab to start a fresh session.',
      'Remember that chat history is maintained in server memory (up to 20 messages per session) and refreshes automatically if the service restarts.'
    ],
    keywords: ['not responding', 'chat stuck', 'server error', 'timeout', 'refresh chat', 'connection issue']
  },

  // ==========================================
  // D. AR Try-On (7 questions)
  // ==========================================
  {
    id: 'ar-1',
    categoryId: 'ar-tryon',
    question: 'What is AR Try-On?',
    answer:
      'AR Try-On is NOVA\'s cutting-edge virtual fitting room powered by Decart AI. It warps and renders selected 3D garments onto your live camera stream or photo in real time, letting you visualize garment drape, sleeve length, silhouette, and proportions before making a purchasing decision.',
    points: [
      'Real-time neural garment warping that tracks your body movements',
      'Realistic fabric rendering with dynamic lighting and shadow matching',
      'Instant swapping between different garments and color variants',
      'Photo capture and "Save Look" features to save outfits to your profile'
    ],
    keywords: ['ar try on', 'what is ar', 'augmented reality', 'virtual dressing room', 'fitting room', 'decart'],
    actionLink: { label: 'Launch AR Try-On', screen: 'ar-tryon' }
  },
  {
    id: 'ar-2',
    categoryId: 'ar-tryon',
    question: 'How do I use AR Try-On?',
    answer:
      'Using the AR Try-On fitting room is simple:',
    steps: [
      'Tap "Try On" on any product card, or open the "Scan" tab in the bottom bar and tap "AR Try-On".',
      'Allow camera permission when requested by your device.',
      'Stand 4 to 6 feet back in a well-lit room so your upper torso and shoulders are clearly visible.',
      'Select any garment from the bottom scrollable carousel to overlay it on your live stream.',
      'Tap the camera capture button to snap a photo, save the look, or share it with friends.'
    ],
    keywords: ['how to use', 'try on steps', 'camera instructions', 'fitting instructions', 'how it works'],
    actionLink: { label: 'Open AR Try-On', screen: 'ar-tryon' }
  },
  {
    id: 'ar-3',
    categoryId: 'ar-tryon',
    question: 'Why is my camera not opening?',
    answer:
      'Camera access requires explicit permission from your mobile operating system or web browser:',
    points: [
      'Android / iOS Settings: Go to Settings > Apps > NOVA > Permissions and ensure Camera is set to "Allow".',
      'Browser Permissions: If using Chrome or Safari, tap the lock/settings icon in the URL bar and allow Camera.',
      'Conflicting Apps: Ensure other video apps (e.g. Zoom, Meet, or the native camera app) are closed.',
      'Hardware Acceleration: Ensure WebGL and hardware acceleration are enabled in your browser settings.'
    ],
    keywords: ['camera not opening', 'camera blocked', 'permission denied', 'black screen', 'camera error', 'webgl']
  },
  {
    id: 'ar-4',
    categoryId: 'ar-tryon',
    question: 'Can I switch between front and rear cameras?',
    answer:
      'Yes! Inside the AR Try-On camera view, look for the Camera Flip icon (circular arrows) in the top control bar. Tapping it switches between your front selfie camera and rear environment camera, allowing you to try on clothes yourself or preview styles on a friend or mannequin.',
    keywords: ['switch camera', 'flip camera', 'rear camera', 'front camera', 'selfie mode', 'environment camera']
  },
  {
    id: 'ar-5',
    categoryId: 'ar-tryon',
    question: 'Why does the outfit look misaligned?',
    answer:
      'Accurate garment placement depends on clear computer-vision pose detection:',
    points: [
      'Ensure bright, even lighting avoiding strong backlighting from windows.',
      'Stand squarely facing the camera with your upper torso, shoulders, and waist visible.',
      'Avoid wearing bulky, oversized jackets or heavy blankets during scanning, which can obscure body contours.',
      'Allow 2 to 3 seconds for the pose tracking model to calibrate to your posture and stance.'
    ],
    keywords: ['misaligned', 'clothes off center', 'tracking error', 'pose estimation', 'fit calibration', 'lighting']
  },
  {
    id: 'ar-6',
    categoryId: 'ar-tryon',
    question: 'Why is AR Try-On taking a long time?',
    answer:
      'Neural garment rendering executes intensive computer-vision calculations. Processing speeds depend on your internet connection and network latency to our Decart AI GPU servers. NOVA maintains a rotating pool of API keys and server failover proxies to maintain smooth performance and prevent rate limiting.',
    keywords: ['slow try on', 'loading delay', 'processing time', 'decart lag', 'connection speed', 'server load']
  },
  {
    id: 'ar-7',
    categoryId: 'ar-tryon',
    question: 'Can I save and revisit a look?',
    answer:
      'Yes! Whenever you preview an outfit in AR Try-On, tap "Save Look" to store the high-resolution snapshot directly to your NOVA profile. You can also tap "Download" to save the image to your device\'s local photo gallery. Access all saved outfits anytime under Profile > Saved Looks.',
    keywords: ['save look', 'revisit look', 'download photo', 'device gallery', 'saved looks', 'screenshot'],
    actionLink: { label: 'View Saved Looks', screen: 'profile' }
  },

  // ==========================================
  // E. Virtual Wardrobe (5 questions)
  // ==========================================
  {
    id: 'vw-1',
    categoryId: 'virtual-wardrobe',
    question: 'What is the Virtual Wardrobe?',
    answer:
      'The Virtual Wardrobe is your personal digital clothing catalog in NOVA. It allows you to digitize the garments hanging in your real-life closet, organize them into categories, and combine them with Showroom items to create coordinated looks with the assistance of Stylist AI.',
    points: [
      'Digital cataloging of your personal clothing collection',
      'Automated AI background removal to isolate clean garment silhouettes',
      'Categorization across Tops, Bottoms, Outerwear, Shoes, and Accessories',
      'Integration with Stylist AI for smart outfit pairing recommendations'
    ],
    keywords: ['virtual wardrobe', 'digital closet', 'my clothes', 'wardrobe catalog', 'digitize clothes'],
    actionLink: { label: 'Open Wardrobe', screen: 'virtual-wardrobe' }
  },
  {
    id: 'vw-2',
    categoryId: 'virtual-wardrobe',
    question: 'How do I add clothes?',
    answer:
      'Adding garments to your Virtual Wardrobe takes just a few seconds:',
    steps: [
      'Open the Virtual Wardrobe from the center NOVA Hub or navigation menu.',
      'Tap the "+" (Add Garment) button.',
      'Take a photo of your garment or upload an existing photo from your device gallery.',
      'NOVA\'s automated background removal tool will isolate the garment onto a clean studio canvas.',
      'Assign the garment category (Tops, Bottoms, Outerwear, Shoes, Accessories) and tap "Save to Wardrobe".'
    ],
    keywords: ['add clothes', 'upload garment', 'take photo', 'digitize item', 'import clothes', 'add to wardrobe'],
    actionLink: { label: 'Add Garments', screen: 'virtual-wardrobe' }
  },
  {
    id: 'vw-3',
    categoryId: 'virtual-wardrobe',
    question: 'Can I organise my wardrobe?',
    answer:
      'Yes! You can organize your digital closet using category filter chips: All, Tops, Bottoms, Outerwear, Shoes, and Accessories. Tapping on any item opens a detailed view where you can review paired looks or delete items you no longer own by tapping the trash icon.',
    keywords: ['organize wardrobe', 'filter clothes', 'categories', 'delete garment', 'manage wardrobe', 'sort']
  },
  {
    id: 'vw-4',
    categoryId: 'virtual-wardrobe',
    question: 'Can NOVA automatically recognise every garment?',
    answer:
      'NOVA utilizes a powerful background removal model (`rembg`) to isolate your clothing from background clutter. While it reliably detects common garment outlines, very intricate multi-piece ensembles or low-contrast photos (e.g. black fabric on a black bedspread) may require you to confirm the category manually.',
    keywords: ['automatic recognition', 'rembg', 'ai detection', 'silhouette', 'background removal', 'limitations']
  },
  {
    id: 'vw-5',
    categoryId: 'virtual-wardrobe',
    question: 'How are wardrobe items used for styling recommendations?',
    answer:
      'When you ask Stylist AI for advice, it takes into account the pieces in your Virtual Wardrobe. For example, asking "What pants in the Showroom match my black leather jacket?" prompts the AI to recommend complementary items that complete your personal wardrobe.',
    keywords: ['wardrobe styling', 'pairing', 'mix and match', 'combine outfits', 'closet recommendations']
  },

  // ==========================================
  // F. Products & Shopping (7 questions)
  // ==========================================
  {
    id: 'ps-1',
    categoryId: 'products-shopping',
    question: 'How do I browse products?',
    answer:
      'You can browse products on the Home screen under Curated Drops, or tap the center NOVA Hub and select "Showroom" to view our complete multi-brand catalog. You can filter items by category (Streetwear, Formal, Traditional, Activewear) and price.',
    keywords: ['browse products', 'showroom', 'catalog', 'find clothes', 'collections', 'trending'],
    actionLink: { label: 'Explore Showroom', screen: 'showroom' }
  },
  {
    id: 'ps-2',
    categoryId: 'products-shopping',
    question: 'How do I check product sizes and colours?',
    answer:
      'Tapping any product card opens the dedicated Product Details page. Here you can inspect high-resolution product photos, browse selectable color swatches, view available sizes (XS, S, M, L, XL, XXL), and read garment composition and fabric care instructions.',
    keywords: ['sizes', 'colors', 'product details', 'variants', 'swatches', 'fabric', 'care instructions']
  },
  {
    id: 'ps-3',
    categoryId: 'products-shopping',
    question: 'How do I add a product to my wishlist?',
    answer:
      'Tap the heart icon in the top-right corner of any product card or on the Product Details page. The heart will turn vibrant red to indicate it is saved. You can review all your saved items anytime by tapping the heart icon in the app header or in Profile > Wishlist.',
    keywords: ['wishlist', 'save product', 'heart icon', 'favorites', 'saved items', 'bookmark'],
    actionLink: { label: 'View Profile', screen: 'profile' }
  },
  {
    id: 'ps-4',
    categoryId: 'products-shopping',
    question: 'How do I add products to my cart?',
    answer:
      'On any Product Details page, choose your preferred color variant and size, then tap "Add to Cart". A confirmation badge will update the cart counter in the top header. You can also add items directly from your Wishlist modal.',
    keywords: ['add to cart', 'shopping bag', 'buy item', 'select size', 'select color'],
    actionLink: { label: 'Open Cart', screen: 'cart' }
  },
  {
    id: 'ps-5',
    categoryId: 'products-shopping',
    question: 'How do promo codes work?',
    answer:
      'In the Cart view, locate the "Promo Code" input box beneath your items summary. Enter a valid promotional code (such as NOVA10 for 10% off or FIRST50 for welcome savings) and tap "Apply". The discount amount will be deducted immediately from your total.',
    keywords: ['promo codes', 'discount', 'coupon', 'voucher', 'nova10', 'first50', 'savings']
  },
  {
    id: 'ps-6',
    categoryId: 'products-shopping',
    question: 'Why is a product unavailable?',
    answer:
      'Product inventory in NOVA is synced live with participating vendor warehouses. If a specific color or size combination sells out, it will be marked as "Out of Stock" and disabled for cart addition until the vendor restocks.',
    keywords: ['unavailable', 'out of stock', 'sold out', 'inventory', 'restock', 'backorder']
  },
  {
    id: 'ps-7',
    categoryId: 'products-shopping',
    question: 'How do I view product reviews and ratings?',
    answer:
      'Tapping any product card opens its Product Details page. Scroll down beneath the sizing selector to view verified customer ratings (1 to 5 stars), average rating summaries, and written reviews with fit feedback from real shoppers.',
    keywords: ['reviews', 'ratings', 'customer feedback', 'stars', 'product reviews', 'buyer feedback']
  },

  // ==========================================
  // G. Cart, Orders & Payments (7 questions)
  // ==========================================
  {
    id: 'cop-1',
    categoryId: 'cart-orders-payments',
    question: 'How do I place an order?',
    answer:
      'Placing an order is straightforward:',
    steps: [
      'Add your chosen items to your Cart and tap the Cart icon in the top header.',
      'Review your garments, selected sizes, quantities, and apply any promo codes.',
      'Confirm or select your delivery address.',
      'Choose your preferred payment method (UPI, Card, or Cash on Delivery).',
      'Tap "Place Order" to finalize your purchase and receive order confirmation.'
    ],
    keywords: ['place order', 'checkout', 'how to buy', 'complete order', 'purchase steps'],
    actionLink: { label: 'Go to Cart', screen: 'cart' }
  },
  {
    id: 'cop-2',
    categoryId: 'cart-orders-payments',
    question: 'How can I check my order status?',
    answer:
      'Once your order has been placed, you can monitor its progress in Profile under "Order History" or through real-time push notifications. Tracking stages include: Order Placed, Preparing Package, Shipped with Courier, Out for Delivery, and Delivered.',
    keywords: ['order status', 'track package', 'shipping status', 'order history', 'where is my order']
  },
  {
    id: 'cop-3',
    categoryId: 'cart-orders-payments',
    question: 'Which payment methods are supported?',
    answer:
      'NOVA supports standard Indian digital payment methods:',
    points: [
      'UPI: Instant payment through Google Pay, PhonePe, Paytm, and BHIM.',
      'Credit & Debit Cards: Visa, Mastercard, RuPay, and American Express.',
      'Cash on Delivery (COD): Available for eligible delivery PIN codes.',
      'Please Note: Live checkout currently operates in test sandbox mode pending final merchant production gateway activation.'
    ],
    keywords: ['payment methods', 'upi', 'gpay', 'phonepe', 'credit card', 'debit card', 'cod', 'cash on delivery']
  },
  {
    id: 'cop-4',
    categoryId: 'cart-orders-payments',
    question: 'What should I do if payment fails?',
    answer:
      'If your payment does not go through:',
    points: [
      'Verify that your card has online payments enabled or that your UPI app has sufficient bank balance.',
      'Ensure you approve the UPI payment request before the payment timer expires.',
      'Switch to another payment method such as Cash on Delivery (COD).',
      'Rest assured that your cart items and shipping details are preserved, so you won\'t have to re-select your items.'
    ],
    keywords: ['payment failed', 'transaction declined', 'upi timeout', 'card failed', 'retry payment']
  },
  {
    id: 'cop-5',
    categoryId: 'cart-orders-payments',
    question: 'Can I cancel or return an order?',
    answer:
      'Orders can be cancelled prior to warehouse dispatch through Order Details in your profile. For returns, garments must be unworn, unwashed, and returned with original tags intact. Because live checkout is in transition to production merchant gateways, specific return windows are subject to operator policy confirmation.',
    keywords: ['cancel order', 'return policy', 'refunds', 'return garment', 'money back']
  },
  {
    id: 'cop-6',
    categoryId: 'cart-orders-payments',
    question: 'How are taxes, shipping and discounts calculated?',
    answer:
      'Your Cart summary breaks down costs transparently:',
    points: [
      'Subtotal: Combined price of your selected garments.',
      'Promotional Discount: Subtracted immediately upon applying an active promo code.',
      'Goods & Services Tax (GST): Calculated at standard Indian apparel tax rates (typically 18%).',
      'Shipping: Free for all orders above ₹999; flat ₹99 for orders below ₹999.'
    ],
    keywords: ['taxes', 'gst', 'shipping fee', 'free shipping', 'discount calculation', 'order total']
  },
  {
    id: 'cop-7',
    categoryId: 'cart-orders-payments',
    question: 'What happens if my order is created but payment fails?',
    answer:
      'Your order will remain in a pending state and your cart contents will not be emptied. You will be prompted with a retry screen allowing you to choose another payment method or select Cash on Delivery without starting over.',
    keywords: ['pending order', 'payment failed recovery', 'retry checkout', 'saved cart']
  },

  // ==========================================
  // H. Shipping & Addresses (6 questions)
  // ==========================================
  {
    id: 'sa-1',
    categoryId: 'shipping-addresses',
    question: 'How do I add a delivery address?',
    answer:
      'Go to Profile > Addresses and tap "Add New Address". Enter your recipient name, mobile number, flat/house number, street address, and PIN code. You can also use our smart autocomplete to find your locality quickly.',
    keywords: ['add address', 'delivery address', 'new address', 'shipping location', 'save address'],
    actionLink: { label: 'Open Addresses', screen: 'profile' }
  },
  {
    id: 'sa-2',
    categoryId: 'shipping-addresses',
    question: 'How do address autocomplete suggestions work?',
    answer:
      'When you type in the address input field, NOVA queries an integrated OpenStreetMap Photon location engine. As you type letters (such as "Goregaon" or "Bandra"), matching localities appear. Selecting an item autofills city, state, and approximate postal details, which you can adjust with your exact apartment number.',
    keywords: ['address autocomplete', 'smart address', 'suggestions', 'photon', 'osm', 'locality search']
  },
  {
    id: 'sa-3',
    categoryId: 'shipping-addresses',
    question: 'Does NOVA support Mumbai and other Indian locations?',
    answer:
      'Yes! NOVA is tailored for Indian addresses, with specialized locality recommendations for Mumbai (including Goregaon, Andheri, Bandra, Powai, Bhandup, South Mumbai) as well as tier-1 and tier-2 Indian metropolitan cities across all states.',
    keywords: ['mumbai', 'india shipping', 'goregaon', 'andheri', 'bandra', 'powai', 'tier 1 cities']
  },
  {
    id: 'sa-4',
    categoryId: 'shipping-addresses',
    question: 'How do I correct an incorrect PIN code?',
    answer:
      'NOVA validates 6-digit Indian Postal PIN codes. If an autocomplete selection inserted a neighboring postal code, simply tap the PIN Code input box and type your exact 6-digit postal code. Both the address and PIN code remain fully editable before saving.',
    keywords: ['correct pin code', 'edit pincode', 'postal code', 'zip code', 'pin code error']
  },
  {
    id: 'sa-5',
    categoryId: 'shipping-addresses',
    question: 'How can I update a saved address?',
    answer:
      'In Profile > Addresses, tap the edit icon next to any saved address. You can modify any component—recipient name, street, or PIN code—and tap "Save". You can also delete unused addresses or mark one as default.',
    keywords: ['update saved address', 'edit address', 'change address', 'delete address', 'default address'],
    actionLink: { label: 'Manage Addresses', screen: 'profile' }
  },
  {
    id: 'sa-6',
    categoryId: 'shipping-addresses',
    question: 'How long does delivery take?',
    answer:
      'Standard courier delivery across Mumbai and major Indian metropolitan cities typically takes 2 to 4 business days. Delivery to tier-2 and regional locations takes approximately 4 to 7 business days depending on vendor warehouse location.',
    keywords: ['delivery time', 'how long shipping', 'transit days', 'metro delivery', 'shipping speed']
  },

  // ==========================================
  // I. Vendors & Products (4 questions)
  // ==========================================
  {
    id: 'vp-1',
    categoryId: 'vendors-products',
    question: 'Where do products in NOVA come from?',
    answer:
      'Products in NOVA are sourced from verified independent fashion labels, designer studios, and boutique manufacturers (such as Urban Threads, Aura Studio, and Luxe Atelier). Each partner label is curated for garment quality, style appeal, and accurate sizing.',
    keywords: ['vendors', 'where products come from', 'boutique brands', 'sourcing', 'brands', 'designers']
  },
  {
    id: 'vp-2',
    categoryId: 'vendors-products',
    question: 'How can vendors list products?',
    answer:
      'Fashion brands and apparel vendors can manage their catalog via NOVA\'s dedicated Vendor Portal. Vendors can upload high-resolution product photography, define 3D try-on asset models, manage size inventories, and synchronize pricing with the customer showroom.',
    keywords: ['vendor listing', 'seller portal', 'how to sell', 'brand registration', 'list products']
  },
  {
    id: 'vp-3',
    categoryId: 'vendors-products',
    question: 'Why might a product not appear in the customer app?',
    answer:
      'A product may be omitted from the customer app if:',
    points: [
      'The vendor marked the product as inactive or draft in their portal.',
      'The item is completely out of stock across all sizes and colors.',
      'The product is undergoing automated 3D AR asset validation before public release.'
    ],
    keywords: ['product not appearing', 'missing item', 'unlisted', 'draft product', 'vendor sync']
  },
  {
    id: 'vp-4',
    categoryId: 'vendors-products',
    question: 'How are product availability and variants managed?',
    answer:
      'NOVA tracks stock availability at the variant level. Every product can have multiple colorways, hexadecimal color badges, image galleries, and sizes (XS through XXL). If a specific size sells out, it is disabled while remaining variants stay purchasable.',
    keywords: ['variants', 'availability', 'stock management', 'sizes', 'colors', 'inventory']
  },

  // ==========================================
  // J. Notifications & Offers (5 questions)
  // ==========================================
  {
    id: 'no-1',
    categoryId: 'notifications-offers',
    question: 'How do I manage notifications?',
    answer:
      'In the Profile tab, tap "Notifications" to open your Notification Preferences center. You can toggle specific categories according to your preference:',
    points: [
      'Price Drops: Alerts when items on your Wishlist go on sale.',
      'New Arrivals: Announcements for new designer collections and seasonal drops.',
      'Stylist Reminders: Tailored outfit inspirations and weather-appropriate tips.',
      'Order & Delivery Tracking: Continuous push alerts regarding active order transit.',
      'Daily Style Drops: Marketing pushes showcasing trending styling aesthetics.'
    ],
    keywords: ['manage notifications', 'notification settings', 'preferences', 'turn on alerts', 'push alerts'],
    actionLink: { label: 'Open Profile', screen: 'profile' }
  },
  {
    id: 'no-2',
    categoryId: 'notifications-offers',
    question: 'Why am I not receiving push notifications?',
    answer:
      'If push notifications are not appearing:',
    points: [
      'Verify that system notifications are allowed for NOVA in Android Settings > Apps > NOVA > Notifications.',
      'Confirm that "Do Not Disturb" or battery-saving background restrictions are not blocking the app.',
      'Ensure the corresponding toggle is turned ON in Profile > Notifications.',
      'On web browsers, ensure you clicked "Allow" when the browser prompted for notification permissions.'
    ],
    keywords: ['not receiving notifications', 'no push alerts', 'android permission', 'notifications blocked']
  },
  {
    id: 'no-3',
    categoryId: 'notifications-offers',
    question: 'How do NOVA offers and promo codes work?',
    answer:
      'NOVA shares exclusive discount coupons, welcome promotions, and seasonal festive sales via push notifications and in-app banners. Enter your code in the Cart before checkout to claim instant discounts.',
    keywords: ['offers', 'promo codes', 'discounts', 'coupons', 'welcome offer', 'savings']
  },
  {
    id: 'no-4',
    categoryId: 'notifications-offers',
    question: 'Can I disable marketing notifications?',
    answer:
      'Yes, absolutely. Go to Profile > Notifications and toggle off "Daily Style Drops". You will immediately stop receiving marketing messages while continuing to receive essential transactional updates such as order tracking and OTP verification codes.',
    keywords: ['disable marketing', 'opt out', 'turn off promotional', 'unsubscribe', 'stop notifications'],
    actionLink: { label: 'Go to Profile', screen: 'profile' }
  },
  {
    id: 'no-5',
    categoryId: 'notifications-offers',
    question: 'How can I change notification preferences?',
    answer:
      'You can adjust your notification settings anytime by tapping "Notifications" in Profile. All toggles update instantly and are saved to your account settings.',
    keywords: ['change preferences', 'notification center', 'customize alerts', 'toggle notifications'],
    actionLink: { label: 'Notification Settings', screen: 'profile' }
  },

  // ==========================================
  // K. Privacy & Data (5 questions)
  // ==========================================
  {
    id: 'pd-1',
    categoryId: 'privacy-data',
    question: 'How does NOVA use profile information?',
    answer:
      'NOVA uses your profile information (name, email, delivery addresses, body measurements, and style preferences) strictly to personalize your shopping experience, generate tailored AR fittings, and deliver your orders. We never sell your personal information to third-party data brokers.',
    keywords: ['privacy', 'profile information', 'data usage', 'how data is used', 'data security'],
    actionLink: { label: 'Read Privacy Policy', screen: 'privacy' }
  },
  {
    id: 'pd-2',
    categoryId: 'privacy-data',
    question: 'Why does NOVA need camera permission?',
    answer:
      'Camera permission is strictly optional and requested on-demand only for interactive visual features: live AR Try-On and digitizing clothes for your Virtual Wardrobe. Video frames are processed in real time and are never recorded or stored on public servers without your explicit command.',
    keywords: ['camera permission', 'why camera', 'camera privacy', 'video stream', 'permissions']
  },
  {
    id: 'pd-3',
    categoryId: 'privacy-data',
    question: 'Is payment information stored by NOVA?',
    answer:
      'No. NOVA does not store credit card numbers, CVVs, or bank account credentials on its servers. All payment transactions are processed securely through certified, PCI-DSS-compliant payment gateway providers.',
    keywords: ['payment information', 'card stored', 'pci dss', 'security', 'card details']
  },
  {
    id: 'pd-4',
    categoryId: 'privacy-data',
    question: 'How can I request account deletion or data removal?',
    answer:
      'Logging out or removing an account from the Profile device switcher removes your credentials and local data from your current device. To request permanent deletion of cloud-stored profile, wardrobe, and order records in Firebase Firestore, contact our privacy officer through our support channel.',
    keywords: ['delete account', 'data removal', 'delete data', 'gdpr', 'erasure request']
  },
  {
    id: 'pd-5',
    categoryId: 'privacy-data',
    question: 'Where can I read the Privacy Policy?',
    answer:
      'You can read NOVA\'s complete, legally binding Privacy Policy anytime by tapping "Privacy Policy" in the Profile tab settings list. It explains our data handling policies, retention schedules, and statutory user rights in full detail.',
    keywords: ['privacy policy', 'read policy', 'legal', 'terms', 'data rights'],
    actionLink: { label: 'Open Privacy Policy', screen: 'privacy' }
  },

  // ==========================================
  // L. Technical Support (5 questions)
  // ==========================================
  {
    id: 'ts-1',
    categoryId: 'technical-support',
    question: 'Why is NOVA not loading?',
    answer:
      'If NOVA is having trouble loading:',
    points: [
      'Check your device\'s Wi-Fi or cellular data connection.',
      'Ensure your browser or Android System WebView is updated to the latest version.',
      'Confirm that WebGL is enabled in your browser settings for AR graphics rendering.',
      'Clear your browser or app cache and reload the application.'
    ],
    keywords: ['not loading', 'blank screen', 'app crash', 'connection error', 'webgl', 'troubleshooting']
  },
  {
    id: 'ts-2',
    categoryId: 'technical-support',
    question: 'What should I do if the app displays an error?',
    answer:
      'If an unexpected error dialog appears:',
    points: [
      'Take a screenshot of the error message for reference.',
      'Tap Back or navigate to Home to refresh the current view.',
      'Restart the application to reload updated scripts.',
      'Use the "Report a Problem" button in the support section below to notify our engineering team.'
    ],
    keywords: ['error message', 'app error', 'glitch', 'crash', 'unexpected error', 'bug']
  },
  {
    id: 'ts-3',
    categoryId: 'technical-support',
    question: 'How can I contact NOVA support?',
    answer:
      'Official registered customer support email and telephone channels are currently pending confirmation from our platform operator (noted as [Pending Confirmation] in our legal disclosures). In the interim, you can use the "Report a Problem" feature below or consult Stylist AI for immediate in-app assistance.',
    keywords: ['contact support', 'support email', 'customer care', 'help desk', 'operator contact']
  },
  {
    id: 'ts-4',
    categoryId: 'technical-support',
    question: 'How can I report a bug?',
    answer:
      'You can report bugs directly from this FAQ screen by tapping "Report a Problem" in the support card at the bottom. Provide a short description of the issue, what screen you were on, and your device type to help our developers fix it quickly.',
    keywords: ['report a bug', 'submit bug', 'report problem', 'issue', 'feedback']
  },
  {
    id: 'ts-5',
    categoryId: 'technical-support',
    question: 'How can I suggest a new feature?',
    answer:
      'We welcome ideas from the NOVA community! You can share feature suggestions—such as new fashion brands, additional wardrobe organization filters, or AR features—using the in-app feedback option or directly in your chats with Stylist AI.',
    keywords: ['suggest feature', 'feature request', 'feedback', 'new idea', 'improvements']
  }
];

export function searchFAQs(
  query: string,
  categoryId: string = 'all',
  items: FAQItem[] = FAQ_ITEMS
): FAQItem[] {
  const normalizedQuery = query.trim().toLowerCase();

  return items.filter((item) => {
    // 1. Category filter
    if (categoryId !== 'all' && item.categoryId !== categoryId) {
      return false;
    }

    // 2. Query filter
    if (!normalizedQuery) {
      return true;
    }

    const inQuestion = item.question.toLowerCase().includes(normalizedQuery);
    const inAnswer = item.answer.toLowerCase().includes(normalizedQuery);
    const inKeywords = item.keywords.some((k) => k.toLowerCase().includes(normalizedQuery));
    const inPoints = item.points?.some((p) => p.toLowerCase().includes(normalizedQuery)) ?? false;
    const inSteps = item.steps?.some((s) => s.toLowerCase().includes(normalizedQuery)) ?? false;

    return inQuestion || inAnswer || inKeywords || inPoints || inSteps;
  });
}
