import express from 'express';
import { getDocs, collection } from 'firebase/firestore';
import { firestore } from './firebase';
import { askModel } from './ollama';
import { products as localProducts } from '../src/data';
import { fashionRules, FashionRule } from '../src/server/fashionKnowledge';

const router = express.Router();

const normalizeText = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ');

const scoreText = (haystack: string, tokens: string[]) => {
  const hay = normalizeText(haystack);
  return tokens.reduce((score, token) => score + (hay.includes(token) ? 1 : 0), 0);
};

const readFashionRules = async (): Promise<FashionRule[]> => {
  const snapshot = await getDocs(collection(firestore, 'fashionRules'));
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as FashionRule[];
};

const readProductCatalog = async () => {
  const snapshot = await getDocs(collection(firestore, 'products'));
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as any[];
};

const findRelevantRules = (query: string, rules: FashionRule[]) => {
  const tokens = normalizeText(query).split(' ').filter(Boolean);
  if (!tokens.length) return rules.slice(0, 5);

  const scored = rules
    .map((rule) => {
      const haystack = [
        rule.rule_type,
        rule.condition,
        ...(rule.tags ?? []),
        ...(rule.recommendation ?? []),
        ...(rule.avoid ?? []),
        rule.description ?? '',
      ]
        .join(' ');
      return { rule, score: scoreText(haystack, tokens) };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.rule);

  return scored.length > 0 ? scored.slice(0, 5) : rules.slice(0, 5);
};

const buildKnowledgeContext = (rules: FashionRule[]) =>
  rules
    .map((rule) => {
      const recommendations = rule.recommendation.join(', ');
      const avoids = rule.avoid?.join(', ') ?? 'None';
      return `Rule type: ${rule.rule_type}\nCondition: ${rule.condition}\nRecommendations: ${recommendations}\nAvoid: ${avoids}`;
    })
    .join('\n\n');

const findProductSuggestions = (query: string, products: any[]) => {
  const tokens = normalizeText(query).split(' ').filter(Boolean);
  const getVariantColors = (product: any) => Array.isArray(product.variants)
    ? product.variants.map((variant: any) => variant?.color).filter(Boolean)
    : [];
  const getProductImage = (product: any) => (
    product.imageUrl ||
    product.mainImage ||
    product.image ||
    (Array.isArray(product.images) ? product.images.find(Boolean) : undefined) ||
    (Array.isArray(product.imageUrls) ? product.imageUrls.find(Boolean) : undefined) ||
    (Array.isArray(product.variants)
      ? product.variants.flatMap((variant: any) => Array.isArray(variant?.images) ? variant.images : []).find(Boolean)
      : undefined)
  );

  const scored = products
    .map((product) => {
      const haystack = [
        product.name,
        product.category,
        ...(product.colors ?? []),
        ...getVariantColors(product),
        ...(product.tags ?? []),
        ...(product.details ?? []),
      ].join(' ');
      return { product, score: scoreText(haystack, tokens) };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.product);

  const suggestions = (scored.length > 0 ? scored.slice(0, 4) : products.slice(0, 4)).map((product) => {
    let imageUrl = getProductImage(product);
    
    // If imageUrl is missing, try to find from local products
    if (!imageUrl) {
      const productName = product.name?.toLowerCase() || '';
      
      // Try exact match first
      for (const key of Object.keys(localProducts)) {
        if (localProducts[key].name.toLowerCase() === productName) {
          imageUrl = localProducts[key].imageUrl;
          break;
        }
      }
      
      // If still not found, try partial match
      if (!imageUrl) {
        for (const key of Object.keys(localProducts)) {
          if (localProducts[key].name.toLowerCase().includes(productName) ||
              productName.includes(localProducts[key].name.toLowerCase())) {
            imageUrl = localProducts[key].imageUrl;
            break;
          }
        }
      }
    }
    
    // Last resort: use a generic fallback
    if (!imageUrl) {
      const defaultImages = [
        'https://images.unsplash.com/photo-1556821552-5ff63b1446d7?w=500&q=80', // hoodie
        'https://images.unsplash.com/photo-1542272604-787c62d465d1?w=500&q=80', // pants
        'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&q=80', // shoes
        'https://images.unsplash.com/photo-1596215578519-c21a6004885c?w=500&q=80', // shirt
      ];
      imageUrl = defaultImages[Math.floor(Math.random() * defaultImages.length)];
    }
    
    return {
      name: product.name || 'Product',
      price: product.price || 0,
      imageUrl,
    };
  });

  return suggestions;
};

router.post('/chat', async (req: any, res: any) => {
  const { messages, message } = req.body;
  const latestMessage = Array.isArray(messages) && messages.length > 0
    ? messages[messages.length - 1].content
    : message || '';

  if (!latestMessage || typeof latestMessage !== 'string') {
    return res.status(400).json({ error: 'Please provide a message or messages array.' });
  }

  try {
    const rules = await readFashionRules();
    const products = await readProductCatalog();
    const relevant = findRelevantRules(latestMessage, rules);
    const retrievedContext = buildKnowledgeContext(relevant);
    const prompt = `You are NOVA, a high-end personal fashion stylist.\nUse the retrieved fashion intelligence to answer the user's question clearly and confidently.\nRespond with outfit guidance, color pairing recommendations, and styling rules when relevant.\nDo not invent product details beyond the style knowledge.\n\nFashion Rules:\n${retrievedContext}\n\nUser Question:\n${latestMessage}`;

    const reply = await askModel(prompt);
    const pairingProducts = findProductSuggestions(latestMessage, products);

    res.json({ reply, pairingProducts });
  } catch (error: any) {
    console.error('Chat route failed:', error);
    res.status(500).json({ error: error.message || 'Chat failure' });
  }
});

router.get('/db-status', async (_req: any, res: any) => {
  try {
    const rules = await readFashionRules();
    const products = await readProductCatalog();
    res.json({
      status: 'ok',
      fashionRules: rules.length,
      products: products.length,
      usedGemini: true,
      model: process.env.GEMINI_MODEL || 'gemini-1.5-pro',
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID || 'nova-26b39',
    });
  } catch (error: any) {
    console.error('DB status failed:', error);
    res.status(500).json({ status: 'error', error: error.message || 'DB status failed' });
  }
});

export default router;
