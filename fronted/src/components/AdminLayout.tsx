import React from 'react';
import { motion } from 'motion/react';
import { View } from '../App';
import {
  FileImage,
  Clapperboard,
  MonitorPlay,
  BellRing,
  FileText,
  Shapes,
  Video,
  BarChart2,
  Settings,
  Users,
  Search,
  Bell,
  User,
  ChevronDown,
  Menu,
  Eye
} from 'lucide-react';

interface Props {
  view: View;
  setView: (view: View) => void;
  children: React.ReactNode;
}

const navItems: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: 'imageDetection', label: '图片检测', icon: <FileImage className="w-[18px] h-[18px]" /> },
  { id: 'videoDetection', label: '视频检测', icon: <Clapperboard className="w-[18px] h-[18px]" /> },
  { id: 'realtime', label: '实时监控', icon: <MonitorPlay className="w-[18px] h-[18px]" /> },
  { id: 'alert_history', label: '告警记录', icon: <BellRing className="w-[18px] h-[18px]" /> },
  { id: 'detection_logs', label: '检测日志', icon: <FileText className="w-[18px] h-[18px]" /> },
  { id: 'sample_management', label: '样本管理', icon: <Shapes className="w-[18px] h-[18px]" /> },
  { id: 'device_management', label: '设备管理', icon: <Video className="w-[18px] h-[18px]" /> },
  { id: 'data_statistics', label: '数据统计', icon: <BarChart2 className="w-[18px] h-[18px]" /> },
  { id: 'settings', label: '系统设置', icon: <Settings className="w-[18px] h-[18px]" /> },
  { id: 'user_management', label: '用户管理', icon: <Users className="w-[18px] h-[18px]" /> },
];

const viewTitles: Record<string, string> = {
  imageDetection: '图片检测', videoDetection: '视频检测',
  realtime: '实时监控', camera_detail: '监控详情', alert_history: '告警记录',
  detection_logs: '检测日志', sample_management: '样本管理', device_management: '设备管理',
  data_statistics: '数据统计', settings: '系统设置', user_management: '用户管理',
  home: '首页', product_features: '产品功能', success_cases: '成功案例',
  news: '新闻动态', about: '关于我们',
};

function isActive(navId: View, currentView: View): boolean {
  if (navId === 'realtime') return currentView === 'realtime' || currentView === 'camera_detail';
  return currentView === navId;
}

export default function AdminLayout({ view, setView, children }: Props) {
  return (
    <div className="bg-gray-50 text-gray-800 font-sans antialiased h-screen flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[260px] bg-white border-r border-gray-200 flex flex-col hidden md:flex h-full flex-shrink-0 z-20">
        {/* Logo */}
        <div className="h-[60px] flex items-center px-5 border-b border-gray-200">
          <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center mr-3">
            <Eye size={18} />
          </div>
          <div>
            <span className="font-semibold text-[15px] text-gray-900 cursor-pointer" onClick={() => setView('home')}>慧眼识行</span>
            <p className="text-[10px] text-gray-400 leading-tight">HuiYan System</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(item => {
            const active = isActive(item.id, view);
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`relative w-full flex items-center px-3 py-2.5 rounded-lg text-[14px] font-medium transition-all duration-200 cursor-pointer ${
                  active
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                {/* Active indicator bar */}
                {active && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue-600 rounded-r-full"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <span className={`mr-3 ${active ? 'text-blue-600' : 'text-gray-400'}`}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200">
          <div className="flex items-center text-xs text-gray-400">
            <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></div>
            系统运行中 · v2.3
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-gray-50 overflow-hidden">
        {/* Header */}
        <header className="h-[60px] bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0 z-10">
          <div className="flex items-center">
            <button className="mr-4 text-gray-400 hover:text-gray-600 md:hidden cursor-pointer">
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-[16px] font-semibold text-gray-900">
              {viewTitles[view] || '后台管理'}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative hidden md:block w-56">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder:text-gray-400"
                placeholder="搜索摄像头 / 位置"
              />
            </div>
            <button className="relative text-gray-400 hover:text-gray-600 p-1.5 cursor-pointer">
              <Bell className="w-[18px] h-[18px]" />
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">12</span>
            </button>
            <div className="flex items-center cursor-pointer hover:bg-gray-50 px-2 py-1.5 rounded-lg transition-colors gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center">
                <User className="w-3.5 h-3.5" />
              </div>
              <span className="text-[13px] font-medium text-gray-700 hidden sm:block">管理员</span>
              <ChevronDown className="w-3 h-3 text-gray-400 hidden sm:block" />
            </div>
          </div>
        </header>

        {/* Content with page transition */}
        <div className="flex-1 overflow-auto">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="h-full"
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
