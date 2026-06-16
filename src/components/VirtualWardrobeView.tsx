import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ScreenId, WardrobeDetectedAttributes, WardrobeGender, WardrobeItem, WardrobeProfile, WardrobeScanMethod, WardrobeSize } from '../types';

interface VirtualWardrobeViewProps {
  onNavigate: (screen: ScreenId) => void;
  userEmail: string;
  isDarkMode?: boolean;
}

const sizes: WardrobeSize[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const maleCategories = ['T-Shirt', 'Shirt', 'Polo', 'Hoodie', 'Sweatshirt', 'Jacket', 'Jeans', 'Trousers', 'Shorts', 'Ethnic Wear', 'Blazer'];
const femaleCategories = ['Kurti', 'Co-ord Set', 'Saree', 'Crop Top', 'T-Shirt', 'Shirt', 'Leggings', 'Jeans', 'Palazzo', 'Dress', 'Jacket', 'Hoodie'];
const categoryIcons: Record<string, string> = {
  'T-Shirt': 'apparel',
  Shirt: 'styler',
  Polo: 'apparel',
  Hoodie: 'checkroom',
  Sweatshirt: 'checkroom',
  Jacket: 'dry_cleaning',
  Jeans: 'laundry',
  Trousers: 'laundry',
  Shorts: 'apparel',
  'Ethnic Wear': 'style',
  Blazer: 'business_center',
  Kurti: 'apparel',
  'Co-ord Set': 'select_all',
  Saree: 'gesture',
  'Crop Top': 'apparel',
  Leggings: 'laundry',
  Palazzo: 'laundry',
  Dress: 'styler'
};

const sampleScan =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 420"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#4f46e5"/><stop offset="1" stop-color="#ec4899"/></linearGradient><pattern id="p" width="42" height="42" patternUnits="userSpaceOnUse"><circle cx="12" cy="14" r="7" fill="#fff" opacity=".78"/><path d="M25 27c17-11 23 9 6 12-11 2-19-2-6-12Z" fill="#a7f3d0" opacity=".82"/></pattern></defs><rect width="320" height="420" rx="34" fill="#eef2ff"/><path d="M48 72h224v276H48z" fill="url(#g)" opacity=".78"/><path d="M48 72h224v276H48z" fill="url(#p)"/><path d="M70 72h180M70 348h180" stroke="#fff" stroke-width="12" opacity=".45"/></svg>`
  );

const makeId = () => `wardrobe-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const storageKey = (userId: string) => `nova_wardrobe_${userId}`;
const profileKey = (userId: string) => `nova_wardrobe_profile_${userId}`;
const userDocId = (email: string) => (email || 'demo-user').toLowerCase().replace(/[^a-z0-9_-]/g, '_');

const colorHex: Record<string, string> = {
  Blue: '#4f46e5',
  Ivory: '#f8fafc',
  Rose: '#ec4899',
  Mint: '#5eead4',
  Charcoal: '#1e293b',
  Sand: '#d6b98c',
  Maroon: '#8a1238',
  Lilac: '#a78bfa'
};

const analyzeScan = (category: string, gender: WardrobeGender, method: WardrobeScanMethod): WardrobeDetectedAttributes => {
  const isBottom = ['Jeans', 'Trousers', 'Shorts', 'Leggings', 'Palazzo'].includes(category);
  const isOuter = ['Hoodie', 'Sweatshirt', 'Jacket', 'Blazer'].includes(category);
  const isTraditional = ['Kurti', 'Saree', 'Ethnic Wear'].includes(category);
  const primaryColor = isBottom ? 'Charcoal' : isTraditional ? 'Blue' : isOuter ? 'Lilac' : gender === 'Female' ? 'Rose' : 'Blue';
  const secondaryColor = isTraditional ? 'Mint' : method === 'Upload Photo' ? 'Ivory' : 'Sand';
  return {
    primaryColor,
    secondaryColor,
    pattern: isBottom ? 'Solid twill' : isTraditional ? 'Floral embroidery' : method === 'Upload Photo' ? 'Micro print' : 'Abstract floral',
    fabric: isBottom ? 'Denim blend' : isOuter ? 'Fleece knit' : isTraditional ? 'Cotton silk' : 'Cotton',
    style: isTraditional ? 'Contemporary ethnic' : isOuter ? 'Street casual' : 'Smart casual',
    sleeveType: isBottom || category === 'Saree' ? 'Not applicable' : category === 'T-Shirt' || category === 'Polo' ? 'Short Sleeve' : '3/4 Sleeve',
    neckType: isBottom ? 'Not applicable' : category === 'Shirt' || category === 'Blazer' ? 'Collared' : category === 'Hoodie' ? 'Hooded' : 'Round'
  };
};

const generateGarmentImage = (category: string, attributes: WardrobeDetectedAttributes) => {
  const primary = colorHex[attributes.primaryColor] || '#4f46e5';
  const secondary = colorHex[attributes.secondaryColor] || '#f8fafc';
  const isBottom = ['Jeans', 'Trousers', 'Shorts', 'Leggings', 'Palazzo'].includes(category);
  const isDress = ['Kurti', 'Dress', 'Saree', 'Ethnic Wear'].includes(category);
  const bodyPath = isBottom
    ? '<path d="M120 72h80l21 264h-56l-5-166-6 166H98L120 72Z"/>'
    : isDress
      ? '<path d="M145 64h70l52 298H91L145 64Z"/>'
      : '<path d="M128 72h104l44 50-38 50-14-22v186H136V150l-14 22-38-50 44-50Z"/>';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 420"><defs><linearGradient id="cloth" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${primary}"/><stop offset="1" stop-color="${secondary}"/></linearGradient><pattern id="print" width="44" height="44" patternUnits="userSpaceOnUse"><circle cx="13" cy="15" r="5" fill="#fff" opacity=".62"/><path d="M25 25c13-8 20 6 8 11-9 4-19 0-8-11Z" fill="#fff" opacity=".34"/></pattern><filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="18" stdDeviation="16" flood-color="#312e81" flood-opacity=".22"/></filter></defs><rect width="360" height="420" fill="transparent"/><g filter="url(#shadow)" transform="translate(0 6)"><g fill="url(#cloth)">${bodyPath}</g><g fill="url(#print)">${bodyPath}</g><path d="M158 70c7 18 35 18 44 0" fill="none" stroke="#fff" stroke-width="8" opacity=".65"/><path d="M125 96c34 13 76 13 111 0" fill="none" stroke="#fff" stroke-width="2" opacity=".25"/></g></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const VirtualWardrobeView: React.FC<VirtualWardrobeViewProps> = ({ onNavigate, userEmail, isDarkMode = false }) => {
  const userId = userDocId(userEmail);
  const [profile, setProfile] = useState<WardrobeProfile>(() => {
    try {
      return JSON.parse(localStorage.getItem(profileKey(userDocId(userEmail))) || '{}');
    } catch {
      return {};
    }
  });
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [scanMethod, setScanMethod] = useState<WardrobeScanMethod>('Live Scan');
  const [scanImage, setScanImage] = useState(sampleScan);
  const [generatedItem, setGeneratedItem] = useState<WardrobeItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<WardrobeItem | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [colorFilter, setColorFilter] = useState('All');
  const [patternFilter, setPatternFilter] = useState('All');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    const loadWardrobe = async () => {
      setIsLoading(true);
      try {
        const saved = localStorage.getItem(storageKey(userId));
        if (saved) setItems(JSON.parse(saved));
        const snap = await getDocs(query(collection(db, 'users', userId, 'wardrobe'), orderBy('dateAdded', 'desc')));
        const remote = snap.docs.map((entry) => ({ ...(entry.data() as WardrobeItem), id: entry.id }));
        if (remote.length) {
          setItems(remote);
          localStorage.setItem(storageKey(userId), JSON.stringify(remote));
        }
      } catch {
        const saved = localStorage.getItem(storageKey(userId));
        setItems(saved ? JSON.parse(saved) : []);
      } finally {
        setIsLoading(false);
      }
    };
    loadWardrobe();
  }, [userId]);

  useEffect(() => {
    localStorage.setItem(profileKey(userId), JSON.stringify(profile));
  }, [profile, userId]);

  const categories = profile.gender === 'Male' ? maleCategories : femaleCategories;
  const categoryOptions = ['All', ...new Set(items.map((item) => item.category))];
  const colorOptions = ['All', ...new Set(items.flatMap((item) => item.colors))];
  const patternOptions = ['All', ...new Set(items.map((item) => item.pattern))];

  const filteredItems = useMemo(() => {
    return items
      .filter((item) => item.category.toLowerCase().includes(search.toLowerCase()) || item.tags.join(' ').toLowerCase().includes(search.toLowerCase()))
      .filter((item) => categoryFilter === 'All' || item.category === categoryFilter)
      .filter((item) => colorFilter === 'All' || item.colors.includes(colorFilter))
      .filter((item) => patternFilter === 'All' || item.pattern === patternFilter)
      .sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());
  }, [categoryFilter, colorFilter, items, patternFilter, search]);

  const persistItems = (next: WardrobeItem[]) => {
    setItems(next);
    localStorage.setItem(storageKey(userId), JSON.stringify(next));
  };

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setScanImage(String(reader.result || sampleScan));
    reader.readAsDataURL(file);
  };

  const handleAnalyze = () => {
    if (!selectedCategory || !profile.gender || !profile.size) return;
    setIsProcessing(true);
    window.setTimeout(() => {
      const attributes = analyzeScan(selectedCategory, profile.gender!, scanMethod);
      const item: WardrobeItem = {
        id: makeId(),
        category: selectedCategory,
        gender: profile.gender!,
        size: profile.size!,
        generatedImage: generateGarmentImage(selectedCategory, attributes),
        originalScan: scanImage,
        colors: [attributes.primaryColor, attributes.secondaryColor],
        pattern: attributes.pattern,
        fabric: attributes.fabric,
        tags: [selectedCategory, attributes.style, attributes.pattern, attributes.fabric, attributes.sleeveType, attributes.neckType],
        dateAdded: new Date().toISOString(),
        attributes
      };
      setGeneratedItem(item);
      setIsProcessing(false);
    }, 1100);
  };

  const saveItem = async () => {
    if (!generatedItem) return;
    const next = [generatedItem, ...items.filter((item) => item.id !== generatedItem.id)];
    persistItems(next);
    setSaveStatus('Saved to wardrobe');
    try {
      const ref = await addDoc(collection(db, 'users', userId, 'wardrobe'), generatedItem);
      const savedWithRemoteId = { ...generatedItem, id: ref.id };
      const remoteNext = [savedWithRemoteId, ...items.filter((item) => item.id !== generatedItem.id)];
      await setDoc(doc(db, 'users', userId, 'wardrobe', ref.id), savedWithRemoteId);
      persistItems(remoteNext);
    } catch {
      setSaveStatus('Saved locally. Firebase sync will retry when available.');
    }
    setSelectedCategory(null);
    setGeneratedItem(null);
    window.setTimeout(() => setSaveStatus(null), 2400);
  };

  const deleteItem = async (item: WardrobeItem) => {
    persistItems(items.filter((entry) => entry.id !== item.id));
    setSelectedItem(null);
    try {
      await deleteDoc(doc(db, 'users', userId, 'wardrobe', item.id));
    } catch {
      setSaveStatus('Removed locally');
      window.setTimeout(() => setSaveStatus(null), 1800);
    }
  };

  const updateItem = (item: WardrobeItem) => {
    const next = items.map((entry) => (entry.id === item.id ? item : entry));
    persistItems(next);
    setSelectedItem(item);
    setDoc(doc(db, 'users', userId, 'wardrobe', item.id), item).catch(() => undefined);
  };

  const panel = isDarkMode ? 'bg-slate-900/70 border-white/10 text-white' : 'bg-white/65 border-white/80 text-slate-900';
  const muted = isDarkMode ? 'text-slate-300' : 'text-slate-500';

  return (
    <div className={`space-y-5 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      {saveStatus && (
        <div className="fixed top-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-950/90 px-4 py-2 text-xs font-bold text-white shadow-xl backdrop-blur">
          {saveStatus}
        </div>
      )}

      <section className={`rounded-3xl border p-5 shadow-lg backdrop-blur-2xl ${panel}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500">NOVA Wardrobe</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight">Virtual Wardrobe</h1>
            <p className={`mt-1 text-xs leading-relaxed ${muted}`}>Scan a neckline, sleeve, print, embroidery, or texture. NOVA builds the full garment preview.</p>
          </div>
          <button onClick={() => onNavigate('scan-outfit')} className="h-10 w-10 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/25">
            <span className="material-symbols-outlined text-xl leading-10">center_focus_strong</span>
          </button>
        </div>
      </section>

      {!profile.gender && (
        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className={`rounded-3xl border p-5 shadow-lg backdrop-blur-2xl ${panel}`}>
          <h2 className="text-xl font-black">Who are we styling today?</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {(['Male', 'Female'] as WardrobeGender[]).map((gender) => (
              <button key={gender} onClick={() => setProfile({ gender })} className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-500 to-purple-600 p-5 text-left text-white shadow-lg shadow-indigo-500/20">
                <span className="material-symbols-outlined text-3xl">{gender === 'Male' ? 'man_2' : 'woman_2'}</span>
                <span className="mt-4 block text-lg font-black">{gender}</span>
              </button>
            ))}
          </div>
        </motion.section>
      )}

      {profile.gender && !profile.size && (
        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className={`rounded-3xl border p-5 shadow-lg backdrop-blur-2xl ${panel}`}>
          <h2 className="text-xl font-black">What's your size?</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {sizes.map((size) => (
              <button key={size} onClick={() => setProfile((prev) => ({ ...prev, size }))} className="min-w-12 rounded-full border border-indigo-200 bg-white/70 px-4 py-2 text-sm font-black text-indigo-700 shadow-sm">
                {size}
              </button>
            ))}
          </div>
        </motion.section>
      )}

      {profile.gender && profile.size && (
        <>
          <section>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h2 className="text-base font-black">Wardrobe Categories</h2>
                <p className={`text-[11px] ${muted}`}>{profile.gender} styling profile - Size {profile.size}</p>
              </div>
              <button onClick={() => setProfile({})} className="text-xs font-bold text-indigo-600">Reset</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {categories.map((category, index) => (
                <motion.button
                  key={category}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.025 }}
                  onClick={() => {
                    setSelectedCategory(category);
                    setGeneratedItem(null);
                    setScanImage(sampleScan);
                  }}
                  className={`min-h-28 rounded-2xl border p-4 text-left shadow-sm backdrop-blur-xl transition-transform active:scale-[0.98] ${panel}`}
                >
                  <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                    <span className="material-symbols-outlined">{categoryIcons[category] || 'checkroom'}</span>
                  </div>
                  <div className="text-sm font-black">{category}</div>
                  <div className={`mt-1 text-[10px] ${muted}`}>Add item</div>
                </motion.button>
              ))}
            </div>
          </section>

          <section className={`rounded-3xl border p-4 shadow-lg backdrop-blur-2xl ${panel}`}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-black">Wardrobe</h2>
              <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[10px] font-black text-indigo-700">{items.length} items</span>
            </div>
            <div className="mb-3 rounded-2xl border border-white/60 bg-white/55 px-3 py-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-indigo-500">search</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search category, fabric, tags" className="w-full bg-transparent text-xs font-semibold outline-none placeholder:text-slate-400" />
            </div>
            <div className="mb-4 flex gap-2 overflow-x-auto hide-scrollbar">
              {[
                { value: categoryFilter, set: setCategoryFilter, options: categoryOptions, icon: 'category' },
                { value: colorFilter, set: setColorFilter, options: colorOptions, icon: 'palette' },
                { value: patternFilter, set: setPatternFilter, options: patternOptions, icon: 'texture' }
              ].map((filter) => (
                <label key={filter.icon} className="flex shrink-0 items-center gap-1.5 rounded-full border border-indigo-100 bg-white/70 px-3 py-2 text-xs font-bold text-slate-600">
                  <span className="material-symbols-outlined text-sm text-indigo-500">{filter.icon}</span>
                  <select value={filter.value} onChange={(e) => filter.set(e.target.value)} className="bg-transparent outline-none">
                    {filter.options.map((option) => <option key={option}>{option}</option>)}
                  </select>
                </label>
              ))}
            </div>

            {isLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((item) => <div key={item} className="h-48 animate-pulse rounded-2xl bg-slate-200/70" />)}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/50 p-6 text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white text-indigo-600 shadow-sm">
                  <span className="material-symbols-outlined text-3xl">checkroom</span>
                </div>
                <p className="text-sm font-black">Your wardrobe is ready for its first scan.</p>
                <p className={`mt-1 text-xs ${muted}`}>Choose a category above and add a fabric detail, print, or front portion.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredItems.map((item) => (
                  <button key={item.id} onClick={() => setSelectedItem(item)} className="overflow-hidden rounded-2xl border border-white/70 bg-white/70 text-left shadow-sm">
                    <div className="flex aspect-[4/5] items-center justify-center bg-[linear-gradient(135deg,#eef2ff,#fdf2f8)]">
                      <img src={item.generatedImage} alt={item.category} className="h-full w-full object-contain p-3" />
                    </div>
                    <div className="p-3">
                      <div className="text-sm font-black">{item.category}</div>
                      <div className="mt-1 text-[11px] font-semibold text-slate-500">{item.colors[0]} - {new Date(item.dateAdded).toLocaleDateString()}</div>
                      <div className="mt-3 flex gap-1.5">
                        {['visibility', 'edit', 'delete'].map((icon) => <span key={icon} className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-indigo-600"><span className="material-symbols-outlined text-sm">{icon}</span></span>)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <AnimatePresence>
        {selectedCategory && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3">
            <motion.section initial={{ y: 420 }} animate={{ y: 0 }} exit={{ y: 420 }} className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-black">Add {selectedCategory}</h2>
                <button onClick={() => setSelectedCategory(null)} className="h-9 w-9 rounded-full bg-slate-100"><span className="material-symbols-outlined text-base">close</span></button>
              </div>
              <div className="mb-4 grid grid-cols-2 gap-2 rounded-full bg-slate-200/70 p-1">
                {(['Live Scan', 'Upload Photo'] as WardrobeScanMethod[]).map((method) => (
                  <button key={method} onClick={() => setScanMethod(method)} className={`rounded-full py-2 text-xs font-black ${scanMethod === method ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500'}`}>
                    <span className="material-symbols-outlined mr-1 align-middle text-sm">{method === 'Live Scan' ? 'camera_alt' : 'photo_library'}</span>{method}
                  </button>
                ))}
              </div>
              {scanMethod === 'Upload Photo' && (
                <label className="mb-4 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/60 p-4 text-xs font-black text-indigo-700">
                  <span className="material-symbols-outlined">upload</span>
                  Upload neck, sleeve, print, embroidery, texture, or front portion
                  <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
                </label>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-100 p-2">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">Before Scan Image</p>
                  <img src={scanImage} alt="Original scan" className="aspect-[3/4] w-full rounded-xl object-cover" />
                </div>
                <div className="rounded-2xl bg-slate-100 p-2">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">Generated Garment</p>
                  <div className="flex aspect-[3/4] items-center justify-center rounded-xl bg-[linear-gradient(135deg,#eef2ff,#fff)]">
                    {isProcessing ? <div className="h-9 w-9 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" /> : generatedItem ? <img src={generatedItem.generatedImage} alt="Generated garment" className="h-full w-full object-contain p-2" /> : <span className="material-symbols-outlined text-4xl text-indigo-200">auto_awesome</span>}
                  </div>
                </div>
              </div>
              {generatedItem && (
                <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3">
                  <pre className="whitespace-pre-wrap text-[11px] font-semibold leading-relaxed text-slate-700">{JSON.stringify({ category: generatedItem.category, color: generatedItem.colors[0], pattern: generatedItem.pattern, fabric: generatedItem.fabric, neck: generatedItem.attributes.neckType, sleeve: generatedItem.attributes.sleeveType }, null, 2)}</pre>
                </div>
              )}
              <div className="mt-4 flex gap-3">
                <button onClick={handleAnalyze} disabled={isProcessing} className="flex-1 rounded-full bg-slate-950 py-3 text-xs font-black text-white shadow-lg disabled:opacity-60">AI Smart Scan</button>
                <button onClick={saveItem} disabled={!generatedItem} className="flex-1 rounded-full bg-indigo-600 py-3 text-xs font-black text-white shadow-lg shadow-indigo-600/25 disabled:opacity-40">Save Item</button>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedItem && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3">
            <motion.section initial={{ y: 420 }} animate={{ y: 0 }} exit={{ y: 420 }} className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-black">{selectedItem.category}</h2>
                <button onClick={() => setSelectedItem(null)} className="h-9 w-9 rounded-full bg-slate-100"><span className="material-symbols-outlined text-base">close</span></button>
              </div>
              <div className="rounded-3xl bg-[linear-gradient(135deg,#eef2ff,#fdf2f8)] p-4">
                <img src={selectedItem.generatedImage} alt={selectedItem.category} className="mx-auto h-72 w-full object-contain" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {[
                  ['Category', selectedItem.category],
                  ['Color', selectedItem.colors.join(', ')],
                  ['Pattern', selectedItem.pattern],
                  ['Fabric', selectedItem.fabric],
                  ['Neck', selectedItem.attributes.neckType],
                  ['Sleeve', selectedItem.attributes.sleeveType],
                  ['Size', selectedItem.size],
                  ['Date Added', new Date(selectedItem.dateAdded).toLocaleDateString()]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-slate-50 p-3">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</div>
                    <div className="mt-1 text-xs font-black text-slate-800">{value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={() => onNavigate('ar-tryon')} className="rounded-full bg-indigo-600 py-3 text-xs font-black text-white">Wear Virtually</button>
                <button onClick={() => setSaveStatus('Outfit Builder seed created')} className="rounded-full bg-slate-950 py-3 text-xs font-black text-white">Create Outfit</button>
                <button onClick={() => updateItem({ ...selectedItem, tags: [...new Set([...selectedItem.tags, 'Edited'])] })} className="rounded-full border border-slate-200 py-3 text-xs font-black text-slate-700">Edit</button>
                <button onClick={() => deleteItem(selectedItem)} className="rounded-full border border-rose-100 bg-rose-50 py-3 text-xs font-black text-rose-600">Delete</button>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
