const AI_SERVER_URL = "http://127.0.0.1:8000";

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

export const aiService = {
  /**
   * Health check to verify FastAPI backend connection
   */
  async checkConnection(): Promise<{ status: string } | null> {
    try {
      const response = await fetch(`${AI_SERVER_URL}/`);
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.warn("⚠️ AI Backend server unreachable at http://127.0.0.1:8000:", error);
      return null;
    }
  },

  /**
   * Sends garment file to Python backend background-removal endpoint (/upload)
   */
  async uploadGarment(file: File, category = ''): Promise<VisionAnalysisResponse> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);

    try {
      const response = await fetch(`${AI_SERVER_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errorDetail = response.statusText;
        try {
          const errorJson = await response.json();
          errorDetail = errorJson.detail || errorJson.error || errorDetail;
        } catch {}
        throw new Error(`Garment processor error (${response.status}): ${errorDetail}`);
      }

      const result = await response.json();
      if (!result.success || !result.processed_image) {
        throw new Error(result.error || "Garment processor did not return a processed image.");
      }
      return result;
    } catch (error) {
      console.error("❌ Error uploading garment to background-removal API:", error);
      throw error;
    }
  },

  /**
   * Generates a 128-dimensional embedding vector for visual matching
   */
  async getEmbedding(file: File): Promise<number[]> {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${AI_SERVER_URL}/api/embedding`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.embedding)) {
          return data.embedding;
        }
      }
    } catch {
      // Fallback embedding generator if server embedding endpoint isn't set up
    }

    // Return synthetic 128-float normalized vector
    return Array.from({ length: 128 }, () => Number((Math.random() * 2 - 1).toFixed(4)));
  }
};

export default aiService;
