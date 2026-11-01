import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, UserPlus, Search, Shield, ShieldCheck, User,
  Edit3, Trash2, Lock,
  CheckCircle2, XCircle, Loader2
} from 'lucide-react';
import { fetchUsers, type UserRecord } from '../services/data';

// Extend with avatar for display
interface DisplayUser extends UserRecord {
  avatar: string;
}

const roleConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  admin: { label: '管理员', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
  operator: { label: '操作员', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: <Shield className="w-3.5 h-3.5" /> },
  viewer: { label: '观察者', color: 'bg-gray-100 text-gray-600 border-gray-200', icon: <User className="w-3.5 h-3.5" /> },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  active: { label: '正常', color: 'text-green-600' },
  inactive: { label: '未激活', color: 'text-gray-500' },
  locked: { label: '已锁定', color: 'text-red-500' },
};

const avatarColors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-amber-500', 'bg-red-500', 'bg-cyan-500'];

export default function UserManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [users, setUsers] = useState<DisplayUser[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchUsers({ role: roleFilter, search: searchTerm });
      setUsers(data.map((u, i) => ({ ...u, avatar: u.name.charAt(0) + (u.name.charAt(1) || '') })));
    } finally {
      setLoading(false);
    }
  }, [roleFilter, searchTerm]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 flex items-center">
          <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center mr-3"><Users className="w-5 h-5 text-blue-600" /></div>
          <div><p className="text-xs text-gray-500">用户总数</p><p className="text-xl font-bold text-gray-800">{users.length}</p></div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 flex items-center">
          <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center mr-3"><CheckCircle2 className="w-5 h-5 text-green-600" /></div>
          <div><p className="text-xs text-gray-500">活跃用户</p><p className="text-xl font-bold text-green-600">{users.filter(u => u.status === 'active').length}</p></div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 flex items-center">
          <div className="h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center mr-3"><ShieldCheck className="w-5 h-5 text-purple-600" /></div>
          <div><p className="text-xs text-gray-500">管理员</p><p className="text-xl font-bold text-purple-600">{users.filter(u => u.role === 'admin').length}</p></div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 flex items-center">
          <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center mr-3"><Lock className="w-5 h-5 text-red-500" /></div>
          <div><p className="text-xs text-gray-500">已锁定</p><p className="text-xl font-bold text-red-500">{users.filter(u => u.status === 'locked').length}</p></div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="搜索用户名 / 邮箱..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none w-56"
            />
          </div>
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="border border-gray-200 rounded-md text-sm py-2 px-3 text-gray-600 bg-gray-50 outline-none focus:border-blue-500"
          >
            <option value="all">全部角色</option>
            <option value="admin">管理员</option>
            <option value="operator">操作员</option>
            <option value="viewer">观察者</option>
          </select>
        </div>
        <button className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-colors">
          <UserPlus className="w-4 h-4 mr-2" /> 添加用户
        </button>
      </div>

      {/* User Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-5 py-3 text-left font-medium">用户</th>
              <th className="px-5 py-3 text-left font-medium">邮箱</th>
              <th className="px-5 py-3 text-left font-medium">角色</th>
              <th className="px-5 py-3 text-left font-medium">状态</th>
              <th className="px-5 py-3 text-left font-medium">最后登录</th>
              <th className="px-5 py-3 text-left font-medium">创建时间</th>
              <th className="px-5 py-3 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />加载中...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">暂无用户数据</td></tr>
            ) : users.map((u, i) => (
              <tr key={u.id} className="hover:bg-gray-50 cursor-pointer">
                <td className="px-5 py-3">
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full ${avatarColors[i % avatarColors.length]} text-white flex items-center justify-center text-xs font-bold mr-3`}>
                      {u.avatar}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{u.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{u.id}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-gray-600">{u.email}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border font-medium ${roleConfig[u.role].color}`}>
                    {roleConfig[u.role].icon} {roleConfig[u.role].label}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className={`flex items-center gap-1 text-xs font-medium ${statusConfig[u.status].color}`}>
                    {u.status === 'active' ? <CheckCircle2 className="w-3.5 h-3.5" /> : u.status === 'locked' ? <Lock className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {statusConfig[u.status].label}
                  </span>
                </td>
                <td className="px-5 py-3 text-gray-500 font-mono text-xs">{u.lastLogin}</td>
                <td className="px-5 py-3 text-gray-500 font-mono text-xs">{u.createdAt}</td>
                <td className="px-5 py-3">
                  <div className="flex gap-1">
                    <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="编辑"><Edit3 className="w-4 h-4" /></button>
                    <button className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded" title="重置密码"><Lock className="w-4 h-4" /></button>
                    <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="删除"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-sm bg-gray-50/50">
          <span className="text-gray-500">共 {users.length} 条</span>
          <div className="flex items-center space-x-1">
            <button className="px-2.5 py-1 border border-gray-200 bg-white rounded text-gray-400 hover:bg-gray-50">«</button>
            <button className="px-3 py-1 bg-blue-600 text-white rounded font-medium shadow-sm">1</button>
            <button className="px-2.5 py-1 border border-gray-200 bg-white rounded text-gray-600 hover:bg-gray-50">»</button>
          </div>
        </div>
      </div>
    </div>
  );
}
