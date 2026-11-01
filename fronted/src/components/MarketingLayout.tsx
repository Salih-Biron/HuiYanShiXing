import React from 'react';
import { motion } from 'motion/react';
import { View } from '../App';
import { Eye } from 'lucide-react';

interface Props {
  view: View;
  setView: (view: View) => void;
  children: React.ReactNode;
}

const navItems: { label: string; view: View }[] = [
  { label: '首页', view: 'home' },
  { label: '产品功能', view: 'product_features' },
  { label: '技术方案', view: 'tech_solutions' },
  { label: '应用场景', view: 'scenarios' },
  { label: '成功案例', view: 'success_cases' },
  { label: '新闻动态', view: 'news' },
  { label: '关于我们', view: 'about' },
];

export default function MarketingLayout({ view, setView, children }: Props) {
  return (
    <div className="text-gray-800 antialiased min-h-screen flex flex-col bg-white">
      <nav className="bg-white/95 backdrop-blur-lg sticky top-0 z-50 border-b border-blue-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center gap-2.5 cursor-pointer" onClick={() => setView('home')}>
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center">
                <Eye size={18} />
              </div>
              <div>
                <h1 className="text-[15px] font-semibold text-gray-900 leading-tight">慧眼识行</h1>
                <p className="text-[9px] text-gray-400 font-medium tracking-wider uppercase leading-tight">HuiYan System</p>
              </div>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map(item => (
                <button
                  key={item.view}
                  onClick={() => setView(item.view)}
                  className={`relative px-4 py-2 text-[13px] font-medium transition-colors rounded-md cursor-pointer ${
                    view === item.view
                      ? 'text-blue-600'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {item.label}
                  {view === item.view && (
                    <span className="absolute left-1/2 -bottom-[13px] h-[3px] w-8 -translate-x-1/2 rounded-full bg-blue-600" />
                  )}
                </button>
              ))}
            </div>

            {/* CTA */}
            <div className="hidden md:flex items-center">
              <button
                onClick={() => setView('imageDetection')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md text-[13px] font-medium transition-colors cursor-pointer shadow-sm"
              >
                申请试用
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <motion.div
        key={view}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className="flex-1"
      >
        {children}
      </motion.div>
    </div>
  );
}
