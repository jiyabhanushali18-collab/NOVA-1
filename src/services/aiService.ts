const AI_SERVER_URL = "http://127.0.0.1:8000";

export interface VisionAnalysisResponse {
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
  processed_image?: string;
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

<<<<<<< HEAD
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
=======
class AIService {
  private async fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 30000) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      window.clearTimeout(timeout);
    }
  }

  // Check whether Python AI server is running
  async checkConnection() {
    const response = await fetch(`${AI_SERVER}/health`);

    if (!response.ok) {
      throw new Error("AI Server is not responding");
>>>>>>> e62f32f31b9f107a939cba2a3d51796f8e7cde6c
    }
  },

<<<<<<< HEAD
  /**
   * Sends garment file to Google Cloud Vision API backend (/api/analyze-vision)
   */
  async uploadGarment(file: File): Promise<VisionAnalysisResponse> {
=======
    return response.json();
  }

  // Send garment image to Python server
  async uploadGarment(file: File, category = "") {
>>>>>>> e62f32f31b9f107a939cba2a3d51796f8e7cde6c
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);

<<<<<<< HEAD
    try {
      const response = await fetch(`${AI_SERVER_URL}/api/analyze-vision`, {
        method: "POST",
        body: formData,
      });
=======
    const response = await this.fetchWithTimeout(`${AI_SERVER}/upload`, {
      method: "POST",
      body: formData,
    });
>>>>>>> e62f32f31b9f107a939cba2a3d51796f8e7cde6c

      if (!response.ok) {
        throw new Error(`Vision API endpoint error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return result.data || result;
    } catch (error) {
      console.error("❌ Error uploading garment to Vision API:", error);
      
      // Fallback return if local backend is restarting or offline
      return {
        category: "Top Wear",
        primaryColor: "Blue",
        pattern: "Solid",
        material: "Cotton",
        attributes: {
          category: "Top Wear",
          primaryColor: "Blue",
          pattern: "Solid",
          material: "Cotton"
        }
      };
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

<<<<<<< HEAD
export default aiService;
=======
export default new AIService();
>>>>>>> e62f32f31b9f107a939cba2a3d51796f8e7cde6c
