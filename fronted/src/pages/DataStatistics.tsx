import React, { useState } from 'react';
import {
  TrendingUp, TrendingDown, Calendar, Download,
  BarChart2, PieChart, Activity, Users, AlertTriangle,
  Target, Clock, Monitor
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const weeklyAlerts = [
  { day: '周一', alerts: 42, resolved: 38 },
  { day: '周二', alerts: 35, resolved: 33 },
  { day: '周三', alerts: 58, resolved: 50 },
  { day: '周四', alerts: 47, resolved: 44 },
  { day: '周五', alerts: 63, resolved: 55 },
  { day: '周六', alerts: 38, resolved: 36 },
  { day: '周日', alerts: 29, resolved: 28 },
];

const monthlyTrend = [
  { month: '1月', count: 320 },
  { month: '2月', count: 280 },
  { month: '3月', count: 410 },
  { month: '4月', count: 380 },
  { month: '5月', count: 456 },
  { month: '6月', count: 390 },
];

const alertTypeData = [
  { name: '跌倒检测', value: 45, color: '#ef4444' },
  { name: '烟雾检测', value: 20, color: '#f97316' },
  { name: '安全帽检测', value: 18, color: '#eab308' },
  { name: '人群聚集', value: 12, color: '#3b82f6' },
  { name: '其他', value: 5, color: '#6b7280' },
];

const hourlyData = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  count: Math.floor(Math.random() * 30) + (i >= 8 && i <= 20 ? 15 : 3),
}));

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white px-4 py-3 rounded-xl shadow-lg border border-gray-100">
      <p className="text-xs font-semibold text-gray-800 mb-2">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: entry.color }} />
          <span className="text-gray-500">{entry.name}:</span>
          <span className="font-semibold text-gray-800">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function DataStatistics() {
  const [timeRange, setTimeRange] = useState('week');

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Gradient defs for charts */}
      <svg width="0" height="0">
        <defs>
          <linearGradient id="alertGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0.5} />
          </linearGradient>
          <linearGradient id="resolvedGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#22c55e" stopOpacity={0.5} />
          </linearGradient>
          <linearGradient id="blueLineGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="hourlyGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.5} />
          </linearGradient>
        </defs>
      </svg>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: '本月告警总数', value: '456', change: '+12.3%', up: true, icon: <AlertTriangle className="w-5 h-5 text-red-500" />, bg: 'bg-red-50' },
          { label: '日均检测帧数', value: '12.8万', change: '+8.7%', up: true, icon: <Activity className="w-5 h-5 text-blue-600" />, bg: 'bg-blue-50' },
          { label: '平均响应时间', value: '2.3s', change: '-15.2%', up: false, icon: <Clock className="w-5 h-5 text-amber-500" />, bg: 'bg-amber-50' },
          { label: '设备在线率', value: '96.8%', change: '+1.2%', up: true, icon: <Monitor className="w-5 h-5 text-green-600" />, bg: 'bg-green-50' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className={`h-10 w-10 rounded-xl ${kpi.bg} flex items-center justify-center`}>{kpi.icon}</div>
              <span className={`text-xs font-medium flex items-center ${kpi.up ? 'text-red-500' : 'text-green-600'}`}>
                {kpi.up ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                {kpi.change}
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-1">{kpi.label}</p>
            <p className="text-2xl font-bold text-gray-800">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Weekly Alert Trend - Beautified */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center">
              <BarChart2 className="w-4 h-4 mr-2 text-blue-500" /> 告警与处理趋势
            </h2>
            <select
              value={timeRange}
              onChange={e => setTimeRange(e.target.value)}
              className="text-xs border-gray-200 rounded-lg py-1.5 px-3 text-gray-600 bg-gray-50 outline-none focus:border-blue-500"
            >
              <option value="week">本周</option>
              <option value="month">本月</option>
            </select>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyAlerts} margin={{ top: 10, right: 10, left: -15, bottom: 0 }} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59, 130, 246, 0.05)', radius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} iconType="circle" iconSize={8} />
                <Bar dataKey="alerts" name="告警数" fill="url(#alertGradient)" radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Bar dataKey="resolved" name="已处理" fill="url(#resolvedGradient)" radius={[6, 6, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Alert Type Pie - Beautified */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center mb-5">
            <PieChart className="w-4 h-4 mr-2 text-purple-500" /> 告警类型分布
          </h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPie>
                <Pie
                  data={alertTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={78}
                  paddingAngle={4}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {alertTypeData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  formatter={(value: number, name: string) => [`${value}%`, name]}
                />
              </RechartsPie>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2.5 mt-4">
            {alertTypeData.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center">
                  <span className="w-2.5 h-2.5 rounded-full mr-2.5 shadow-sm" style={{ background: item.color }} />
                  <span className="text-gray-600">{item.name}</span>
                </div>
                <span className="font-semibold text-gray-800 bg-gray-50 px-2 py-0.5 rounded-full">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Monthly Trend - Beautified Line Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center mb-5">
            <TrendingUp className="w-4 h-4 mr-2 text-blue-500" /> 月度告警趋势
          </h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrend} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="告警数"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#fff', strokeWidth: 2.5, stroke: '#3b82f6' }}
                  activeDot={{ r: 7, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hourly Distribution - Beautified */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center mb-5">
            <Clock className="w-4 h-4 mr-2 text-amber-500" /> 24小时告警分布
          </h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }} barCategoryGap="15%">
                <defs>
                  <linearGradient id="hourlyBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#93c5fd" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#9ca3af' }} interval={3} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59, 130, 246, 0.05)', radius: 6 }} />
                <Bar dataKey="count" name="告警数" fill="url(#hourlyBarGrad)" radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Summary Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-sm font-semibold text-gray-800">摄像头告警排行</h2>
          <button className="flex items-center text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors">
            <Download className="w-3.5 h-3.5 mr-1" /> 导出报表
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-5 py-3 text-left font-medium">排名</th>
              <th className="px-5 py-3 text-left font-medium">摄像头</th>
              <th className="px-5 py-3 text-left font-medium">位置</th>
              <th className="px-5 py-3 text-left font-medium">告警次数</th>
              <th className="px-5 py-3 text-left font-medium">处理率</th>
              <th className="px-5 py-3 text-left font-medium">趋势</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {[
              { rank: 1, id: 'CAM-02', name: '养老院活动室', location: '养老院2楼', alerts: 87, rate: '95.4%', up: true },
              { rank: 2, id: 'CAM-01', name: '机场T1大厅', location: '机场T1航站楼', alerts: 72, rate: '91.7%', up: true },
              { rank: 3, id: 'CAM-04', name: '医院门诊大厅', location: '医院1楼', alerts: 65, rate: '88.5%', up: false },
              { rank: 4, id: 'CAM-05', name: '地铁站台', location: '地铁3号线', alerts: 58, rate: '93.1%', up: true },
              { rank: 5, id: 'CAM-06', name: '建筑工地', location: '工地东侧', alerts: 45, rate: '86.7%', up: false },
            ].map(r => (
              <tr key={r.rank} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3">
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${r.rank <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                    {r.rank}
                  </span>
                </td>
                <td className="px-5 py-3 font-medium text-gray-800">{r.id} {r.name}</td>
                <td className="px-5 py-3 text-gray-500">{r.location}</td>
                <td className="px-5 py-3 font-semibold text-gray-800">{r.alerts}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500" style={{ width: r.rate }} />
                    </div>
                    <span className="text-xs text-gray-600 font-medium">{r.rate}</span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  {r.up ? <TrendingUp className="w-4 h-4 text-red-500" /> : <TrendingDown className="w-4 h-4 text-green-500" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
