import express, { Request, Response } from 'express';

const router = express.Router();

export interface AddressSuggestion {
  id: string;
  title: string;
  subtitle: string;
  formattedAddress: string;
  flatNo?: string;
  street?: string;
  area?: string;
  city: string;
  state: string;
  country: string;
  pinCode?: string;
}

// Curated high-relevance Mumbai & Indian localities for offline/quick resilience
const CURATED_INDIAN_LOCALITIES: AddressSuggestion[] = [
  {
    id: 'mum_goregaon_w',
    title: 'Goregaon West',
    subtitle: 'Mumbai, Maharashtra • 400062',
    formattedAddress: 'Goregaon West, Mumbai, Maharashtra',
    area: 'Goregaon West',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    pinCode: '400062'
  },
  {
    id: 'mum_goregaon_e',
    title: 'Goregaon East',
    subtitle: 'Mumbai, Maharashtra • 400063',
    formattedAddress: 'Goregaon East, Mumbai, Maharashtra',
    area: 'Goregaon East',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    pinCode: '400063'
  },
  {
    id: 'mum_andheri_w',
    title: 'Andheri West',
    subtitle: 'Mumbai, Maharashtra • 400058',
    formattedAddress: 'Andheri West, Mumbai, Maharashtra',
    area: 'Andheri West',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    pinCode: '400058'
  },
  {
    id: 'mum_andheri_e',
    title: 'Andheri East',
    subtitle: 'Mumbai, Maharashtra • 400069',
    formattedAddress: 'Andheri East, Mumbai, Maharashtra',
    area: 'Andheri East',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    pinCode: '400069'
  },
  {
    id: 'mum_bandra_w',
    title: 'Bandra West',
    subtitle: 'Mumbai, Maharashtra • 400050',
    formattedAddress: 'Bandra West, Mumbai, Maharashtra',
    area: 'Bandra West',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    pinCode: '400050'
  },
  {
    id: 'mum_borivali_w',
    title: 'Borivali West',
    subtitle: 'Mumbai, Maharashtra • 400092',
    formattedAddress: 'Borivali West, Mumbai, Maharashtra',
    area: 'Borivali West',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    pinCode: '400092'
  },
  {
    id: 'mum_powai',
    title: 'Powai (Hiranandani Gardens)',
    subtitle: 'Mumbai, Maharashtra • 400076',
    formattedAddress: 'Powai, Mumbai, Maharashtra',
    area: 'Powai',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    pinCode: '400076'
  },
  {
    id: 'mum_bhandup_w',
    title: 'Bhandup West',
    subtitle: 'Mumbai, Maharashtra • 400078',
    formattedAddress: 'Bhandup West, Mumbai, Maharashtra',
    area: 'Bhandup West',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    pinCode: '400078'
  },
  {
    id: 'mum_juhu',
    title: 'Juhu',
    subtitle: 'Mumbai, Maharashtra • 400049',
    formattedAddress: 'Juhu, Mumbai, Maharashtra',
    area: 'Juhu',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    pinCode: '400049'
  },
  {
    id: 'mum_malad_w',
    title: 'Malad West',
    subtitle: 'Mumbai, Maharashtra • 400064',
    formattedAddress: 'Malad West, Mumbai, Maharashtra',
    area: 'Malad West',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    pinCode: '400064'
  },
  {
    id: 'mum_dadar_w',
    title: 'Dadar West',
    subtitle: 'Mumbai, Maharashtra • 400028',
    formattedAddress: 'Dadar West, Mumbai, Maharashtra',
    area: 'Dadar West',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    pinCode: '400028'
  },
  {
    id: 'blr_indiranagar',
    title: 'Indiranagar',
    subtitle: 'Bengaluru, Karnataka • 560038',
    formattedAddress: 'Indiranagar, Bengaluru, Karnataka',
    area: 'Indiranagar',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    pinCode: '560038'
  },
  {
    id: 'del_connaught',
    title: 'Connaught Place',
    subtitle: 'New Delhi, Delhi • 110001',
    formattedAddress: 'Connaught Place, New Delhi, Delhi',
    area: 'Connaught Place',
    city: 'New Delhi',
    state: 'Delhi',
    country: 'India',
    pinCode: '110001'
  }
];

/**
 * GET /api/address/autocomplete
 * Smart address recommendation supporting Mumbai, Maharashtra and all of India.
 */
router.get('/address/autocomplete', async (req: Request, res: Response) => {
  try {
    const rawQuery = String(req.query.q || '').trim();
    if (!rawQuery || rawQuery.length < 2) {
      return res.json({ success: true, suggestions: [] });
    }

    const cleanQuery = rawQuery.toLowerCase();
    const suggestions: AddressSuggestion[] = [];

    // 1. First, check curated localities for fast local match
    const curatedMatches = CURATED_INDIAN_LOCALITIES.filter((item) => {
      const q = cleanQuery;
      return (
        item.title.toLowerCase().includes(q) ||
        item.area?.toLowerCase().includes(q) ||
        item.city.toLowerCase().includes(q) ||
        (item.pinCode && item.pinCode.startsWith(q))
      );
    });

    suggestions.push(...curatedMatches);

    // 2. Query live OpenStreetMap / Photon geocoding API for exact street/locality coverage
    try {
      const searchQuery = `${rawQuery}, India`;
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(searchQuery)}&limit=8`;

      const response = await fetch(url, {
        headers: { 'User-Agent': 'NOVA-Customer-App/1.0' },
        signal: AbortSignal.timeout(3500)
      });

      if (response.ok) {
        const data = await response.json();
        const features = data?.features || [];

        for (const feat of features) {
          const props = feat?.properties;
          if (!props) continue;

          // Country filter: prioritize India
          const country = props.country || 'India';
          if (country.toLowerCase() !== 'india' && props.countrycode !== 'IN') {
            continue;
          }

          const name = props.name || '';
          const street = props.street || '';
          const locality = props.locality || props.district || '';
          const city = props.city || props.county || 'Mumbai';
          const state = props.state || 'Maharashtra';
          const pinCode = props.postcode && /^\d{6}$/.test(props.postcode) ? props.postcode : undefined;

          // Build a readable title
          const titleParts = [name, street].filter(Boolean);
          const title = titleParts.length > 0 ? Array.from(new Set(titleParts)).join(', ') : locality || city;
          if (!title) continue;

          // Build clean subtitle
          const subParts = [locality, city, state].filter(Boolean);
          const uniqueSub = Array.from(new Set(subParts)).join(', ');
          const subtitle = pinCode ? `${uniqueSub} • ${pinCode}` : uniqueSub;

          // Full formatted address
          const fullAddress = Array.from(new Set([title, locality, city, state])).filter(Boolean).join(', ');

          const suggestionId = `geo_${props.osm_id || Math.random().toString(36).slice(2, 8)}`;

          // Avoid duplicate titles
          const isDuplicate = suggestions.some(
            (s) => s.title.toLowerCase() === title.toLowerCase() && s.city.toLowerCase() === city.toLowerCase()
          );

          if (!isDuplicate) {
            suggestions.push({
              id: suggestionId,
              title,
              subtitle,
              formattedAddress: fullAddress,
              street: street || undefined,
              area: locality || name,
              city,
              state,
              country,
              pinCode
            });
          }
        }
      }
    } catch (apiErr) {
      // Gracefully fall back to curated matches if upstream times out
      console.warn('[Address Autocomplete] Upstream geocoding fallback:', apiErr);
    }

    return res.json({
      success: true,
      query: rawQuery,
      count: suggestions.length,
      suggestions: suggestions.slice(0, 6)
    });
  } catch (err: any) {
    console.error('[Address Autocomplete] Route error:', err);
    return res.status(500).json({ success: false, error: 'Could not fetch address suggestions' });
  }
});

/**
 * GET /api/address/verify-pincode/:pincode
 * Validates 6-digit Indian postal PIN code and returns city/state.
 */
router.get('/address/verify-pincode/:pincode', async (req: Request, res: Response) => {
  try {
    const rawPin = String(req.params.pincode || '').trim();
    if (!/^\d{6}$/.test(rawPin)) {
      return res.status(400).json({
        success: false,
        valid: false,
        error: 'PIN code must be exactly 6 digits.'
      });
    }

    // Check curated list first
    const curatedMatch = CURATED_INDIAN_LOCALITIES.find((c) => c.pinCode === rawPin);
    if (curatedMatch) {
      return res.json({
        success: true,
        valid: true,
        pinCode: rawPin,
        city: curatedMatch.city,
        state: curatedMatch.state,
        area: curatedMatch.area,
        country: 'India'
      });
    }

    // Query Photon / OpenStreetMap for postcode lookup
    try {
      const url = `https://photon.komoot.io/api/?q=${rawPin}&countrycode=in&limit=1`;
      const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (response.ok) {
        const data = await response.json();
        const feat = data?.features?.[0]?.properties;
        if (feat && (feat.city || feat.county || feat.state)) {
          return res.json({
            success: true,
            valid: true,
            pinCode: rawPin,
            city: feat.city || feat.county || 'Mumbai',
            state: feat.state || 'Maharashtra',
            country: 'India'
          });
        }
      }
    } catch {}

    // Fallback: Indian PIN codes with 400xxx are Mumbai, 110xxx Delhi, 560xxx Bengaluru, etc.
    let guessedCity = '';
    let guessedState = '';
    if (rawPin.startsWith('400')) {
      guessedCity = 'Mumbai';
      guessedState = 'Maharashtra';
    } else if (rawPin.startsWith('411')) {
      guessedCity = 'Pune';
      guessedState = 'Maharashtra';
    } else if (rawPin.startsWith('110')) {
      guessedCity = 'New Delhi';
      guessedState = 'Delhi';
    } else if (rawPin.startsWith('560')) {
      guessedCity = 'Bengaluru';
      guessedState = 'Karnataka';
    } else if (rawPin.startsWith('500')) {
      guessedCity = 'Hyderabad';
      guessedState = 'Telangana';
    }

    return res.json({
      success: true,
      valid: true,
      pinCode: rawPin,
      city: guessedCity,
      state: guessedState,
      country: 'India'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to verify PIN code' });
  }
});

export default router;
