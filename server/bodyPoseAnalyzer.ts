import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

const resolveDetectorScriptPath = (): string => {
  const candidates = [
    path.resolve(currentDir, 'bodyPoseDetector.py'),
    path.resolve(currentDir, 'server', 'bodyPoseDetector.py'),
    path.resolve(currentDir, '..', 'server', 'bodyPoseDetector.py'),
    path.resolve(process.cwd(), 'server', 'bodyPoseDetector.py'),
    path.resolve(process.cwd(), 'bodyPoseDetector.py')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
};

const getPythonCommand = (): string => {
  return process.env.PYTHON_PATH || process.env.PYTHON_BIN || 'python';
};

export interface BodyLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface VisibilityMetrics {
  upperBodyVisible: boolean;
  lowerBodyVisible: boolean;
  fullBodyVisible: boolean;
  averageConfidence: number;
}

export interface GeometricProportions {
  shoulderWidthNormalized: number;
  hipWidthNormalized: number;
  shoulderToHipRatio: number | null;
  torsoLengthNormalized: number;
  legLengthNormalized: number | null;
  torsoToLegRatio: number | null;
}

export interface BodyPoseAnalysis {
  landmarks: Record<string, BodyLandmark>;
  visibilityMetrics: VisibilityMetrics;
  geometricProportions: GeometricProportions;
  imageDimensions: {
    width: number;
    height: number;
    aspectRatio: number;
  };
  disclaimer: string;
}

const splitDataUrl = (imageDataUrl: string) => {
  const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
};

/**
 * Runs MediaPipe Pose landmark detection via Python on the given base64 image data URL.
 * Detects key body landmarks and computes objective geometric proportions.
 */
export const analyzeBodyPose = async (imageDataUrl: string): Promise<BodyPoseAnalysis> => {
  if (!imageDataUrl || typeof imageDataUrl !== 'string') {
    throw new Error('imageDataUrl must be a non-empty string.');
  }

  const parsed = splitDataUrl(imageDataUrl);
  if (!parsed) {
    throw new Error('imageDataUrl must be a base64 image data URL.');
  }

  const scriptPath = resolveDetectorScriptPath();
  const pythonCmd = getPythonCommand();

  return new Promise((resolve, reject) => {
    const pythonProcess = spawn(pythonCmd, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd(),
      windowsHide: true
    });

    let stdoutData = '';
    let stderrData = '';

    pythonProcess.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    pythonProcess.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    pythonProcess.on('error', (err) => {
      reject(new Error(`Failed to start pose detection process with "${pythonCmd}": ${err.message}`));
    });

    pythonProcess.on('close', (code) => {
      if (!stdoutData.trim()) {
        const errorDetail = stderrData.trim() || `Exit code ${code}`;
        return reject(new Error(`Pose detector returned no output. ${errorDetail}`));
      }

      try {
        const parsedOutput = JSON.parse(stdoutData.trim());
        if (parsedOutput.error) {
          return reject(new Error(parsedOutput.error));
        }
        resolve(parsedOutput as BodyPoseAnalysis);
      } catch (parseError) {
        reject(
          new Error(
            `Failed to parse pose detection output: ${parseError instanceof Error ? parseError.message : String(parseError)}`
          )
        );
      }
    });

    const payload = JSON.stringify({ imageDataUrl });
    pythonProcess.stdin.write(payload);
    pythonProcess.stdin.end();
  });
};
