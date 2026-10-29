import sys
import json
import base64
import math
import cv2
import numpy as np

def run():
    try:
        raw_input = sys.stdin.read().strip()
        if not raw_input:
            print(json.dumps({"error": "No input received."}))
            return

        try:
            payload = json.loads(raw_input)
            data_url = payload.get("imageDataUrl", "")
        except Exception:
            data_url = raw_input

        if "," in data_url:
            data_url = data_url.split(",", 1)[1]

        try:
            img_bytes = base64.b64decode(data_url)
        except Exception:
            print(json.dumps({"error": "Invalid base64 image data."}))
            return

        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            print(json.dumps({"error": "Failed to decode image from provided data URL."}))
            return

        h, w, _ = img.shape
        if h < 32 or w < 32:
            print(json.dumps({"error": "Image resolution is too small for landmark detection."}))
            return

        aspect = w / h

        import mediapipe as mp
        mp_pose = mp.solutions.pose
        with mp_pose.Pose(static_image_mode=True, model_complexity=1, min_detection_confidence=0.5) as pose:
            rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            results = pose.process(rgb_img)

        if not results.pose_landmarks:
            print(json.dumps({
                "error": "No person or pose landmarks detected in the image. Please upload a clear photo showing your body."
            }))
            return

        lms = results.pose_landmarks.landmark

        named_indices = {
            "nose": 0,
            "left_shoulder": 11,
            "right_shoulder": 12,
            "left_elbow": 13,
            "right_elbow": 14,
            "left_wrist": 15,
            "right_wrist": 16,
            "left_hip": 23,
            "right_hip": 24,
            "left_knee": 25,
            "right_knee": 26,
            "left_ankle": 27,
            "right_ankle": 28
        }

        landmarks = {}
        all_vis = []
        for name, idx in named_indices.items():
            lm = lms[idx]
            vis = max(0.0, min(1.0, round(float(lm.visibility), 4)))
            all_vis.append(vis)
            landmarks[name] = {
                "x": round(float(lm.x), 4),
                "y": round(float(lm.y), 4),
                "z": round(float(lm.z), 4),
                "visibility": vis
            }

        ls = lms[named_indices["left_shoulder"]]
        rs = lms[named_indices["right_shoulder"]]
        lh = lms[named_indices["left_hip"]]
        rh = lms[named_indices["right_hip"]]
        lk = lms[named_indices["left_knee"]]
        rk = lms[named_indices["right_knee"]]
        la = lms[named_indices["left_ankle"]]
        ra = lms[named_indices["right_ankle"]]

        upper_vis_ok = (ls.visibility >= 0.35 and rs.visibility >= 0.35 and 
                        lh.visibility >= 0.35 and rh.visibility >= 0.35)
        
        if not upper_vis_ok:
            print(json.dumps({
                "error": "Upper body landmarks (shoulders or hips) were not detected with sufficient visibility. Please ensure your upper torso and hips are visible."
            }))
            return

        def dist(lm1, lm2):
            dx = (float(lm1.x) - float(lm2.x)) * aspect
            dy = float(lm1.y) - float(lm2.y)
            return math.sqrt(dx * dx + dy * dy)

        sw = dist(ls, rs)
        hw = dist(lh, rh)
        s_to_h = round(sw / hw, 3) if hw > 0.001 else None

        sm_x, sm_y = (ls.x + rs.x) / 2.0, (ls.y + rs.y) / 2.0
        hm_x, hm_y = (lh.x + rh.x) / 2.0, (lh.y + rh.y) / 2.0

        torso_len = math.sqrt(((sm_x - hm_x) * aspect) ** 2 + (sm_y - hm_y) ** 2)

        lower_vis_ok = (lk.visibility >= 0.35 and rk.visibility >= 0.35 and 
                        la.visibility >= 0.35 and ra.visibility >= 0.35)

        leg_len = None
        t_to_l = None

        if lower_vis_ok:
            km_x, km_y = (lk.x + rk.x) / 2.0, (lk.y + rk.y) / 2.0
            am_x, am_y = (la.x + ra.x) / 2.0, (la.y + ra.y) / 2.0
            upper_leg = math.sqrt(((hm_x - km_x) * aspect) ** 2 + (hm_y - km_y) ** 2)
            lower_leg = math.sqrt(((km_x - am_x) * aspect) ** 2 + (km_y - am_y) ** 2)
            leg_len = round(upper_leg + lower_leg, 4)
            if leg_len > 0.001:
                t_to_l = round(torso_len / leg_len, 3)

        avg_conf = round(sum(all_vis) / len(all_vis), 4)

        output = {
            "landmarks": landmarks,
            "visibilityMetrics": {
                "upperBodyVisible": True,
                "lowerBodyVisible": bool(lower_vis_ok),
                "fullBodyVisible": bool(lower_vis_ok),
                "averageConfidence": avg_conf
            },
            "geometricProportions": {
                "shoulderWidthNormalized": round(sw, 4),
                "hipWidthNormalized": round(hw, 4),
                "shoulderToHipRatio": s_to_h,
                "torsoLengthNormalized": round(torso_len, 4),
                "legLengthNormalized": leg_len,
                "torsoToLegRatio": t_to_l
            },
            "imageDimensions": {
                "width": w,
                "height": h,
                "aspectRatio": round(aspect, 3)
            },
            "disclaimer": "Geometric proportions are calculated directly from 2D pose landmarks under the captured camera perspective. They represent geometric measurements only and do not establish a person's true body type or anatomical measurements."
        }

        print(json.dumps(output))

    except Exception as e:
        print(json.dumps({"error": f"Pose detection processing error: {str(e)}"}))

if __name__ == "__main__":
    run()
