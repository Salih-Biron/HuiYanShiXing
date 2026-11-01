import React from 'react';
import { View } from '../App';
import { 
  ChevronLeft, ChevronRight, AlertTriangle, Filter, Download
} from 'lucide-react';

export default function CameraDetail() {
  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 space-y-4">
      {/* Top Section: Video & Details */}
      <div className="flex gap-6 flex-col lg:flex-row h-auto lg:h-[500px]">
        {/* Video Container */}
        <div className="flex-[3] bg-black rounded-lg relative overflow-hidden flex flex-col shadow-sm border border-gray-200">
          <img 
            src="https://lh3.googleusercontent.com/aida/ADBb0ujOn5UQqfc0Z5N2uceY3x7Myc6dKthBHR1P8kyb3ZK3fua9WfQCe6BvgynePjjQj_GOL6kannrNJMHAHlNoNTAwJDmk40B-eKP_oZNDAxhjs7vLWi5SYFr31M-QolhJLr0AGV7yKWzgPrxHPawTgxwwuP4xWZTiqSMYw5Lhb-W61ETOuqa_9U34qFgR12hPmf0QODNkHSb5L2VQWbTrq-4hGhmZsaOfo85oNMhkUl8iK-ybRlGqYJzvXopA" 
            alt="Live Feed" 
            className="w-full h-full object-cover opacity-90"
          />
          <div className="absolute top-4 left-4 text-white bg-black/50 px-2 py-1 rounded text-sm font-mono backdrop-blur-sm">
            2024-05-20 10:23:41
          </div>
          
          {/* Mock Overlays */}
          <div className="absolute top-[45%] left-[40%] w-[20%] h-[18%] border-2 border-red-500 bg-red-500/20">
            <div className="absolute -top-6 left-[-2px] bg-red-500 text-white px-1.5 py-0.5 text-xs font-bold whitespace-nowrap z-10">
              FALL ALERT 98.7%
            </div>
            {/* Mock Skeleton */}
            <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
              <line x1="20" y1="50" x2="40" y2="40" stroke="red" strokeWidth="2"></line>
              <line x1="40" y1="40" x2="60" y2="45" stroke="red" strokeWidth="2"></line>
              <line x1="60" y1="45" x2="80" y2="70" stroke="red" strokeWidth="2"></line>
              <circle cx="20" cy="50" r="3" fill="red"></circle>
              <circle cx="40" cy="40" r="3" fill="red"></circle>
              <circle cx="60" cy="45" r="3" fill="red"></circle>
              <circle cx="80" cy="70" r="3" fill="red"></circle>
            </svg>
          </div>
          <div className="absolute top-[25%] left-[10%] w-[9%] h-[38%] border-2 border-green-500 bg-green-500/10">
             <div className="absolute -top-5 left-[-2px] bg-green-500 text-white px-1 py-0.5 text-[10px] whitespace-nowrap z-10">
              NORMAL 96.7%
            </div>
          </div>
        </div>

        {/* Right Info Panel */}
        <div className="flex-1 min-w-[320px] bg-white rounded-lg shadow-sm border border-gray-200 p-5 flex flex-col">
          <h2 className="text-base font-bold text-gray-800 mb-4 pb-3 border-b border-gray-100">检测信息</h2>
          <div className="space-y-4 text-sm flex-1">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">当前帧编号</span>
              <span className="font-mono text-gray-800 font-medium">24567</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">检测人数</span>
              <span className="font-medium text-gray-800">14</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">异常事件数量</span>
              <span className="font-medium text-red-500">1</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">最大置信度</span>
              <span className="font-medium text-gray-800">98.7%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">检测算法版本</span>
              <span className="text-gray-800">v2.3.1</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">处理耗时</span>
              <span className="text-gray-800">132 ms</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">分析时间</span>
              <span className="text-gray-800 font-mono text-xs">2024-05-20 10:23:41</span>
            </div>
          </div>

          {/* Current Alert Widget */}
          <div className="mt-4 bg-gray-50 rounded-lg p-4 border border-red-100">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-gray-800">当前告警</h3>
              <div className="flex items-center space-x-2 text-xs text-gray-400">
                <span>1/1</span>
                <div className="flex space-x-1">
                  <button className="hover:text-gray-600 disabled:opacity-50"><ChevronLeft className="w-4 h-4" /></button>
                  <button className="hover:text-gray-600 disabled:opacity-50"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-24 h-16 bg-gray-200 rounded overflow-hidden relative shrink-0 border border-red-200">
                <img src="https://lh3.googleusercontent.com/aida/ADBb0ujOn5UQqfc0Z5N2uceY3x7Myc6dKthBHR1P8kyb3ZK3fua9WfQCe6BvgynePjjQj_GOL6kannrNJMHAHlNoNTAwJDmk40B-eKP_oZNDAxhjs7vLWi5SYFr31M-QolhJLr0AGV7yKWzgPrxHPawTgxwwuP4xWZTiqSMYw5Lhb-W61ETOuqa_9U34qFgR12hPmf0QODNkHSb5L2VQWbTrq-4hGhmZsaOfo85oNMhkUl8iK-ybRlGqYJzvXopA" alt="Thumb" className="w-full h-full object-cover scale-[3] origin-[45%_55%]" />
              </div>
              <div className="flex flex-col justify-between text-xs">
                <div className="flex items-center text-red-600 font-medium mb-1 space-x-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>摔倒检测</span>
                </div>
                <div className="text-gray-500 space-y-1">
                  <p>置信度: <span className="text-gray-800 font-medium">98.7%</span></p>
                  <p>发生时间: <span className="text-gray-800 font-medium">10:23:41</span></p>
                  <p>状态: <span className="text-red-500 font-medium">未处理</span></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Event Log Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col flex-1 min-h-[280px]">
        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-base font-bold text-gray-800">事件日志</h2>
          <div className="flex items-center space-x-2">
             <button className="p-1.5 text-gray-400 hover:text-gray-600 bg-white border border-gray-200 rounded transition-colors shadow-sm"><Filter className="w-4 h-4" /></button>
             <button className="p-1.5 text-gray-400 hover:text-gray-600 bg-white border border-gray-200 rounded transition-colors shadow-sm"><Download className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm text-left text-gray-600 whitespace-nowrap">
            <thead className="text-xs text-gray-400 uppercase bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 font-medium">Time</th>
                <th className="px-6 py-3 font-medium">Source</th>
                <th className="px-6 py-3 font-medium">Frame</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Risk Level</th>
                <th className="px-6 py-3 font-medium">Detections</th>
                <th className="px-6 py-3 font-medium">Alert Image</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
               <tr className="bg-red-50/20 hover:bg-red-50/50 transition-colors">
                 <td className="px-6 py-3 font-mono">2024-05-20 10:23:41</td>
                 <td className="px-6 py-3">Camera 01</td>
                 <td className="px-6 py-3">24567</td>
                 <td className="px-6 py-3"><span className="text-red-500 font-medium bg-red-100 px-2 py-0.5 rounded text-xs">alert</span></td>
                 <td className="px-6 py-3"><span className="text-red-500 font-medium">high</span></td>
                 <td className="px-6 py-3">person:14, fall:1</td>
                 <td className="px-6 py-3">
                   <div className="w-12 h-8 bg-gray-200 rounded overflow-hidden shadow-sm">
                     <img src="https://lh3.googleusercontent.com/aida/ADBb0ujOn5UQqfc0Z5N2uceY3x7Myc6dKthBHR1P8kyb3ZK3fua9WfQCe6BvgynePjjQj_GOL6kannrNJMHAHlNoNTAwJDmk40B-eKP_oZNDAxhjs7vLWi5SYFr31M-QolhJLr0AGV7yKWzgPrxHPawTgxwwuP4xWZTiqSMYw5Lhb-W61ETOuqa_9U34qFgR12hPmf0QODNkHSb5L2VQWbTrq-4hGhmZsaOfo85oNMhkUl8iK-ybRlGqYJzvXopA" alt="thumb" className="w-full h-full object-cover scale-[3] origin-[45%_55%]" />
                   </div>
                 </td>
               </tr>
               <tr className="hover:bg-gray-50 transition-colors">
                 <td className="px-6 py-3 font-mono">2024-05-20 10:23:38</td>
                 <td className="px-6 py-3">Camera 01</td>
                 <td className="px-6 py-3">24564</td>
                 <td className="px-6 py-3"><span className="text-green-500">normal</span></td>
                 <td className="px-6 py-3"><span className="text-green-500">low</span></td>
                 <td className="px-6 py-3">person:13</td>
                 <td className="px-6 py-3 text-gray-300">-</td>
               </tr>
               <tr className="hover:bg-gray-50 transition-colors">
                 <td className="px-6 py-3 font-mono">2024-05-20 10:23:36</td>
                 <td className="px-6 py-3">Camera 01</td>
                 <td className="px-6 py-3">24561</td>
                 <td className="px-6 py-3"><span className="text-green-500">normal</span></td>
                 <td className="px-6 py-3"><span className="text-green-500">low</span></td>
                 <td className="px-6 py-3">person:12</td>
                 <td className="px-6 py-3 text-gray-300">-</td>
               </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
