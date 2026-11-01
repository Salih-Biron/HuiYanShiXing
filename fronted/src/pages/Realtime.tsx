import React, { useState, useEffect } from 'react';
import { View } from '../App';
import {
  RefreshCcw, Grid, Maximize, Square,
  AlertTriangle, Flame, Users, HardHat,
  TrendingUp, Activity, Monitor, Target, CheckCircle2,
  ChevronRight, BellRing, LayoutGrid
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchCameras, fetchStats, fetchTrend, fetchAlerts, type Camera, type StatsData, type TrendPoint, type Alert } from '../services/data';
import { FadeIn, StaggerContainer, StaggerItem } from '../components/AnimateIn';

export default function Realtime({ setView }: { setView: (v: View) => void }) {
  const [layout, setLayout] = useState<1 | 4 | 6>(6);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');

  // Data state
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    fetchCameras().then(setCameras);
    fetchStats().then(setStats);
    fetchTrend().then(setTrendData);
    fetchAlerts({ pageSize: 4 }).then(r => setRecentAlerts(r.data));
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const [c, s, t, a] = await Promise.all([
      fetchCameras(), fetchStats(), fetchTrend(), fetchAlerts({ pageSize: 4 })
    ]);
    setCameras(c); setStats(s); setTrendData(t); setRecentAlerts(a.data);
    setIsRefreshing(false);
  };

  const getGridClass = () => {
    if (layout === 1) return "grid-cols-1";
    if (layout === 4) return "grid-cols-1 md:grid-cols-2 lg:grid-cols-2";
    return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
  };

  const visibleCameras = activeFilter === 'alert'
    ? cameras.filter(c => c.status === 'alert')
    : layout === 1 ? cameras.slice(0, 1)
    : layout === 4 ? cameras.slice(0, 4)
    : cameras;

  const alertTypeIcons: Record<string, React.ReactNode> = {
    fall: <AlertTriangle className="w-4 h-4" />,
    smoke: <Flame className="w-4 h-4" />,
    no_helmet: <HardHat className="w-4 h-4" />,
    crowd: <Users className="w-4 h-4" />,
  };
  const alertTypeLabels: Record<string, string> = {
    fall: '人员跌倒告警', smoke: '烟雾检测疑似', no_helmet: '未佩戴安全帽', crowd: '人群密集聚集',
  };
  const riskColorMap: Record<string, string> = {
    high: 'red', medium: 'orange', low: 'green',
  };
  const statusLabelMap: Record<string, string> = {
    pending: '待处理', processing: '待跟进', resolved: '已处理', false_positive: '误报',
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Toolbar */}
      <FadeIn>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-3 rounded-lg shadow-sm border border-gray-100">
          <div className="flex flex-wrap gap-2 sm:gap-3 items-center w-full sm:w-auto">
            <select
              value={activeFilter}
              onChange={e => setActiveFilter(e.target.value)}
              className="block w-32 rounded-md border-gray-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:text-sm text-gray-600 bg-gray-50 py-2 px-2 cursor-pointer"
            >
              <option value="all">全部状态</option>
              <option value="alert">告警优先</option>
            </select>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <RefreshCcw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} /> 刷新
            </button>
          </div>
          <div className="flex items-center space-x-2 text-gray-500 bg-gray-50 p-1 rounded-md border border-gray-200">
            <span className="text-sm px-2 font-medium">{layout}画面</span>
            {([1, 4, 6] as const).map(n => (
              <button key={n} onClick={() => setLayout(n)} className={`p-1.5 rounded transition-all cursor-pointer ${layout === n ? 'bg-white shadow-sm text-blue-600' : 'hover:bg-white hover:text-gray-900'}`}>
                {n === 1 ? <Square className="w-4 h-4" /> : n === 4 ? <LayoutGrid className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
              </button>
            ))}
            <div className="mx-1 w-px h-4 bg-gray-300"></div>
            <button className="p-1.5 rounded hover:bg-white hover:text-gray-900 transition-all text-gray-400 cursor-pointer"><Maximize className="w-4 h-4" /></button>
          </div>
        </div>
      </FadeIn>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3">
          <StaggerContainer staggerDelay={0.08} className={`grid gap-3 ${getGridClass()}`}>
            {visibleCameras.map(cam => (
              <StaggerItem key={cam.id}>
                <div
                  className={`relative bg-gray-900 rounded-lg overflow-hidden shadow-sm group cursor-pointer transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-md aspect-video ${cam.status === 'alert' ? 'border-2 border-red-500 shadow-red-500/20' : 'border border-gray-700'}`}
                  onClick={() => setView('camera_detail')}
                >
                  <img src={cam.image} alt={cam.name} className={`w-full h-full object-cover transition-opacity duration-500 ${cam.status === 'alert' ? 'opacity-90' : 'opacity-70 group-hover:opacity-100'}`} />
                  {cam.status === 'alert' && <div className="absolute inset-0 bg-red-500/10 pointer-events-none animate-pulse"></div>}
                  <div className="absolute top-0 left-0 right-0 p-2 flex justify-between items-center text-xs text-white font-mono z-10 bg-gradient-to-b from-black/60 to-transparent">
                    <div className="flex items-center drop-shadow-md">
                      <span className={`w-2 h-2 rounded-full mr-2 ${cam.status === 'alert' ? 'bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]' : 'bg-green-500'}`}></span>
                      {cam.id} {cam.name}
                    </div>
                    {cam.timestamp && <div className="drop-shadow-md">{cam.timestamp}</div>}
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>

        {/* Alert Sidebar */}
        <div className="xl:col-span-1 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col relative overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80 rounded-t-lg z-10">
            <h2 className="font-semibold text-gray-800 flex items-center">
              <AlertTriangle className="text-red-500 mr-2 w-5 h-5 animate-pulse" /> 实时告警
            </h2>
            <button onClick={() => setView('alert_history')} className="text-sm text-blue-600 hover:text-blue-800 flex items-center font-medium cursor-pointer">
              查看更多 <ChevronRight className="w-4 h-4 ml-0.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 z-10">
            {recentAlerts.map(alert => {
              const color = riskColorMap[alert.riskLevel];
              return (
                <div key={alert.id} className={`bg-${color === 'red' ? 'red' : color === 'orange' ? 'orange' : 'green'}-50/60 border border-${color === 'red' ? 'red' : color === 'orange' ? 'orange' : 'green'}-100 p-3.5 rounded-lg flex items-start gap-3 hover:bg-${color === 'red' ? 'red' : color === 'orange' ? 'orange' : 'green'}-50 transition-all cursor-pointer group shadow-sm`}
                  onClick={() => setView('alert_history')}
                >
                  <div className={`w-8 h-8 rounded-full bg-${color}-100 text-${color}-600 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform`}>
                    {alertTypeIcons[alert.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs text-gray-500 font-mono">{alert.timestamp.split(' ')[1]}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded text-${color}-700 bg-${color}-100 border border-${color}-200`}>{statusLabelMap[alert.status]}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-800 mb-0.5 truncate group-hover:text-red-700 transition-colors">{alert.cameraId} {alert.cameraName}</h3>
                    <p className={`text-xs text-${color}-600 font-medium`}>{alertTypeLabels[alert.type]}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="p-3 border-t border-gray-100 text-center bg-gray-50/80 rounded-b-lg z-10">
            <button onClick={() => setView('alert_history')} className="text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 font-medium w-full py-2 rounded-md transition-colors cursor-pointer">
              进入告警中心排查
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-semibold text-gray-800 flex items-center"><Activity className="w-4 h-4 mr-2 text-blue-500" /> 今日告警趋势</h2>
          </div>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="realtimeLineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: '8px 12px' }}
                  cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ strokeWidth: 2, r: 3.5, fill: '#fff', stroke: '#3b82f6' }}
                  activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <StaggerContainer staggerDelay={0.1} className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
          <StaggerItem>
            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 flex flex-col justify-center hover:shadow-md transition-shadow cursor-default">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-3"><BellRing className="w-5 h-5" /></div>
              <p className="text-sm text-gray-500 font-medium mb-1">今日告警数</p>
              <h3 className="text-3xl font-bold text-gray-800">{stats?.todayAlerts ?? '—'}</h3>
              <div className="mt-2 text-xs flex items-center text-red-500 font-medium">较昨日 <TrendingUp className="w-3 h-3 mx-1" /> {stats?.alertsTrend ?? 0}%</div>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 flex flex-col justify-center hover:shadow-md transition-shadow cursor-default">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mb-3"><Monitor className="w-5 h-5" /></div>
              <p className="text-sm text-gray-500 font-medium mb-1">在线设备数</p>
              <h3 className="text-3xl font-bold text-gray-800">{stats?.onlineDevices ?? '—'}</h3>
              <div className="mt-2 text-xs flex items-center text-emerald-600 font-medium">在线率 {stats?.devicesOnlineRate ?? 0}%</div>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 flex flex-col justify-center hover:shadow-md transition-shadow cursor-default">
              <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 mb-3"><Target className="w-5 h-5" /></div>
              <p className="text-sm text-gray-500 font-medium mb-1">识别准确率</p>
              <h3 className="text-3xl font-bold text-gray-800">{stats?.accuracy ?? '—'}<span className="text-lg font-medium text-gray-500 ml-0.5">%</span></h3>
              <div className="mt-2 text-xs flex items-center text-emerald-600 font-medium">较昨日 <TrendingUp className="w-3 h-3 mx-1" /> 0.6%</div>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 flex flex-col justify-center hover:shadow-md transition-shadow cursor-default">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 mb-3"><CheckCircle2 className="w-5 h-5" /></div>
              <p className="text-sm text-gray-500 font-medium mb-1">处理完成率</p>
              <h3 className="text-3xl font-bold text-gray-800">{stats?.processedRate ?? '—'}<span className="text-lg font-medium text-gray-500 ml-0.5">%</span></h3>
              <div className="mt-2 text-xs flex items-center text-emerald-600 font-medium">较昨日 <TrendingUp className="w-3 h-3 mx-1" /> 4.1%</div>
            </div>
          </StaggerItem>
        </StaggerContainer>
      </div>

    </div>
  );
}
