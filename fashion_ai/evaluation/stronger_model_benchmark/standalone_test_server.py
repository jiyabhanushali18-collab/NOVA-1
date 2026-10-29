#!/usr/bin/env python3
"""
Standalone Isolated API Server for NOVA Structured 1.5B Candidate
Runs on port 3001 (or TEST_PORT) without modifying existing production routes,
Firebase, or frontend code.
"""

import json
import os
import sys
import time
from http.server import HTTPServer, BaseHTTPRequestHandler

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from isolated_curator_adapter import curate_structured_outfit, MODEL_NAME

HOST = os.environ.get("TEST_HOST", "127.0.0.1")
PORT = int(os.environ.get("TEST_PORT", "3001"))

class StructuredCuratorHandler(BaseHTTPRequestHandler):
    def _send_json_response(self, status_code: int, data: dict):
        body = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            self._send_json_response(200, {
                "status": "ok",
                "service": "NOVA-Isolated-Structured-1.5B",
                "model": MODEL_NAME,
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            })
        else:
            self._send_json_response(404, {
                "status": "error",
                "error": {
                    "code": "NOT_FOUND",
                    "message": f"Path '{self.path}' not found on isolated test server."
                }
            })

    def do_POST(self):
        if self.path != "/api/curate-structured":
            self._send_json_response(404, {
                "status": "error",
                "error": {
                    "code": "NOT_FOUND",
                    "message": f"Endpoint '{self.path}' does not exist. Use POST /api/curate-structured."
                }
            })
            return

        # 1. Read request body
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length == 0:
                self._send_json_response(400, {
                    "status": "error",
                    "error": {
                        "code": "EMPTY_BODY",
                        "message": "Request body cannot be empty."
                    }
                })
                return

            raw_body = self.rfile.read(content_length).decode("utf-8")
            body_json = json.loads(raw_body)
        except json.JSONDecodeError:
            self._send_json_response(400, {
                "status": "error",
                "error": {
                    "code": "MALFORMED_JSON",
                    "message": "The request body must be valid JSON."
                }
            })
            return
        except Exception as e:
            self._send_json_response(400, {
                "status": "error",
                "error": {
                    "code": "BAD_REQUEST",
                    "message": "Failed to parse request."
                }
            })
            return

        # 2. Extract and validate user prompt
        user_prompt = body_json.get("message") or body_json.get("prompt")
        if not user_prompt or not isinstance(user_prompt, str) or not user_prompt.strip():
            self._send_json_response(400, {
                "status": "error",
                "error": {
                    "code": "INVALID_INPUT",
                    "message": "A non-empty string is required in field 'message' or 'prompt'."
                }
            })
            return

        # 3. Call isolated curator adapter
        start_ts = time.time()
        print(f"[{time.strftime('%X')}] Incoming curation request: '{user_prompt[:60]}...'")
        
        try:
            res = curate_structured_outfit(user_prompt)
            duration_ms = res.get("metadata", {}).get("duration_ms", int((time.time() - start_ts) * 1000))
            status = res.get("status")
            retries = res.get("metadata", {}).get("retry_count", 0)

            print(f"[{time.strftime('%X')}] Curation finished: status={status} | retries={retries} | duration={duration_ms}ms")

            # Remove internal keys before returning to client
            clean_res = {
                "status": res["status"],
                "data": res.get("data"),
                "metadata": res.get("metadata")
            }
            if "error" in res:
                clean_res["error"] = res["error"]

            if status == "success":
                self._send_json_response(200, clean_res)
            elif status == "rejected":
                # 422 Unprocessable Entity indicates hard constraint violation after retry
                self._send_json_response(422, clean_res)
            else:
                self._send_json_response(503, clean_res)

        except Exception as e:
            print(f"[{time.strftime('%X')}] Internal adapter error: {str(e)}")
            self._send_json_response(503, {
                "status": "error",
                "error": {
                    "code": "SERVICE_ERROR",
                    "message": "Internal styling service encountered an error."
                }
            })

    def log_message(self, format, *args):
        # Suppress default stdio log spam to keep console clean
        pass

def run_server():
    server_address = (HOST, PORT)
    httpd = HTTPServer(server_address, StructuredCuratorHandler)
    print("=" * 60)
    print(f"NOVA Isolated Structured 1.5B Test Server")
    print(f"Listening on: http://{HOST}:{PORT}")
    print(f"Target Model: {MODEL_NAME}")
    print(f"Endpoint:     POST http://{HOST}:{PORT}/api/curate-structured")
    print(f"Health Check: GET  http://{HOST}:{PORT}/health")
    print("=" * 60)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down test server...")
        httpd.server_close()

if __name__ == "__main__":
    run_server()
