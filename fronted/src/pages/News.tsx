import React from 'react';
import { View } from '../App';
import {
  Newspaper, Calendar, Tag, ArrowRight, TrendingUp,
  Award, Rocket, BookOpen, Users
} from 'lucide-react';

interface NewsItem {
  id: number;
  title: string;
  summary: string;
  date: string;
  category: string;
  image: string;
  featured?: boolean;
}

const newsItems: NewsItem[] = [
  {
    id: 1,
    title: '慧眼识行AI安全监控系统v2.3正式发布',
    summary: '新版本引入了Tiled YOLO回退检测机制，对小目标和遮挡场景的检测能力大幅提升，跌倒检测准确率突破98.7%。',
    date: '2024-05-20',
    category: '产品发布',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCD0PlKUy3FhlltVbi0GZuRU-yGNUqzDlXQiL7i9DTj2dHTo9vf7DvFRguUOj6ulKDYABiuZLht6yrvkg5B-SzARjs_m6jgoBIzhMsNG9mm-CXhCbRmOtxNfbuJ9it5ArXyVhEFm746vcCtOkz33_4TlEV5Uu59m-3rPDag0yOWUYb6pYlDybpXmv7aYH-sFtaZhvN4zJ1o1sMD__VkX6ahFvXYlLkZOb4ZvPkNuDfVElXpVBQJwNw915VoUExR63RlVkD4TA-Fl3aM',
    featured: true,
  },
  {
    id: 2,
    title: '阳光养老院AI监控项目成功验收',
    summary: '经过3个月的试运行，阳光养老院AI安全监控系统成功预警12起跌倒事件，获得客户高度认可。',
    date: '2024-05-15',
    category: '客户案例',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAaVHNSUO8F8_5HcrhXVa5LV2gSNQbKq6hyzWGjIJxYFcbKqLd9gVq91UVV-cDUyyQxdKekrLrsMR6yl5PR2ebYeaNu5SZoPvO7ecuePjbO4uBH3Nn6vBLDKZ2quJbFu5lSsxGCOAqs5t1c-IU9cbFNvuwVAhNaECJMMYJaD3py4xFhyDMfMUdqdcs0MS9UwT51fwPYk3BLgbvx2yyE1qZcGbxvbmkM5SdYyuTSM3fky0aj_qdsUb1rLM7HXfo_bvI-lI3ISgwT0KzI',
  },
  {
    id: 3,
    title: 'RTMO姿态估计算法优化报告',
    summary: '技术团队对RTMO算法进行了专项优化，在保持精度的同时推理速度提升40%，满足实时监控需求。',
    date: '2024-05-10',
    category: '技术更新',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAIlYQFcL3C7j595c3s_70Zbd5_0r9nXnRa-kqV1VnKLotxUB8J_zB9Ms2h4kuMeQdAiUK05UJI-QUtFZzNxIYFa-Wy_q44CzrQVfktQM4PtEZmVE8Pca88ki5j5HTD3bom0qumpYdCq_4Afg48ORcjbDzFOHj4Rg-_IguP9EbVR15CQ8_vfoM5TvaFYjZKkgXA3JYJnD5izRgYTvjhrLEuPU5Cv8bKyXA37CPdgMuMCEFF9rIpDLy0hnk59J6Ott6eeYHVcjjfZ7zV',
  },
  {
    id: 4,
    title: '公司荣获"智慧安防创新企业"称号',
    summary: '在2024中国智慧安防大会上，慧眼识行凭借在AI安全监控领域的技术创新，荣获年度创新企业奖。',
    date: '2024-05-05',
    category: '公司荣誉',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAVdCNWn6TwA8mmnw5FIPZXo5h1fE4-SpYtrvsBYAxOMPJd4BzN1TtvwtY3ZyVsgiEtyPK7TN60wBdKU_rFEugmWREyoZXPpU5UD6ilwYkx2peDNfg4ujEJmVMNaKM1ZzxIDim5tB2skZznAWQtgFPzdcywSzmG-9mXPNO8ObU5BQ6BQ3NJJ1z-Jq5qjXsVP_gtbKT8_RiT_sqD3SKsiYKvG6zaxtTN_WGAT_1xv37DMyG5fD8VIQMqUjoAL9n_WZRV1w26ykVy17di',
  },
  {
    id: 5,
    title: '智慧工地安全监控解决方案上线',
    summary: '针对建筑施工场景，推出安全帽检测、危险区域入侵检测等新功能，助力工地安全管理数字化转型。',
    date: '2024-04-28',
    category: '产品发布',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAOAu9nOe2jc3F2ZRCLx2f1OaKtpjuj5GQq4Spvk8odGJsTfkZu5A_hOnunFLQVPP1-93__qI5l_FBF1wJUnbU5M_XN-jrOfntPxX-ENXzYguZ15CilIt1-tsXxxxPDS3Ipd8QXf1dWyoUK9kLRTuWA6k8o8vqkELMuw_0Fv0i-vhUJqcYIEkuiHI55DpBhcXFDUAKfH7KzviSwAqSxrIY_x62vhkBCrmSYRi4sJWDJ-kt1HiLU0VxKsINLJIv8vZ4xeW9Yf3qbx9Bp',
  },
  {
    id: 6,
    title: '与多所高校达成产学研合作协议',
    summary: '公司与清华大学、北京大学等高校签署合作协议，共同推进AI安全监控技术的前沿研究。',
    date: '2024-04-20',
    category: '公司动态',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAEELsfR6dD21et11rp-D7Y-pPm1WeBCcLORVoZHZEt7fAmwsyfgERz3W8TVhH7TLrXrxWrXtZYjtjvz4OhUClbKFzdW0BKcnHHO-4NuCCJbu9Yhh6DQC0hhKvsc112-S-GrwBMQrzHtOM52Z7u2purNQfs_tS_f7uIcguttMa2eLr4n739oPtsIVQrnDCwWF7D1yRIkec8xLa_sM9gWWYp47HybeHM8K22r5H6JMuFNcj4ttzbzNnleBGK5RhEduayY6gOuw-nWC3b',
  },
];

const categoryIcons: Record<string, React.ReactNode> = {
  '产品发布': <Rocket className="w-3.5 h-3.5" />,
  '客户案例': <Users className="w-3.5 h-3.5" />,
  '技术更新': <BookOpen className="w-3.5 h-3.5" />,
  '公司荣誉': <Award className="w-3.5 h-3.5" />,
  '公司动态': <TrendingUp className="w-3.5 h-3.5" />,
};

const categoryColors: Record<string, string> = {
  '产品发布': 'bg-blue-100 text-blue-700',
  '客户案例': 'bg-green-100 text-green-700',
  '技术更新': 'bg-purple-100 text-purple-700',
  '公司荣誉': 'bg-amber-100 text-amber-700',
  '公司动态': 'bg-cyan-100 text-cyan-700',
};

export default function News({ setView }: { setView: (v: View) => void }) {
  const featured = newsItems.find(n => n.featured);
  const rest = newsItems.filter(n => !n.featured);

  return (
    <div className="bg-white">
      {/* Hero - ChatGPT-style blue gradient */}
      <section className="bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center bg-white/10 text-white/90 text-sm px-4 py-1.5 rounded-full mb-6 border border-white/20">
            <Newspaper className="w-4 h-4 mr-2" /> 新闻动态
          </div>
          <h1 className="text-4xl font-bold mb-4">最新资讯</h1>
          <p className="text-blue-200 max-w-2xl mx-auto text-lg">
            了解慧眼识行的最新产品动态、技术突破和行业资讯
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Featured */}
        {featured && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-12 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="grid lg:grid-cols-2">
              <div className="relative h-64 lg:h-auto">
                <img src={featured.image} alt={featured.title} className="w-full h-full object-cover" />
                <div className="absolute top-4 left-4">
                  <span className="bg-red-500 text-white text-xs px-3 py-1 rounded-full font-medium">最新</span>
                </div>
              </div>
              <div className="p-8 flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-4">
                  <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${categoryColors[featured.category]}`}>
                    {categoryIcons[featured.category]} {featured.category}
                  </span>
                  <span className="text-xs text-gray-400 flex items-center"><Calendar className="w-3 h-3 mr-1" />{featured.date}</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">{featured.title}</h2>
                <p className="text-gray-600 leading-relaxed mb-6">{featured.summary}</p>
                <button className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center">
                  阅读全文 <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rest.map(item => (
            <div key={item.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer group">
              <div className="relative h-48 overflow-hidden">
                <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${categoryColors[item.category]}`}>
                    {categoryIcons[item.category]} {item.category}
                  </span>
                  <span className="text-xs text-gray-400">{item.date}</span>
                </div>
                <h3 className="font-bold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed line-clamp-3">{item.summary}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
