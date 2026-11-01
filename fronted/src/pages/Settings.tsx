import React, { useState } from 'react';
import {
  Settings as SettingsIcon, Bell, Shield, Database, Globe,
  Monitor, Save, RotateCcw, CheckCircle2,
  ChevronRight, Lock, Mail, Smartphone, Cloud
} from 'lucide-react';
import { getConfig, updateConfig, resetConfig, type AppConfig } from '../services/config';

const sections = [
  { id: 'general', label: '基本设置', icon: <SettingsIcon className="w-4 h-4" /> },
  { id: 'notification', label: '通知设置', icon: <Bell className="w-4 h-4" /> },
  { id: 'detection', label: '检测参数', icon: <Monitor className="w-4 h-4" /> },
  { id: 'security', label: '安全设置', icon: <Shield className="w-4 h-4" /> },
  { id: 'storage', label: '存储设置', icon: <Database className="w-4 h-4" /> },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('general');
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<AppConfig>(getConfig());

  const set = <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    updateConfig(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    resetConfig();
    setForm(getConfig());
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex flex-col lg:flex-row gap-5">
        {/* Left Nav */}
        <div className="lg:w-56 shrink-0">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <nav className="p-2">
              {sections.map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${activeSection === s.id ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'}`}
                >
                  <span className={`mr-3 ${activeSection === s.id ? 'text-blue-600' : 'text-gray-400'}`}>{s.icon}</span>
                  {s.label}
                  <ChevronRight className={`w-4 h-4 ml-auto ${activeSection === s.id ? 'text-blue-600' : 'text-gray-300'}`} />
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Right Content */}
        <div className="flex-1 space-y-5">
          {/* ===== 基本设置 ===== */}
          {activeSection === 'general' && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-800">基本设置</h2>
                <p className="text-xs text-gray-500 mt-1">配置系统基本参数和显示选项</p>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">系统名称</label>
                    <input type="text" value={form.systemName} onChange={e => set('systemName', e.target.value)}
                      className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">组织名称</label>
                    <input type="text" value={form.orgName} onChange={e => set('orgName', e.target.value)}
                      className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">语言</label>
                    <select value={form.language} onChange={e => set('language', e.target.value)}
                      className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:border-blue-500 outline-none bg-white cursor-pointer">
                      <option value="zh-CN">简体中文</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">时区</label>
                    <select value={form.timezone} onChange={e => set('timezone', e.target.value)}
                      className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:border-blue-500 outline-none bg-white cursor-pointer">
                      <option value="Asia/Shanghai">Asia/Shanghai (UTC+8)</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">API 服务地址</label>
                  <input type="text" value={form.apiUrl} onChange={e => set('apiUrl', e.target.value)}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all" />
                  <p className="text-xs text-gray-400 mt-1">后端 FastAPI 服务的访问地址，保存后立即生效</p>
                </div>
              </div>
            </div>
          )}

          {/* ===== 通知设置 ===== */}
          {activeSection === 'notification' && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-800">通知设置</h2>
                <p className="text-xs text-gray-500 mt-1">跌倒告警开关控制后台新事件弹窗及声音反馈；声音需先点击页面右下角开启。设备离线、邮件、短信与云端推送尚未接入真实通知通道。</p>
              </div>
              <div className="p-6 space-y-4">
                {([
                  { key: 'notifyFall' as const, label: '跌倒告警通知', desc: '检测到跌倒事件时立即通知', icon: <Bell className="w-4 h-4 text-red-500" /> },
                  { key: 'notifyDeviceOffline' as const, label: '设备离线通知', desc: '设备离线超过5分钟时通知', icon: <Monitor className="w-4 h-4 text-orange-500" /> },
                  { key: 'notifyEmail' as const, label: '邮件通知', desc: '通过邮件发送告警摘要', icon: <Mail className="w-4 h-4 text-blue-500" /> },
                  { key: 'notifySms' as const, label: '短信通知', desc: '高优先级告警发送短信', icon: <Smartphone className="w-4 h-4 text-green-500" /> },
                  { key: 'notifyCloud' as const, label: '云端推送', desc: '推送到企业微信/钉钉', icon: <Cloud className="w-4 h-4 text-purple-500" /> },
                ]).map(item => (
                  <div key={item.key} className="flex items-center justify-between p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center">
                      <div className="mr-3">{item.icon}</div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{item.label}</p>
                        <p className="text-xs text-gray-500">{item.desc}</p>
                      </div>
                    </div>
                    <Toggle checked={form[item.key]} onChange={v => set(item.key, v)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== 检测参数 ===== */}
          {activeSection === 'detection' && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-800">检测参数</h2>
                <p className="text-xs text-gray-500 mt-1">调整AI检测算法的灵敏度和阈值</p>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">跌倒检测置信度阈值</label>
                  <div className="flex items-center gap-4">
                    <input type="range" min={50} max={99} value={form.confidenceThreshold}
                      onChange={e => set('confidenceThreshold', Number(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                    <span className="text-sm font-mono text-gray-700 w-12 text-right">{form.confidenceThreshold}%</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">低于此阈值的检测结果将被标记为低置信度</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">水平姿态判定比例</label>
                  <div className="flex items-center gap-4">
                    <input type="range" min={70} max={99} value={form.horizontalRatio}
                      onChange={e => set('horizontalRatio', Number(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                    <span className="text-sm font-mono text-gray-700 w-12 text-right">{(form.horizontalRatio / 100).toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">RTMO姿态估计中，身体宽高比超过此值判定为水平姿态</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">YOLO模型版本</label>
                    <select value={form.yoloModel} onChange={e => set('yoloModel', e.target.value)}
                      className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:border-blue-500 outline-none bg-white cursor-pointer">
                      <option value="camera_fall_v2-2">camera_fall_v2-2 (当前)</option>
                      <option value="camera_fall_v2-1">camera_fall_v2-1</option>
                      <option value="camera_fall_v1">camera_fall_v1</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">检测帧率</label>
                    <select value={form.detectFrameRate} onChange={e => set('detectFrameRate', e.target.value)}
                      className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:border-blue-500 outline-none bg-white cursor-pointer">
                      <option value="1">每帧检测</option>
                      <option value="2">每2帧检测</option>
                      <option value="5">每5帧检测</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 border border-gray-100 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-800">启用 Tiled YOLO 回退</p>
                    <p className="text-xs text-gray-500">全图未检测到目标时，自动切分小图重新检测</p>
                  </div>
                  <Toggle checked={form.tiledYolo} onChange={v => set('tiledYolo', v)} />
                </div>
              </div>
            </div>
          )}

          {/* ===== 安全设置 ===== */}
          {activeSection === 'security' && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-800">安全设置</h2>
                <p className="text-xs text-gray-500 mt-1">配置访问控制和数据安全策略</p>
              </div>
              <div className="p-6 space-y-4">
                {([
                  { key: 'twoFactorAuth' as const, label: '双因素认证', desc: '登录时需要验证码二次确认', icon: <Lock className="w-4 h-4 text-blue-500" /> },
                  { key: 'ipWhitelist' as const, label: 'IP白名单', desc: '仅允许指定IP地址访问管理后台', icon: <Globe className="w-4 h-4 text-green-500" /> },
                  { key: 'auditLog' as const, label: '操作审计日志', desc: '记录所有用户操作行为', icon: <Shield className="w-4 h-4 text-purple-500" /> },
                  { key: 'dataEncryption' as const, label: '数据加密存储', desc: '对敏感数据进行AES-256加密', icon: <Lock className="w-4 h-4 text-amber-500" /> },
                ]).map(item => (
                  <div key={item.key} className="flex items-center justify-between p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center">
                      <div className="mr-3">{item.icon}</div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{item.label}</p>
                        <p className="text-xs text-gray-500">{item.desc}</p>
                      </div>
                    </div>
                    <Toggle checked={form[item.key]} onChange={v => set(item.key, v)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== 存储设置 ===== */}
          {activeSection === 'storage' && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-800">存储设置</h2>
                <p className="text-xs text-gray-500 mt-1">管理数据存储和清理策略</p>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">存储空间使用</label>
                  <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: '62%' }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>已使用 124.8 GB</span>
                    <span>总计 200 GB</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">告警截图保留天数</label>
                    <select value={form.alertRetention} onChange={e => set('alertRetention', e.target.value)}
                      className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:border-blue-500 outline-none bg-white cursor-pointer">
                      <option value="30">30天</option>
                      <option value="60">60天</option>
                      <option value="90">90天</option>
                      <option value="-1">永久</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">日志保留天数</label>
                    <select value={form.logRetention} onChange={e => set('logRetention', e.target.value)}
                      className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:border-blue-500 outline-none bg-white cursor-pointer">
                      <option value="7">7天</option>
                      <option value="30">30天</option>
                      <option value="90">90天</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 border border-gray-100 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-800">自动清理过期数据</p>
                    <p className="text-xs text-gray-500">自动删除超过保留期限的截图和日志</p>
                  </div>
                  <Toggle checked={form.autoCleanup} onChange={v => set('autoCleanup', v)} />
                </div>
              </div>
            </div>
          )}

          {/* Save Bar */}
          <div className="flex justify-end gap-3">
            <button onClick={handleReset}
              className="flex items-center border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 px-5 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer">
              <RotateCcw className="w-4 h-4 mr-2" /> 重置默认
            </button>
            <button onClick={handleSave}
              className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-md text-sm font-medium shadow-sm transition-colors cursor-pointer">
              {saved ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              {saved ? '已保存' : '保存设置'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
