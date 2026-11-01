import urllib.request
import json
import io
import os
import sys
from PIL import Image

def test_fastapi_health():
    print("Testing FastAPI /health...")
    try:
        req = urllib.request.Request("http://127.0.0.1:8000/health")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            print("  Response:", data)
            if data.get("status") == "healthy":
                print("  [PASS] FastAPI health check succeeded.")
                return True
    except Exception as e:
        print("  [FAIL] FastAPI health check failed:", e)
        return False

def test_fastapi_upload():
    print("Testing FastAPI /upload...")
    try:
        img = Image.new("RGBA", (120, 120), color=(100, 150, 200, 255))
        img_bytes = io.BytesIO()
        img.save(img_bytes, format="PNG")
        raw_bytes = img_bytes.getvalue()

        boundary = "Boundary123456"
        parts = [
            f"--{boundary}\r\n".encode("utf-8"),
            b'Content-Disposition: form-data; name="file"; filename="test_garment.png"\r\n',
            b"Content-Type: image/png\r\n\r\n",
            raw_bytes,
            b"\r\n",
            f"--{boundary}\r\n".encode("utf-8"),
            b'Content-Disposition: form-data; name="category"\r\n\r\n',
            b"Top\r\n",
            f"--{boundary}--\r\n".encode("utf-8"),
        ]
        body = b"".join(parts)

        req = urllib.request.Request(
            "http://127.0.0.1:8000/upload",
            data=body,
            headers={
                "Content-Type": f"multipart/form-data; boundary={boundary}",
                "User-Agent": "NOVA-Test/1.0"
            }
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
            print("  Upload response success:", data.get("success"))
            print("  Image URL returned:", data.get("image_url"))
            print("  Processed image length:", len(data.get("processed_image", "")))
            if data.get("success") and data.get("processed_image"):
                print("  [PASS] Garment upload & background removal succeeded.")
                return True
    except Exception as e:
        print("  [FAIL] Garment upload test failed:", e)
        return False

def test_render_backend():
    print("Testing Production Render Backend (/api/wardrobe/analyze-garment)...")
    try:
        # Send minimal payload to verify endpoint exists and responds with 400 (invalid data) instead of 404 or 405
        payload = json.dumps({"image": ""}).encode("utf-8")
        req = urllib.request.Request(
            "https://nova-1-1.onrender.com/api/wardrobe/analyze-garment",
            data=payload,
            headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode())
                print("  Status 200 response:", data)
                return True
        except urllib.error.HTTPError as err:
            body = err.read().decode()
            print(f"  HTTP {err.code}: {body}")
            # HTTP 400 with valid JSON response proves the endpoint exists and handles requests
            if err.code == 400 and "error" in body:
                print("  [PASS] Endpoint is active and returned valid structured JSON error.")
                return True
            else:
                print("  [FAIL] Unexpected HTTP response:", err.code)
                return False
    except Exception as e:
        print("  [FAIL] Render backend test failed:", e)
        return False

if __name__ == "__main__":
    t1 = test_fastapi_health()
    t2 = test_fastapi_upload()
    t3 = test_render_backend()
    if t1 and t2 and t3:
        print("\n=== ALL CONNECTIVITY TESTS PASSED ===")
        sys.exit(0)
    else:
        print("\n=== SOME TESTS FAILED ===")
        sys.exit(1)

