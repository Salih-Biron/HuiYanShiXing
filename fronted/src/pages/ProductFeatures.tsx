import React from 'react';
import { View } from '../App';
import {
  Brain, Eye, Zap, Bell, Monitor, Shield, BarChart2,
  Users, Video, Database, Globe, Lock, ArrowRight,
  CheckCircle2, Layers, Cpu, Scan
} from 'lucide-react';

const mainFeatures = [
  {
    icon: <Brain className="w-8 h-8" />,
    title: 'YOLO目标检测',
    subtitle: '高性能实时检测',
    desc: '基于YOLO v8的深度学习目标检测模型，针对跌倒场景专项优化。支持Tiled YOLO回退机制，对小目标和遮挡场景具备更强的检测能力。',
    highlights: ['96类目标识别', 'Tiled回退检测', '960x960高分辨率', 'GPU加速推理'],
    color: 'blue',
    image: '/images/ppt-detection-overview.png',
  },
  {
    icon: <Eye className="w-8 h-8" />,
    title: 'RTMO姿态估计',
    subtitle: '精准姿态分析',
    desc: '采用RTMO (Real-Time Multi-Person Pose Estimation) 算法，对人体关键点进行精确定位，通过宽高比分析判定是否存在异常姿态。',
    highlights: ['17关键点定位', '多人同时检测', '水平姿态判定', '关键点可视化'],
    color: 'purple',
    image: '/images/feature-rtmo-pose.png',
  },
  {
    icon: <Zap className="w-8 h-8" />,
    title: '智能融合决策',
    subtitle: '多模型协同推理',
    desc: '将YOLO检测结果与RTMO姿态分析结果进行融合，通过规则引擎输出最终判定，有效降低单一模型的误报率。',
    highlights: ['双引擎融合', '三级风险评估', '规则引擎决策', '结果可追溯'],
    color: 'amber',
    image: '/images/feature-fusion-decision.png',
  },
  {
    icon: <Bell className="w-8 h-8" />,
    title: '实时告警系统',
    subtitle: '秒级响应通知',
    desc: '检测到异常事件后，系统在毫秒级内完成告警生成，支持多种通知渠道（短信、邮件、企业微信、钉钉），确保第一时间响应。',
    highlights: ['毫秒级告警', '多渠道推送', '告警升级机制', '处理状态追踪'],
    color: 'red',
    image: '/images/feature-realtime-alert.png',
  },
];

const additionalFeatures = [
  { icon: <Monitor className="w-5 h-5" />, title: '多画面监控', desc: '支持1/4/6/9多种画面布局' },
  { icon: <Video className="w-5 h-5" />, title: '多设备接入', desc: '支持主流品牌摄像头即插即用' },
  { icon: <BarChart2 className="w-5 h-5" />, title: '数据统计', desc: '多维度数据分析与可视化报表' },
  { icon: <Database className="w-5 h-5" />, title: '历史回溯', desc: '告警记录与检测日志完整保存' },
  { icon: <Users className="w-5 h-5" />, title: '权限管理', desc: '多角色权限控制，操作可审计' },
  { icon: <Globe className="w-5 h-5" />, title: '远程访问', desc: 'Web端随时随地查看监控状态' },
  { icon: <Lock className="w-5 h-5" />, title: '数据安全', desc: 'AES-256加密，数据安全有保障' },
  { icon: <Layers className="w-5 h-5" />, title: '灵活部署', desc: '支持云端/本地/边缘多种部署方式' },
];

const colorMap: Record<string, { bg: string; text: string; border: string; light: string }> = {
  blue: { bg: 'bg-blue-600', text: 'text-blue-600', border: 'border-blue-200', light: 'bg-blue-50' },
  purple: { bg: 'bg-purple-600', text: 'text-purple-600', border: 'border-purple-200', light: 'bg-purple-50' },
  amber: { bg: 'bg-amber-600', text: 'text-amber-600', border: 'border-amber-200', light: 'bg-amber-50' },
  red: { bg: 'bg-red-600', text: 'text-red-600', border: 'border-red-200', light: 'bg-red-50' },
};

export default function ProductFeatures({ setView }: { setView: (v: View) => void }) {
  return (
    <div className="bg-white">
      {/* Hero - ChatGPT-style blue gradient */}
      <section className="bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center bg-white/10 text-white/90 text-sm px-4 py-1.5 rounded-full mb-6 border border-white/20">
            <Cpu className="w-4 h-4 mr-2" /> 产品功能
          </div>
          <h1 className="text-4xl font-bold mb-4">全方位AI安全检测能力</h1>
          <p className="text-blue-200 max-w-2xl mx-auto text-lg">
            从目标检测到姿态分析，从实时告警到数据统计，提供完整的安全监控解决方案
          </p>
        </div>
      </section>

      {/* Main Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="space-y-16">
          {mainFeatures.map((f, i) => {
            const c = colorMap[f.color];
            return (
              <div key={i} className={`grid lg:grid-cols-2 gap-10 items-center ${i % 2 === 1 ? 'lg:direction-rtl' : ''}`}>
                <div className={i % 2 === 1 ? 'lg:order-2' : ''}>
                  <div className={`inline-flex items-center ${c.light} ${c.text} text-sm px-3 py-1 rounded-full mb-4 font-medium`}>
                    {f.icon} <span className="ml-2">{f.subtitle}</span>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">{f.title}</h2>
                  <p className="text-gray-600 leading-relaxed mb-6">{f.desc}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {f.highlights.map((h, j) => (
                      <div key={j} className="flex items-center text-sm text-gray-700">
                        <CheckCircle2 className={`w-4 h-4 ${c.text} mr-2 shrink-0`} />
                        {h}
                      </div>
                    ))}
                  </div>
                </div>
                <div className={`${i % 2 === 1 ? 'lg:order-1' : ''}`}>
                  <div className={`${c.light} rounded-2xl p-8 border ${c.border}`}>
                    <div className="aspect-video bg-white rounded-xl overflow-hidden flex items-center justify-center">
                      {f.image ? (
                        <img
                          src={f.image}
                          alt={`${f.title}示意图`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className={`${c.text} opacity-20`}>
                          {React.cloneElement(f.icon, { className: 'w-24 h-24' })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Additional Features Grid */}
      <section className="bg-gray-50 border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">更多功能特性</h2>
            <p className="text-gray-500">覆盖安全监控全流程的丰富功能</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {additionalFeatures.map((f, i) => (
              <div key={i} className="p-5 rounded-xl border border-gray-200 hover:border-blue-200 hover:bg-blue-50/50 transition-all group bg-white">
                <div className="w-10 h-10 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center mb-3 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-gray-800 text-sm mb-1">{f.title}</h3>
                <p className="text-xs text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">想了解更多技术细节？</h2>
        <p className="text-gray-500 mb-8">查看我们的技术方案文档，深入了解系统架构和算法原理</p>
        <div className="flex justify-center gap-4">
          <button onClick={() => setView('tech_solutions')} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors flex items-center">
            查看技术方案 <ArrowRight className="w-4 h-4 ml-2" />
          </button>
          <button onClick={() => setView('realtime')} className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors">
            进入监控台
          </button>
        </div>
      </section>
    </div>
  );
}
