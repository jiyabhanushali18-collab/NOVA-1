import express, { Request, Response } from 'express';
import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  serverTimestamp,
  Timestamp,
  QueryConstraint
} from 'firebase/firestore';
import { firestore } from './firebase';

const router = express.Router();

// Types for request bodies
interface CreateProductRequest {
  name: string;
  category: string;
  price: number;
  description?: string;
  brand?: string;
  fabric?: string;
  fit?: string;
  gender?: string;
  occasion?: string;
  season?: string;
  pattern?: string;
  stretch?: string;
  sleeveType?: string;
  neckType?: string;
  careInstructions?: string;
  tags?: string[];
  imageUrl?: string;
  images?: string[];
  variants?: Array<{
    color: string;
    sizes: string[];
    stock: number;
    images: string[];
  }>;
  colors?: string[];
  sizes?: string[];
  details?: string[];
  originalPrice?: number;
  rating?: number;
  reviewsCount?: number;
  inStock?: boolean;
  badge?: string;
  vendorId?: string;
}

interface UpdateProductRequest extends Partial<CreateProductRequest> {
  id: string;
}

// Validation helper
const validateProductData = (data: CreateProductRequest): string | null => {
  if (!data.name || data.name.trim() === '') {
    return 'Product name is required';
  }
  if (!data.category || data.category.trim() === '') {
    return 'Category is required';
  }
  if (typeof data.price !== 'number' || data.price < 0) {
    return 'Price must be a positive number';
  }
  if (data.originalPrice && typeof data.originalPrice !== 'number') {
    return 'Original price must be a number';
  }
  return null;
};

// Normalize product data for backward compatibility
const normalizeProductData = (data: CreateProductRequest) => {
  return {
    // Core required fields
    name: data.name || '',
    category: data.category || 'Uncategorized',
    price: data.price || 0,
    rating: data.rating || 0,
    reviewsCount: data.reviewsCount || 0,

    // Basic info
    description: data.description || '',
    brand: data.brand || '',
    imageUrl: data.imageUrl || '',
    images: Array.isArray(data.images) ? data.images : [],

    // Display info
    colors: Array.isArray(data.colors) ? data.colors : [],
    sizes: Array.isArray(data.sizes) ? data.sizes : [],
    details: Array.isArray(data.details) ? data.details : [],
    inStock: typeof data.inStock === 'boolean' ? data.inStock : true,
    badge: data.badge || '',

    // Pricing
    originalPrice: data.originalPrice,
    discountPrice: undefined,

    // Clothing-specific fields (optional)
    fabric: data.fabric || undefined,
    fit: data.fit || undefined,
    gender: data.gender || undefined,
    occasion: data.occasion || undefined,
    season: data.season || undefined,
    pattern: data.pattern || undefined,
    stretch: data.stretch || undefined,
    sleeveType: data.sleeveType || undefined,
    neckType: data.neckType || undefined,
    careInstructions: data.careInstructions || undefined,
    tags: Array.isArray(data.tags) ? data.tags : [],

    // Variants
    newVariants: Array.isArray(data.variants) ? data.variants : [],

    // Metadata
    vendorId: data.vendorId || '',
    updatedAt: serverTimestamp()
  };
};

/**
 * GET /api/products - Get all products or filter by vendor
 */
router.get('/products', async (req: Request, res: Response) => {
  try {
    const { vendorId, limit = 50, offset = 0 } = req.query;
    const productsCollection = collection(firestore, 'products');

    let constraints: QueryConstraint[] = [];
    if (vendorId && typeof vendorId === 'string') {
      constraints.push(where('vendorId', '==', vendorId));
    }

    const q = constraints.length > 0 ? query(productsCollection, ...constraints) : query(productsCollection);
    const snapshot = await getDocs(q);

    const products = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({
      success: true,
      total: products.length,
      products: products.slice(
        Number(offset),
        Number(offset) + Number(limit)
      )
    });
  } catch (error: any) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch products'
    });
  }
});

/**
 * GET /api/products/:productId - Get a single product
 */
router.get('/products/:productId', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const docRef = doc(firestore, 'products', productId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    res.json({
      success: true,
      product: {
        id: docSnap.id,
        ...docSnap.data()
      }
    });
  } catch (error: any) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch product'
    });
  }
});

/**
 * POST /api/products - Create a new product
 */
router.post('/products', async (req: Request, res: Response) => {
  try {
    const productData = req.body as CreateProductRequest;

    // Validate
    const validationError = validateProductData(productData);
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError
      });
    }

    // Normalize and prepare data
    const normalized = normalizeProductData(productData);

    // Generate document ID from product name
    const docId = `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const docRef = doc(firestore, 'products', docId);

    // Save to Firestore
    await setDoc(docRef, {
      ...normalized,
      createdAt: serverTimestamp()
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      productId: docId
    });
  } catch (error: any) {
    console.error('Error creating product:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create product'
    });
  }
});

/**
 * PUT /api/products/:productId - Update a product
 */
router.put('/products/:productId', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const updateData = req.body as UpdateProductRequest;

    // Check if product exists
    const docRef = doc(firestore, 'products', productId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Validate the update data (if provided)
    if (updateData.name || updateData.category || updateData.price) {
      const validationError = validateProductData({
        name: updateData.name || docSnap.data().name,
        category: updateData.category || docSnap.data().category,
        price: updateData.price || docSnap.data().price
      } as CreateProductRequest);
      if (validationError) {
        return res.status(400).json({
          success: false,
          error: validationError
        });
      }
    }

    // Prepare update object
    const updateObj: Record<string, any> = {};

    // Update core fields
    if (updateData.name) updateObj.name = updateData.name;
    if (updateData.category) updateObj.category = updateData.category;
    if (typeof updateData.price === 'number') updateObj.price = updateData.price;
    if (updateData.description) updateObj.description = updateData.description;
    if (updateData.brand) updateObj.brand = updateData.brand;
    if (updateData.imageUrl) updateObj.imageUrl = updateData.imageUrl;
    if (Array.isArray(updateData.images)) updateObj.images = updateData.images;
    if (Array.isArray(updateData.colors)) updateObj.colors = updateData.colors;
    if (Array.isArray(updateData.sizes)) updateObj.sizes = updateData.sizes;
    if (Array.isArray(updateData.details)) updateObj.details = updateData.details;
    if (typeof updateData.inStock === 'boolean') updateObj.inStock = updateData.inStock;
    if (updateData.badge) updateObj.badge = updateData.badge;

    // Update clothing-specific fields
    if (updateData.fabric) updateObj.fabric = updateData.fabric;
    if (updateData.fit) updateObj.fit = updateData.fit;
    if (updateData.gender) updateObj.gender = updateData.gender;
    if (updateData.occasion) updateObj.occasion = updateData.occasion;
    if (updateData.season) updateObj.season = updateData.season;
    if (updateData.pattern) updateObj.pattern = updateData.pattern;
    if (updateData.stretch) updateObj.stretch = updateData.stretch;
    if (updateData.sleeveType) updateObj.sleeveType = updateData.sleeveType;
    if (updateData.neckType) updateObj.neckType = updateData.neckType;
    if (updateData.careInstructions) updateObj.careInstructions = updateData.careInstructions;
    if (Array.isArray(updateData.tags)) updateObj.tags = updateData.tags;
    if (Array.isArray(updateData.variants)) updateObj.newVariants = updateData.variants;

    // Update metadata
    updateObj.updatedAt = serverTimestamp();

    // Perform update
    await updateDoc(docRef, updateObj);

    res.json({
      success: true,
      message: 'Product updated successfully',
      productId
    });
  } catch (error: any) {
    console.error('Error updating product:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update product'
    });
  }
});

/**
 * DELETE /api/products/:productId - Delete a product
 */
router.delete('/products/:productId', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const docRef = doc(firestore, 'products', productId);

    // Check if exists
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Delete
    await deleteDoc(docRef);

    res.json({
      success: true,
      message: 'Product deleted successfully',
      productId
    });
  } catch (error: any) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete product'
    });
  }
});

export default router;
