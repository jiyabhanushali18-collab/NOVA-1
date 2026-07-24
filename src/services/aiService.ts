const AI_SERVER = "http://127.0.0.1:8000";

class AIService {

  // Check whether Python AI server is running
  async checkConnection() {
    const response = await fetch(`${AI_SERVER}/health`);

    if (!response.ok) {
      throw new Error("AI Server is not responding");
    }

    return response.json();
  }

  // Send garment image to Python server
  async uploadGarment(file: File) {
    const formData = new FormData();

    formData.append("file", file);

    const response = await fetch(`${AI_SERVER}/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Garment upload failed");
    }

    return response.json();
  }
}

export default new AIService();