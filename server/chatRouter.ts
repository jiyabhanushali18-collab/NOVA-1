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
  const scored = products
    .map((product) => {
      const haystack = [
        product.name,
        product.category,
        ...(product.colors ?? []),
        ...(product.tags ?? []),
        ...(product.details ?? []),
      ].join(' ');
      return { product, score: scoreText(haystack, tokens) };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.product);

  if (scored.length > 0) {
    return scored.slice(0, 4).map((product) => ({
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
    }));
  }

  return products.slice(0, 4).map((product) => ({
    name: product.name,
    price: product.price,
    imageUrl: product.imageUrl,
  }));
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
