/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { fetchAlertsApi, getResultAssetUrl, type AlertItem } from './services/api';
import { getConfig } from './services/config';
import AdminLayout from './components/AdminLayout';
import MarketingLayout from './components/MarketingLayout';
// Admin Pages
import ImageDetection from './pages/ImageDetection';
import VideoDetection from './pages/VideoDetection';
import Realtime from './pages/Realtime';
import CameraDetail from './pages/CameraDetail';
import AlertHistory from './pages/AlertHistory';
import DetectionLogs from './pages/DetectionLogs';
import SampleManagement from './pages/SampleManagement';
import DeviceManagement from './pages/DeviceManagement';
import DataStatistics from './pages/DataStatistics';
import SettingsPage from './pages/Settings';
import UserManagement from './pages/UserManagement';
// Marketing Pages
import Home from './pages/Home';
import ProductFeatures from './pages/ProductFeatures';
import TechSolutions from './pages/TechSolutions';
import Scenarios from './pages/Scenarios';
import SuccessCases from './pages/SuccessCases';
import News from './pages/News';
import AboutUs from './pages/AboutUs';

export type View =
  | 'imageDetection' | 'videoDetection'
  | 'realtime' | 'camera_detail' | 'alert_history' | 'detection_logs'
  | 'sample_management' | 'device_management' | 'data_statistics'
  | 'settings' | 'user_management'
  | 'home' | 'product_features' | 'tech_solutions' | 'scenarios'
  | 'success_cases' | 'news' | 'about';

const adminViews = new Set(['imageDetection', 'videoDetection', 'realtime', 'camera_detail', 'alert_history', 'detection_logs',
  'sample_management', 'device_management', 'data_statistics', 'settings', 'user_management']);

function AlertFeedback({ openHistory }: { openHistory: () => void }) {
  const [active, setActive] = useState<AlertItem | null>(null);
  const [error, setError] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const sound = useRef(false);
  const acknowledged = useRef(new Set<string>());
  const cameraFeedbackAt = useRef(0);
  const queue = useRef<AlertItem[]>([]);
  const current = useRef<AlertItem | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let initialized = false;
    let newestId: string | undefined;
    const poll = async () => {
      try {
        const incoming: AlertItem[] = [];
        let page = 1;
        let reachedKnown = false;
        do {
          const result = await fetchAlertsApi({ dateScope: 'all', page, pageSize: 100 }, controller.signal);
          for (const item of result.data) {
            if (item.id === newestId) { reachedKnown = true; break; }
            incoming.push(item);
          }
          if (!initialized || reachedKnown || page >= result.totalPages) break;
          page += 1;
        } while (!controller.signal.aborted);
        if (controller.signal.aborted) return;
        setError('');
        if (incoming.length) newestId = incoming[0].id;
        if (initialized && getConfig().notifyFall) {
          const fresh = incoming.filter(item => item.status === 'pending' && !acknowledged.current.has(item.id));
          fresh.forEach(item => acknowledged.current.add(item.id));
          const now = Date.now();
          const notifications = fresh.reverse().filter(item => {
            if (!item.source.includes('camera-capture-')) return true;
            if (now - cameraFeedbackAt.current < 10000 || current.current?.source.includes('camera-capture-') || queue.current.some(queued => queued.source.includes('camera-capture-'))) return false;
            cameraFeedbackAt.current = now;
            return true;
          });
          queue.current.push(...notifications);
          if (!current.current && queue.current.length) {
            current.current = queue.current.shift()!;
            setActive(current.current);
          }
          if (notifications.length && sound.current && audio.current?.state === 'running') {
            const context = audio.current;
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            oscillator.frequency.value = 880;
            gain.gain.setValueAtTime(0.15, context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.7);
            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.start();
            oscillator.stop(context.currentTime + 0.7);
          }
        }
        initialized = true;
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : '告警监听失败');
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(poll, 2000);
      }
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
      void audio.current?.close();
      audio.current = null;
    };
  }, []);

  const toggleSound = async () => {
    if (sound.current) {
      sound.current = false;
      setSoundEnabled(false);
      return;
    }
    try {
      audio.current ??= new AudioContext();
      await audio.current.resume();
      sound.current = audio.current.state === 'running';
      setSoundEnabled(sound.current);
      if (!sound.current) setError('浏览器未允许声音，请重新点击开启');
    } catch {
      setError('浏览器未允许声音，请检查权限');
    }
  };
  const dismiss = () => {
    current.current = queue.current.shift() || null;
    setActive(current.current);
  };

  return <>
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
      {error && <p role="status" className="max-w-sm rounded bg-red-50 p-2 text-xs text-red-700 shadow">{error}</p>}
      <button onClick={toggleSound} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-blue-700 shadow">
        {soundEnabled ? '告警声音已开启（点击关闭）' : '开启告警声音'}
      </button>
    </div>
    {active && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="新告警反馈">
      <div className="w-full max-w-lg space-y-4 rounded-xl border-t-4 border-red-500 bg-white p-6 shadow-xl">
        <h2 className="text-xl font-bold text-red-600">{active.rawStatus === 'POSE_WARNING' ? '检测到姿态风险' : '检测到跌倒告警'}</h2>
        <p className="break-all text-sm text-gray-700">来源：{active.source}</p>
        <p className="text-sm text-gray-500">{active.timestamp} · 风险：{active.riskLevel}</p>
        {active.image && <img src={getResultAssetUrl(active.taskId, active.image)} alt="真实告警截图" className="max-h-64 w-full rounded bg-gray-900 object-contain" />}
        <p className="text-xs text-gray-500">关闭提示不会将事件标记为已处理，请到告警中心确认或标记误报。</p>
        <div className="flex justify-end gap-3">
          <button onClick={dismiss} className="rounded border px-4 py-2 text-sm">关闭提示{queue.current.length ? `（另有${queue.current.length}条）` : ''}</button>
          <button onClick={() => { queue.current = []; current.current = null; setActive(null); openHistory(); }} className="rounded bg-red-600 px-4 py-2 text-sm text-white">进入告警中心</button>
        </div>
      </div>
    </div>}
  </>;
}

export default function App() {
  const [currentView, setCurrentView] = useState<View>('home');

  if (adminViews.has(currentView)) {
    return (
      <AdminLayout view={currentView} setView={setCurrentView}>
        <AlertFeedback openHistory={() => setCurrentView('alert_history')} />
        {currentView === 'imageDetection' && <ImageDetection />}
        {currentView === 'videoDetection' && <VideoDetection />}
        {currentView === 'realtime' && <Realtime setView={setCurrentView} />}
        {currentView === 'camera_detail' && <CameraDetail />}
        {currentView === 'alert_history' && <AlertHistory />}
        {currentView === 'detection_logs' && <DetectionLogs />}
        {currentView === 'sample_management' && <SampleManagement />}
        {currentView === 'device_management' && <DeviceManagement />}
        {currentView === 'data_statistics' && <DataStatistics />}
        {currentView === 'settings' && <SettingsPage />}
        {currentView === 'user_management' && <UserManagement />}
      </AdminLayout>
    );
  }

  return (
    <MarketingLayout view={currentView} setView={setCurrentView}>
      {currentView === 'home' && <Home setView={setCurrentView} />}
      {currentView === 'product_features' && <ProductFeatures setView={setCurrentView} />}
      {currentView === 'tech_solutions' && <TechSolutions />}
      {currentView === 'scenarios' && <Scenarios />}
      {currentView === 'success_cases' && <SuccessCases setView={setCurrentView} />}
      {currentView === 'news' && <News setView={setCurrentView} />}
      {currentView === 'about' && <AboutUs setView={setCurrentView} />}
    </MarketingLayout>
  );
}
