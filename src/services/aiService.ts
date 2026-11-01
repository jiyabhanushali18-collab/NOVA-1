import { apiUrl } from './apiClient';

export interface VisionAnalysisResponse {
  success?: boolean;
  filename?: string;
  path?: string;
  processed_image?: string;
  image_url?: string;
  scan_note?: string;
  error?: string;
  detected_objects?: string[];
  labels?: string[];
  dominant_color_rgb?: { r: number; g: number; b: number };
  category?: string;
  subcategory?: string;
  primaryColor?: string;
  secondaryColor?: string;
  pattern?: string;
  sleeveType?: string;
  neckType?: string;
  fit?: string;
  material?: string;
  attributes?: {
    category?: string;
    primaryColor?: string;
    subcategory?: string;
    pattern?: string;
    sleeveType?: string;
    neckType?: string;
    fit?: string;
    material?: string;
  };
}

/**
 * Safely parses response JSON, avoiding 'Unexpected end of JSON input' on empty bodies.
 */
async function parseSafeJson<T = any>(response: Response): Promise<{ data: T | null; text: string }> {
  const text = await response.text().catch(() => '');
  if (!text || !text.trim()) {
    return { data: null, text: '' };
  }
  try {
    return { data: JSON.parse(text) as T, text };
  } catch {
    return { data: null, text };
  }
}

export const aiService = {
  /**
   * Health check to verify AI backend service connection via Node backend gateway.
   * Never exposes internal backend URLs or ports to the client.
   */
  async checkConnection(): Promise<{ status: string; service?: string } | null> {
    try {
      const response = await fetch(apiUrl('/api/wardrobe/ai-status'), {
        method: 'GET',
        headers: { Accept: 'application/json' }
      });

      if (!response.ok) return null;

      const { data } = await parseSafeJson<{ status?: string; service?: string }>(response);
      if (data && (data.status === 'healthy' || data.status === 'partial' || data.status?.includes('running'))) {
        return { status: data.status, service: data.service || 'NOVA Wardrobe AI Service' };
      }
    } catch {
      // Backend unreachable or offline
    }

    return null;
  },

  /**
   * Sends garment file to background-removal proxy endpoint on Node.js backend.
   * Node.js handles communication with the Python FastAPI backend securely.
   */
  async uploadGarment(file: File, category = ''): Promise<VisionAnalysisResponse> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);

    const targetUrl = apiUrl('/api/wardrobe/upload-garment');

    let response: Response;
    try {
      response = await fetch(targetUrl, {
        method: "POST",
        body: formData,
      });
    } catch (networkErr: any) {
      throw new Error(`Garment processing server unreachable: ${networkErr?.message || 'Network error'}`);
    }

    const { data, text } = await parseSafeJson<any>(response);

    if (!response.ok) {
      const errorMsg = data?.detail || data?.error || text || `Server returned HTTP ${response.status} (${response.statusText})`;
      throw new Error(`Garment processor error (${response.status}): ${errorMsg}`);
    }

    if (!data) {
      throw new Error(`Garment processor returned an invalid or empty response.`);
    }

    if (!data.success || !data.processed_image) {
      throw new Error(data.error || "Garment processor did not return a processed image.");
    }

    return data;
  },

  /**
   * Retrieves a high-dimensional visual embedding vector from the backend.
   * Requirement 7: Never silently returns fake synthetic embeddings.
   * Returns null if server embedding endpoint is offline or not configured.
   */
  async getEmbedding(file: File): Promise<number[] | null> {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(apiUrl('/api/wardrobe/embedding'), {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const { data } = await parseSafeJson<{ embedding?: number[] }>(response);
        if (data && Array.isArray(data.embedding)) {
          return data.embedding;
        }
      }
    } catch {
      // Endpoint offline or unreachable
    }

    // Do not fabricate synthetic embeddings; report lack of embedding honestly
    return null;
  }
};

export default aiService;
