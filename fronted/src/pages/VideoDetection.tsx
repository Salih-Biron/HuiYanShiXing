import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clapperboard,
  Loader2,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { FadeIn } from '../components/AnimateIn';
import {
  uploadVideo,
  getVideoStatus,
  getAlertFrameUrl,
  cancelVideoTask,
  type VideoProgress,
  type VideoResult,
  type VideoAlertFrame,
} from '../services/api';

type Phase = 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';

const POLL_INTERVAL_MS = 1000;

function phaseLabel(phase: Phase): string {
  if (phase === 'uploading') return '上传中';
  if (phase === 'processing') return '检测中';
  if (phase === 'completed') return '检测完成';
  if (phase === 'failed') return '检测失败';
  return '待检测';
}

function phaseClass(phase: Phase): string {
  if (phase === 'processing' || phase === 'uploading') return 'text-blue-600 bg-blue-50 border-blue-100';
  if (phase === 'completed') return 'text-emerald-600 bg-emerald-50 border-emerald-100';
  if (phase === 'failed') return 'text-red-600 bg-red-50 border-red-100';
  return 'text-gray-500 bg-gray-50 border-gray-100';
}

function alertStatusLabel(status: VideoAlertFrame['status']): string {
  return status === 'POSE_WARNING' ? '姿态异常' : '跌倒告警';
}

function formatTimestamp(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function VideoDetection() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState<VideoProgress | null>(null);
  const [result, setResult] = useState<VideoResult | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<VideoAlertFrame | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [screenshotError, setScreenshotError] = useState(false);

  useEffect(() => { setScreenshotError(false); }, [selectedEvent, taskId]);

  // 本地视频预览
  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  // 轮询进度
  useEffect(() => {
    if (phase !== 'processing' || !taskId) return;

    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const status = await getVideoStatus(taskId);
        if (cancelled) return;
        setProgress(status.progress);
        if (status.status === 'completed' && status.result) {
          setResult(status.result);
          setSelectedEvent(status.result.alert_timeline[0] ?? null);
          setPhase('completed');
        } else if (status.status === 'failed') {
          setError(status.error || '视频检测失败');
          setPhase('failed');
        }
      } catch {
        // 单次轮询失败不致命，继续重试
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [phase, taskId]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    resetTask();
    setSelectedFile(file);
  };

  function resetTask() {
    setTaskId(null);
    setPhase('idle');
    setProgress(null);
    setResult(null);
    setSelectedEvent(null);
    setError(null);
  }

  const handleUpload = async () => {
    if (!selectedFile || phase === 'uploading' || phase === 'processing') return;

    setError(null);
    setResult(null);
    setProgress(null);
    setPhase('uploading');

    try {
      const res = await uploadVideo(selectedFile);
      setTaskId(res.task_id);
      setPhase('processing');
    } catch (err) {
      setError(err instanceof Error ? err.message : '视频上传失败，请检查后端服务是否运行');
      setPhase('failed');
    }
  };

  const handleClear = async () => {
    if (taskId && (phase === 'processing' || phase === 'completed' || phase === 'failed')) {
      cancelVideoTask(taskId).catch(() => {});
    }
    setSelectedFile(null);
    resetTask();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const percent = progress?.percent ?? 0;
  const processedFrames = progress?.processed_frames ?? result?.processed_frames ?? 0;
  const totalFrames = progress?.total_frames ?? result?.total_frames ?? 0;
  const alertCount = progress?.alert_count ?? result?.alert_count ?? 0;
  const timeline = result?.alert_timeline ?? [];
  const isBusy = phase === 'uploading' || phase === 'processing';

  return (
    <div className="p-4 md:p-6 space-y-6">
      <FadeIn>
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold text-gray-900">视频检测</h2>
          <p className="text-sm text-gray-500">
            上传视频，系统按帧采样调用 YOLO → Tiled → RTMO 级联管线进行逐帧跌倒检测与告警分析
          </p>
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <FadeIn className="xl:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 md:p-6 space-y-5">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleFileChange}
            />

            <button
              type="button"
              onClick={() => !isBusy && fileInputRef.current?.click()}
              disabled={isBusy}
              className="w-full min-h-[300px] rounded-xl border-2 border-dashed border-blue-100 bg-blue-50/40 hover:bg-blue-50 hover:border-blue-200 transition-all cursor-pointer disabled:cursor-not-allowed overflow-hidden"
            >
              {previewUrl ? (
                <video
                  src={previewUrl}
                  className="w-full h-[300px] object-contain bg-gray-900"
                  controls
                />
              ) : (
                <div className="h-[300px] flex flex-col items-center justify-center text-center px-6">
                  <div className="w-14 h-14 rounded-full bg-white text-blue-600 flex items-center justify-center shadow-sm border border-blue-100 mb-4">
                    <Clapperboard className="w-7 h-7" />
                  </div>
                  <p className="text-sm font-semibold text-gray-800 mb-1">选择视频</p>
                  <p className="text-xs text-gray-500">支持 MP4、AVI、MOV、MKV、WEBM 等视频格式</p>
                </div>
              )}
            </button>

            {/* 进度与统计 */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-3">
                <p className="text-xs text-blue-600 mb-1">已处理帧</p>
                <p className="text-xl font-bold text-blue-700">{processedFrames}/{totalFrames || '—'}</p>
              </div>
              <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-3">
                <p className="text-xs text-red-600 mb-1">告警数</p>
                <p className="text-xl font-bold text-red-700">{alertCount}</p>
              </div>
              <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-3">
                <p className="text-xs text-gray-500 mb-1">进度</p>
                <p className="text-xl font-bold text-gray-900">{Math.round(percent)}%</p>
              </div>
            </div>

            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${percent}%` }} />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBusy}
                className="inline-flex items-center px-4 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-600 text-sm font-medium hover:bg-blue-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                <Clapperboard className="w-4 h-4 mr-2" />
                选择视频
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={!selectedFile || isBusy}
                className="inline-flex items-center px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {phase === 'uploading' ? '上传中...' : phase === 'processing' ? `检测中 ${Math.round(percent)}%` : '上传视频检测'}
              </button>
              <button
                type="button"
                onClick={handleClear}
                disabled={!selectedFile && phase === 'idle'}
                className="inline-flex items-center px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <X className="w-4 h-4 mr-2" />
                清空
              </button>
            </div>

            <div className="text-xs text-gray-400">
              {selectedFile
                ? `${selectedFile.name} · ${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`
                : '尚未选择视频'}
            </div>
          </div>
        </FadeIn>

        <FadeIn className="xl:col-span-2" delay={0.06}>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 md:p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">视频检测结果</h3>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-medium ${phaseClass(phase)}`}>
                {phase === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> : phase === 'processing' || phase === 'uploading' ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5 mr-1" />}
                {phaseLabel(phase)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3">
                <p className="text-xs text-gray-500 mb-1">总体状态</p>
                <p className={`text-sm font-semibold ${result?.status === 'FALL_ALERT' ? 'text-red-600' : 'text-gray-800'}`}>
                  {result ? (result.status === 'FALL_ALERT' ? '存在告警' : '正常') : phaseLabel(phase)}
                </p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3">
                <p className="text-xs text-gray-500 mb-1">时长 / 速度</p>
                <p className="text-sm font-semibold text-gray-800">
                  {result ? `${result.duration_sec}s · ${result.average_fps} fps` : '-'}
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500">事件截图（标注）</p>
                {taskId && selectedEvent?.alert_image && <a href={getAlertFrameUrl(taskId, selectedEvent.alert_image)} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">查看大图</a>}
              </div>
              {timeline.length > 0 && <select aria-label="选择事件截图" value={timeline.indexOf(selectedEvent!)} onChange={e => setSelectedEvent(timeline[Number(e.target.value)] ?? null)} className="w-full border border-gray-200 rounded text-xs p-2 mb-3">
                {timeline.map((event, index) => <option key={event.event_id ?? event.frame} value={index}>事件 {index + 1} · {formatTimestamp(event.timestamp_sec)} · 帧 {event.frame}</option>)}
              </select>}
              <div className="aspect-video rounded-lg border border-gray-200 bg-gray-900 overflow-hidden flex items-center justify-center text-gray-400">
                {phase === 'completed' && taskId && selectedEvent?.alert_image && !screenshotError ? (
                  <img key={selectedEvent.alert_image} src={getAlertFrameUrl(taskId, selectedEvent.alert_image)} alt={`事件 ${timeline.indexOf(selectedEvent) + 1} 检测截图`} onError={() => setScreenshotError(true)} className="w-full h-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center">
                    <Video className="w-8 h-8 mb-2" />
                    <span className="text-xs">{screenshotError ? '截图加载失败，请重试或查看大图' : phase === 'completed' ? (selectedEvent ? '该事件暂无截图' : '暂无事件截图') : '检测完成后显示事件截图'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 告警时间线 */}
            <div>
              <p className="text-xs text-gray-500 mb-2">告警时间线 {timeline.length > 0 && `（${timeline.length}）`}</p>
              <div className="rounded-lg border border-gray-100 bg-gray-50 max-h-[260px] overflow-y-auto divide-y divide-gray-100">
                {timeline.length > 0 ? timeline.map((alert) => (
                  <div key={alert.event_id ?? alert.frame} className="flex items-center hover:bg-white transition-colors">
                    <button
                      type="button"
                      onClick={() => setSelectedEvent(alert)}
                      className="min-w-0 flex-1 flex items-center gap-3 px-3 py-2.5 text-left cursor-pointer"
                      title="查看事件截图"
                    >
                      {taskId && alert.alert_image && (
                        <img
                          src={getAlertFrameUrl(taskId, alert.alert_image)}
                          alt={`告警帧 ${alert.frame}`}
                          className="w-16 h-10 rounded object-cover bg-gray-200 border border-gray-100 shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-gray-700">{formatTimestamp(alert.timestamp_sec)}</span>
                          <span className="text-xs text-gray-400">帧 {alert.frame}</span>
                        </div>
                        <p className={`text-xs font-medium ${alert.status === 'FALL_ALERT' ? 'text-red-600' : 'text-orange-500'}`}>
                          {alertStatusLabel(alert.status)}
                          {typeof alert.confidence === 'number' ? ` · ${(alert.confidence * 100).toFixed(0)}%` : ''}
                        </p>
                      </div>
                    </button>
                    <span className={`shrink-0 mr-3 w-2 h-2 rounded-full ${alert.status === 'FALL_ALERT' ? 'bg-red-500' : 'bg-orange-400'}`} />
                  </div>
                )) : (
                  <div className="px-3 py-8 text-center text-xs text-gray-400">
                    {phase === 'completed' ? '本次检测未触发告警' : '检测完成后显示告警帧'}
                  </div>
                )}
              </div>
            </div>
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
