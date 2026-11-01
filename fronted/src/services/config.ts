/**
 * 全局配置存储 — 所有设置项持久化到 localStorage
 * Settings 页面修改后，其他模块可实时读取
 */

const STORAGE_KEY = 'huiyan_config';

export interface AppConfig {
  // 基本设置
  apiUrl: string;
  systemName: string;
  orgName: string;
  language: string;
  timezone: string;
  // 通知设置
  notifyFall: boolean;
  notifyDeviceOffline: boolean;
  notifyEmail: boolean;
  notifySms: boolean;
  notifyCloud: boolean;
  // 检测参数
  confidenceThreshold: number;
  horizontalRatio: number;
  yoloModel: string;
  detectFrameRate: string;
  tiledYolo: boolean;
  // 安全设置
  twoFactorAuth: boolean;
  ipWhitelist: boolean;
  auditLog: boolean;
  dataEncryption: boolean;
  // 存储设置
  alertRetention: string;
  logRetention: string;
  autoCleanup: boolean;
}

const defaults: AppConfig = {
  apiUrl: '/api',  // 改成相对路径，走 Vite dev server 代理
  systemName: '慧眼识行',
  orgName: '慧眼识行科技',
  language: 'zh-CN',
  timezone: 'Asia/Shanghai',
  notifyFall: true,
  notifyDeviceOffline: true,
  notifyEmail: false,
  notifySms: false,
  notifyCloud: true,
  confidenceThreshold: 85,
  horizontalRatio: 95,
  yoloModel: 'camera_fall_v2-2',
  detectFrameRate: '1',
  tiledYolo: true,
  twoFactorAuth: false,
  ipWhitelist: true,
  auditLog: true,
  dataEncryption: true,
  alertRetention: '30',
  logRetention: '30',
  autoCleanup: true,
};

function load(): AppConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {}
  return { ...defaults };
}

let config: AppConfig = load();

export function getConfig(): AppConfig {
  return { ...config };
}

export function updateConfig(partial: Partial<AppConfig>) {
  config = { ...config, ...partial };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function resetConfig() {
  config = { ...defaults };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}
