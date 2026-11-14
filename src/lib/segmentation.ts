import * as vision from '@mediapipe/tasks-vision';

export interface SegmentationConfig {
  model: 'selfie' | 'multiclass';
  runningMode: 'VIDEO' | 'IMAGE';
  outputCategoryMask: boolean;
  outputConfidenceMasks: boolean;
}

export class SegmenterEngine {
  private segmenter: vision.ImageSegmenter | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  async init(config: SegmentationConfig): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const { ImageSegmenter, FilesetResolver } = vision;
      const filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
      );

      const modelMap: Record<string, string> = {
        selfie: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm/image_segmenter.tflite',
        multiclass: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm/image_segmenter_multiclass.tflite',
      };

      this.segmenter = await ImageSegmenter.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: modelMap[config.model],
          delegate: 'GPU',
        },
        runningMode: config.runningMode as 'VIDEO' | 'IMAGE',
        outputCategoryMask: config.outputCategoryMask,
        outputConfidenceMasks: config.outputConfidenceMasks,
      });

      this.initialized = true;
    })();

    return this.initPromise;
  }

  async segmentForVideo(
    videoFrame: VideoFrame | HTMLVideoElement,
    timestampMs: number,
    onResult: (maskBitmap: ImageBitmap | null) => void,
  ): Promise<void> {
    if (!this.segmenter || !this.initialized) return;

    try {
      const result = this.segmenter.segmentForVideo(videoFrame, timestampMs);
      const mask = result.categoryMask || result.confidenceMasks?.[0];
      if (mask) {
        const bitmap = await createImageBitmap(mask);
        onResult(bitmap);
      } else {
        onResult(null);
      }
    } catch (e) {
      console.warn('Segmentation frame failed:', e);
      onResult(null);
    }
  }

  destroy(): void {
    this.segmenter?.close();
    this.segmenter = null;
    this.initialized = false;
    this.initPromise = null;
  }

  isReady(): boolean {
    return this.initialized && this.segmenter !== null;
  }
}
