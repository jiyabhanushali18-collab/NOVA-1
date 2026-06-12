# Firebase Firestore Setup Guide - NOVA Showroom

## ✅ Status
Your frontend is **already configured** to fetch products from Firebase Firestore. The App.tsx automatically loads products from a `products` collection.

---

## 📋 Firestore Collection Structure

### Collection: `products`
Each document represents a product with the following fields:

```json
{
  "id": "kurta-001",
  "name": "Premium Cotton Kurta",
  "category": "Kurtas",
  "price": 1299,
  "originalPrice": 1499,
  "rating": 4.5,
  "reviewsCount": 42,
  "imageUrl": "https://your-image-url.jpg",
  "colors": ["White", "Navy", "Maroon", "Cream"],
  "sizes": ["XS", "S", "M", "L", "XL", "XXL"],
  "inStock": true,
  "stockLeft": 15,
  "badge": "New Arrival",
  "details": [
    "100% Cotton",
    "Hand-embroidered",
    "Machine washable",
    "Traditional design"
  ]
}
```

---

## 🚀 Quick Setup Steps

### Step 1: Go to Firebase Console
1. Visit [Firebase Console](https://console.firebase.google.com/)
2. Select your **nova-26b39** project
3. Navigate to **Firestore Database** (left sidebar)

### Step 2: Create Products Collection
1. Click **+ Create Collection**
2. Name it: `products`
3. Click **Next**

### Step 3: Add Sample Products

#### Add First Document (Kurta)
Click **+ Add Document** and paste this data:

**Document ID:** `kurta-premium-cotton`

| Field | Type | Value |
|-------|------|-------|
| name | string | Premium Cotton Kurta |
| category | string | Kurtas |
| price | number | 1299 |
| originalPrice | number | 1499 |
| rating | number | 4.5 |
| reviewsCount | number | 42 |
| imageUrl | string | https://lh3.googleusercontent.com/... |
| inStock | boolean | true |
| stockLeft | number | 15 |
| badge | string | New Arrival |
| colors | array | ["White", "Navy", "Maroon", "Cream"] |
| sizes | array | ["XS", "S", "M", "L", "XL", "XXL"] |
| details | array | ["100% Cotton", "Hand-embroidered", "Machine washable"] |

#### Add More Products

**Casual Shirt 1**
```
Document ID: casual-shirt-001
name: "Casual Striped Shirt"
category: "Casual Shirts"
price: 899
originalPrice: 999
rating: 4.3
reviewsCount: 28
imageUrl: [your-image-url]
inStock: true
stockLeft: 20
badge: "Popular"
colors: ["Blue Stripes", "Red Stripes", "Black", "White"]
sizes: ["S", "M", "L", "XL"]
details: ["100% Cotton", "Comfortable fit", "Perfect for casual wear"]
```

**Casual Shirt 2**
```
Document ID: casual-shirt-002
name: "Oxford Button-Down Shirt"
category: "Casual Shirts"
price: 1199
rating: 4.6
reviewsCount: 35
imageUrl: [your-image-url]
inStock: true
stockLeft: 12
colors: ["White", "Light Blue", "Pink"]
sizes: ["S", "M", "L", "XL", "XXL"]
details: ["Premium Cotton", "Classic Oxford", "Business casual"]
```

**Kurta 2**
```
Document ID: kurta-ethnic-001
name: "Ethnic Embroidered Kurta"
category: "Kurtas"
price: 1599
originalPrice: 1999
rating: 4.8
reviewsCount: 56
imageUrl: [your-image-url]
inStock: true
stockLeft: 8
badge: "Top Pick"
colors: ["Gold", "Silver", "Black", "Maroon"]
sizes: ["XS", "S", "M", "L", "XL"]
details: ["Pure silk", "Hand embroidered", "Ethnic design"]
```

---

## 📸 Where to Get Product Images

Use these free image sources or your own product photos:
- **Unsplash**: https://unsplash.com/
- **Pexels**: https://www.pexels.com/
- **Your own product images**: Upload to any CDN

### Example Product Image URLs:
- Kurta: `https://images.unsplash.com/photo-1584542604411-e61fb8d5e5a2`
- Casual Shirt: `https://images.unsplash.com/photo-1517249828539-c1f1d878e5c0`

---

## ✅ Testing the Integration

### In Browser:
1. Open **NOVA Showroom** app
2. Navigate to **Showroom** tab
3. You should see your products loading automatically!

### Via Console (Optional):
```javascript
// Open browser DevTools Console (F12)
// Your App.tsx logs errors:
console.log('Products loaded from Firebase');
```

### Troubleshooting:

| Issue | Solution |
|-------|----------|
| Products not showing | Check Firestore collection name is exactly `products` |
| Loading spinner forever | Check Firestore rules (should allow read access) |
| See fallback products | Products are loading from data.ts, Firestore fetch may be pending |

---

## 🔐 Firestore Security Rules (Optional)

To allow frontend read access, update your security rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /products/{document=**} {
      allow read: if true;  // Anyone can read products
      allow write: if request.auth != null;  // Only authenticated users can write
    }
  }
}
```

---

## 📦 Auto-Sync Flow

Your frontend automatically:
1. ✅ Loads products from `products` collection on app start
2. ✅ Displays them in NOVA Showroom
3. ✅ Falls back to sample data if Firestore is empty
4. ✅ Shows loading/error states

---

## 🎯 Product Field Reference

| Field | Required | Type | Notes |
|-------|----------|------|-------|
| name | ✅ Yes | string | Product name (max 100 chars) |
| category | ✅ Yes | string | Kurtas, Casual Shirts, etc. |
| price | ✅ Yes | number | Current price in INR |
| originalPrice | No | number | For discount display |
| rating | ✅ Yes | number | 1-5 scale |
| reviewsCount | ✅ Yes | number | Number of reviews |
| imageUrl | ✅ Yes | string | Full image URL |
| colors | ✅ Yes | array | Available colors |
| sizes | ✅ Yes | array | Available sizes |
| inStock | No | boolean | Defaults to true |
| stockLeft | No | number | Quantity remaining |
| badge | No | string | "New", "Top Pick", "Sale", etc. |
| details | No | array | Key features/description |

---

## 🔄 Real-time Updates

Once you add/edit products in Firestore Console, they'll appear in your app within seconds (real-time Firestore sync).

**Done!** Your NOVA Showroom is now connected to Firebase. 🚀
