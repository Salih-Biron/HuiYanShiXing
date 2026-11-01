import { View } from '../App';
import {
  ArrowRight,
  BarChart3,
  Bell,
  Bot,
  Clapperboard,
  Eye,
  FileImage,
  MonitorPlay,
  ShieldCheck,
  Target,
} from 'lucide-react';
import { FadeIn } from '../components/AnimateIn';

const capabilityItems = [
  {
    title: 'AI智能识别',
    desc: '人体行为分析\n精准识别风险',
    icon: Target,
  },
  {
    title: '实时告警',
    desc: '多级告警机制\n异常事件秒级响应',
    icon: Bell,
  },
  {
    title: '数据可视化',
    desc: '多维数据统计\n掌握安全态势',
    icon: BarChart3,
  },
  {
    title: '多场景适用',
    desc: '覆盖多种公共场所\n灵活部署管理',
    icon: ShieldCheck,
  },
];

const metrics = [
  { value: '256', unit: '路', label: '接入设备总数', icon: Bot },
  { value: '12', unit: '起', label: '今日告警事件', icon: Bell },
  { value: '98.6', unit: '%', label: '今日识别准确率', icon: BarChart3 },
  { value: '7×24', unit: '小时', label: '实时守护安全', icon: ShieldCheck },
];

const entryCards = [
  {
    title: '图片检测',
    desc: '批量上传图片，逐张跟进检测状态，查看结果图与告警截图。',
    view: 'imageDetection' as View,
    icon: FileImage,
  },
  {
    title: '视频检测',
    desc: '上传视频后逐帧分析，输出处理进度、告警帧和检测日志。',
    view: 'videoDetection' as View,
    icon: Clapperboard,
  },
  {
    title: '实时监控',
    desc: '查看多路摄像头画面，监测异常告警与设备运行状态。',
    view: 'realtime' as View,
    icon: MonitorPlay,
  },
];

function AdminPreview() {
  return (
    <div className="w-full max-w-[980px] xl:justify-self-end rounded-xl border border-blue-100 bg-white shadow-xl shadow-blue-900/10 overflow-hidden">
      <div className="grid grid-cols-[88px_1fr] bg-white">
        <aside className="bg-[#061f3d] text-white p-2.5">
          <div className="text-[9px] font-semibold mb-4 truncate">慧眼识行</div>
          {['图片检测', '视频检测', '实时监控', '告警记录'].map((item, index) => (
            <div
              key={item}
              className={`h-7 rounded-md px-2 mb-1.5 flex items-center text-[9px] ${
                index === 0 ? 'bg-blue-600 text-white' : 'text-blue-100/75'
              }`}
            >
              {item}
            </div>
          ))}
        </aside>

        <div className="bg-gray-50 min-w-0">
          <div className="h-9 bg-white border-b border-gray-100 flex items-center justify-between px-3">
            <div className="text-xs font-semibold text-gray-900">图片检测</div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <span className="h-6 w-6 rounded-full bg-blue-600" />
            </div>
          </div>

          <div className="grid grid-cols-[1.28fr_0.72fr] gap-2.5 p-2.5">
            <div className="space-y-2.5 min-w-0">
              <div className="rounded-lg border border-dashed border-blue-200 bg-white p-1.5">
                <img
                  src="/images/home-detection-frame.png"
                  alt="图片检测预览"
                  className="w-full aspect-[16/10] object-cover rounded-md"
                />
              </div>

              <div className="grid grid-cols-4 gap-2">
                {[
                  ['已选图片', '12'],
                  ['已处理', '1/12'],
                  ['告警/异常', '0'],
                  ['失败数', '1'],
                ].map(([label, value], index) => (
                  <div
                    key={label}
                    className={`rounded-md border px-2 py-2 ${
                      index === 1
                        ? 'bg-blue-50 border-blue-100'
                        : index === 2
                          ? 'bg-red-50 border-red-100'
                          : index === 3
                            ? 'bg-amber-50 border-amber-100'
                            : 'bg-gray-50 border-gray-100'
                    }`}
                  >
                    <p className="text-[8px] text-gray-500 mb-0.5">{label}</p>
                    <p className="text-xs font-bold text-gray-900">{value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-gray-900">实时检测进度</p>
                  <span className="rounded-full border border-blue-100 bg-white px-2 py-0.5 text-[10px] text-blue-600">检测中</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ['当前进度', '1/12 · 第 2 张'],
                    ['当前阶段', 'AI 推理中'],
                    ['耗时', '12.0s'],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-md bg-white border border-blue-100 px-2 py-1.5">
                      <p className="text-[8px] text-gray-500 mb-0.5">{label}</p>
                      <p className="text-[11px] font-semibold text-gray-900 truncate">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2.5 min-w-0">
              <div className="rounded-lg bg-white border border-gray-100 p-2.5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-900">当前图片结果</p>
                  <span className="rounded-full bg-gray-50 border border-gray-100 px-2 py-0.5 text-[10px] text-gray-500">等待检测</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {['检测状态', '风险等级', '任务 ID', '单张耗时'].map((label) => (
                    <div key={label} className="rounded-md bg-gray-50 border border-gray-100 p-1.5">
                      <p className="text-[8px] text-gray-500 mb-0.5">{label}</p>
                      <p className="text-[11px] font-semibold text-gray-900">待检测</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg bg-white border border-gray-100 p-2.5">
                <p className="text-xs font-semibold text-gray-900 mb-2">推理链路</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['YOLO 检测', '等待检测'],
                    ['Tiled YOLO', '-'],
                    ['RTMO 姿态复核', '等待检测'],
                    ['Fusion 结论', '-'],
                  ].map(([label, value], index) => (
                    <div
                      key={label}
                      className={`rounded-md border p-2 ${
                        index === 0
                          ? 'bg-blue-50 border-blue-100'
                          : index === 2
                            ? 'bg-indigo-50 border-indigo-100'
                            : index === 3
                              ? 'bg-emerald-50 border-emerald-100'
                              : 'bg-gray-50 border-gray-100'
                      }`}
                    >
                      <p className="text-[8px] text-blue-600 mb-0.5">{label}</p>
                      <p className="text-[11px] font-semibold text-gray-900">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg bg-white border border-gray-100 overflow-hidden">
                <img
                  src="/images/home-detection-frame.png"
                  alt="检测结果预览"
                  className="w-full aspect-[16/9] object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home({ setView }: { setView: (v: View) => void }) {
  return (
    <main className="relative min-h-[calc(100vh-64px)] overflow-hidden bg-white">
      <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-blue-50 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-blue-100/70 to-transparent" />
      <div className="absolute -bottom-20 left-0 right-0 h-44 bg-blue-500/10 rotate-[-3deg] origin-left" />
      <div className="absolute -bottom-28 left-0 right-0 h-44 bg-blue-600/10 rotate-[-6deg] origin-left" />

      <section className="relative max-w-[1640px] mx-auto px-6 lg:px-10 py-8 lg:py-10">
        <div className="grid grid-cols-1 xl:grid-cols-[0.68fr_1.32fr] gap-14 2xl:gap-20 items-center min-h-[470px]">
          <FadeIn>
            <div>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-sm">
                  <Eye className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-[#12346b] leading-tight">慧眼识行</p>
                  <p className="text-[10px] font-semibold tracking-[0.18em] text-blue-500">HUIYAN SYSTEM</p>
                </div>
              </div>

              <h1 className="text-4xl xl:text-5xl font-semibold text-[#12346b] tracking-normal leading-tight mb-5">
                慧眼识行安全监测系统
              </h1>
              <p className="text-base xl:text-lg text-slate-500 mb-9">
                AI赋能视觉，让安全管理更智能、更高效、更安心
              </p>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-[620px]">
                {capabilityItems.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.title}
                      type="button"
                      onClick={() => index === 0 && setView('imageDetection')}
                      className="group text-center cursor-pointer"
                    >
                      <div className="mx-auto w-10 h-10 text-blue-600 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                        <Icon className="w-8 h-8" strokeWidth={1.7} />
                      </div>
                      <p className="text-sm font-semibold text-blue-600 mb-2">{item.title}</p>
                      <p className="text-xs leading-5 text-slate-500 whitespace-pre-line">{item.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.08} direction="left">
            <AdminPreview />
          </FadeIn>
        </div>

        <FadeIn delay={0.12}>
          <div className="relative mt-4 w-[1120px] max-w-full mx-auto space-y-5">
            <div className="w-full rounded-xl border border-blue-100 bg-white/90 backdrop-blur-sm shadow-sm px-5 py-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
              {metrics.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className={`flex items-center justify-center gap-3 ${index > 0 ? 'lg:border-l lg:border-blue-100' : ''}`}
                  >
                    <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-end gap-1">
                        <span className="text-2xl xl:text-3xl font-bold text-blue-600 leading-none">{item.value}</span>
                        <span className="text-xs text-slate-500 pb-1">{item.unit}</span>
                      </div>
                      <p className="text-xs xl:text-sm text-slate-500 mt-1.5">{item.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="w-full rounded-xl border border-blue-100 bg-white/90 backdrop-blur-sm shadow-sm px-5 py-4 grid grid-cols-1 md:grid-cols-3">
              {entryCards.map((item, index) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => setView(item.view)}
                    className={`group min-h-[92px] p-3 text-left hover:bg-blue-50/70 transition-colors cursor-pointer flex items-start gap-3 ${
                      index > 0 ? 'md:border-l md:border-blue-100' : ''
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <h2 className="text-base font-semibold text-[#12346b]">{item.title}</h2>
                        <ArrowRight className="w-4 h-4 text-blue-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                      </div>
                      <p className="text-sm text-slate-500 leading-6">{item.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </FadeIn>
      </section>
    </main>
  );
}
