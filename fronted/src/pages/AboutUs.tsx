import React from 'react';
import { View } from '../App';
import {
  Eye, Users, Target, Award, MapPin, Mail, Phone,
  Globe, Rocket, Heart, Lightbulb, Shield, ArrowRight
} from 'lucide-react';

const values = [
  { icon: <Lightbulb className="w-6 h-6" />, title: '技术创新', desc: '持续投入研发，推动AI安全监控技术前沿探索' },
  { icon: <Heart className="w-6 h-6" />, title: '客户至上', desc: '以客户需求为导向，提供最优质的产品和服务' },
  { icon: <Shield className="w-6 h-6" />, title: '安全可靠', desc: '系统稳定性99.9%，数据安全是我们的生命线' },
  { icon: <Users className="w-6 h-6" />, title: '开放协作', desc: '与高校、行业伙伴深度合作，共建安全生态' },
];

const team = [
  { name: '张博士', role: '首席技术官', desc: '清华大学计算机视觉博士，10年AI研发经验', avatar: 'ZB' },
  { name: '李总监', role: '产品总监', desc: '前华为安全产品负责人，深耕安防行业15年', avatar: 'LZ' },
  { name: '王工程师', role: '算法负责人', desc: 'YOLO/RTMO算法优化专家，发表论文20余篇', avatar: 'WG' },
  { name: '赵经理', role: '客户成功经理', desc: '服务过100+企业客户，项目交付率100%', avatar: 'ZJ' },
];

const milestones = [
  { year: '2022', event: '公司成立，开始AI安全监控技术研究' },
  { year: '2023', event: '完成YOLO跌倒检测模型第一版训练' },
  { year: '2023', event: '引入RTMO姿态估计算法，实现双引擎架构' },
  { year: '2024', event: '首个商业项目（阳光养老院）成功交付' },
  { year: '2024', event: '系统v2.3发布，检测准确率达98.7%' },
];

const avatarColors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-amber-500'];

export default function AboutUs({ setView }: { setView: (v: View) => void }) {
  return (
    <div className="bg-white">
      {/* Hero - ChatGPT-style blue gradient */}
      <section className="bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center bg-white/10 text-white/90 text-sm px-4 py-1.5 rounded-full mb-6 border border-white/20">
                <Eye className="w-4 h-4 mr-2" /> 关于我们
              </div>
              <h1 className="text-4xl font-bold mb-6">用AI守护安全，让世界更美好</h1>
              <p className="text-blue-200 text-lg leading-relaxed mb-8">
                慧眼识行科技专注于AI安全监控领域，通过深度学习和计算机视觉技术，为养老、教育、建筑等行业提供智能化安全解决方案。我们的使命是让每一个角落都安全无忧。
              </p>
              <div className="grid grid-cols-3 gap-6">
                <div><p className="text-3xl font-bold text-blue-300">50+</p><p className="text-sm text-blue-200">企业客户</p></div>
                <div><p className="text-3xl font-bold text-blue-300">500+</p><p className="text-sm text-blue-200">接入设备</p></div>
                <div><p className="text-3xl font-bold text-blue-300">98.7%</p><p className="text-sm text-blue-200">检测准确率</p></div>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-8">
                <div className="grid grid-cols-2 gap-4">
                  {values.map((v, i) => (
                    <div key={i} className="bg-white/5 rounded-xl p-5 border border-white/10 hover:bg-white/10 transition-colors">
                      <div className="text-blue-300 mb-3">{v.icon}</div>
                      <h3 className="font-semibold text-white text-sm mb-1">{v.title}</h3>
                      <p className="text-xs text-blue-200/70">{v.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-6">我们的使命</h2>
            <p className="text-gray-600 leading-relaxed mb-6">
              慧眼识行科技成立于2022年，由一群来自清华大学、北京大学的AI研究者创立。我们坚信，人工智能技术可以在保障公共安全方面发挥巨大作用。
            </p>
            <p className="text-gray-600 leading-relaxed mb-6">
              从养老院的跌倒检测到校园的安全监控，从工地的安全帽检测到地铁的人群分析，我们的AI系统正在守护着无数人的安全。
            </p>
            <div className="flex items-center gap-4">
              <div className="flex -space-x-2">
                {avatarColors.map((c, i) => (
                  <div key={i} className={`w-8 h-8 rounded-full ${c} text-white flex items-center justify-center text-xs font-bold border-2 border-white`}>
                    {['Z', 'L', 'W', 'T'][i]}
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-500">核心团队 20+ 人</p>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">发展里程碑</h3>
            {milestones.map((m, i) => (
              <div key={i} className="flex items-start">
                <div className="flex flex-col items-center mr-4">
                  <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-blue-200"></div>
                  {i < milestones.length - 1 && <div className="w-0.5 h-8 bg-blue-200 mt-1"></div>}
                </div>
                <div>
                  <span className="text-xs text-blue-600 font-mono font-bold">{m.year}</span>
                  <p className="text-sm text-gray-700">{m.event}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="bg-gray-50 border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">核心团队</h2>
            <p className="text-gray-500">来自顶尖高校和科技企业的AI专家</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {team.map((t, i) => (
              <div key={i} className="text-center p-6 rounded-xl border border-gray-200 bg-white hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <div className={`w-16 h-16 rounded-full ${avatarColors[i]} text-white flex items-center justify-center text-xl font-bold mx-auto mb-4`}>
                  {t.avatar}
                </div>
                <h3 className="font-bold text-gray-800 mb-1">{t.name}</h3>
                <p className="text-sm text-blue-600 font-medium mb-2">{t.role}</p>
                <p className="text-xs text-gray-500">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-10 lg:p-16">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div className="text-white">
              <h2 className="text-3xl font-bold mb-4">联系我们</h2>
              <p className="text-blue-100 mb-8">期待与您合作，共同守护安全</p>
              <div className="space-y-4">
                <div className="flex items-center text-blue-100"><MapPin className="w-5 h-5 mr-3 text-blue-300" />北京市海淀区中关村科技园</div>
                <div className="flex items-center text-blue-100"><Mail className="w-5 h-5 mr-3 text-blue-300" />contact@huiyan-shixing.com</div>
                <div className="flex items-center text-blue-100"><Phone className="w-5 h-5 mr-3 text-blue-300" />+86 400-888-0000</div>
                <div className="flex items-center text-blue-100"><Globe className="w-5 h-5 mr-3 text-blue-300" />www.huiyan-shixing.com</div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20">
              <h3 className="text-white font-semibold mb-4">预约演示</h3>
              <div className="space-y-3">
                <input type="text" placeholder="您的姓名" className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-white/50 text-sm focus:bg-white/20 outline-none" />
                <input type="email" placeholder="邮箱地址" className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-white/50 text-sm focus:bg-white/20 outline-none" />
                <input type="text" placeholder="公司/机构名称" className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-white/50 text-sm focus:bg-white/20 outline-none" />
                <button className="w-full bg-white text-blue-700 py-2.5 rounded-lg font-semibold hover:bg-blue-50 transition-colors text-sm">
                  提交预约
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
