import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronDown, Search, Download,
  ChevronLeft, ChevronRight, Check, X,
  Loader2, CheckCircle2, AlertTriangle
} from 'lucide-react';
import { fetchAlertsApi, updateAlertStatusApi, getResultAssetUrl, type AlertItem, type PaginatedApiResult, type AlertFilter } from '../services/api';
import { FadeIn } from '../components/AnimateIn';

const eventLabels: Record<string, string> = { FALL_ALERT: '跌倒告警', POSE_WARNING: '姿态预警', NORMAL: '正常' };
const eventLabel = (status: string) => eventLabels[status] || status;
const confidenceLabel = (value: number | null) => value == null ? '—' : `${(value * 100).toFixed(1)}%`;
const assetUrl = (alert: AlertItem, path: string) => path ? getResultAssetUrl(alert.taskId, path) : '';
const riskColors: Record<string, string> = {
  high: 'text-red-600', medium: 'text-orange-500', low: 'text-green-600',
};
const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: '待处理', color: 'text-red-600', bg: 'bg-red-100/50' },
  processing: { label: '处理中', color: 'text-orange-600', bg: 'bg-orange-100/50' },
  resolved: { label: '已处理', color: 'text-green-600', bg: 'bg-green-100/50' },
  false_positive: { label: '误报', color: 'text-gray-500', bg: 'bg-gray-100/50' },
};

const eventName = (alert: AlertItem) => {
  const match = alert.eventId?.match(/^fall_(\d+)$/);
  return match ? `事件 ${Number(match[1])}` : alert.eventId || '事件编号未知';
};
const eventTime = (seconds?: number) => seconds != null && Number.isFinite(seconds) ? `${seconds.toFixed(2)} 秒` : '未知';

function AlertScreenshot({ alert, thumbnail = false }: { alert: AlertItem; thumbnail?: boolean }) {
  const src = assetUrl(alert, alert.image);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const available = Boolean(src) && failedSrc !== src;
  const className = thumbnail
    ? 'w-24 h-16 object-cover rounded shadow-sm border border-gray-200 shrink-0 mr-3'
    : 'w-full h-full object-contain';
  return available ? (
    <img src={src} alt={alert.sourceType === 'video' ? `${eventName(alert)}首次触发截图` : '告警截图'} className={className} onError={() => setFailedSrc(src)} />
  ) : (
    <div role="status" className={`${thumbnail ? 'w-24 h-16 rounded shrink-0 mr-3 text-xs' : 'w-full h-full text-sm'} bg-gray-100 text-gray-500 flex items-center justify-center`}>
      {src ? '截图加载失败' : thumbnail ? '暂无截图' : '该事件暂无截图'}
    </div>
  );
}

export default function AlertHistory() {
  const [alertData, setAlertData] = useState<PaginatedApiResult<AlertItem> | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [filter, setFilter] = useState<AlertFilter>({ dateScope: 'today', page: 1, pageSize: 5 });
  const [searchInput, setSearchInput] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [reloadVersion, setReloadVersion] = useState(0);
  const reviewSelection = useRef<{ id: string; index: number; filter: AlertFilter } | null>(null);
  const isHistory = filter.dateScope === 'history';
  const loadAlerts = useCallback(() => setReloadVersion(prev => prev + 1), []);

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' });
    let currentDay = formatter.format(new Date());
    const checkDate = () => {
      const nextDay = formatter.format(new Date());
      if (nextDay !== currentDay) {
        currentDay = nextDay;
        setFilter(prev => ({ ...prev, page: 1 }));
        loadAlerts();
      }
    };
    const timer = window.setInterval(checkDate, 30000);
    window.addEventListener('focus', checkDate);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', checkDate);
    };
  }, [loadAlerts]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const selection = reviewSelection.current?.filter === filter ? reviewSelection.current : null;
    if (!selection) {
      reviewSelection.current = null;
      setAlertData(null);
      setSelectedAlert(null);
    }
    fetchAlertsApi(filter, controller.signal)
      .then(result => {
        if (controller.signal.aborted) return;
        if (result.data.length === 0 && result.total > 0 && (filter.page || 1) > result.totalPages) {
          setFilter(prev => ({ ...prev, page: Math.max(1, result.totalPages) }));
          return;
        }
        const retained = selection ? result.data.find(item => item.id === selection.id) : undefined;
        setAlertData(result);
        setSelectedAlert(retained || result.data[Math.min(selection?.index || 0, result.data.length - 1)] || null);
        if (selection && !retained) {
          setToast({ message: result.data.length ? '该告警已不在当前筛选结果中，已选择下一条可用记录' : '该告警已不在当前筛选结果中，暂无其他记录', type: 'success' });
          setTimeout(() => setToast(null), 3500);
        }
        reviewSelection.current = null;
      })
      .catch(err => {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : '告警加载失败');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [filter, reloadVersion]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleSearch = () => {
    setFilter(prev => ({ ...prev, search: searchInput, page: 1 }));
  };

  const handleReset = () => {
    setSearchInput('');
    setFilter(prev => ({ dateScope: prev.dateScope, page: 1, pageSize: 5 }));
  };

  const handleStatusChange = async (status: AlertItem['status']) => {
    if (!selectedAlert || loading || updating) return;
    const id = selectedAlert.id;
    setUpdating(true);
    try {
      const updated = await updateAlertStatusApi(id, status);
      setSelectedAlert(prev => prev?.id === id ? updated : prev);
      setAlertData(prev => prev ? { ...prev, data: prev.data.map(item => item.id === id ? updated : item) } : prev);
      reviewSelection.current = { id, index: Math.max(0, alertData?.data.findIndex(item => item.id === id) ?? 0), filter };
      showToast(filter.status && filter.status !== 'all' && filter.status !== status ? '处置已保存，该告警将移出当前筛选结果' : '处置状态已保存', 'success');
      loadAlerts();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '处置保存失败，请重试', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleExportCSV = () => {
    if (!alertData) return;
    const headers = ['ID', '来源', '类型', '风险等级', '置信度', '状态', '时间', '任务ID'];
    const rows = alertData.data.map(a => [a.id, a.source, eventLabel(a.rawStatus), a.riskLevel, confidenceLabel(a.confidence), statusConfig[a.status].label, a.timestamp, a.taskId]);
    const csv = [headers, ...rows].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `alerts_${Date.now()}.csv`; link.click();
    URL.revokeObjectURL(url);
    showToast('CSV导出成功', 'success');
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}

      {/* Filters */}
      <FadeIn>
        <section className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <select
                value={filter.sourceType || 'all'}
                onChange={e => setFilter(prev => ({ ...prev, sourceType: e.target.value === 'all' ? undefined : e.target.value as 'image' | 'video', page: 1 }))}
                className="appearance-none w-36 pl-3 pr-8 py-2 bg-white border border-gray-200 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
              >
                <option value="all">全部来源类型</option>
                <option value="image">图片</option>
                <option value="video">视频</option>
              </select>
              <ChevronDown className="w-3 h-3 absolute right-3 top-3 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={filter.riskLevel || 'all'}
                onChange={e => setFilter(prev => ({ ...prev, riskLevel: e.target.value, page: 1 }))}
                className="appearance-none w-36 pl-3 pr-8 py-2 bg-white border border-gray-200 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">全部风险等级</option>
                <option value="high">高风险</option>
                <option value="medium">中风险</option>
                <option value="low">低风险</option>
              </select>
              <ChevronDown className="w-3 h-3 absolute right-3 top-3 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={filter.status || 'all'}
                onChange={e => setFilter(prev => ({ ...prev, status: e.target.value, page: 1 }))}
                className="appearance-none w-32 pl-3 pr-8 py-2 bg-white border border-gray-200 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">全部状态</option>
                <option value="pending">待处理</option>
                <option value="processing">处理中</option>
                <option value="resolved">已处理</option>
                <option value="false_positive">误报</option>
              </select>
              <ChevronDown className="w-3 h-3 absolute right-3 top-3 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative flex items-center">
              <Search className="w-4 h-4 absolute left-3 text-gray-400" />
              <input
                type="text"
                placeholder="搜索来源/任务ID..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="w-48 pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer">查询</button>
            <button onClick={handleReset} className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-5 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer">重置</button>
            <button
              type="button"
              onClick={() => setFilter(prev => ({ ...prev, dateScope: isHistory ? 'today' : 'history', page: 1 }))}
              className="border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-md text-sm font-medium cursor-pointer"
            >
              {isHistory ? '返回今日告警记录' : '历史告警记录'}
            </button>
          </div>
          <button onClick={handleExportCSV} disabled={loading || !alertData?.data.length} className="flex items-center bg-white border border-gray-200 hover:bg-gray-50 text-blue-600 px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40">
            <Download className="w-4 h-4 mr-2" /> 导出CSV
          </button>
        </section>
      </FadeIn>

      {/* Main Split View */}
      <section className="flex flex-col lg:flex-row gap-4 h-[550px]">
        {/* Left Panel - Alert List */}
        <div className="w-full lg:w-1/3 xl:w-[480px] bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col">
          <div className="p-4 border-b border-gray-200 font-medium text-gray-800 bg-gray-50/50 rounded-t-lg text-sm flex justify-between items-center">
            <span>{isHistory ? '历史告警记录' : '今日告警记录'}</span>
            {loading && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {error && <div role="alert" className="text-center text-red-600 py-4">{error}<button onClick={loadAlerts} className="ml-2 underline">重试</button></div>}
            {alertData?.data.map(alert => {
              const isSelected = selectedAlert?.id === alert.id;
              const st = statusConfig[alert.status];
              return (
                <div
                  key={alert.id}
                  onClick={() => setSelectedAlert(alert)}
                  className={`flex items-start p-3 rounded-lg cursor-pointer transition-all group relative ${isSelected ? 'border-2 border-blue-400 bg-blue-50/50' : 'border border-gray-200 bg-white hover:bg-gray-50'} ${alert.status === 'resolved' || alert.status === 'false_positive' ? 'opacity-75' : ''}`}
                >
                  <AlertScreenshot alert={alert} thumbnail />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1 text-sm">
                      <h3 className="font-semibold text-gray-800 truncate pr-2">{alert.source}</h3>
                      <span className={`text-xs font-semibold whitespace-nowrap px-1.5 rounded flex items-center ${st.bg} ${st.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-1 ${alert.status === 'pending' ? 'bg-red-500' : alert.status === 'processing' ? 'bg-orange-500' : 'bg-green-500'}`}></span>
                        {st.label}
                      </span>
                    </div>
                    <div className="flex items-center text-xs text-gray-500 mb-2 space-x-2">
                      <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded border border-red-200 font-bold">{eventLabel(alert.rawStatus)}</span>
                      <span>风险: <span className={`font-medium ${riskColors[alert.riskLevel]}`}>{alert.riskLevel.toUpperCase()}</span></span>
                      <span>{alert.sourceType === 'video' ? '事件最高置信度' : '置信度'}: {confidenceLabel(alert.confidence)}</span>
                    </div>
                    {alert.sourceType === 'video' && <p className="text-xs text-gray-600 mb-1">{eventName(alert)} · 视频内 {eventTime(alert.timestampSec)}</p>}
                    <p className="text-xs text-gray-400 font-mono">{alert.timestamp}</p>
                  </div>
                </div>
              );
            })}
            {alertData?.data.length === 0 && (
              <div className="text-center text-gray-400 py-8">{isHistory ? '暂无符合条件的历史告警记录' : '今日暂无符合条件的告警记录'}</div>
            )}
          </div>
          {/* Pagination */}
          {alertData && alertData.totalPages > 0 && (
            <div className="p-3 border-t border-gray-200 flex items-center justify-between bg-white rounded-b-lg">
              <span className="text-xs text-gray-500">共 {alertData.total} 条</span>
              <div className="flex items-center space-x-1">
                <button
                  disabled={alertData.page <= 1}
                  onClick={() => setFilter(prev => ({ ...prev, page: prev.page! - 1 }))}
                  className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
                ><ChevronLeft className="w-3 h-3" /></button>
                {Array.from({ length: alertData.totalPages }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setFilter(prev => ({ ...prev, page: i + 1 }))}
                    className={`w-7 h-7 flex items-center justify-center rounded text-xs font-medium cursor-pointer ${alertData.page === i + 1 ? 'bg-blue-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >{i + 1}</button>
                ))}
                <button
                  disabled={alertData.page >= alertData.totalPages}
                  onClick={() => setFilter(prev => ({ ...prev, page: prev.page! + 1 }))}
                  className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
                ><ChevronRight className="w-3 h-3" /></button>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Alert Preview */}
        <div className="flex-1 bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-200 font-medium text-gray-800 flex justify-between items-center bg-gray-50/50">
            <span className="text-sm text-gray-700">告警详情</span>
            <div className="flex space-x-3">
              <button
                onClick={() => handleStatusChange('resolved')}
                disabled={loading || updating || !selectedAlert || selectedAlert.status === 'resolved'}
                className="text-blue-600 hover:text-blue-800 text-sm px-3 py-1.5 rounded-md border border-blue-200 bg-blue-50 font-medium flex items-center shadow-sm transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Check className="w-4 h-4 mr-1.5" /> 确认告警
              </button>
              <button
                onClick={() => handleStatusChange('false_positive')}
                disabled={loading || updating || !selectedAlert || selectedAlert.status === 'false_positive'}
                className="text-gray-600 hover:text-gray-800 text-sm px-3 py-1.5 rounded-md border border-gray-300 bg-white font-medium flex items-center shadow-sm transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <X className="w-4 h-4 mr-1.5" /> 误报
              </button>
            </div>
          </div>
          {selectedAlert ? (
            <div className="flex-1 p-5 bg-gray-100 flex flex-col overflow-y-auto">
              <div className="relative w-full aspect-video bg-black rounded-lg shadow-inner overflow-hidden mb-3 shrink-0">
                <AlertScreenshot alert={selectedAlert} />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm mb-3">
                {selectedAlert.sourceType === 'video' && <span className="text-gray-600">{eventName(selectedAlert)} · 首次触发截图</span>}
                {selectedAlert.image && <a href={assetUrl(selectedAlert, selectedAlert.image)} target="_blank" rel="noopener noreferrer" className="text-blue-600">查看截图大图</a>}
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 text-sm">
                  <div><p className="text-gray-500 mb-1.5 text-xs font-medium">事件类型</p><p className="font-bold text-red-600 bg-red-50 inline-block px-2.5 py-1 rounded border border-red-100 text-xs">{eventLabel(selectedAlert.rawStatus)}</p></div>
                  <div><p className="text-gray-500 mb-1.5 text-xs font-medium">风险等级</p><p className={`font-bold ${riskColors[selectedAlert.riskLevel]}`}>{selectedAlert.riskLevel.toUpperCase()}</p></div>
                  <div><p className="text-gray-500 mb-1.5 text-xs font-medium">{selectedAlert.sourceType === 'video' ? '事件最高置信度' : '置信度'}</p><p className="font-semibold text-gray-800">{confidenceLabel(selectedAlert.confidence)}</p></div>
                  {selectedAlert.sourceType === 'video' && <>
                    <div><p className="text-gray-500 mb-1.5 text-xs font-medium">事件编号</p><p className="font-semibold text-gray-800">{eventName(selectedAlert)}</p></div>
                    <div><p className="text-gray-500 mb-1.5 text-xs font-medium">视频内发生时间</p><p className="font-semibold text-gray-800">{eventTime(selectedAlert.timestampSec)}</p></div>
                    <div><p className="text-gray-500 mb-1.5 text-xs font-medium">触发帧号</p><p className="font-semibold text-gray-800">{selectedAlert.frame ?? '未知'}</p></div>
                  </>}
                  <div><p className="text-gray-500 mb-1.5 text-xs font-medium">检测时间</p><p className="font-semibold text-gray-800 font-mono text-xs">{selectedAlert.timestamp}</p></div>
                  <div><p className="text-gray-500 mb-1.5 text-xs font-medium">来源类型</p><p className="font-semibold text-gray-800">{selectedAlert.sourceType === 'video' ? '视频' : '图片'}</p></div>
                  <div><p className="text-gray-500 mb-1.5 text-xs font-medium">处理状态</p><p className={`font-bold flex items-center ${statusConfig[selectedAlert.status].color}`}><span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${selectedAlert.status === 'pending' ? 'bg-red-500' : selectedAlert.status === 'processing' ? 'bg-orange-500' : 'bg-green-500'}`}></span>{statusConfig[selectedAlert.status].label}</p></div>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-600">
                  <p className="font-medium mb-2">处置历史</p>
                  {selectedAlert.history?.length ? selectedAlert.history.map((entry, index) => <p key={`${entry.timestamp}-${index}`} className="mb-1">{entry.timestamp} · {statusConfig[entry.status]?.label || entry.status}</p>) : <p className="text-gray-400">暂无处置历史</p>}
                  {selectedAlert.updatedAt && <p className="mt-2 text-gray-400">最近更新：{selectedAlert.updatedAt}</p>}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">选择一条告警查看详情</div>
          )}
        </div>
      </section>
    </div>
  );
}
