/**
 * Mock Data Service
 * 为Demo提供完整数据层，模拟真实后端API响应
 * 真实部署时替换为实际API调用
 */

// ==================== Types ====================

export interface Alert {
  id: string;
  cameraId: string;
  cameraName: string;
  type: 'fall' | 'smoke' | 'no_helmet' | 'crowd';
  riskLevel: 'high' | 'medium' | 'low';
  confidence: number;
  status: 'pending' | 'processing' | 'resolved' | 'false_positive';
  timestamp: string;
  image: string;
  location: string;
}

export interface DetectionLog {
  id: string;
  timestamp: string;
  source: string;
  frame: number;
  status: 'alert' | 'normal';
  riskLevel: 'high' | 'medium' | 'low';
  detections: string;
  alertImage?: string;
}

export interface Device {
  id: string;
  name: string;
  location: string;
  ip: string;
  status: 'online' | 'offline' | 'error';
  fps: number;
  resolution: string;
  lastActive: string;
  model: string;
}

export interface Sample {
  id: string;
  name: string;
  type: 'fall' | 'standing' | 'other';
  status: 'labeled' | 'unlabeled' | 'reviewing';
  source: string;
  date: string;
  thumb: string;
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
  status: 'active' | 'inactive' | 'locked';
  lastLogin: string;
  createdAt: string;
}

export interface Camera {
  id: string;
  name: string;
  image: string;
  video?: string;
  status: 'normal' | 'alert';
  detections?: { label: string; confidence: number; box: { top: string; left: string; w: string; h: string }; color: string }[];
  timestamp?: string;
}

export interface StatsData {
  todayAlerts: number;
  onlineDevices: number;
  accuracy: number;
  processedRate: number;
  alertsTrend: number;
  devicesOnlineRate: number;
}

export interface TrendPoint {
  time: string;
  count: number;
}

// ==================== Mock Data ====================

const MOCK_CAMERAS: Camera[] = [
  {
    id: 'CAM-01', name: '明达楼',
    image: '/images/monitoring/CAM-01.png',
    video: '/videos/CAM-01.mp4',
    status: 'normal',
    timestamp: '2024-05-20 18:24:36'
  },
  {
    id: 'CAM-02', name: '笃学楼',
    image: '/images/monitoring/CAM-02.png',
    video: '/videos/CAM-02.mp4',
    status: 'alert'
  },
  {
    id: 'CAM-03', name: '勤学楼',
    image: '/images/monitoring/CAM-03.png',
    video: '/videos/CAM-03.mp4',
    status: 'normal'
  },
  {
    id: 'CAM-04', name: '励学楼',
    image: '/images/monitoring/CAM-04.png',
    video: '/videos/CAM-04.mp4',
    status: 'normal'
  },
  {
    id: 'CAM-05', name: '宿舍门口',
    image: '/images/monitoring/CAM-05.png',
    video: '/videos/CAM-05.mp4',
    status: 'normal'
  },
  {
    id: 'CAM-06', name: '食堂门口',
    image: '/images/monitoring/CAM-06.png',
    video: '/videos/CAM-06.mp4',
    status: 'normal'
  }
];

const MOCK_ALERTS: Alert[] = [
  { id: 'ALT-001', cameraId: 'CAM-02', cameraName: '笃学楼', type: 'fall', riskLevel: 'high', confidence: 98.7, status: 'pending', timestamp: '2024-05-20 18:34:31', image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400&h=225&fit=crop', location: '笃学楼' },
  { id: 'ALT-002', cameraId: 'CAM-04', cameraName: '励学楼', type: 'smoke', riskLevel: 'medium', confidence: 85.2, status: 'processing', timestamp: '2024-05-20 10:23:56', image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400&h=225&fit=crop', location: '励学楼' },
  { id: 'ALT-003', cameraId: 'CAM-06', cameraName: '食堂门口', type: 'no_helmet', riskLevel: 'low', confidence: 92.1, status: 'resolved', timestamp: '2024-05-20 10:23:51', image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=225&fit=crop', location: '食堂门口' },
  { id: 'ALT-004', cameraId: 'CAM-01', cameraName: '明达楼', type: 'fall', riskLevel: 'high', confidence: 97.3, status: 'pending', timestamp: '2024-05-20 10:23:41', image: 'https://images.unsplash.com/photo-1556388158-158ea5ccacbd?w=400&h=225&fit=crop', location: '明达楼' },
  { id: 'ALT-005', cameraId: 'CAM-05', cameraName: '宿舍门口', type: 'crowd', riskLevel: 'medium', confidence: 78.5, status: 'resolved', timestamp: '2024-05-20 08:15:22', image: 'https://images.unsplash.com/photo-1562774053-701939374585?w=400&h=225&fit=crop', location: '宿舍门口' },
  { id: 'ALT-006', cameraId: 'CAM-02', cameraName: '笃学楼', type: 'fall', riskLevel: 'high', confidence: 95.8, status: 'resolved', timestamp: '2024-05-19 15:42:10', image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400&h=225&fit=crop', location: '笃学楼' },
  { id: 'ALT-007', cameraId: 'CAM-03', cameraName: '勤学楼', type: 'crowd', riskLevel: 'medium', confidence: 82.3, status: 'false_positive', timestamp: '2024-05-19 12:30:05', image: 'https://images.unsplash.com/photo-1565043666747-69f6646db940?w=400&h=225&fit=crop', location: '勤学楼' },
  { id: 'ALT-008', cameraId: 'CAM-06', cameraName: '食堂门口', type: 'no_helmet', riskLevel: 'low', confidence: 88.9, status: 'resolved', timestamp: '2024-05-19 09:15:33', image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=225&fit=crop', location: '食堂门口' },
  { id: 'ALT-009', cameraId: 'CAM-01', cameraName: '明达楼', type: 'fall', riskLevel: 'high', confidence: 96.1, status: 'pending', timestamp: '2024-05-18 22:10:45', image: 'https://images.unsplash.com/photo-1556388158-158ea5ccacbd?w=400&h=225&fit=crop', location: '明达楼' },
  { id: 'ALT-010', cameraId: 'CAM-04', cameraName: '励学楼', type: 'smoke', riskLevel: 'medium', confidence: 80.5, status: 'resolved', timestamp: '2024-05-18 14:25:18', image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400&h=225&fit=crop', location: '励学楼' },
  { id: 'ALT-011', cameraId: 'CAM-05', cameraName: '宿舍门口', type: 'fall', riskLevel: 'high', confidence: 94.2, status: 'processing', timestamp: '2024-05-18 11:05:30', image: 'https://images.unsplash.com/photo-1565043666747-69f6646db940?w=400&h=225&fit=crop', location: '宿舍门口' },
  { id: 'ALT-012', cameraId: 'CAM-02', cameraName: '笃学楼', type: 'fall', riskLevel: 'high', confidence: 99.1, status: 'pending', timestamp: '2024-05-17 20:30:00', image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400&h=225&fit=crop', location: '笃学楼' },
];

const MOCK_LOGS: DetectionLog[] = [
  { id: 'LOG-001', timestamp: '2024-05-20 10:23:41', source: 'Camera 01', frame: 24567, status: 'alert', riskLevel: 'high', detections: 'person:14, fall:1', alertImage: 'https://lh3.googleusercontent.com/aida/ADBb0ugqlemoujLj_V9I-es3SaGPuRVC6bH1Vyi9LqqIqlmgWttfOqXSol42d5z9w_nMdiNEzptGfF4T0vPeNAnapfBt7YtlsjduecGQrZ1eq-jevYxQT8Y2jpxsIavUKugEuIhxAyNBaw12vXs1RCclJdrUccJZ04UjIEltAQI4lbYkRmwueyGNvZ2dLCMzi0R5qCdr8pDP818Ufvi25wRhRKVWsDjcFH0JbrILacsXgmxEv7LdJmsKjr97upsy' },
  { id: 'LOG-002', timestamp: '2024-05-20 10:23:38', source: 'Camera 01', frame: 24564, status: 'normal', riskLevel: 'low', detections: 'person:13' },
  { id: 'LOG-003', timestamp: '2024-05-20 10:23:35', source: 'Camera 02', frame: 24567, status: 'normal', riskLevel: 'low', detections: 'person:9' },
  { id: 'LOG-004', timestamp: '2024-05-20 10:23:28', source: 'Camera 01', frame: 24555, status: 'alert', riskLevel: 'medium', detections: 'person:14, fight:1' },
  { id: 'LOG-005', timestamp: '2024-05-20 10:22:15', source: 'Camera 03', frame: 24540, status: 'normal', riskLevel: 'low', detections: 'person:6' },
  { id: 'LOG-006', timestamp: '2024-05-20 10:21:50', source: 'Camera 02', frame: 24530, status: 'alert', riskLevel: 'high', detections: 'person:8, fall:1', alertImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAaVHNSUO8F8_5HcrhXVa5LV2gSNQbKq6hyzWGjIJxYFcbKqLd9gVq91UVV-cDUyyQxdKekrLrsMR6yl5PR2ebYeaNu5SZoPvO7ecuePjbO4uBH3Nn6vBLDKZ2quJbFu5lSsxGCOAqs5t1c-IU9cbFNvuwVAhNaECJMMYJaD3py4xFhyDMfMUdqdcs0MS9UwT51fwPYk3BLgbvx2yyE1qZcGbxvbmkM5SdYyuTSM3fky0aj_qdsUb1rLM7HXfo_bvI-lI3ISgwT0KzI' },
  { id: 'LOG-007', timestamp: '2024-05-20 10:21:30', source: 'Camera 04', frame: 24520, status: 'normal', riskLevel: 'low', detections: 'person:11' },
  { id: 'LOG-008', timestamp: '2024-05-20 10:20:45', source: 'Camera 05', frame: 24510, status: 'normal', riskLevel: 'low', detections: 'person:15' },
  { id: 'LOG-009', timestamp: '2024-05-20 10:20:12', source: 'Camera 06', frame: 24500, status: 'alert', riskLevel: 'medium', detections: 'person:5, no_helmet:2' },
  { id: 'LOG-010', timestamp: '2024-05-20 10:19:55', source: 'Camera 01', frame: 24490, status: 'normal', riskLevel: 'low', detections: 'person:12' },
  { id: 'LOG-011', timestamp: '2024-05-20 10:19:30', source: 'Camera 03', frame: 24480, status: 'normal', riskLevel: 'low', detections: 'person:7' },
  { id: 'LOG-012', timestamp: '2024-05-20 10:19:00', source: 'Camera 02', frame: 24470, status: 'normal', riskLevel: 'low', detections: 'person:9' },
];

const MOCK_DEVICES: Device[] = [
  { id: 'CAM-01', name: '机场T1大厅摄像头', location: '机场T1航站楼', ip: '192.168.1.101', status: 'online', fps: 25, resolution: '1920x1080', lastActive: '2024-05-20 18:30:00', model: 'HIKVISION DS-2CD' },
  { id: 'CAM-02', name: '养老院活动室', location: '养老院2楼', ip: '192.168.1.102', status: 'online', fps: 30, resolution: '1920x1080', lastActive: '2024-05-20 18:30:00', model: 'DAHUA DH-IPC' },
  { id: 'CAM-03', name: '教学楼走廊', location: '教学楼A栋3层', ip: '192.168.1.103', status: 'online', fps: 25, resolution: '1280x720', lastActive: '2024-05-20 18:29:45', model: 'HIKVISION DS-2CD' },
  { id: 'CAM-04', name: '医院门诊大厅', location: '医院1楼门诊', ip: '192.168.1.104', status: 'error', fps: 0, resolution: '1920x1080', lastActive: '2024-05-20 16:45:12', model: 'UNIVIEW IPC' },
  { id: 'CAM-05', name: '地铁站台', location: '地铁3号线站台', ip: '192.168.1.105', status: 'online', fps: 30, resolution: '1920x1080', lastActive: '2024-05-20 18:30:00', model: 'DAHUA DH-IPC' },
  { id: 'CAM-06', name: '建筑工地', location: '工地东侧', ip: '192.168.1.106', status: 'offline', fps: 0, resolution: '1280x720', lastActive: '2024-05-20 14:20:33', model: 'HIKVISION DS-2CD' },
  { id: 'CAM-07', name: '社区广场', location: '中心社区广场', ip: '192.168.1.107', status: 'online', fps: 25, resolution: '1920x1080', lastActive: '2024-05-20 18:30:00', model: 'UNIVIEW IPC' },
  { id: 'CAM-08', name: '商场中庭', location: '购物中心B1', ip: '192.168.1.108', status: 'online', fps: 30, resolution: '3840x2160', lastActive: '2024-05-20 18:30:00', model: 'DAHUA DH-IPC' },
];

const MOCK_SAMPLES: Sample[] = [
  { id: 'S-001', name: 'fall_001.jpg', type: 'fall', status: 'labeled', source: 'CAM-02', date: '2024-05-18', thumb: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAaVHNSUO8F8_5HcrhXVa5LV2gSNQbKq6hyzWGjIJxYFcbKqLd9gVq91UVV-cDUyyQxdKekrLrsMR6yl5PR2ebYeaNu5SZoPvO7ecuePjbO4uBH3Nn6vBLDKZ2quJbFu5lSsxGCOAqs5t1c-IU9cbFNvuwVAhNaECJMMYJaD3py4xFhyDMfMUdqdcs0MS9UwT51fwPYk3BLgbvx2yyE1qZcGbxvbmkM5SdYyuTSM3fky0aj_qdsUb1rLM7HXfo_bvI-lI3ISgwT0KzI' },
  { id: 'S-002', name: 'standing_045.jpg', type: 'standing', status: 'labeled', source: 'CAM-01', date: '2024-05-18', thumb: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCD0PlKUy3FhlltVbi0GZuRU-yGNUqzDlXQiL7i9DTj2dHTo9vf7DvFRguUOj6ulKDYABiuZLht6yrvkg5B-SzARjs_m6jgoBIzhMsNG9mm-CXhCbRmOtxNfbuJ9it5ArXyVhEFm746vcCtOkz33_4TlEV5Uu59m-3rPDag0yOWUYb6pYlDybpXmv7aYH-sFtaZhvN4zJ1o1sMD__VkX6ahFvXYlLkZOb4ZvPkNuDfVElXpVBQJwNw915VoUExR63RlVkD4TA-Fl3aM' },
  { id: 'S-003', name: 'fall_012.jpg', type: 'fall', status: 'unlabeled', source: 'CAM-04', date: '2024-05-19', thumb: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAVdCNWn6TwA8mmnw5FIPZXo5h1fE4-SpYtrvsBYAxOMPJd4BzN1TtvwtY3ZyVsgiEtyPK7TN60wBdKU_rFEugmWREyoZXPpU5UD6ilwYkx2peDNfg4ujEJmVMNaKM1ZzxIDim5tB2skZznAWQtgFPzdcywSzmG-9mXPNO8ObU5BQ6BQ3NJJ1z-Jq5qjXsVP_gtbKT8_RiT_sqD3SKsiYKvG6zaxtTN_WGAT_1xv37DMyG5fD8VIQMqUjoAL9n_WZRV1w26ykVy17di' },
  { id: 'S-004', name: 'other_008.jpg', type: 'other', status: 'reviewing', source: 'CAM-06', date: '2024-05-19', thumb: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAOAu9nOe2jc3F2ZRCLx2f1OaKtpjuj5GQq4Spvk8odGJsTfkZu5A_hOnunFLQVPP1-93__qI5l_FBF1wJUnbU5M_XN-jrOfntPxX-ENXzYguZ15CilIt1-tsXxxxPDS3Ipd8QXf1dWyoUK9kLRTuWA6k8o8vqkELMuw_0Fv0i-vhUJqcYIEkuiHI55DpBhcXFDUAKfH7KzviSwAqSxrIY_x62vhkBCrmSYRi4sJWDJ-kt1HiLU0VxKsINLJIv8vZ4xeW9Yf3qbx9Bp' },
  { id: 'S-005', name: 'standing_099.jpg', type: 'standing', status: 'labeled', source: 'CAM-05', date: '2024-05-20', thumb: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAEELsfR6dD21et11rp-D7Y-pPm1WeBCcLORVoZHZEt7fAmwsyfgERz3W8TVhH7TLrXrxWrXtZYjtjvz4OhUClbKFzdW0BKcnHHO-4NuCCJbu9Yhh6DQC0hhKvsc112-S-GrwBMQrzHtOM52Z7u2purNQfs_tS_f7uIcguttMa2eLr4n739oPtsIVQrnDCwWF7D1yRIkec8xLa_sM9gWWYp47HybeHM8K22r5H6JMuFNcj4ttzbzNnleBGK5RhEduayY6gOuw-nWC3b' },
  { id: 'S-006', name: 'fall_023.jpg', type: 'fall', status: 'labeled', source: 'CAM-03', date: '2024-05-20', thumb: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAIlYQFcL3C7j595c3s_70Zbd5_0r9nXnRa-kqV1VnKLotxUB8J_zB9Ms2h4kuMeQdAiUK05UJI-QUtFZzNxIYFa-Wy_q44CzrQVfktQM4PtEZmVE8Pca88ki5j5HTD3bom0qumpYdCq_4Afg48ORcjbDzFOHj4Rg-_IguP9EbVR15CQ8_vfoM5TvaFYjZKkgXA3JYJnD5izRgYTvjhrLEuPU5Cv8bKyXA37CPdgMuMCEFF9rIpDLy0hnk59J6Ott6eeYHVcjjfZ7zV' },
];

const MOCK_USERS: UserRecord[] = [
  { id: 'U-001', name: '张明', email: 'zhangming@example.com', role: 'admin', status: 'active', lastLogin: '2024-05-20 18:30', createdAt: '2024-01-15' },
  { id: 'U-002', name: '李婷', email: 'liting@example.com', role: 'operator', status: 'active', lastLogin: '2024-05-20 17:45', createdAt: '2024-02-20' },
  { id: 'U-003', name: '王强', email: 'wangqiang@example.com', role: 'operator', status: 'active', lastLogin: '2024-05-20 16:20', createdAt: '2024-03-01' },
  { id: 'U-004', name: '赵雪', email: 'zhaoxue@example.com', role: 'viewer', status: 'inactive', lastLogin: '2024-05-15 09:00', createdAt: '2024-03-10' },
  { id: 'U-005', name: '陈伟', email: 'chenwei@example.com', role: 'viewer', status: 'active', lastLogin: '2024-05-20 14:30', createdAt: '2024-04-05' },
  { id: 'U-006', name: '刘洋', email: 'liuyang@example.com', role: 'operator', status: 'locked', lastLogin: '2024-05-10 11:00', createdAt: '2024-04-15' },
];

const MOCK_TREND: TrendPoint[] = [
  { time: '00:00', count: 10 }, { time: '02:00', count: 5 },
  { time: '04:00', count: 20 }, { time: '06:00', count: 15 },
  { time: '08:00', count: 60 }, { time: '10:00', count: 45 },
  { time: '12:00', count: 35 }, { time: '14:00', count: 25 },
  { time: '16:00', count: 30 }, { time: '18:00', count: 42 },
  { time: '20:00', count: 15 }, { time: '22:00', count: 8 },
];

const MOCK_STATS: StatsData = {
  todayAlerts: 128,
  onlineDevices: 256,
  accuracy: 98.7,
  processedRate: 92.3,
  alertsTrend: 32,
  devicesOnlineRate: 98.6,
};

// ==================== Simulated API Functions ====================

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Cameras
export async function fetchCameras(): Promise<Camera[]> {
  await delay(200);
  return [...MOCK_CAMERAS];
}

// Alerts
export interface AlertFilter {
  cameraId?: string;
  riskLevel?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function fetchAlerts(filter: AlertFilter = {}): Promise<PaginatedResult<Alert>> {
  await delay(150);
  let result = [...MOCK_ALERTS];
  if (filter.cameraId && filter.cameraId !== 'all') result = result.filter(a => a.cameraId === filter.cameraId);
  if (filter.riskLevel && filter.riskLevel !== 'all') result = result.filter(a => a.riskLevel === filter.riskLevel);
  if (filter.status && filter.status !== 'all') result = result.filter(a => a.status === filter.status);
  if (filter.search) result = result.filter(a => a.cameraName.includes(filter.search!) || a.location.includes(filter.search!));
  const page = filter.page || 1;
  const pageSize = filter.pageSize || 5;
  const total = result.length;
  const totalPages = Math.ceil(total / pageSize);
  const data = result.slice((page - 1) * pageSize, page * pageSize);
  return { data, total, page, pageSize, totalPages };
}

export async function updateAlertStatus(alertId: string, status: Alert['status']): Promise<boolean> {
  await delay(200);
  const alert = MOCK_ALERTS.find(a => a.id === alertId);
  if (alert) alert.status = status;
  return !!alert;
}

// Detection Logs
export interface LogFilter {
  status?: string;
  riskLevel?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function fetchDetectionLogs(filter: LogFilter = {}): Promise<PaginatedResult<DetectionLog>> {
  await delay(150);
  let result = [...MOCK_LOGS];
  if (filter.status && filter.status !== 'all') result = result.filter(l => l.status === filter.status);
  if (filter.riskLevel && filter.riskLevel !== 'all') result = result.filter(l => l.riskLevel === filter.riskLevel);
  if (filter.search) result = result.filter(l => l.source.includes(filter.search!) || l.detections.includes(filter.search!));
  const page = filter.page || 1;
  const pageSize = filter.pageSize || 5;
  const total = result.length;
  const totalPages = Math.ceil(total / pageSize);
  const data = result.slice((page - 1) * pageSize, page * pageSize);
  return { data, total, page, pageSize, totalPages };
}

// Devices
export interface DeviceFilter {
  status?: string;
  search?: string;
}

export async function fetchDevices(filter: DeviceFilter = {}): Promise<Device[]> {
  await delay(150);
  let result = [...MOCK_DEVICES];
  if (filter.status && filter.status !== 'all') result = result.filter(d => d.status === filter.status);
  if (filter.search) result = result.filter(d => d.name.includes(filter.search!) || d.location.includes(filter.search!) || d.id.includes(filter.search!));
  return result;
}

// Samples
export interface SampleFilter {
  type?: string;
  status?: string;
  search?: string;
}

export async function fetchSamples(filter: SampleFilter = {}): Promise<Sample[]> {
  await delay(150);
  let result = [...MOCK_SAMPLES];
  if (filter.type && filter.type !== 'all') result = result.filter(s => s.type === filter.type);
  if (filter.status && filter.status !== 'all') result = result.filter(s => s.status === filter.status);
  if (filter.search) result = result.filter(s => s.name.includes(filter.search!) || s.source.includes(filter.search!));
  return result;
}

// Users
export interface UserFilter {
  role?: string;
  search?: string;
}

export async function fetchUsers(filter: UserFilter = {}): Promise<UserRecord[]> {
  await delay(150);
  let result = [...MOCK_USERS];
  if (filter.role && filter.role !== 'all') result = result.filter(u => u.role === filter.role);
  if (filter.search) result = result.filter(u => u.name.includes(filter.search!) || u.email.includes(filter.search!));
  return result;
}

// Stats
export async function fetchStats(): Promise<StatsData> {
  await delay(100);
  return { ...MOCK_STATS };
}

export async function fetchTrend(): Promise<TrendPoint[]> {
  await delay(100);
  return [...MOCK_TREND];
}

// Export mock data for direct use
export { MOCK_CAMERAS, MOCK_ALERTS, MOCK_LOGS, MOCK_DEVICES, MOCK_SAMPLES, MOCK_USERS, MOCK_TREND, MOCK_STATS };
