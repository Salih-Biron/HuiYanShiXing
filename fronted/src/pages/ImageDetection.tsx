import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  FileImage,
  FileText,
  Loader2,
  RefreshCcw,
  Upload,
  X,
} from 'lucide-react';
import { FadeIn } from '../components/AnimateIn';
import { detectImage, getResultFileUrl, getResultJson, type DetectionResult } from '../services/api';

const MAX_BATCH_SIZE = 20;

type TaskStatus = 'waiting' | 'running' | 'success' | 'error';
type TaskStage = 'waiting' | 'uploading' | 'inferencing' | 'done' | 'error';

type ImageTask = {
  id: string;
  file: File;
  previewUrl: string;
  status: TaskStatus;
  stage: TaskStage;
  result?: DetectionResult;
  error?: string;
  elapsedMs?: number;
  startedAt?: number;
  finishedAt?: number;
};

type PosePersonSummary = {
  pose_quality?: number;
  bbox_area?: number;
  horizontal_pose?: boolean;
};

type PoseEventSummary = {
  risk_level?: string;
  reason?: string;
  num_persons_kept?: number;
  num_horizontal_candidates?: number;
  main_person?: PosePersonSummary | null;
};

type FusionEventSummary = {
  final_decision?: string;
  risk_level?: string;
  reason?: string;
};

type FusionSummary = {
  final_event_count?: number;
  events?: FusionEventSummary[];
};

type RtmoDetails = {
  poseEvent?: PoseEventSummary | null;
  fusion?: FusionSummary | null;
  error?: string;
};

function statusLabel(status?: DetectionResult['status']): string {
  if (status === 'FALL_ALERT') return '跌倒告警';
  if (status === 'POSE_WARNING') return '姿态异常';
  if (status === 'NORMAL') return '正常';
  return '等待检测';
}

function statusClass(status?: DetectionResult['status']): string {
  if (status === 'FALL_ALERT') return 'text-red-600 bg-red-50 border-red-100';
  if (status === 'POSE_WARNING') return 'text-orange-600 bg-orange-50 border-orange-100';
  if (status === 'NORMAL') return 'text-emerald-600 bg-emerald-50 border-emerald-100';
  return 'text-gray-500 bg-gray-50 border-gray-100';
}

function taskStatusLabel(status: TaskStatus): string {
  if (status === 'running') return '检测中';
  if (status === 'success') return '已完成';
  if (status === 'error') return '失败';
  return '等待';
}

function taskStatusClass(status: TaskStatus): string {
  if (status === 'running') return 'text-blue-600 bg-blue-50 border-blue-100';
  if (status === 'success') return 'text-emerald-600 bg-emerald-50 border-emerald-100';
  if (status === 'error') return 'text-red-600 bg-red-50 border-red-100';
  return 'text-gray-500 bg-gray-50 border-gray-100';
}

function taskStageLabel(stage: TaskStage): string {
  if (stage === 'uploading') return '上传中';
  if (stage === 'inferencing') return 'AI 推理中';
  if (stage === 'done') return '检测完成';
  if (stage === 'error') return '检测失败';
  return '等待检测';
}

function relativeResultPath(taskId: string, filePath: string): string {
  const marker = `/api/result/${taskId}/`;
  const markerIndex = filePath.indexOf(marker);
  return markerIndex >= 0 ? filePath.slice(markerIndex + marker.length) : filePath;
}

function formatElapsedMs(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`;
}

function formatNumber(value?: number, fractionDigits = 1): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return value.toFixed(fractionDigits);
}

function pipelineLabel(mode?: DetectionResult['pipeline_mode']): string {
  if (mode === 'yolo_tiled_rtmo') return 'YOLO + Tiled + RTMO';
  if (mode === 'yolo_rtmo') return 'YOLO + RTMO';
  if (mode === 'yolo_tiled') return 'YOLO + Tiled';
  if (mode === 'yolo_only') return 'YOLO';
  return '-';
}

function rtmoStatusLabel(result: DetectionResult | null): string {
  if (!result) return '等待检测';
  if (result.rtmo_error) return '复核异常';
  if (result.rtmo_ran || result.pipeline_mode?.includes('rtmo')) return '已复核';
  return '未触发';
}

function parsePoseEvent(value: unknown): PoseEventSummary | null {
  if (!Array.isArray(value)) return null;
  const firstEvent = value.find((item) => item && typeof item === 'object');
  return firstEvent ? firstEvent as PoseEventSummary : null;
}

function parseFusionSummary(value: unknown): FusionSummary | null {
  if (!value || typeof value !== 'object') return null;
  return value as FusionSummary;
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'RTMO 明细读取失败';
}

function revokeTaskPreviews(tasks: ImageTask[]) {
  tasks.forEach((task) => URL.revokeObjectURL(task.previewUrl));
}

function createImageTask(file: File): ImageTask {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

  return {
    id,
    file,
    previewUrl: URL.createObjectURL(file),
    status: 'waiting',
    stage: 'waiting',
  };
}

function fileListToFiles(fileList: FileList | null): File[] {
  if (!fileList) return [];

  return Array.from({ length: fileList.length }, (_, index) => fileList.item(index))
    .filter((file): file is File => file !== null);
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export default function ImageDetection() {
  const [imageTasks, setImageTasks] = useState<ImageTask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rtmoDetails, setRtmoDetails] = useState<RtmoDetails | null>(null);
  const [isLoadingRtmoDetails, setIsLoadingRtmoDetails] = useState(false);
  const [isCapturingBurst, setIsCapturingBurst] = useState(false);
  const [currentTaskIndex, setCurrentTaskIndex] = useState<number | null>(null);
  const [batchStartedAt, setBatchStartedAt] = useState<number | null>(null);
  const [batchFinishedAt, setBatchFinishedAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => performance.now());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const tasksRef = useRef<ImageTask[]>([]);

  const activeTask = imageTasks.find((task) => task.id === activeTaskId) || imageTasks[0] || null;
  const activeResult = activeTask?.result || null;
  const resultImagePath = activeResult?.api_files?.result_image
    ? relativeResultPath(activeResult.task_id, activeResult.api_files.result_image)
    : null;
  const alertImagePath = activeResult?.api_files?.alert_image
    ? relativeResultPath(activeResult.task_id, activeResult.api_files.alert_image)
    : null;
  const resultJsonPath = activeResult?.api_files?.result_json
    ? relativeResultPath(activeResult.task_id, activeResult.api_files.result_json)
    : null;
  const poseEventsPath = activeResult?.api_files?.pose_events
    ? relativeResultPath(activeResult.task_id, activeResult.api_files.pose_events)
    : null;
  const fusionResultPath = activeResult?.api_files?.fusion_result
    ? relativeResultPath(activeResult.task_id, activeResult.api_files.fusion_result)
    : null;

  const summary = useMemo(() => {
    const completed = imageTasks.filter((task) => task.status === 'success').length;
    const failed = imageTasks.filter((task) => task.status === 'error').length;
    const alertCount = imageTasks.filter((task) => task.result?.status === 'FALL_ALERT' || task.result?.status === 'POSE_WARNING').length;
    const processed = completed + failed;
    const progress = imageTasks.length ? Math.round((processed / imageTasks.length) * 100) : 0;

    return {
      selected: imageTasks.length,
      completed,
      failed,
      alertCount,
      processed,
      progress,
    };
  }, [imageTasks]);

  const batchElapsedMs = batchStartedAt
    ? Math.round((batchFinishedAt || nowMs) - batchStartedAt)
    : 0;
  const averageTaskMs = summary.processed > 0 ? batchElapsedMs / summary.processed : 0;
  const remainingTaskCount = Math.max(summary.selected - summary.processed, 0);
  const estimatedRemainingMs = isDetecting && averageTaskMs > 0
    ? Math.round(averageTaskMs * remainingTaskCount)
    : 0;
  const currentTask = currentTaskIndex !== null ? imageTasks[currentTaskIndex] || null : null;
  const progressTask = currentTask || activeTask;
  const remainingCaptureSlots = Math.max(0, MAX_BATCH_SIZE - imageTasks.length);

  useEffect(() => {
    if (!isDetecting) return undefined;

    const timer = window.setInterval(() => setNowMs(performance.now()), 500);
    return () => window.clearInterval(timer);
  }, [isDetecting]);

  useEffect(() => {
    let cancelled = false;

    setRtmoDetails(null);

    if (!activeResult || (!poseEventsPath && !fusionResultPath)) {
      setIsLoadingRtmoDetails(false);
      return () => {
        cancelled = true;
      };
    }

    async function loadRtmoDetails() {
      setIsLoadingRtmoDetails(true);

      const [poseResult, fusionResult] = await Promise.allSettled([
        poseEventsPath ? getResultJson(activeResult.task_id, poseEventsPath) : Promise.resolve(null),
        fusionResultPath ? getResultJson(activeResult.task_id, fusionResultPath) : Promise.resolve(null),
      ]);

      if (cancelled) return;

      const nextDetails: RtmoDetails = {};

      if (poseResult.status === 'fulfilled') {
        nextDetails.poseEvent = parsePoseEvent(poseResult.value);
      } else {
        nextDetails.error = getErrorMessage(poseResult.reason);
      }

      if (fusionResult.status === 'fulfilled') {
        nextDetails.fusion = parseFusionSummary(fusionResult.value);
      } else {
        nextDetails.error = nextDetails.error || getErrorMessage(fusionResult.reason);
      }

      setRtmoDetails(nextDetails);
      setIsLoadingRtmoDetails(false);
    }

    void loadRtmoDetails();

    return () => {
      cancelled = true;
    };
  }, [activeResult, poseEventsPath, fusionResultPath]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  }

  function syncCameraDevices(devices: MediaDeviceInfo[], preferredDeviceId?: string) {
    const videoDevices = devices.filter((device) => device.kind === 'videoinput');
    setCameraDevices(videoDevices);
    setSelectedCameraId((currentDeviceId) => {
      const nextDeviceId = preferredDeviceId || currentDeviceId;
      if (nextDeviceId && videoDevices.some((device) => device.deviceId === nextDeviceId)) {
        return nextDeviceId;
      }
      return videoDevices[0]?.deviceId || '';
    });
  }

  async function loadCameraDevices(showError = false, preferredDeviceId?: string) {
    if (!navigator.mediaDevices?.enumerateDevices) {
      if (showError) setError('当前浏览器不支持摄像头设备列表');
      return;
    }

    setIsLoadingDevices(true);
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      syncCameraDevices(devices, preferredDeviceId);
    } catch (err) {
      if (showError) {
        setError(err instanceof Error ? `无法读取摄像头设备：${err.message}` : '无法读取摄像头设备');
      }
    } finally {
      setIsLoadingDevices(false);
    }
  }

  function cameraDeviceLabel(device: MediaDeviceInfo, index: number) {
    return device.label || `摄像头 ${index + 1}${index === 0 ? '（默认）' : ''}`;
  }

  function replaceImageTasks(files: File[]) {
    const imageFiles = files.filter((file) => file.type.startsWith('image/')).slice(0, MAX_BATCH_SIZE);
    const nextTasks = imageFiles.map(createImageTask);

    setImageTasks((previousTasks) => {
      revokeTaskPreviews(previousTasks);
      return nextTasks;
    });
    setActiveTaskId(nextTasks[0]?.id || null);
    setCurrentTaskIndex(null);
    setBatchStartedAt(null);
    setBatchFinishedAt(null);
    setNowMs(performance.now());
    setError(files.length > MAX_BATCH_SIZE ? `最多支持一次选择 ${MAX_BATCH_SIZE} 张，已自动保留前 ${MAX_BATCH_SIZE} 张` : null);
  }

  function appendImageTasks(files: File[]) {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    const currentTasks = tasksRef.current;
    const remainingSlots = Math.max(0, MAX_BATCH_SIZE - currentTasks.length);
    if (remainingSlots === 0) {
      setError(`队列已满，最多支持 ${MAX_BATCH_SIZE} 张图片`);
      return;
    }

    const acceptedFiles = imageFiles.slice(0, remainingSlots);
    const nextTasks = acceptedFiles.map(createImageTask);

    setImageTasks((previousTasks) => [...previousTasks, ...nextTasks]);
    setActiveTaskId((currentActiveTaskId) => currentActiveTaskId || nextTasks[0]?.id || null);
    setCurrentTaskIndex(null);
    setBatchStartedAt(null);
    setBatchFinishedAt(null);
    setNowMs(performance.now());
    setError(imageFiles.length > remainingSlots ? `队列最多 ${MAX_BATCH_SIZE} 张，本次只追加了 ${remainingSlots} 张` : null);
  }

  function clearImageTasks() {
    setImageTasks((previousTasks) => {
      revokeTaskPreviews(previousTasks);
      return [];
    });
    setActiveTaskId(null);
    setCurrentTaskIndex(null);
    setBatchStartedAt(null);
    setBatchFinishedAt(null);
    setNowMs(performance.now());
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  useEffect(() => {
    tasksRef.current = imageTasks;
  }, [imageTasks]);

  useEffect(() => {
    loadCameraDevices(false);

    const handleDeviceChange = () => {
      loadCameraDevices(false);
    };

    navigator.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange);
    };
  }, []);

  useEffect(() => {
    if (!cameraActive || !videoRef.current || !streamRef.current) return;

    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch(() => {
      setError('摄像头预览启动失败，请重新打开摄像头');
      stopCamera();
    });
  }, [cameraActive]);

  useEffect(() => {
    return () => {
      stopCamera();
      revokeTaskPreviews(tasksRef.current);
    };
  }, []);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = fileListToFiles(event.target.files);
    if (files.length === 0) return;
    stopCamera();
    replaceImageTasks(files);
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (isDetecting) return;

    const files = fileListToFiles(event.dataTransfer.files);
    if (files.length === 0) return;
    stopCamera();
    replaceImageTasks(files);
  };

  const handleOpenCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('当前浏览器不支持摄像头采集');
      return;
    }

    try {
      setError(null);
      stopCamera();
      const videoConstraints: MediaTrackConstraints = {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30, max: 30 },
        ...(selectedCameraId
          ? { deviceId: { exact: selectedCameraId } }
          : { facingMode: { ideal: 'environment' } }),
      };
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });
      const activeDeviceId = stream.getVideoTracks()[0]?.getSettings().deviceId;
      streamRef.current = stream;
      if (activeDeviceId) setSelectedCameraId(activeDeviceId);
      loadCameraDevices(false, activeDeviceId);
      setCameraActive(true);
    } catch (err) {
      setError(err instanceof Error ? `无法打开摄像头：${err.message}` : '无法打开摄像头，请检查浏览器权限或设备连接');
      stopCamera();
    }
  };

  const captureCameraFile = (sequence?: number) => {
    const video = videoRef.current;
    if (!video || !streamRef.current) {
      throw new Error('摄像头未打开');
    }
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      throw new Error('摄像头画面尚未准备好，请稍后再拍');
    }

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')?.drawImage(video, 0, 0, width, height);

    return new Promise<File>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('拍照失败，请重新打开摄像头'));
          return;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const suffix = typeof sequence === 'number' ? `-${String(sequence + 1).padStart(2, '0')}` : '';
        resolve(new File([blob], `camera-capture-${timestamp}${suffix}.jpg`, { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.95);
    });
  };

  const handleCaptureFrame = async () => {
    if (isDetecting || isCapturingBurst) return;
    if (remainingCaptureSlots <= 0) {
      setError(`队列已满，最多支持 ${MAX_BATCH_SIZE} 张图片`);
      return;
    }

    try {
      setError(null);
      const file = await captureCameraFile();
      appendImageTasks([file]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '拍照失败，请重新打开摄像头');
    }
  };

  const handleCaptureBurst = async () => {
    if (isDetecting || isCapturingBurst) return;
    if (remainingCaptureSlots <= 0) {
      setError(`队列已满，最多支持 ${MAX_BATCH_SIZE} 张图片`);
      return;
    }

    setIsCapturingBurst(true);
    setError(null);
    const files: File[] = [];

    try {
      for (let index = 0; index < remainingCaptureSlots; index += 1) {
        files.push(await captureCameraFile(index));
        if (index < remainingCaptureSlots - 1) {
          await sleep(300);
        }
      }
      appendImageTasks(files);
    } catch (err) {
      if (files.length > 0) appendImageTasks(files);
      setError(err instanceof Error ? err.message : '连拍失败，请重新打开摄像头');
    } finally {
      setIsCapturingBurst(false);
    }
  };

  const handleDetectAll = async () => {
    if (imageTasks.length === 0 || isDetecting) return;

    const startedAt = performance.now();
    const tasksToRun = [...imageTasks];
    let firstAlertTaskId: string | null = null;

    setIsDetecting(true);
    setError(null);
    setBatchStartedAt(startedAt);
    setBatchFinishedAt(null);
    setNowMs(startedAt);
    setCurrentTaskIndex(0);
    setActiveTaskId(tasksToRun[0]?.id || null);
    setImageTasks((previousTasks) => previousTasks.map((task) => ({
      ...task,
      status: 'waiting',
      stage: 'waiting',
      result: undefined,
      error: undefined,
      elapsedMs: undefined,
      startedAt: undefined,
      finishedAt: undefined,
    })));

    for (const [index, taskToRun] of tasksToRun.entries()) {
      const taskStartedAt = performance.now();
      setCurrentTaskIndex(index);
      setActiveTaskId(taskToRun.id);
      setImageTasks((previousTasks) => previousTasks.map((task) => (
        task.id === taskToRun.id
          ? {
            ...task,
            status: 'running',
            stage: 'inferencing',
            error: undefined,
            startedAt: taskStartedAt,
          }
          : task
      )));

      try {
        const result = await detectImage(taskToRun.file);
        const taskFinishedAt = performance.now();
        const elapsedMs = Math.round(result.timings_ms?.total || (taskFinishedAt - taskStartedAt));

        if (!result.success) {
          const message = typeof result.message === 'string' ? result.message : '检测失败';
          throw new Error(message);
        }

        if (!firstAlertTaskId && result.status !== 'NORMAL') {
          firstAlertTaskId = taskToRun.id;
        }

        setImageTasks((previousTasks) => previousTasks.map((task) => (
          task.id === taskToRun.id
            ? {
              ...task,
              status: 'success',
              stage: 'done',
              result,
              elapsedMs,
              finishedAt: taskFinishedAt,
            }
            : task
        )));
      } catch (err) {
        const taskFinishedAt = performance.now();
        const message = err instanceof Error ? err.message : '检测失败，请检查后端服务是否运行';
        setImageTasks((previousTasks) => previousTasks.map((task) => (
          task.id === taskToRun.id
            ? {
              ...task,
              status: 'error',
              stage: 'error',
              error: message,
              elapsedMs: Math.round(taskFinishedAt - taskStartedAt),
              finishedAt: taskFinishedAt,
            }
            : task
        )));
      }
    }

    const finishedAt = performance.now();
    setBatchFinishedAt(finishedAt);
    setNowMs(finishedAt);
    setCurrentTaskIndex(null);
    if (firstAlertTaskId) setActiveTaskId(firstAlertTaskId);
    setIsDetecting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const pipelineMode = activeResult?.pipeline_mode;
  const rtmoTriggered = Boolean(activeResult?.rtmo_ran || pipelineMode?.includes('rtmo'));
  const rtmoError = activeResult?.rtmo_error || rtmoDetails?.error || '';
  const poseEvent = rtmoDetails?.poseEvent || null;
  const mainPerson = poseEvent?.main_person || null;
  const fusionEvent = rtmoDetails?.fusion?.events?.[0] || null;
  const fusionDecision = fusionEvent?.final_decision || activeResult?.status || '-';
  const tiledStatus = activeResult ? (pipelineMode?.includes('tiled') ? '已运行' : '未触发') : '-';
  const rtmoElapsed = activeResult?.timings_ms?.rtmo;
  const fusionElapsed = activeResult?.timings_ms?.fusion;
  const totalElapsed = activeResult?.timings_ms?.total || activeTask?.elapsedMs;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <FadeIn>
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold text-gray-900">图片检测</h2>
          <p className="text-sm text-gray-500">
            支持一次选择最多 20 张图片，系统会按队列调用后端 AI 模型进行跌倒检测与姿态分析
          </p>
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <FadeIn className="xl:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 md:p-6 space-y-5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="w-full min-h-[300px] rounded-xl border-2 border-dashed border-blue-100 bg-blue-50/40 overflow-hidden">
              {cameraActive ? (
                <div className="relative h-[300px] bg-gray-900">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-contain"
                    muted
                    playsInline
                  />
                  <div className="absolute left-3 top-3 inline-flex items-center rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse" />
                    摄像头预览
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleDrop}
                  disabled={isDetecting}
                  className="w-full h-[300px] hover:bg-blue-50 transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  {activeTask ? (
                    <img
                      src={activeTask.previewUrl}
                      alt="待检测图片预览"
                      className="w-full h-[300px] object-contain bg-gray-50"
                    />
                  ) : (
                    <div className="h-[300px] flex flex-col items-center justify-center text-center px-6">
                      <div className="w-14 h-14 rounded-full bg-white text-blue-600 flex items-center justify-center shadow-sm border border-blue-100 mb-4">
                        <FileImage className="w-7 h-7" />
                      </div>
                      <p className="text-sm font-semibold text-gray-800 mb-1">选择或拖入图片</p>
                      <p className="text-xs text-gray-500">一次最多 20 张，支持 JPG、PNG、BMP、WEBP 等图片格式</p>
                    </div>
                  )}
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-3">
                <p className="text-xs text-gray-500 mb-1">已选图片</p>
                <p className="text-xl font-bold text-gray-900">{summary.selected}</p>
              </div>
              <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-3">
                <p className="text-xs text-blue-600 mb-1">已处理</p>
                <p className="text-xl font-bold text-blue-700">{summary.processed}/{summary.selected || 0}</p>
              </div>
              <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-3">
                <p className="text-xs text-red-600 mb-1">告警/异常</p>
                <p className="text-xl font-bold text-red-700">{summary.alertCount}</p>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-3">
                <p className="text-xs text-amber-600 mb-1">失败数</p>
                <p className="text-xl font-bold text-amber-700">{summary.failed}</p>
              </div>
            </div>

            <div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-blue-600 transition-all duration-300" style={{ width: `${summary.progress}%` }} />
              </div>
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">实时检测进度</h3>
                  <p className="text-xs text-gray-500 mt-1">逐张提交后端，完成一张立即更新结果</p>
                </div>
                <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-medium ${
                  isDetecting
                    ? 'text-blue-600 bg-white border-blue-100'
                    : summary.processed > 0
                      ? 'text-emerald-600 bg-white border-emerald-100'
                      : 'text-gray-500 bg-white border-gray-100'
                }`}>
                  {isDetecting && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                  {isDetecting ? '检测中' : summary.processed > 0 ? '已完成' : '待开始'}
                </span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <div className="rounded-lg bg-white border border-blue-100 px-3 py-2">
                  <p className="text-xs text-gray-500 mb-1">当前进度</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {summary.processed}/{summary.selected || 0}
                    {isDetecting && currentTaskIndex !== null ? ` · 第 ${currentTaskIndex + 1} 张` : ''}
                  </p>
                </div>
                <div className="rounded-lg bg-white border border-blue-100 px-3 py-2 min-w-0">
                  <p className="text-xs text-gray-500 mb-1">当前图片</p>
                  <p className="text-sm font-semibold text-gray-900 truncate">{progressTask?.file.name || '-'}</p>
                </div>
                <div className="rounded-lg bg-white border border-blue-100 px-3 py-2">
                  <p className="text-xs text-gray-500 mb-1">当前阶段</p>
                  <p className="text-sm font-semibold text-gray-900">{taskStageLabel(progressTask?.stage || 'waiting')}</p>
                </div>
                <div className="rounded-lg bg-white border border-blue-100 px-3 py-2">
                  <p className="text-xs text-gray-500 mb-1">耗时 / 预计剩余</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {batchStartedAt ? formatElapsedMs(batchElapsedMs) : '-'}
                    <span className="text-gray-400"> / </span>
                    {isDetecting && estimatedRemainingMs > 0 ? formatElapsedMs(estimatedRemainingMs) : '-'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
              <label className="block">
                <span className="block text-xs font-medium text-gray-500 mb-1">摄像头设备</span>
                <select
                  value={selectedCameraId}
                  onChange={(event) => setSelectedCameraId(event.target.value)}
                  disabled={cameraActive || isLoadingDevices || cameraDevices.length === 0 || isDetecting || isCapturingBurst}
                  className="w-full h-10 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {cameraDevices.length > 0 ? (
                    cameraDevices.map((device, index) => (
                      <option key={device.deviceId || index} value={device.deviceId}>
                        {cameraDeviceLabel(device, index)}
                      </option>
                    ))
                  ) : (
                    <option value="">未检测到摄像头</option>
                  )}
                </select>
              </label>
              <button
                type="button"
                onClick={() => loadCameraDevices(true)}
                disabled={cameraActive || isLoadingDevices || isDetecting || isCapturingBurst}
                className="inline-flex items-center justify-center self-end h-10 px-4 rounded-lg border border-gray-200 bg-white text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                <RefreshCcw className={`w-4 h-4 mr-2 ${isLoadingDevices ? 'animate-spin' : ''}`} />
                刷新设备
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {cameraActive ? (
                <>
                  <button
                    type="button"
                    onClick={handleCaptureFrame}
                    disabled={isDetecting || isCapturingBurst || remainingCaptureSlots <= 0}
                    className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    拍照加入队列
                  </button>
                  <button
                    type="button"
                    onClick={handleCaptureBurst}
                    disabled={isDetecting || isCapturingBurst || remainingCaptureSlots <= 0}
                    className="inline-flex items-center px-4 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-600 text-sm font-medium hover:bg-blue-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isCapturingBurst ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
                    {isCapturingBurst ? '连拍中' : `连拍补满 ${MAX_BATCH_SIZE} 张`}
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    disabled={isDetecting || isCapturingBurst}
                    className="inline-flex items-center px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <CameraOff className="w-4 h-4 mr-2" />
                    关闭摄像头
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isDetecting}
                    className="inline-flex items-center px-4 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-600 text-sm font-medium hover:bg-blue-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <FileImage className="w-4 h-4 mr-2" />
                    选择图片
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenCamera}
                    disabled={isDetecting}
                    className="inline-flex items-center px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    打开摄像头
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={handleDetectAll}
                disabled={imageTasks.length === 0 || isDetecting || isCapturingBurst}
                className="inline-flex items-center px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isDetecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {isDetecting ? `检测中 ${summary.processed}/${summary.selected}` : '开始批量检测'}
              </button>
              <button
                type="button"
                onClick={clearImageTasks}
                disabled={imageTasks.length === 0 || isDetecting || isCapturingBurst}
                className="inline-flex items-center px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <X className="w-4 h-4 mr-2" />
                清空队列
              </button>
            </div>

            {cameraActive && (
              <div className="rounded-lg border border-blue-100 bg-blue-50/70 px-4 py-3 text-xs text-blue-700">
                摄像头拍照会追加到当前队列，当前已加入 {imageTasks.length}/{MAX_BATCH_SIZE} 张；拍满后点击“开始批量检测”按顺序检测。
              </div>
            )}

            <div className="rounded-lg border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">图片检测队列</h3>
                <span className="text-xs text-gray-400">按顺序逐张检测，避免同时抢占 GPU</span>
              </div>
              <div className="max-h-[560px] 2xl:max-h-[640px] overflow-y-auto divide-y divide-gray-100">
                {imageTasks.length > 0 ? imageTasks.map((task, index) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => setActiveTaskId(task.id)}
                    className={`w-full grid grid-cols-[48px_28px_minmax(0,1fr)_72px] items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer ${activeTask?.id === task.id ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'}`}
                  >
                    <img src={task.previewUrl} alt={task.file.name} className="w-12 h-12 rounded-md object-cover bg-gray-100 border border-gray-100 shrink-0" />
                    <span className="text-xs text-gray-400 font-mono tabular-nums text-center">{String(index + 1).padStart(2, '0')}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate mb-1">{task.file.name}</p>
                      <p className="text-xs text-gray-400">
                        {(task.file.size / 1024 / 1024).toFixed(2)} MB
                        {task.elapsedMs ? ` · ${(task.elapsedMs / 1000).toFixed(1)}s` : ''}
                        {` · ${taskStageLabel(task.stage)}`}
                        {task.result ? ` · ${statusLabel(task.result.status)}` : ''}
                        {task.error ? ` · ${task.error}` : ''}
                      </p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center justify-center w-[64px] px-2.5 py-1 rounded-full border text-xs font-medium ${taskStatusClass(task.status)}`}>
                      {task.status === 'running' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                      {taskStatusLabel(task.status)}
                    </span>
                  </button>
                )) : (
                  <div className="px-4 py-8 text-center text-sm text-gray-400">选择图片后显示检测队列</div>
                )}
              </div>
            </div>
          </div>
        </FadeIn>

        <FadeIn className="xl:col-span-2" delay={0.06}>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 md:p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">当前图片结果</h3>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-medium ${statusClass(activeResult?.status)}`}>
                {activeResult?.status === 'NORMAL' ? <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> : <AlertTriangle className="w-3.5 h-3.5 mr-1" />}
                {statusLabel(activeResult?.status)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3">
                <p className="text-xs text-gray-500 mb-1">检测状态</p>
                <p className="text-sm font-semibold text-gray-800">
                  {activeTask?.status === 'error' ? '检测失败' : statusLabel(activeResult?.status)}
                </p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3">
                <p className="text-xs text-gray-500 mb-1">风险等级</p>
                <p className="text-sm font-semibold text-gray-800">{activeResult?.risk_level || '待检测'}</p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3">
                <p className="text-xs text-gray-500 mb-1">任务 ID</p>
                <p className="text-sm font-mono text-gray-800 truncate">{activeResult?.task_id || '-'}</p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3">
                <p className="text-xs text-gray-500 mb-1">单张耗时</p>
                <p className="text-sm font-semibold text-gray-800">{activeTask?.elapsedMs ? `${(activeTask.elapsedMs / 1000).toFixed(1)}s` : '-'}</p>
              </div>
            </div>

            {activeTask?.error && (
              <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-3 text-sm text-red-700">
                {activeTask.error}
              </div>
            )}

            {(activeResult || activeTask) && (
              <div className="rounded-lg border border-gray-100 bg-white overflow-hidden">
                <div className="px-3 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-800">推理链路</h4>
                  <span className="text-xs text-gray-400">{pipelineLabel(pipelineMode)}</span>
                </div>
                <div className="p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
                      <p className="text-xs text-blue-500 mb-1">YOLO 检测</p>
                      <p className="text-sm font-semibold text-blue-700">{activeResult ? '已完成' : '等待检测'}</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                      <p className="text-xs text-gray-500 mb-1">Tiled YOLO</p>
                      <p className="text-sm font-semibold text-gray-800">{tiledStatus}</p>
                    </div>
                    <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2">
                      <p className="text-xs text-indigo-500 mb-1">RTMO 姿态复核</p>
                      <p className="text-sm font-semibold text-indigo-700">{rtmoStatusLabel(activeResult)}</p>
                    </div>
                    <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
                      <p className="text-xs text-emerald-500 mb-1">Fusion 结论</p>
                      <p className="text-sm font-semibold text-emerald-700 truncate">{fusionDecision}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                      <p className="text-gray-500 mb-1">RTMO 耗时</p>
                      <p className="font-semibold text-gray-800">{formatElapsedMs(rtmoElapsed)}</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                      <p className="text-gray-500 mb-1">Fusion 耗时</p>
                      <p className="font-semibold text-gray-800">{formatElapsedMs(fusionElapsed)}</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                      <p className="text-gray-500 mb-1">总耗时</p>
                      <p className="font-semibold text-gray-800">{formatElapsedMs(totalElapsed)}</p>
                    </div>
                  </div>

                  {rtmoError && (
                    <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                      RTMO 异常：{rtmoError}
                    </div>
                  )}

                  <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-gray-800">姿态分析摘要</p>
                      {isLoadingRtmoDetails && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                    </div>

                    {rtmoTriggered ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-xs text-gray-500">有效人体</p>
                            <p className="text-sm font-semibold text-gray-800">{poseEvent?.num_persons_kept ?? '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">横向候选</p>
                            <p className="text-sm font-semibold text-gray-800">{poseEvent?.num_horizontal_candidates ?? '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">姿态质量</p>
                            <p className="text-sm font-semibold text-gray-800">{formatNumber(mainPerson?.pose_quality, 2)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">目标面积</p>
                            <p className="text-sm font-semibold text-gray-800">{formatNumber(mainPerson?.bbox_area, 0)}</p>
                          </div>
                        </div>
                        <div className="rounded-md bg-white border border-gray-100 px-3 py-2">
                          <p className="text-xs text-gray-500 mb-1">复核原因</p>
                          <p className="text-xs leading-5 text-gray-700">{poseEvent?.reason || fusionEvent?.reason || '等待 RTMO 明细'}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs leading-5 text-gray-500">
                        当前结果未触发 RTMO：只有 YOLO 命中跌倒、高风险目标或摄像头抓拍兜底时，后端才会同步运行 RTMO 姿态复核。
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-2">结果图片</p>
                <div className="aspect-video rounded-lg border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center">
                  {activeResult && resultImagePath ? (
                    <img
                      src={getResultFileUrl(activeResult.task_id, resultImagePath)}
                      alt="检测结果图"
                      className="w-full h-full object-contain"
                    />
                  ) : activeTask ? (
                    <img src={activeTask.previewUrl} alt="当前图片" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-xs text-gray-400">检测完成后显示结果图片</span>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-2">告警截图</p>
                <div className="aspect-video rounded-lg border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center">
                  {activeResult && alertImagePath ? (
                    <img
                      src={getResultFileUrl(activeResult.task_id, alertImagePath)}
                      alt="告警截图"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-gray-400">存在告警时显示截图</span>
                  )}
                </div>
              </div>
            </div>

            <a
              href={activeResult && resultJsonPath ? getResultFileUrl(activeResult.task_id, resultJsonPath) : undefined}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex w-full items-center justify-center px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                activeResult && resultJsonPath
                  ? 'border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 cursor-pointer'
                  : 'border-gray-200 text-gray-400 bg-gray-50 pointer-events-none'
              }`}
            >
              <FileText className="w-4 h-4 mr-2" />
              JSON 结果查看
            </a>
          </div>
        </FadeIn>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center text-red-700">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
