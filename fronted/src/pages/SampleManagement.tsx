import React, { useState, useEffect, useCallback } from 'react';
import {
  Upload, Search, Grid, List,
  ChevronLeft, ChevronRight, Eye, Trash2,
  Download, FolderOpen, CheckCircle2, XCircle, Loader2
} from 'lucide-react';
import { fetchSamples, type Sample } from '../services/data';

const typeLabels: Record<string, { text: string; color: string }> = {
  fall: { text: '跌倒', color: 'bg-red-100 text-red-700 border-red-200' },
  standing: { text: '站立', color: 'bg-green-100 text-green-700 border-green-200' },
  other: { text: '其他', color: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const statusLabels: Record<string, { text: string; color: string; icon: React.ReactNode }> = {
  labeled: { text: '已标注', color: 'text-green-600', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  unlabeled: { text: '未标注', color: 'text-orange-500', icon: <XCircle className="w-3.5 h-3.5" /> },
  reviewing: { text: '审核中', color: 'text-blue-500', icon: <Eye className="w-3.5 h-3.5" /> },
};

export default function SampleManagement() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSamples = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSamples({ type: selectedType, status: selectedStatus, search: searchTerm });
      setSamples(data);
    } finally {
      setLoading(false);
    }
  }, [selectedType, selectedStatus, searchTerm]);

  useEffect(() => { loadSamples(); }, [loadSamples]);

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '总样本数', value: '2,456', icon: <FolderOpen className="w-5 h-5 text-blue-600" />, bg: 'bg-blue-50' },
          { label: '已标注', value: '1,832', icon: <CheckCircle2 className="w-5 h-5 text-green-600" />, bg: 'bg-green-50' },
          { label: '未标注', value: '486', icon: <XCircle className="w-5 h-5 text-orange-500" />, bg: 'bg-orange-50' },
          { label: '审核中', value: '138', icon: <Eye className="w-5 h-5 text-purple-600" />, bg: 'bg-purple-50' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 flex items-center">
            <div className={`h-10 w-10 rounded-full ${s.bg} flex items-center justify-center mr-3 shrink-0`}>{s.icon}</div>
            <div>
              <p className="text-xs text-gray-500 font-medium">{s.label}</p>
              <p className="text-xl font-bold text-gray-800">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input type="text" placeholder="搜索样本名称..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500 outline-none w-56" />
          </div>
          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            className="border border-gray-200 rounded-md text-sm py-2 px-3 text-gray-600 bg-gray-50 outline-none focus:border-blue-500"
          >
            <option value="all">全部类型</option>
            <option value="fall">跌倒</option>
            <option value="standing">站立</option>
            <option value="other">其他</option>
          </select>
          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="border border-gray-200 rounded-md text-sm py-2 px-3 text-gray-600 bg-gray-50 outline-none focus:border-blue-500"
          >
            <option value="all">全部状态</option>
            <option value="labeled">已标注</option>
            <option value="unlabeled">未标注</option>
            <option value="reviewing">审核中</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-gray-200 rounded-md overflow-hidden">
            <button onClick={() => setViewMode('grid')} className={`p-2 ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-400 hover:text-gray-600'}`}>
              <Grid className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('list')} className={`p-2 ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-400 hover:text-gray-600'}`}>
              <List className="w-4 h-4" />
            </button>
          </div>
          <button className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-colors">
            <Upload className="w-4 h-4 mr-2" /> 上传样本
          </button>
        </div>
      </div>

      {/* Sample Grid / List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {loading ? (
        <div className="col-span-full flex items-center justify-center py-12 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2" /> 加载中...</div>
      ) : samples.length === 0 ? (
        <div className="col-span-full text-center py-12 text-gray-400">暂无样本数据</div>
      ) : samples.map(s => (
            <div key={s.id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
              <div className="relative aspect-video bg-gray-100">
                <img src={s.thumb} alt={s.name} className="w-full h-full object-cover" />
                <div className="absolute top-2 left-2 flex gap-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${typeLabels[s.type].color}`}>
                    {typeLabels[s.type].text}
                  </span>
                </div>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <button className="bg-white/90 text-gray-700 p-2 rounded-full mr-2 hover:bg-white"><Eye className="w-4 h-4" /></button>
                  <button className="bg-white/90 text-gray-700 p-2 rounded-full hover:bg-white"><Download className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1">{s.source}</span>
                  <span className={`flex items-center gap-1 ${statusLabels[s.status].color}`}>
                    {statusLabels[s.status].icon} {statusLabels[s.status].text}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left font-medium">缩略图</th>
                <th className="px-4 py-3 text-left font-medium">文件名</th>
                <th className="px-4 py-3 text-left font-medium">类型</th>
                <th className="px-4 py-3 text-left font-medium">状态</th>
                <th className="px-4 py-3 text-left font-medium">来源</th>
                <th className="px-4 py-3 text-left font-medium">日期</th>
                <th className="px-4 py-3 text-left font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
        <div className="col-span-full flex items-center justify-center py-12 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2" /> 加载中...</div>
      ) : samples.length === 0 ? (
        <div className="col-span-full text-center py-12 text-gray-400">暂无样本数据</div>
      ) : samples.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-2"><img src={s.thumb} alt="" className="w-16 h-10 object-cover rounded border border-gray-200" /></td>
                  <td className="px-4 py-2 font-medium text-gray-800">{s.name}</td>
                  <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded border ${typeLabels[s.type].color}`}>{typeLabels[s.type].text}</span></td>
                  <td className="px-4 py-2"><span className={`flex items-center gap-1 text-xs ${statusLabels[s.status].color}`}>{statusLabels[s.status].icon} {statusLabels[s.status].text}</span></td>
                  <td className="px-4 py-2 text-gray-600">{s.source}</td>
                  <td className="px-4 py-2 text-gray-500 font-mono text-xs">{s.date}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Eye className="w-4 h-4" /></button>
                      <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm bg-gray-50/50">
            <span className="text-gray-500">共 {samples.length} 条</span>
            <div className="flex items-center space-x-1">
              <button className="px-2.5 py-1 border border-gray-200 bg-white rounded text-gray-400 hover:bg-gray-50">«</button>
              <button className="px-3 py-1 bg-blue-600 text-white rounded font-medium shadow-sm">1</button>
              <button className="px-2.5 py-1 border border-gray-200 bg-white rounded text-gray-600 hover:bg-gray-50">»</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
