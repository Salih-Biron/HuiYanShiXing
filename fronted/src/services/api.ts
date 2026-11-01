/**
 * API Service Layer
 * 封装与 HuiYanShiXing 后端 FastAPI 的通信
 */

import { getConfig } from './config';

function baseUrl(): string {
  // 这里使用相对路径，确保 Vite dev server 代理生效
  return getConfig().apiUrl || '/api';
}

// ==================== Types ====================

export interface HealthCheckResponse {
  success: boolean;
  message: string;
}

export interface DetectionResult {
  success: boolean;
  task_id: string;
  batch_id?: string;
  batch_index?: number;
  filename?: string;
  created_at?: string;
  status: 'FALL_ALERT' | 'POSE_WARNING' | 'NORMAL';
  risk_level: string;
  pipeline_mode?: 'yolo_only' | 'yolo_tiled' | 'yolo_rtmo' | 'yolo_tiled_rtmo';
  timings_ms?: Record<string, number>;
  rtmo_ran?: boolean;
  rtmo_error?: string | null;
  api_files: {
    result_json: string;
    yolo_events: string;
    pose_events: string;
    fusion_result: string;
    result_image?: string;
    alert_image?: string;
  };
  [key: string]: unknown;
}

export interface ApiError {
  success: false;
  message: string;
  task_id?: string;
  error?: string;
  stderr?: string;
  stdout?: string;
}

export interface BatchDetectionError {
  success: false;
  batch_id?: string;
  batch_index: number;
  filename: string;
  task_id?: string;
  message: string;
  error?: string;
}

export type BatchDetectionItem = DetectionResult | BatchDetectionError;

export interface BatchDetectionResponse {
  success: boolean;
  batch_id: string;
  total: number;
  completed: number;
  failed: number;
  alert_count: number;
  timings_ms?: Record<string, number>;
  results: BatchDetectionItem[];
}

export interface DetectionLogItem {
  id: string;
  taskId?: string;
  timestamp: string;
  source: string;
  frame: number;
  status: 'alert' | 'normal' | 'partial_false_positive' | 'false_positive';
  rawStatus?: string;
  riskLevel: 'high' | 'medium' | 'low' | 'none';
  detections: string;
  alertImage?: string;
  resultImage?: string;
  resultJson?: string;
  pipelineMode?: string;
  elapsedMs?: number;
  sourceType?: 'image' | 'video';
  outputVideo?: string;
  alertCount?: number;
  originalAlertCount?: number;
  falsePositiveCount?: number;
  alertTimeline?: VideoAlertFrame[];
}

export type AlertProcessStatus = 'pending' | 'processing' | 'resolved' | 'false_positive';

export interface AlertItem {
  id: string;
  taskId: string;
  eventId?: string;
  source: string;
  sourceType: 'image' | 'video';
  timestamp: string;
  rawStatus: string;
  riskLevel: 'high' | 'medium' | 'low';
  confidence: number | null;
  status: AlertProcessStatus;
  image: string;
  eventVideo?: string;
  outputVideo?: string;
  frame?: number;
  timestampSec?: number;
  updatedAt?: string;
  history?: Array<{ status: string; timestamp: string }>;
}

export interface AlertFilter extends DetectionLogFilter {
  sourceType?: string;
}

export async function fetchAlertsApi(filter: AlertFilter = {}, signal?: AbortSignal): Promise<PaginatedApiResult<AlertItem>> {
  const params = new URLSearchParams();
  if (filter.dateScope) params.set('date_scope', filter.dateScope);
  if (filter.status) params.set('status', filter.status);
  if (filter.riskLevel) params.set('risk_level', filter.riskLevel);
  if (filter.search) params.set('search', filter.search);
  if (filter.sourceType) params.set('source_type', filter.sourceType);
  if (filter.page) params.set('page', String(filter.page));
  if (filter.pageSize) params.set('page_size', String(filter.pageSize));
  const res = await fetch(`${baseUrl()}/alerts?${params}`, { signal });
  if (!res.ok) throw new Error(`告警加载失败：${res.status}`);
  return res.json();
}

export async function updateAlertStatusApi(id: string, status: AlertProcessStatus): Promise<AlertItem> {
  const res = await fetch(`${baseUrl()}/alerts/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.detail || `告警处理失败：${res.status}`);
  return data.data;
}

export async function fetchAlertTrend(): Promise<Array<{ day: string; count: number }>> {
  const res = await fetch(`${baseUrl()}/stats/trend`);
  if (!res.ok) throw new Error(`趋势加载失败：${res.status}`);
  const data = await res.json();
  return data.data;
}

export interface PaginatedApiResult<T> {
  success?: boolean;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DetectionLogFilter {
  dateScope?: 'today' | 'history' | 'all';
  status?: string;
  riskLevel?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface StatsSummary {
  success?: boolean;
  todayImages: number;
  todayFrames: number;
  todayAlerts: number;
  todayFalsePositives?: number;
  processedEvents: number;
  averageLatencyMs?: number;
  averageAccuracy?: number | null;
  totalImages?: number;
  generatedAt?: string;
}

// ==================== API Functions ====================

/**
 * 健康检查 - 检测后端是否运行
 */
export async function healthCheck(): Promise<HealthCheckResponse> {
  const res = await fetch(`${baseUrl()}/`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

/**
 * 上传图片进行跌倒检测
 * @param file - 图片文件 (jpg/jpeg/png/bmp/webp)
 * @returns 检测结果，包含 task_id、状态、风险等级和结果文件链接
 */
export async function detectImage(file: File, signal?: AbortSignal): Promise<DetectionResult> {
  const formData = new FormData();
  formData.append('file', file);

  // 改成相对路径，走 Vite 代理
  const res = await fetch(`${baseUrl()}/detect/image`, {
    method: 'POST',
    body: formData,
    signal,
  });

  const data = await res.json();

  if (!res.ok) {
    const apiError = data as ApiError;
    const detail = apiError.error || apiError.stderr || apiError.message;
    throw new Error(detail || 'Detection failed');
  }

  return data as DetectionResult;
}

async function detectImagesSequential(files: File[]): Promise<BatchDetectionResponse> {
  const batchId = `local-${Date.now()}`;
  const results: BatchDetectionItem[] = [];

  for (const [index, file] of files.entries()) {
    try {
      const result = await detectImage(file);
      results.push({
        ...result,
        batch_id: batchId,
        batch_index: index,
        filename: file.name,
      });
    } catch (err) {
      results.push({
        success: false,
        batch_id: batchId,
        batch_index: index,
        filename: file.name,
        message: err instanceof Error ? err.message : 'Detection failed',
      });
    }
  }

  const completed = results.filter(item => item.success).length;
  const failed = results.length - completed;
  const alertCount = results.filter(item => item.success && item.status !== 'NORMAL').length;

  return {
    success: failed === 0,
    batch_id: batchId,
    total: results.length,
    completed,
    failed,
    alert_count: alertCount,
    results,
  };
}

/**
 * 批量上传图片进行检测。后端批量接口不可用时降级为逐张调用单图接口。
 */
export async function detectImages(files: File[]): Promise<BatchDetectionResponse> {
  if (files.length === 0) {
    return {
      success: true,
      batch_id: `empty-${Date.now()}`,
      total: 0,
      completed: 0,
      failed: 0,
      alert_count: 0,
      results: [],
    };
  }

  const formData = new FormData();
  files.forEach(file => formData.append('files', file));

  const res = await fetch(`${baseUrl()}/detect/images`, {
    method: 'POST',
    body: formData,
  });

  if (res.status === 404 || res.status === 405) {
    return detectImagesSequential(files);
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error((data as ApiError).message || 'Batch detection failed');
  }

  return data as BatchDetectionResponse;
}

/**
 * 获取结果文件的完整 URL
 * @param taskId - 任务 ID
 * @param filePath - 文件相对路径
 */
export function getResultFileUrl(taskId: string, filePath: string): string {
  return `${baseUrl()}/result/${taskId}/${filePath}`;
}

/**
 * 获取结果文件内容 (JSON)
 */
export async function getResultJson(taskId: string, filePath: string): Promise<unknown> {
  const url = getResultFileUrl(taskId, filePath);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch result: ${res.status}`);
  return res.json();
}

/**
 * 获取结果图片的 Blob URL
 */
export async function getResultImageBlob(taskId: string, filePath: string): Promise<string> {
  const url = getResultFileUrl(taskId, filePath);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function fetchDetectionLogsApi(filter: DetectionLogFilter = {}, signal?: AbortSignal): Promise<PaginatedApiResult<DetectionLogItem>> {
  const params = new URLSearchParams();
  if (filter.dateScope) params.set('date_scope', filter.dateScope);
  if (filter.status) params.set('status', filter.status);
  if (filter.riskLevel) params.set('risk_level', filter.riskLevel);
  if (filter.search) params.set('search', filter.search);
  if (filter.page) params.set('page', String(filter.page));
  if (filter.pageSize) params.set('page_size', String(filter.pageSize));

  const query = params.toString();
  const res = await fetch(`${baseUrl()}/detection/logs${query ? `?${query}` : ''}`, { signal });
  if (!res.ok) throw new Error(`Failed to fetch detection logs: ${res.status}`);
  return res.json();
}

export async function fetchStatsSummary(): Promise<StatsSummary> {
  const res = await fetch(`${baseUrl()}/stats/summary`);
  if (!res.ok) throw new Error(`Failed to fetch stats summary: ${res.status}`);
  return res.json();
}

// ==================== Video Detection ====================

export interface VideoUploadResponse {
  success: boolean;
  task_id: string;
  status: 'processing' | 'completed' | 'failed';
  message: string;
}

export interface VideoProgress {
  processed_frames: number;
  total_frames: number;
  alert_count: number;
  percent: number;
}

export interface VideoAlertFrame {
  event_id?: string;
  frame: number;
  first_frame?: number;
  last_alert_frame?: number;
  timestamp_sec: number;
  last_alert_timestamp_sec?: number;
  status: 'FALL_ALERT' | 'POSE_WARNING';
  risk_level: string;
  confidence?: number | null;
  alert_image: string;
  detection_count?: number;
  clip_start_sec?: number;
  clip_end_sec?: number;
  clip_duration_sec?: number;
  pre_event_sec?: number;
  post_event_sec?: number;
  event_video?: string;
  event_video_error?: string;
  reviewStatus?: AlertProcessStatus;
  excluded?: boolean;
}

export interface VideoResult {
  success: boolean;
  task_id: string;
  created_at?: string;
  source?: string;
  source_type?: 'video';
  status: 'FALL_ALERT' | 'NORMAL';
  risk_level: string;
  duration_sec: number;
  total_frames: number;
  processed_frames: number;
  alert_count: number;
  alert_frame_count?: number;
  event_clip_count?: number;
  event_clip_error_count?: number;
  average_fps: number;
  pipeline_mode?: string;
  timings_ms?: Record<string, number>;
  alert_timeline: VideoAlertFrame[];
  api_files: {
    output_video: string;
    event_clips?: string[];
    timeline_json: string;
    result_json: string;
    yolo_events?: string;
    pose_events?: string;
    fusion_result?: string;
  };
}

export interface VideoTaskStatus {
  success: boolean;
  task_id: string;
  status: 'processing' | 'completed' | 'failed';
  progress: VideoProgress;
  result: VideoResult | null;
  error: string | null;
}

/**
 * 上传视频，立即返回 task_id，后端异步处理
 */
export async function uploadVideo(file: File): Promise<VideoUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${baseUrl()}/detect/video`, {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as ApiError).message || 'Video upload failed');
  }
  return data as VideoUploadResponse;
}

/**
 * 轮询视频检测任务状态与进度
 */
export async function getVideoStatus(taskId: string): Promise<VideoTaskStatus> {
  const res = await fetch(`${baseUrl()}/detect/video/${taskId}/status`);
  if (!res.ok) throw new Error(`Failed to fetch video status: ${res.status}`);
  return res.json();
}

/**
 * 获取标注后输出视频的 URL
 */
export function getVideoOutputUrl(taskId: string): string {
  return `${baseUrl()}/detect/video/${taskId}/output.mp4`;
}

/**
 * 获取告警帧图片 URL（alert_image 为后端返回的相对路径）
 */
export function getResultAssetUrl(taskId: string, assetPath: string): string {
  if (/^https?:\/\//i.test(assetPath)) return assetPath;
  if (assetPath.startsWith('/api/')) {
    const marker = `/api/result/${taskId}/`;
    const idx = assetPath.indexOf(marker);
    if (idx >= 0) return getResultFileUrl(taskId, assetPath.slice(idx + marker.length));
  }
  return getResultFileUrl(taskId, assetPath);
}

export function getAlertFrameUrl(taskId: string, alertImagePath: string): string {
  return getResultAssetUrl(taskId, alertImagePath);
}

export function getEventVideoUrl(taskId: string, eventVideoPath: string): string {
  return getResultAssetUrl(taskId, eventVideoPath);
}

/**
 * 取消并清理视频任务
 */
export async function cancelVideoTask(taskId: string): Promise<void> {
  await fetch(`${baseUrl()}/detect/video/${taskId}`, { method: 'DELETE' });
}
