import React from 'react';
import { View } from '../App';
import {
  Building2, Heart, GraduationCap, Train, HardHat, Trees,
  Quote, TrendingUp, Users, Shield, CheckCircle2, ArrowRight
} from 'lucide-react';

const cases = [
  {
    icon: <Heart className="w-6 h-6" />,
    org: '阳光养老院',
    location: '北京市朝阳区',
    scenario: '养老院活动室及走廊',
    result: '跌倒事件响应时间从平均15分钟缩短至30秒内',
    metrics: [
      { label: '跌倒检测准确率', value: '99.2%' },
      { label: '误报率下降', value: '87%' },
      { label: '日均检测帧数', value: '50万+' },
    ],
    quote: '系统上线3个月以来，成功预警了12起跌倒事件，老人安全得到了极大保障。',
    person: '王院长',
    color: 'red',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAaVHNSUO8F8_5HcrhXVa5LV2gSNQbKq6hyzWGjIJxYFcbKqLd9gVq91UVV-cDUyyQxdKekrLrsMR6yl5PR2ebYeaNu5SZoPvO7ecuePjbO4uBH3Nn6vBLDKZ2quJbFu5lSsxGCOAqs5t1c-IU9cbFNvuwVAhNaECJMMYJaD3py4xFhyDMfMUdqdcs0MS9UwT51fwPYk3BLgbvx2yyE1qZcGbxvbmkM5SdYyuTSM3fky0aj_qdsUb1rLM7HXfo_bvI-lI3ISgwT0KzI',
  },
  {
    icon: <GraduationCap className="w-6 h-6" />,
    org: '第三实验中学',
    location: '上海市浦东新区',
    scenario: '教学楼走廊及操场',
    result: '校园安全事件同比下降62%，家长满意度提升至98%',
    metrics: [
      { label: '监控覆盖率', value: '100%' },
      { label: '事件响应时间', value: '<1min' },
      { label: '家长满意度', value: '98%' },
    ],
    quote: 'AI监控系统帮助我们实现了校园安全的智能化管理，老师们可以更专注于教学。',
    person: '李校长',
    color: 'blue',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAIlYQFcL3C7j595c3s_70Zbd5_0r9nXnRa-kqV1VnKLotxUB8J_zB9Ms2h4kuMeQdAiUK05UJI-QUtFZzNxIYFa-Wy_q44CzrQVfktQM4PtEZmVE8Pca88ki5j5HTD3bom0qumpYdCq_4Afg48ORcjbDzFOHj4Rg-_IguP9EbVR15CQ8_vfoM5TvaFYjZKkgXA3JYJnD5izRgYTvjhrLEuPU5Cv8bKyXA37CPdgMuMCEFF9rIpDLy0hnk59J6Ott6eeYHVcjjfZ7zV',
  },
  {
    icon: <HardHat className="w-6 h-6" />,
    org: '中建三局智慧工地',
    location: '深圳市南山区',
    scenario: '建筑施工现场',
    result: '安全事故率降低75%，安全帽佩戴合规率提升至99.5%',
    metrics: [
      { label: '安全事故降低', value: '75%' },
      { label: '安全帽合规率', value: '99.5%' },
      { label: '巡检效率提升', value: '300%' },
    ],
    quote: 'AI监控替代了大量人工巡检工作，不仅提高了效率，更重要的是降低了安全风险。',
    person: '张项目经理',
    color: 'amber',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAOAu9nOe2jc3F2ZRCLx2f1OaKtpjuj5GQq4Spvk8odGJsTfkZu5A_hOnunFLQVPP1-93__qI5l_FBF1wJUnbU5M_XN-jrOfntPxX-ENXzYguZ15CilIt1-tsXxxxPDS3Ipd8QXf1dWyoUK9kLRTuWA6k8o8vqkELMuw_0Fv0i-vhUJqcYIEkuiHI55DpBhcXFDUAKfH7KzviSwAqSxrIY_x62vhkBCrmSYRi4sJWDJ-kt1HiLU0VxKsINLJIv8vZ4xeW9Yf3qbx9Bp',
  },
];

const colorMap: Record<string, { bg: string; text: string; light: string; border: string }> = {
  red: { bg: 'bg-red-500', text: 'text-red-600', light: 'bg-red-50', border: 'border-red-200' },
  blue: { bg: 'bg-blue-500', text: 'text-blue-600', light: 'bg-blue-50', border: 'border-blue-200' },
  amber: { bg: 'bg-amber-500', text: 'text-amber-600', light: 'bg-amber-50', border: 'border-amber-200' },
};

export default function SuccessCases({ setView }: { setView: (v: View) => void }) {
  return (
    <div className="bg-white">
      {/* Hero - ChatGPT-style blue gradient */}
      <section className="bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center bg-white/10 text-white/90 text-sm px-4 py-1.5 rounded-full mb-6 border border-white/20">
            <CheckCircle2 className="w-4 h-4 mr-2" /> 成功案例
          </div>
          <h1 className="text-4xl font-bold mb-4">客户信赖，成效显著</h1>
          <p className="text-blue-200 max-w-2xl mx-auto text-lg">
            已在养老、教育、建筑等多个行业成功落地，助力客户实现安全监控智能化升级
          </p>
        </div>
      </section>

      {/* Cases */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 space-y-16">
        {cases.map((c, i) => {
          const cl = colorMap[c.color];
          return (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
              <div className="grid lg:grid-cols-2">
                {/* Image */}
                <div className="relative h-64 lg:h-auto">
                  <img src={c.image} alt={c.org} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                  <div className="absolute bottom-4 left-4 flex items-center text-white">
                    <div className={`w-10 h-10 rounded-full ${cl.bg} flex items-center justify-center mr-3`}>
                      {c.icon}
                    </div>
                    <div>
                      <p className="font-bold text-lg">{c.org}</p>
                      <p className="text-white/80 text-sm">{c.location}</p>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-8">
                  <div className={`inline-flex items-center ${cl.light} ${cl.text} text-xs px-3 py-1 rounded-full mb-4 font-medium border ${cl.border}`}>
                    {c.scenario}
                  </div>

                  <h3 className="text-lg font-bold text-gray-900 mb-3">{c.result}</h3>

                  {/* Metrics */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    {c.metrics.map((m, j) => (
                      <div key={j} className="text-center p-3 bg-gray-50 rounded-lg">
                        <p className={`text-xl font-bold ${cl.text}`}>{m.value}</p>
                        <p className="text-xs text-gray-500 mt-1">{m.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Quote */}
                  <div className={`border-l-4 ${cl.border} pl-4 py-2`}>
                    <div className="flex items-start">
                      <Quote className={`w-4 h-4 ${cl.text} mr-2 mt-0.5 shrink-0`} />
                      <p className="text-sm text-gray-600 italic leading-relaxed">{c.quote}</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-2 ml-6">—— {c.person}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">成为下一个成功案例</h2>
          <p className="text-blue-100 mb-8 max-w-lg mx-auto">联系我们，获取专属的安全监控解决方案</p>
          <button
            onClick={() => setView('realtime')}
            className="bg-white text-blue-700 px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors shadow-lg flex items-center mx-auto"
          >
            立即体验 <ArrowRight className="w-4 h-4 ml-2" />
          </button>
        </div>
      </section>
    </div>
  );
}
