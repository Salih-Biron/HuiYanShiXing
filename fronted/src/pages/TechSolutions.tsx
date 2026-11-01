import {
  Bell,
  BrainCircuit,
  ChevronRight,
  Database,
  FileVideo,
  Gauge,
  Layers3,
  Monitor,
  Network,
  Server,
  ShieldCheck,
  Smartphone,
  Video,
} from 'lucide-react';
import { FadeIn, StaggerContainer, StaggerItem } from '../components/AnimateIn';

const processSteps = [
  {
    title: '视频输入',
    subtitle: '多源接入',
    icon: FileVideo,
    desc: '统一接入摄像头、视频文件与实时视频流，为后续检测提供稳定帧源。',
    points: ['支持多种视频源接入', '实时视频流或文件导入'],
  },
  {
    title: '数据预处理',
    subtitle: '帧级清洗',
    icon: Database,
    desc: '对视频帧进行解码、抽帧、增强和区域约束，降低无效背景干扰。',
    points: ['视频解码与抽帧', '图像增强与去噪', 'ROI 区域设定'],
  },
  {
    title: 'YOLO 检测',
    subtitle: '目标定位',
    icon: Layers3,
    desc: '快速识别人体与疑似跌倒目标，输出检测框、类别和置信度。',
    points: ['YOLOv8 目标检测', '识别人体并定位', '输出检测结果与置信度'],
  },
  {
    title: 'RTMO 姿态估计',
    subtitle: '姿态复核',
    icon: BrainCircuit,
    desc: '在高风险目标上提取人体关键点，辅助判断横向、蜷缩等异常姿态。',
    points: ['RTMO 实时姿态估计', '关键点提取与跟踪', '姿态角度计算'],
  },
  {
    title: '规则融合',
    subtitle: '风险判定',
    icon: Network,
    desc: '融合目标检测、姿态角度、区域信息和置信度，形成最终风险结论。',
    points: ['多维规则引擎', '姿态 + 行为 + 区域分析', '异常事件判定与分级'],
  },
  {
    title: '告警输出',
    subtitle: '闭环处置',
    icon: Bell,
    desc: '生成告警截图、结构化结果与处置记录，并推送到前端和通知渠道。',
    points: ['实时告警推送', '截图与结果文件保存', '多端通知与联动'],
  },
];

const architecture = [
  { label: '视频源', icon: Video },
  { label: '流媒体服务', icon: Monitor },
  { label: '数据处理集群', icon: Server },
  { label: 'AI 推理引擎', icon: BrainCircuit, active: true },
  { label: '结构化存储', icon: Database },
  { label: '业务应用', icon: Gauge },
  { label: '多端展示', icon: Smartphone },
  { label: '告警通知', icon: Bell },
];

export default function TechSolutions() {
  return (
    <main className="bg-gradient-to-b from-blue-50/70 via-white to-white min-h-screen pb-14">
      <section className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        <FadeIn>
          <div className="text-center mb-9">
            <h1 className="text-3xl font-semibold text-[#12346b]">技术方案</h1>
            <div className="w-11 h-[3px] rounded-full bg-blue-600 mx-auto mt-4" />
          </div>
        </FadeIn>

        <StaggerContainer staggerDelay={0.05} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-stretch">
          {processSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <StaggerItem key={step.title} className="relative">
                <div className="h-full rounded-2xl border border-blue-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-blue-600 mb-1">
                          {String(index + 1).padStart(2, '0')} / {step.subtitle}
                        </div>
                        <h2 className="text-lg font-semibold text-[#17376d]">{step.title}</h2>
                      </div>
                    </div>
                    <div className="text-4xl font-bold text-blue-50 leading-none">
                      {String(index + 1).padStart(2, '0')}
                    </div>
                  </div>

                  <p className="mt-5 text-sm text-slate-600 leading-6 min-h-[48px]">{step.desc}</p>

                  <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {step.points.map((point) => (
                      <li key={point} className="flex items-center rounded-lg bg-blue-50/70 px-3 py-2 text-xs text-slate-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-2 shrink-0" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>

                {index < processSteps.length - 1 && (index + 1) % 3 !== 0 && (
                  <div className="hidden xl:flex absolute top-1/2 -right-4 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center">
                    <ChevronRight className="w-6 h-6 text-blue-300" />
                  </div>
                )}
              </StaggerItem>
            );
          })}
        </StaggerContainer>

        <FadeIn delay={0.08}>
          <section className="mt-8 rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-[120px_1fr] gap-5 items-center">
              <div className="text-[#17376d] font-semibold text-lg">系统架构</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
                {architecture.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="relative flex flex-col items-center text-center">
                      <div className={`w-12 h-12 rounded-lg border flex items-center justify-center mb-2 ${
                        item.active
                          ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                          : 'bg-blue-50 border-blue-100 text-blue-600'
                      }`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className={`text-xs ${item.active ? 'font-semibold text-blue-700' : 'text-slate-600'}`}>
                        {item.label}
                      </span>
                      {index < architecture.length - 1 && (
                        <ChevronRight className="hidden xl:block absolute -right-4 top-4 w-5 h-5 text-blue-300" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </FadeIn>

        <FadeIn delay={0.12}>
          <div className="mt-7 rounded-xl border border-blue-100 bg-blue-50/80 px-5 py-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-sm text-slate-600 leading-6">
              当前前端展示采用 PPT 中的技术链路：视频输入、数据预处理、YOLO 检测、RTMO 姿态估计、规则融合和告警输出。
              后台实际检测页面保持独立，点击顶部“申请试用”可进入检测后台。
            </p>
          </div>
        </FadeIn>
      </section>
    </main>
  );
}
