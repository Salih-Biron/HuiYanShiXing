import {
  Building2,
  GraduationCap,
  HardHat,
  ShoppingBag,
  TrainFront,
  UserRoundCheck,
} from 'lucide-react';
import { FadeIn, StaggerContainer, StaggerItem } from '../components/AnimateIn';

const scenarios = [
  {
    title: '校园走廊',
    image: '/images/ppt/scenario-campus.png',
    icon: GraduationCap,
    color: 'blue',
    stats: ['总人数 18', '正常 18', '异常 0'],
    tags: ['人员通行监测', '聚集行为预警', '跌倒检测预警'],
  },
  {
    title: '养老活动室',
    image: '/images/ppt/scenario-nursing.png',
    icon: UserRoundCheck,
    color: 'cyan',
    stats: ['总人数 12', '正常 11', '异常 1'],
    tags: ['跌倒检测预警', '长时间静止预警', '离床行为监测'],
  },
  {
    title: '商场中庭',
    image: '/images/ppt/scenario-mall.png',
    icon: ShoppingBag,
    color: 'indigo',
    stats: ['总人数 36', '正常 34', '异常 2'],
    tags: ['跌倒检测预警', '客流密度分析', '异常行为识别'],
  },
  {
    title: '地铁站台',
    image: '/images/ppt/scenario-subway.png',
    icon: TrainFront,
    color: 'sky',
    stats: ['总人数 26', '正常 26', '异常 0'],
    tags: ['危险行为预警', '乘客密度监测', '违规滞留预警'],
  },
  {
    title: '施工现场',
    image: '/images/ppt/scenario-construction.png',
    icon: HardHat,
    color: 'blue',
    stats: ['总人数 15', '正常 15', '异常 0'],
    tags: ['安全帽检测', '人员闯入预警', '区域入侵监测'],
  },
  {
    title: '社区广场',
    image: '/images/ppt/scenario-community.jpeg',
    icon: Building2,
    color: 'indigo',
    stats: ['总人数 22', '正常 21', '异常 1'],
    tags: ['行为姿态分析', '儿童看护监测', '异常行为预警'],
  },
];

function iconColor(color: string): string {
  if (color === 'cyan') return 'bg-cyan-50 text-cyan-600';
  if (color === 'indigo') return 'bg-indigo-50 text-indigo-600';
  if (color === 'sky') return 'bg-sky-50 text-sky-600';
  return 'bg-blue-50 text-blue-600';
}

export default function Scenarios() {
  return (
    <main className="bg-gradient-to-b from-blue-50/70 via-white to-white min-h-screen pb-14">
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        <FadeIn>
          <div className="text-center mb-9">
            <h1 className="text-3xl font-semibold text-[#12346b]">应用场景</h1>
            <div className="w-11 h-[3px] rounded-full bg-blue-600 mx-auto mt-4" />
          </div>
        </FadeIn>

        <StaggerContainer staggerDelay={0.06} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {scenarios.map((scenario) => {
            const Icon = scenario.icon;
            return (
              <StaggerItem key={scenario.title}>
                <article className="rounded-xl bg-white border border-blue-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                  <div className="relative aspect-[16/9] bg-gray-100 overflow-hidden">
                    <img
                      src={scenario.image}
                      alt={scenario.title}
                      className="w-full h-full object-cover"
                      onError={(event) => {
                        const image = event.currentTarget;
                        if (image.dataset.fallback) {
                          image.style.display = 'none';
                          return;
                        }
                        image.dataset.fallback = 'true';
                        image.src = '/images/home-detection-frame.png';
                      }}
                    />
                    <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/45 to-transparent" />
                    <div className="absolute left-3 top-3 rounded bg-black/55 px-2 py-1 text-xs font-medium text-white">
                      {scenario.title}
                    </div>
                    <div className="absolute right-3 top-3 rounded bg-black/55 px-2.5 py-1.5 text-[11px] text-white leading-5">
                      {scenario.stats.map((item) => (
                        <div key={item}>{item}</div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconColor(scenario.color)}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <h2 className="text-base font-semibold text-[#17376d]">{scenario.title}</h2>
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-2">
                      {scenario.tags.map((tag) => (
                        <span key={tag} className="inline-flex items-center text-xs text-slate-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </section>
    </main>
  );
}
