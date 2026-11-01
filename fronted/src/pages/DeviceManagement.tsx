import React, { useState, useEffect, useCallback } from 'react';
import {
  Video, Wifi, WifiOff, Plus, Search, Settings, Trash2,
  RefreshCcw, MapPin, Clock, Activity, CheckCircle2,
  AlertTriangle, ChevronDown, Edit3, Power, Loader2
} from 'lucide-react';
import { fetchDevices, type Device } from '../services/data';
import { FadeIn, StaggerContainer, StaggerItem } from '../components/AnimateIn';

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  online: { label: '在线', color: 'text-green-600', bg: 'bg-green-50 border-green-200', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  offline: { label: '离线', color: 'text-gray-500', bg: 'bg-gray-50 border-gray-200', icon: <WifiOff className="w-3.5 h-3.5" /> },
  error: { label: '异常', color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
};

export default function DeviceManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDevices({ status: statusFilter, search: searchTerm });
      setDevices(data);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm]);

  useEffect(() => { loadDevices(); }, [loadDevices]);

  const handleRefresh = () => loadDevices();

  const onlineCount = devices.filter(d => d.status === 'online').length;
  const offlineCount = devices.filter(d => d.status === 'offline').length;
  const errorCount = devices.filter(d => d.status === 'error').length;

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 flex items-center">
          <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center mr-3"><Video className="w-5 h-5 text-blue-600" /></div>
          <div><p className="text-xs text-gray-500">设备总数</p><p className="text-xl font-bold text-gray-800">{devices.length}</p></div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 flex items-center">
          <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center mr-3"><Wifi className="w-5 h-5 text-green-600" /></div>
          <div><p className="text-xs text-gray-500">在线设备</p><p className="text-xl font-bold text-green-600">{onlineCount}</p></div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 flex items-center">
          <div className="h-10 w-10 rounded-full bg-gray-50 flex items-center justify-center mr-3"><WifiOff className="w-5 h-5 text-gray-500" /></div>
          <div><p className="text-xs text-gray-500">离线设备</p><p className="text-xl font-bold text-gray-600">{offlineCount}</p></div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 flex items-center">
          <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center mr-3"><AlertTriangle className="w-5 h-5 text-red-500" /></div>
          <div><p className="text-xs text-gray-500">异常设备</p><p className="text-xl font-bold text-red-600">{errorCount}</p></div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="搜索设备名称 / 位置 / ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500 outline-none w-64"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-md text-sm py-2 px-3 text-gray-600 bg-gray-50 outline-none focus:border-blue-500"
          >
            <option value="all">全部状态</option>
            <option value="online">在线</option>
            <option value="offline">离线</option>
            <option value="error">异常</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRefresh} className="flex items-center border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer">
            <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> 刷新
          </button>
          <button className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-colors">
            <Plus className="w-4 h-4 mr-2" /> 添加设备
          </button>
        </div>
      </div>

      {/* Device Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full flex items-center justify-center py-12 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> 加载中...
          </div>
        ) : devices.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-400">暂无设备数据</div>
        ) : devices.map(device => {
          const st = statusConfig[device.status];
          return (
            <div key={device.id} className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 ${device.status === 'online' ? 'bg-green-50' : device.status === 'error' ? 'bg-red-50' : 'bg-gray-50'}`}>
                    <Video className={`w-5 h-5 ${device.status === 'online' ? 'text-green-600' : device.status === 'error' ? 'text-red-500' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-800">{device.name}</h3>
                    <p className="text-xs text-gray-500 font-mono">{device.id}</p>
                  </div>
                </div>
                <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded border font-medium ${st.bg} ${st.color}`}>
                  {st.icon} {st.label}
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center text-gray-500"><MapPin className="w-3.5 h-3.5 mr-2 text-gray-400" />{device.location}</div>
                <div className="flex items-center text-gray-500"><Wifi className="w-3.5 h-3.5 mr-2 text-gray-400" />IP: {device.ip}</div>
                <div className="flex items-center text-gray-500"><Activity className="w-3.5 h-3.5 mr-2 text-gray-400" />{device.resolution} / {device.fps}fps</div>
                <div className="flex items-center text-gray-500"><Clock className="w-3.5 h-3.5 mr-2 text-gray-400" />最后活跃: {device.lastActive}</div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                <span className="text-xs text-gray-400">{device.model}</span>
                <div className="flex gap-1">
                  <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="设置"><Settings className="w-4 h-4" /></button>
                  <button className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors" title="编辑"><Edit3 className="w-4 h-4" /></button>
                  <button className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors" title="重启"><Power className="w-4 h-4" /></button>
                  <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="删除"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
