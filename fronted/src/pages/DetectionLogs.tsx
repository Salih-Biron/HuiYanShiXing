import React, { useState, useEffect, useCallback } from 'react';
import {
  Video, FileImage, ShieldAlert, ShieldCheck, CheckCircle, ExternalLink,
  Loader2, Search
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { fetchDetectionLogsApi, fetchStatsSummary, fetchAlertTrend, getResultAssetUrl, type DetectionLogItem, type StatsSummary, type PaginatedApiResult, type DetectionLogFilter } from '../services/api';
import { FadeIn, StaggerContainer, StaggerItem } from '../components/AnimateIn';

type LogRow = DetectionLogItem;
const statusLabels: Record<LogRow['status'], string> = {
  alert: '告警', normal: '正常', partial_false_positive: '部分误报', false_positive: '误报',
};
const riskLabels: Record<LogRow['riskLevel'], string> = {
  high: '高风险', medium: '中风险', low: '低风险', none: '风险已排除',
};

export default function DetectionLogs() {
  const [logData, setLogData] = useState<PaginatedApiResult<LogRow> | null>(null);
  const [selectedLog, setSelectedLog] = useState<LogRow | null>(null);
  const [statsSummary, setStatsSummary] = useState<StatsSummary | null>(null);
  const [barData, setBarData] = useState<{ day: string; count: number }[]>([]);
  const [error, setError] = useState('');
  const [statsError, setStatsError] = useState('');
  const [trendError, setTrendError] = useState('');
  const [trendLoading, setTrendLoading] = useState(true);
  const [eventIndex, setEventIndex] = useState(0);
  const [mediaError, setMediaError] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<DetectionLogFilter>({ dateScope: 'today', page: 1, pageSize: 5 });
  const [searchInput, setSearchInput] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);
  const isHistory = filter.dateScope === 'history';
  const loadLogs = useCallback(() => setReloadVersion(prev => prev + 1), []);

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' });
    let currentDay = formatter.format(new Date());
    const checkDate = () => {
      const nextDay = formatter.format(new Date());
      if (nextDay !== currentDay) {
        currentDay = nextDay;
        setFilter(prev => ({ ...prev, page: 1 }));
        loadLogs();
      }
    };
    const timer = window.setInterval(checkDate, 30000);
    const refreshOnFocus = () => {
      checkDate();
      loadLogs();
    };
    window.addEventListener('focus', refreshOnFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [loadLogs]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setLogData(null);
    setSelectedLog(null);
    setEventIndex(0);

    fetchDetectionLogsApi(filter, controller.signal)
      .then(result => {
        if (controller.signal.aborted) return;
        setLogData(result);
        setSelectedLog(result.data[0] || null);
      })
      .catch(err => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : '检测日志加载失败');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [filter, reloadVersion]);
  useEffect(() => {
    let active = true;
    setStatsError('');
    setTrendError('');
    setTrendLoading(true);
    fetchStatsSummary()
      .then(result => { if (active) setStatsSummary(result); })
      .catch(err => {
        if (!active) return;
        setStatsSummary(null);
        setStatsError(err instanceof Error ? err.message : '统计加载失败');
      });
    fetchAlertTrend()
      .then(result => { if (active) setBarData(result); })
      .catch(err => { if (active) setTrendError(err instanceof Error ? err.message : '趋势加载失败'); })
      .finally(() => { if (active) setTrendLoading(false); });
    return () => { active = false; };
  }, [reloadVersion]);
  useEffect(() => { setEventIndex(0); }, [selectedLog?.id]);

  const handleSearch = () => setFilter(prev => ({ ...prev, search: searchInput, page: 1 }));

  const todayAlerts = statsSummary?.todayAlerts ?? '—';
  const todayFrames = statsSummary?.todayFrames ?? '—';
  const todayImages = statsSummary?.todayImages ?? '—';
  const accuracy = statsSummary?.averageAccuracy == null ? '—' : `${statsSummary.averageAccuracy}%`;
  const processed = statsSummary?.processedEvents ?? '—';
  const selectedEvent = selectedLog?.alertTimeline?.[eventIndex];
  const resultAsset = (path?: string) => path && selectedLog?.taskId ? getResultAssetUrl(selectedLog.taskId, path) : '';
  const previewImage = resultAsset(selectedLog?.sourceType === 'video'
    ? selectedEvent?.alert_image
    : selectedLog?.resultImage || selectedLog?.alertImage);

  useEffect(() => {
    setMediaError('');
  }, [previewImage]);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
      {/* KPI Cards */}
      <StaggerContainer staggerDelay={0.1} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-6">
        <StaggerItem>
          <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100 flex items-center">
            <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center mr-4 shrink-0"><Video className="w-6 h-6 text-blue-600" /></div>
            <div>
              <p className="text-sm text-gray-500 font-medium mb-1">今日检测视频帧数</p>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-bold text-gray-900">{todayFrames}</span>

              </div>
            </div>
          </div>
        </StaggerItem>
        <StaggerItem>
          <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100 flex items-center">
            <div className="h-12 w-12 rounded-full bg-cyan-50 flex items-center justify-center mr-4 shrink-0"><FileImage className="w-6 h-6 text-cyan-600" /></div>
            <div>
              <p className="text-sm text-gray-500 font-medium mb-1">今日图片检测数</p>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-bold text-gray-900">{todayImages}</span>

              </div>
            </div>
          </div>
        </StaggerItem>
        <StaggerItem>
          <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100 flex items-center">
            <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center mr-4 shrink-0"><ShieldAlert className="w-5 h-5 text-red-500" /></div>
            <div>
              <p className="text-sm text-gray-500 font-medium mb-1">告警次数</p>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-bold text-gray-900">{todayAlerts}</span>

              </div>
            </div>
          </div>
        </StaggerItem>
        <StaggerItem>
          <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100 flex items-center">
            <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center mr-4 shrink-0"><ShieldCheck className="w-6 h-6 text-blue-600" /></div>
            <div>
              <p className="text-sm text-gray-500 font-medium mb-1">平均准确率</p>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-bold text-gray-900">{accuracy}</span>
              </div>
            </div>
          </div>
        </StaggerItem>
        <StaggerItem>
          <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100 flex items-center">
            <div className="h-12 w-12 rounded-full bg-green-50 flex items-center justify-center mr-4 shrink-0"><CheckCircle className="w-5 h-5 text-green-600" /></div>
            <div>
              <p className="text-sm text-gray-500 font-medium mb-1">已处理事件数</p>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-bold text-gray-900">{processed}</span>

              </div>
            </div>
          </div>
        </StaggerItem>
      </StaggerContainer>
      {statsError && <div role="alert" className="text-sm text-red-600">统计加载失败：{statsError}</div>}

      {/* Filters */}
      <FadeIn>
        <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text" placeholder="搜索来源/检测..." value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none w-48"
            />
          </div>
          <select value={filter.status || 'all'} onChange={e => setFilter(prev => ({ ...prev, status: e.target.value, page: 1 }))} className="border border-gray-200 rounded-md text-sm py-2 px-3 text-gray-600 bg-gray-50 outline-none cursor-pointer">
            <option value="all">全部状态</option>
            <option value="alert">告警</option>
            <option value="normal">正常</option>
            <option value="partial_false_positive">部分误报</option>
            <option value="false_positive">误报</option>
          </select>
          <select value={filter.riskLevel || 'all'} onChange={e => setFilter(prev => ({ ...prev, riskLevel: e.target.value, page: 1 }))} className="border border-gray-200 rounded-md text-sm py-2 px-3 text-gray-600 bg-gray-50 outline-none cursor-pointer">
            <option value="all">全部风险</option>
            <option value="high">高风险</option>
            <option value="medium">中风险</option>
            <option value="low">低风险</option>
            <option value="none">风险已排除</option>
          </select>
          <button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium cursor-pointer">查询</button>
          <button type="button" onClick={loadLogs} disabled={loading} className="border border-gray-200 px-4 py-2 rounded-md text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">刷新</button>
          <button
            type="button"
            onClick={() => setFilter(prev => ({ ...prev, dateScope: isHistory ? 'today' : 'history', page: 1 }))}
            className="border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-md text-sm font-medium cursor-pointer sm:ml-auto"
          >
            {isHistory ? '返回今日检测日志' : '历史检测日志'}
          </button>
        </div>
      </FadeIn>

      {/* Two columns layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:h-[450px]">
        {/* Left col - Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 flex flex-col lg:col-span-2 overflow-hidden h-full">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <h2 className="text-base font-semibold text-gray-800">{isHistory ? '历史检测日志' : '今日检测日志'}</h2>
            {loading && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase sticky top-0">
                <tr>
                  <th className="px-5 py-3 font-medium">Time</th>
                  <th className="px-5 py-3 font-medium">Source</th>
                  <th className="px-5 py-3 font-medium">Frame</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Risk</th>
                  <th className="px-5 py-3 font-medium">Detections</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 divide-y divide-gray-100">
                {error && <tr><td colSpan={6} role="alert" className="px-5 py-6 text-center text-red-600">{error}<button onClick={loadLogs} className="ml-2 underline">重试</button></td></tr>}
                {!loading && !error && !logData?.data.length && <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">{isHistory ? '暂无符合条件的历史检测日志' : '今日暂无符合条件的检测日志'}</td></tr>}
                {logData?.data.map(log => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className={`cursor-pointer transition-colors ${selectedLog?.id === log.id ? 'bg-blue-50' : (log.status === 'alert' || log.status === 'partial_false_positive') ? 'bg-blue-50/40 hover:bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-5 py-3 font-mono text-xs">{log.timestamp}</td>
                    <td className="px-5 py-3 text-gray-800 font-medium">{log.source}</td>
                    <td className="px-5 py-3">{log.frame}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2.5 py-1 text-xs rounded font-medium border ${(log.status === 'alert' || log.status === 'partial_false_positive') ? 'bg-red-100 text-red-600 border-red-200' : 'bg-green-50 text-green-600 border-green-200'}`}>
                        {statusLabels[log.status]}
                      </span>
                    </td>
                    <td className={`px-5 py-3 font-medium ${log.riskLevel === 'high' ? 'text-red-600' : log.riskLevel === 'medium' ? 'text-orange-500' : 'text-green-600'}`}>{riskLabels[log.riskLevel]}</td>
                    <td className="px-5 py-3 text-gray-500">{log.detections}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {logData && logData.totalPages > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-sm bg-gray-50/50 shrink-0">
              <span className="text-gray-500">共 {logData.total} 件</span>
              <div className="flex items-center space-x-1">
                <button disabled={logData.page <= 1} onClick={() => setFilter(prev => ({ ...prev, page: prev.page! - 1 }))} className="px-2.5 py-1 border border-gray-200 bg-white rounded text-gray-400 hover:bg-gray-50 disabled:opacity-40 cursor-pointer">«</button>
                {Array.from({ length: logData.totalPages }, (_, i) => (
                  <button key={i} onClick={() => setFilter(prev => ({ ...prev, page: i + 1 }))} className={`px-3 py-1 rounded font-medium cursor-pointer ${logData.page === i + 1 ? 'bg-blue-600 text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>{i + 1}</button>
                ))}
                <button disabled={logData.page >= logData.totalPages} onClick={() => setFilter(prev => ({ ...prev, page: prev.page! + 1 }))} className="px-2.5 py-1 border border-gray-200 bg-white rounded text-gray-600 hover:bg-gray-50 disabled:opacity-40 cursor-pointer">»</button>
              </div>
            </div>
          )}
        </div>

        {/* Right col - Preview & Chart */}
        <div className="flex flex-col gap-6 h-full">
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 flex flex-col flex-1 pb-4">
            <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-sm font-semibold text-gray-800">检测详情</h2>
              {previewImage && <a href={previewImage} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-xs hover:underline flex items-center font-medium">查看大图 <ExternalLink className="w-3 h-3 ml-1" /></a>}
            </div>
            <div className="p-4 flex flex-col flex-1">
              {selectedLog ? (
                <>
                  {!!selectedLog.alertTimeline?.length && (
                    <select aria-label="选择事件截图" value={eventIndex} onChange={e => setEventIndex(Number(e.target.value))} className="border border-gray-200 rounded text-xs p-2 mb-3">
                      {selectedLog.alertTimeline.map((event, index) => <option key={event.event_id || index} value={index}>事件 {index + 1} · {event.timestamp_sec.toFixed(1)} 秒 · 帧 {event.frame}{event.excluded ? '（误报，已排除）' : event.reviewStatus === 'resolved' ? '（已确认）' : ''}</option>)}
                    </select>
                  )}
                  <div className="relative rounded overflow-hidden bg-gray-900 border border-gray-200 aspect-video mb-4 shadow-sm">
                    {previewImage && !mediaError ? <img key={previewImage} src={previewImage} alt={selectedEvent ? `事件 ${eventIndex + 1} 检测截图` : '检测结果图'} onError={() => setMediaError('截图加载失败，请重试或查看大图。')} className="w-full h-full object-contain" /> : <div className="h-full flex items-center justify-center text-gray-400 text-sm">{mediaError || (selectedLog.sourceType === 'video' ? (selectedEvent ? '该事件暂无截图' : '暂无事件截图') : '暂无检测结果图')}</div>}
                  </div>
                  <div className="grid grid-cols-2 gap-y-3 text-xs mt-auto">
                    <div><span className="text-gray-400 block mb-0.5">时间</span><span className="text-gray-800 font-mono">{selectedLog.timestamp}</span></div>
                    <div><span className="text-gray-400 block mb-0.5">状态</span><span className={`font-bold ${(selectedLog.status === 'alert' || selectedLog.status === 'partial_false_positive') ? 'text-red-600' : 'text-green-600'}`}>{statusLabels[selectedLog.status]}</span></div>
                    <div><span className="text-gray-400 block mb-0.5">来源</span><span className="text-gray-800 font-medium">{selectedLog.source}</span></div>
                    <div><span className="text-gray-400 block mb-0.5">风险等级</span><span className={`font-bold uppercase ${selectedLog.riskLevel === 'high' ? 'text-red-500' : selectedLog.riskLevel === 'medium' ? 'text-orange-500' : 'text-green-500'}`}>{riskLabels[selectedLog.riskLevel]}</span></div>
                    <div><span className="text-gray-400 block mb-0.5">有效告警 / 原始告警</span><span>{selectedLog.alertCount ?? 0} / {selectedLog.originalAlertCount ?? selectedLog.alertCount ?? 0}</span></div>
                    <div><span className="text-gray-400 block mb-0.5">已排除误报</span><span>{selectedLog.falsePositiveCount ?? 0}</span></div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                  选择一条日志查看
                </div>
              )}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 flex flex-col flex-1 shrink-0 h-[240px]">
            <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-sm font-semibold text-gray-800">告警趋势 (近7天)</h2>
            </div>
            <div className="flex-1 w-full p-4 pt-6 pb-2">
              {trendLoading ? <p className="text-sm text-gray-400">趋势加载中...</p> : trendError ? <p role="alert" className="text-sm text-red-600">{trendError}</p> : !barData.length ? <p className="text-sm text-gray-400">暂无趋势数据</p> : <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }} barCategoryGap="20%">
                  <defs>
                    <linearGradient id="logBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#93c5fd" stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(59, 130, 246, 0.05)', radius: 8 }}
                    contentStyle={{ fontSize: 12, borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: '8px 12px' }}
                    itemStyle={{ color: '#374151' }}
                  />
                  <Bar dataKey="count" name="告警数" fill="url(#logBarGradient)" radius={[6, 6, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
