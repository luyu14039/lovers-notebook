import React, { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { Heart, Zap, Plus, Trash2, CheckCircle, AlertCircle, Calendar, Thermometer, ChevronLeft, ChevronDown, LogOut, Clock, User, Home, Sparkles, BarChart3, Search, Settings, X, QrCode, Camera, Image as ImageIcon, Users, TrendingUp, TrendingDown } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import LZString from 'lz-string';
import jsQR from 'jsqr';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart } from 'recharts';
import {
  pageVariants,
  listContainerVariants,
  listItemVariants,
  buttonTapAnimation,
  fabPulseVariants,
  modalVariants,
  counterAnimation,
  circularProgressVariants,
  tagVariants,
  forgiveAnimationVariants,
  emptyStateVariants,
  searchOverlayVariants,
  heartbeatVariants,
  springConfigs,
  shouldReduceMotion,
} from './animations';
import { CardSkeleton, StatsSkeleton } from './components/SkeletonLoader';

// --- Types ---

type Role = 'bf' | 'gf' | null;

type GrudgeStatus = 'active' | 'forgiven';

// 情绪类型定义
type MoodType = '愤怒' | '失望' | '委屈' | '无奈' | '嫌弃' | '无语';

interface MoodOption {
  type: MoodType;
  emoji: string;
  label: string;
  color: string; // Tailwind color class
}

interface Grudge {
  id: string;
  title: string;
  description: string;
  severity: number; // 1-100, 现在表示情绪强度
  moodType: MoodType; // 情绪类型
  date: string;
  tags: string[];
  penalty: string;
  status: GrudgeStatus;
  forgivenAt?: string; // 原谅时间
  isPrivate?: boolean;  // 是否私密(不同步给对方)
  authorDeviceId?: string; // 作者设备ID(用于区分谁创建的)
  photos?: string[]; // 图片ID数组（存储在IndexedDB中）
}

interface PartnerInfo {
  id: string;          // 对方设备唯一ID
  name: string;        // 对方昵称
  role: Role;          // 对方角色
  callName: string;    // 我叫Ta什么
  callsMe: string;     // Ta叫我什么
}

interface RelationshipInfo {
  anniversary?: string;  // 纪念日
  pairDate: string;     // 配对日期
  partnerBirthday?: string; // 对方生日
}

interface SpaceConfig {
  grudgeSpaceName: string;   // 负面记录空间名称
  memorySpaceName: string;   // 正面回忆空间名称
}

interface UserProfile {
  role: Role;
  name: string;
  onboarded: boolean;
  
  // 配对信息
  paired: boolean;
  pairId: string | null;  // 配对ID（两台设备共享）
  deviceId: string;       // 本设备唯一ID
  
  partner?: PartnerInfo;
  relationship?: RelationshipInfo;
  
  // 自定义称呼
  customCallName?: string;  // 自定义的对方称呼（默认"男朋友"/"女朋友"）
  customSelfName?: string;  // 自定义的自己称呼（如"小公主"、"大宝贝"）
  
  // 空间配置
  spaceConfig?: SpaceConfig;
}

// --- Memory Types (正向记录) ---

interface Memory {
  id: string;
  title: string;
  description: string;
  sweetness: number; // 1-100, 甜蜜度
  date: string;
  tags: string[];
  feeling: string; // 当时的心情描述
  isPrivate?: boolean;  // 是否私密(不同步给对方)
  authorDeviceId?: string; // 作者设备ID(用于区分谁创建的)
  photos?: string[]; // 图片ID数组（存储在IndexedDB中）
}

// --- Statistics Types (统计数据) ---

interface Statistics {
  totalGrudges: number;
  totalMemories: number;
  forgivenCount: number;
  activeGrudgeCount: number;
  avgAngerLevel: number;
  avgSweetnessLevel: number;
  harmonyScore: number; // 和谐度评分 0-100
  mostCommonTags: { tag: string; count: number }[];
  forgivenessRate: number; // 原谅率 0-100
}

// --- Photo Interface (预留接口) ---

interface Photo {
  id: string;
  data: string; // base64 编码
  thumbnail: string; // 缩略图
  timestamp: string;
  size: number;
}

// --- Achievement Interface (预留接口) ---

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: number;
  target: number;
  category: 'grudge' | 'memory' | 'harmony';
}

// --- Preset Constants (预设常量库) ---

// 女友可能叫男友的预设
const GIRLFRIEND_CALL_BOYFRIEND_PRESETS = {
  romantic: ['老公', '宝宝', '亲爱的', 'Darling'],
  cute: ['猪猪', '笨蛋', '憨憨', '大宝贝'],
  cool: ['臭男人', '小王', '你这个人']
};

// 男友可能叫女友的预设
const BOYFRIEND_CALL_GIRLFRIEND_PRESETS = {
  romantic: ['老婆', '宝贝', '小可爱', '心肝'],
  cute: ['猪猪', '傻瓜', '小笨蛋', '小公主'],
  sweet: ['甜心', '小仙女', '小祖宗', '女王大人']
};

// 负面空间名称预设（中性化，男女通用）
const GRUDGE_SPACE_PRESETS = {
  record: ['黑名单', '吐槽专区', '账本', '备忘录'],
  archive: ['事件档案', '争议记录', '矛盾本', '反思日志'],
  fun: ['小本本', '翻旧账专区', '历史遗留问题', '待解决事项'],
  emotion: ['情绪记录', '不爽时刻', '需要改进的地方']
};

// 正面空间名称预设（通用）
const MEMORY_SPACE_PRESETS = [
  '甜蜜回忆', '浪漫瞬间', '幸福时光', '爱的记录', 
  '温馨时刻', '美好瞬间', '心动合集'
];

// 默认空间名称
const DEFAULT_GRUDGE_SPACE_NAME = {
  gf: '记仇本本',
  bf: '生存记录'
};

const DEFAULT_MEMORY_SPACE_NAME = '甜蜜回忆';

// --- App Settings ---
// 已迁移至 theme.config.ts,使用ThemeConfig类型

// --- Pairing Types (配对相关类型) ---

interface PairInvite {
  type: 'pair_invite';
  version: string;
  timestamp: number;
  inviter: {
    id: string;
    role: Role;
    name: string;
    callName: string; // 期望对方叫自己什么
  };
}

interface PairConfirm {
  type: 'pair_confirm';
  version: string;
  timestamp: number;
  responder: {
    id: string;
    role: Role;
    name: string;
    callName: string; // 期望对方叫自己什么
  };
  relationship: {
    partnerCallsMe: string;  // 对方叫我什么
    myCallName: string;       // 我叫对方什么
    anniversary?: string;
  };
  linkTo: string; // 关联到邀请者ID
}

interface SyncData {
  type: 'data_sync';
  version: string;
  from: string; // 发送者设备ID
  timestamp: number;
  syncId: string;
  data: {
    grudges: Grudge[];
    memories: Memory[];
  };
  stats: {
    totalGrudges: number;
    totalMemories: number;
  };
}

type QRCodeData = PairInvite | PairConfirm | SyncData;

// --- Utility Functions (预留接口) ---

/**
 * IndexedDB 存储服务
 */
class IndexedDBService {
  private static DB_NAME = 'LoveLedgerDB';
  private static DB_VERSION = 1;
  private static STORE_PHOTOS = 'photos';
  private static STORE_DATA = 'appData';
  
  private static db: IDBDatabase | null = null;
  
  // 初始化数据库
  static async init(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      
      request.onerror = () => {
        reject(new Error('无法打开IndexedDB'));
      };
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // 创建照片存储
        if (!db.objectStoreNames.contains(this.STORE_PHOTOS)) {
          const photoStore = db.createObjectStore(this.STORE_PHOTOS, { keyPath: 'id' });
          photoStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        
        // 创建应用数据存储
        if (!db.objectStoreNames.contains(this.STORE_DATA)) {
          db.createObjectStore(this.STORE_DATA);
        }
      };
    });
  }
  
  // 保存照片
  static async savePhoto(photo: Photo): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_PHOTOS], 'readwrite');
      const store = transaction.objectStore(this.STORE_PHOTOS);
      const request = store.put(photo);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('保存照片失败'));
    });
  }
  
  // 获取照片
  static async getPhoto(id: string): Promise<Photo | null> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_PHOTOS], 'readonly');
      const store = transaction.objectStore(this.STORE_PHOTOS);
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('获取照片失败'));
    });
  }
  
  // 删除照片
  static async deletePhoto(id: string): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_PHOTOS], 'readwrite');
      const store = transaction.objectStore(this.STORE_PHOTOS);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('删除照片失败'));
    });
  }
  
  // 获取所有照片（用于计算存储大小）
  static async getAllPhotos(): Promise<Photo[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_PHOTOS], 'readonly');
      const store = transaction.objectStore(this.STORE_PHOTOS);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('获取照片列表失败'));
    });
  }
  
  // 计算存储大小
  static async getStorageSize(): Promise<number> {
    const photos = await this.getAllPhotos();
    return photos.reduce((total, photo) => total + photo.size, 0);
  }
  
  // 保存应用数据（带防抖）
  private static saveTimeout: NodeJS.Timeout | null = null;
  static saveDebouncedData(key: string, data: any, delay: number = 500): Promise<void> {
    return new Promise((resolve) => {
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
      }
      
      this.saveTimeout = setTimeout(async () => {
        await this.saveData(key, data);
        resolve();
      }, delay);
    });
  }
  
  // 立即保存应用数据
  static async saveData(key: string, data: any): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_DATA], 'readwrite');
      const store = transaction.objectStore(this.STORE_DATA);
      const request = store.put(data, key);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('保存数据失败'));
    });
  }
  
  // 获取应用数据
  static async getData(key: string): Promise<any> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_DATA], 'readonly');
      const store = transaction.objectStore(this.STORE_DATA);
      const request = store.get(key);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('获取数据失败'));
    });
  }
}

/**
 * 照片服务
 */
class PhotoService {
  // 压缩图片到指定质量
  private static async compressImage(dataUrl: string, maxWidth: number = 1920, quality: number = 0.8): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // 按比例缩放
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('无法创建Canvas上下文'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = dataUrl;
    });
  }
  
  // 生成缩略图
  private static async generateThumbnail(dataUrl: string): Promise<string> {
    return this.compressImage(dataUrl, 200, 0.6);
  }
  
  // 使用相机拍照或从相册选择
  static async pickPhoto(): Promise<Photo | null> {
    try {
      const { Camera, CameraSource, CameraResultType } = await import('@capacitor/camera');
      
      const image = await Camera.getPhoto({
        quality: 90,
        source: CameraSource.Prompt, // 弹出选择：相机或相册
        resultType: CameraResultType.DataUrl,
        allowEditing: true,
        width: 1920,
      });

      if (!image.dataUrl) {
        return null;
      }

      // 生成ID
      const id = 'photo-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      
      // 压缩原图
      const compressedData = await this.compressImage(image.dataUrl);
      
      // 生成缩略图
      const thumbnail = await this.generateThumbnail(image.dataUrl);
      
      // 计算大小
      const size = new Blob([compressedData]).size;
      
      const photo: Photo = {
        id,
        data: compressedData,
        thumbnail,
        timestamp: new Date().toISOString(),
        size
      };
      
      // 存储到IndexedDB
      await IndexedDBService.savePhoto(photo);
      
      return photo;
    } catch (error) {
      console.error('选择照片失败:', error);
      throw error;
    }
  }
  
  static async getPhoto(id: string): Promise<Photo | null> {
    return await IndexedDBService.getPhoto(id);
  }
  
  static async deletePhoto(id: string): Promise<boolean> {
    try {
      await IndexedDBService.deletePhoto(id);
      return true;
    } catch (error) {
      console.error('删除照片失败:', error);
      return false;
    }
  }
  
  static async getStorageUsage(): Promise<{ used: number; total: number }> {
    const used = await IndexedDBService.getStorageSize();
    const total = 50 * 1024 * 1024; // 50MB
    return { used, total };
  }
}

/**
 * 配对服务
 */
// --- Helper Functions ---

// 获取记仇/回忆的同步状态
const getSyncStatus = (item: Grudge | Memory, profile: UserProfile): '已同步' | '会被同步' | '不会被同步' => {
  // 如果标记为私密,不会被同步
  if (item.isPrivate) {
    return '不会被同步';
  }
  
  // 如果是自己创建的记录,会被同步(当配对时)
  if (item.authorDeviceId === profile.deviceId) {
    return '会被同步';
  }
  
  // 如果是对方的记录(authorDeviceId不同),说明已经同步过来了
  return '已同步';
};

// 获取作者标签(用于显示记录的创建者)
const getAuthorLabel = (item: Grudge | Memory, profile: UserProfile): { text: string; isMine: boolean; emoji: string } => {
  // 如果没有作者信息(旧数据),默认认为是自己的
  if (!item.authorDeviceId) {
    return { text: '我的记录', isMine: true, emoji: '✍️' };
  }
  
  // 是自己创建的
  if (item.authorDeviceId === profile.deviceId) {
    return { text: '我的记录', isMine: true, emoji: '✍️' };
  }
  
  // 是对方创建的
  const partnerName = profile.partner?.name || 'TA';
  const partnerCallName = profile.partner?.callsMe || partnerName;
  return { text: `${partnerCallName}的记录`, isMine: false, emoji: '💌' };
};

class PairingService {
  // 生成配对邀请数据
  static generatePairInvite(profile: UserProfile, callName: string): PairInvite {
    return {
      type: 'pair_invite',
      version: '1.0',
      timestamp: Date.now(),
      inviter: {
        id: profile.deviceId,
        role: profile.role!,
        name: profile.name,
        callName: callName // 期望对方怎么叫自己
      }
    };
  }

  // 生成配对确认数据
  static generatePairConfirm(
    profile: UserProfile,
    invite: PairInvite,
    myCallName: string,
    partnerCallsMe: string,
    anniversary?: string
  ): PairConfirm {
    return {
      type: 'pair_confirm',
      version: '1.0',
      timestamp: Date.now(),
      responder: {
        id: profile.deviceId,
        role: profile.role!,
        name: profile.name,
        callName: partnerCallsMe // 我希望对方叫我什么
      },
      relationship: {
        partnerCallsMe: myCallName, // 对方叫我什么 (实际是invite中的inviter的callName)
        myCallName: myCallName,      // 我叫对方什么
        anniversary
      },
      linkTo: invite.inviter.id
    };
  }

  // 编码二维码数据（压缩）
  static encodeQRData(data: QRCodeData): string {
    const json = JSON.stringify(data);
    return LZString.compressToBase64(json);
  }

  // 解码二维码数据
  static decodeQRData(encoded: string): QRCodeData | null {
    try {
      const decompressed = LZString.decompressFromBase64(encoded);
      if (!decompressed) return null;
      return JSON.parse(decompressed) as QRCodeData;
    } catch (error) {
      console.error('解码二维码失败:', error);
      return null;
    }
  }

  // 生成同步数据
  static generateSyncData(
    deviceId: string,
    grudges: Grudge[],
    memories: Memory[]
  ): SyncData {
    // 过滤掉私密内容,只同步非私密的数据
    const publicGrudges = grudges.filter(g => !g.isPrivate);
    const publicMemories = memories.filter(m => !m.isPrivate);
    
    return {
      type: 'data_sync',
      version: '1.0',
      from: deviceId,
      timestamp: Date.now(),
      syncId: 'sync-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      data: {
        grudges: publicGrudges,
        memories: publicMemories
      },
      stats: {
        totalGrudges: publicGrudges.length,
        totalMemories: publicMemories.length
      }
    };
  }

  // 扫描二维码（使用摄像头）
  static async scanQRCode(): Promise<string | null> {
    try {
      console.log('开始扫描二维码...');
      
      // 检查是否支持扫描
      const isSupported = await BarcodeScanner.isSupported();
      console.log('扫描功能支持状态:', isSupported);
      
      if (!isSupported) {
        throw new Error('当前设备不支持二维码扫描');
      }

      // 检查 Google Barcode Scanner 模块是否已安装
      console.log('检查 Google Barcode Scanner 模块...');
      const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      
      if (!available) {
        console.log('Google Barcode Scanner 模块未安装，开始安装...');
        await BarcodeScanner.installGoogleBarcodeScannerModule();
        console.log('Google Barcode Scanner 模块安装完成');
      } else {
        console.log('Google Barcode Scanner 模块已可用');
      }

      // 请求相机权限
      console.log('请求相机权限...');
      const permission = await BarcodeScanner.requestPermissions();
      console.log('权限结果:', permission);
      
      if (permission.camera !== 'granted') {
        throw new Error('需要相机权限才能扫描二维码');
      }

      // 开始扫描
      console.log('启动扫描界面...');
      const result = await BarcodeScanner.scan();
      console.log('扫描结果:', result);
      
      if (result.barcodes && result.barcodes.length > 0) {
        const qrValue = result.barcodes[0].rawValue || null;
        console.log('读取到二维码:', qrValue?.substring(0, 50) + '...');
        return qrValue;
      }
      
      console.log('未扫描到二维码');
      return null;
    } catch (error) {
      console.error('扫描二维码失败:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error('扫描失败: ' + errorMsg);
    }
  }

  // 从相册选择二维码图片
  static async pickQRCodeFromGallery(): Promise<string | null> {
    try {
      console.log('打开相册选择图片...');
      const { Camera, CameraSource, CameraResultType } = await import('@capacitor/camera');
      
      const image = await Camera.getPhoto({
        quality: 100,
        source: CameraSource.Photos, // 从相册选择
        resultType: CameraResultType.DataUrl,
        allowEditing: false
      });

      if (!image.dataUrl) {
        console.log('未获取到图片数据');
        return null;
      }

      console.log('开始解析图片中的二维码...');
      
      // 创建图片元素加载图片
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          try {
            // 创建 canvas 绘制图片
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
              reject(new Error('无法创建 Canvas 上下文'));
              return;
            }

            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            // 使用 jsQR 解析二维码
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert'
            });

            if (code) {
              console.log('成功识别二维码:', code.data.substring(0, 50) + '...');
              resolve(code.data);
            } else {
              console.log('图片中未识别到二维码');
              resolve(null);
            }
          } catch (error) {
            console.error('解析二维码失败:', error);
            reject(error);
          }
        };
        
        img.onerror = () => {
          reject(new Error('图片加载失败'));
        };
        
        img.src = image.dataUrl!;
      });
    } catch (error) {
      console.error('从相册选择二维码失败:', error);
      throw error;
    }
  }
}

/**
 * 成就系统
 */

// 成就定义列表
const ACHIEVEMENT_DEFINITIONS: Omit<Achievement, 'unlocked' | 'unlockedAt' | 'progress'>[] = [
  // 记仇类成就
  { id: 'grudge_first', name: '第一笔账', description: '记录第一条记仇', icon: '📝', target: 1, category: 'grudge' },
  { id: 'grudge_10', name: '记仇达人', description: '记录10条记仇', icon: '📚', target: 10, category: 'grudge' },
  { id: 'grudge_50', name: '账本专家', description: '记录50条记仇', icon: '📖', target: 50, category: 'grudge' },
  { id: 'grudge_100', name: '记仇大师', description: '记录100条记仇', icon: '🏆', target: 100, category: 'grudge' },
  { id: 'high_anger', name: '火山爆发', description: '单条愤怒值达到100', icon: '🌋', target: 1, category: 'grudge' },
  { id: 'daily_5', name: '脾气暴躁', description: '单日记录5条记仇', icon: '😤', target: 5, category: 'grudge' },
  { id: 'grudge_tag_first', name: '贴标签', description: '为记仇添加第一个标签', icon: '🏷️', target: 1, category: 'grudge' },
  { id: 'grudge_photo_10', name: '铁证如山', description: '记仇记录中上传10张照片', icon: '📸', target: 10, category: 'grudge' },
  
  // 回忆类成就
  { id: 'memory_first', name: '第一份甜蜜', description: '记录第一条回忆', icon: '💕', target: 1, category: 'memory' },
  { id: 'memory_10', name: '甜蜜回忆', description: '记录10条回忆', icon: '🎀', target: 10, category: 'memory' },
  { id: 'memory_50', name: '幸福满溢', description: '记录50条回忆', icon: '💖', target: 50, category: 'memory' },
  { id: 'memory_100', name: '爱的见证', description: '记录100条回忆', icon: '💝', target: 100, category: 'memory' },
  { id: 'high_sweet', name: '超级感动', description: '单条甜蜜度达到100', icon: '🌟', target: 1, category: 'memory' },
  { id: 'daily_memory_3', name: '天天甜蜜', description: '单日记录3条回忆', icon: '🥰', target: 3, category: 'memory' },
  { id: 'memory_photo_10', name: '美好瞬间', description: '回忆记录中上传10张照片', icon: '📷', target: 10, category: 'memory' },
  
  // 和解类成就
  { id: 'forgive_first', name: '第一次原谅', description: '原谅第一条记录', icon: '🤝', target: 1, category: 'harmony' },
  { id: 'forgive_10', name: '宽容大度', description: '原谅10条记录', icon: '😊', target: 10, category: 'harmony' },
  { id: 'forgive_50', name: '和平使者', description: '原谅50条记录', icon: '🕊️', target: 50, category: 'harmony' },
  { id: 'forgive_rate_80', name: '天使伴侣', description: '原谅率达到80%', icon: '👼', target: 80, category: 'harmony' },
  { id: 'harmony_80', name: '完美关系', description: '和谐度达到80分', icon: '💯', target: 80, category: 'harmony' },
  { id: 'harmony_perfect', name: '神仙眷侣', description: '和谐度达到95分', icon: '✨', target: 95, category: 'harmony' },
  { id: 'quick_forgive', name: '闪电和解', description: '1小时内原谅一条记仇', icon: '⚡', target: 1, category: 'harmony' },
  
  // 综合类成就
  { id: 'balance', name: '完美平衡', description: '正负记录比例1:1', icon: '⚖️', target: 1, category: 'harmony' },
  { id: 'total_100', name: '百里挑一', description: '总记录数达到100', icon: '💯', target: 100, category: 'harmony' },
  { id: 'total_365', name: '天长地久', description: '总记录数达到365', icon: '🎊', target: 365, category: 'harmony' },
  { id: 'use_30days', name: '忠实用户', description: '使用APP满30天', icon: '📅', target: 30, category: 'harmony' },
  { id: 'continuous_3days', name: '坚持不懈', description: '连续3天记录', icon: '🔥', target: 3, category: 'harmony' },
  { id: 'continuous_7days', name: '一周之约', description: '连续7天记录', icon: '🌈', target: 7, category: 'harmony' },
  { id: 'night_owl', name: '深夜档案', description: '在23:00后记录10次', icon: '🦉', target: 10, category: 'harmony' },
  { id: 'early_bird', name: '清晨记录', description: '在6:00-8:00记录10次', icon: '🌅', target: 10, category: 'harmony' },
  { id: 'delete_master', name: '冷静思考', description: '删除记录达5次', icon: '🗑️', target: 5, category: 'harmony' },
];

class AchievementService {
  /**
   * 初始化成就列表
   */
  static initAchievements(): Achievement[] {
    return ACHIEVEMENT_DEFINITIONS.map(def => ({
      ...def,
      unlocked: false,
      unlockedAt: null,
      progress: 0
    }));
  }

  /**
   * 检查并更新所有成就
   * 返回新解锁的成就列表
   */
  static checkAchievements(
    grudges: Grudge[], 
    memories: Memory[], 
    currentAchievements: Achievement[],
    profile: UserProfile
  ): { achievements: Achievement[], newlyUnlocked: Achievement[] } {
    const updatedAchievements = [...currentAchievements];
    const newlyUnlocked: Achievement[] = [];

    const stats = this.calculateStats(grudges, memories, profile);

    updatedAchievements.forEach(achievement => {
      if (achievement.unlocked) return;

      let progress = 0;
      let shouldUnlock = false;

      // 根据成就 ID 计算进度
      switch (achievement.id) {
        case 'grudge_first':
        case 'grudge_10':
        case 'grudge_50':
        case 'grudge_100':
          progress = grudges.length;
          shouldUnlock = progress >= achievement.target;
          break;

        case 'memory_first':
        case 'memory_10':
        case 'memory_50':
        case 'memory_100':
          progress = memories.length;
          shouldUnlock = progress >= achievement.target;
          break;

        case 'forgive_first':
        case 'forgive_10':
        case 'forgive_50':
          progress = stats.forgivenCount;
          shouldUnlock = progress >= achievement.target;
          break;

        case 'high_anger':
          progress = stats.maxAnger;
          shouldUnlock = progress >= achievement.target;
          break;

        case 'high_sweet':
          progress = stats.maxSweetness;
          shouldUnlock = progress >= achievement.target;
          break;

        case 'daily_5':
          progress = stats.maxDailyGrudges;
          shouldUnlock = progress >= achievement.target;
          break;

        case 'daily_memory_3':
          progress = stats.maxDailyMemories;
          shouldUnlock = progress >= achievement.target;
          break;

        case 'forgive_rate_80':
          progress = stats.forgivenessRate;
          shouldUnlock = progress >= achievement.target && grudges.length >= 10;
          break;

        case 'harmony_80':
        case 'harmony_perfect':
          progress = stats.harmonyScore;
          shouldUnlock = progress >= achievement.target;
          break;

        case 'balance':
          progress = stats.balanceRatio;
          shouldUnlock = stats.balanceRatio >= 0.8 && stats.balanceRatio <= 1.2 && grudges.length >= 10 && memories.length >= 10;
          break;

        case 'total_100':
        case 'total_365':
          progress = grudges.length + memories.length;
          shouldUnlock = progress >= achievement.target;
          break;

        case 'use_30days':
          progress = stats.usageDays;
          shouldUnlock = progress >= achievement.target;
          break;

        case 'grudge_tag_first':
          progress = stats.grudgeTagCount;
          shouldUnlock = progress >= achievement.target;
          break;

        case 'grudge_photo_10':
          progress = stats.grudgePhotoCount;
          shouldUnlock = progress >= achievement.target;
          break;

        case 'memory_photo_10':
          progress = stats.memoryPhotoCount;
          shouldUnlock = progress >= achievement.target;
          break;

        case 'quick_forgive':
          progress = stats.quickForgivCount;
          shouldUnlock = progress >= achievement.target;
          break;

        case 'continuous_3days':
        case 'continuous_7days':
          progress = stats.continuousDays;
          shouldUnlock = progress >= achievement.target;
          break;

        case 'night_owl':
          progress = stats.nightRecordCount;
          shouldUnlock = progress >= achievement.target;
          break;

        case 'early_bird':
          progress = stats.earlyRecordCount;
          shouldUnlock = progress >= achievement.target;
          break;

        case 'delete_master':
          progress = stats.deleteCount;
          shouldUnlock = progress >= achievement.target;
          break;
      }

      achievement.progress = Math.min(progress, achievement.target);

      if (shouldUnlock) {
        achievement.unlocked = true;
        achievement.unlockedAt = new Date().toISOString();
        newlyUnlocked.push(achievement);
      }
    });

    return { achievements: updatedAchievements, newlyUnlocked };
  }

  /**
   * 计算统计数据用于成就检测
   */
  private static calculateStats(grudges: Grudge[], memories: Memory[], profile: UserProfile) {
    const forgivenCount = grudges.filter(g => g.status === 'forgiven').length;
    const forgivenessRate = grudges.length > 0 ? (forgivenCount / grudges.length) * 100 : 0;
    
    const maxAnger = grudges.length > 0 ? Math.max(...grudges.map(g => g.severity)) : 0;
    const maxSweetness = memories.length > 0 ? Math.max(...memories.map(m => m.sweetness)) : 0;

    // 计算单日最大记录数
    const grudgeDates: { [key: string]: number } = {};
    grudges.forEach(g => {
      const date = new Date(g.date).toDateString();
      grudgeDates[date] = (grudgeDates[date] || 0) + 1;
    });
    const maxDailyGrudges = Object.values(grudgeDates).length > 0 ? Math.max(...Object.values(grudgeDates)) : 0;

    const memoryDates: { [key: string]: number } = {};
    memories.forEach(m => {
      const date = new Date(m.date).toDateString();
      memoryDates[date] = (memoryDates[date] || 0) + 1;
    });
    const maxDailyMemories = Object.values(memoryDates).length > 0 ? Math.max(...Object.values(memoryDates)) : 0;

    // 计算和谐度（简化版）
    const activeAnger = grudges.filter(g => g.status === 'active').reduce((sum, g) => sum + g.severity, 0);
    const totalSweetness = memories.reduce((sum, m) => sum + m.sweetness, 0);
    const harmonyScore = Math.max(0, Math.min(100, 50 + (totalSweetness / 10 - activeAnger / 5)));

    // 正负记录比例
    const balanceRatio = memories.length > 0 ? grudges.length / memories.length : 0;

    // 使用天数（从第一条记录开始）
    const allDates = [...grudges.map(g => new Date(g.date)), ...memories.map(m => new Date(m.date))];
    const firstDate = allDates.length > 0 ? Math.min(...allDates.map(d => d.getTime())) : Date.now();
    const usageDays = Math.floor((Date.now() - firstDate) / (1000 * 60 * 60 * 24));

    // 标签统计
    const grudgeTagCount = grudges.filter(g => g.tags && g.tags.length > 0).length;

    // 照片统计
    const grudgePhotoCount = grudges.filter(g => g.photos && g.photos.length > 0).reduce((sum, g) => sum + (g.photos?.length || 0), 0);
    const memoryPhotoCount = memories.filter(m => m.photos && m.photos.length > 0).reduce((sum, m) => sum + (m.photos?.length || 0), 0);

    // 快速原谅统计（1小时内）
    const quickForgivCount = grudges.filter(g => {
      if (g.status !== 'forgiven' || !g.forgivenAt) return false;
      const timeDiff = new Date(g.forgivenAt).getTime() - new Date(g.date).getTime();
      return timeDiff <= 3600000; // 1小时 = 3600000ms
    }).length;

    // 连续使用天数统计
    const recordDates = [...grudges.map(g => g.date), ...memories.map(m => m.date)]
      .map(d => new Date(d).toDateString())
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort();
    let continuousDays = 0;
    let currentStreak = 1;
    for (let i = 1; i < recordDates.length; i++) {
      const prev = new Date(recordDates[i - 1]);
      const curr = new Date(recordDates[i]);
      const diffDays = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        currentStreak++;
        continuousDays = Math.max(continuousDays, currentStreak);
      } else {
        currentStreak = 1;
      }
    }
    if (recordDates.length > 0) continuousDays = Math.max(continuousDays, currentStreak);

    // 时间段统计
    const nightRecordCount = [...grudges, ...memories].filter(r => {
      const hour = new Date(r.date).getHours();
      return hour >= 23 || hour < 6;
    }).length;

    const earlyRecordCount = [...grudges, ...memories].filter(r => {
      const hour = new Date(r.date).getHours();
      return hour >= 6 && hour < 8;
    }).length;

    // 删除次数（从profile中获取，需要在profile中添加deleteCount字段）
    const deleteCount = (profile as any).deleteCount || 0;

    return {
      forgivenCount,
      forgivenessRate,
      maxAnger,
      maxSweetness,
      maxDailyGrudges,
      maxDailyMemories,
      harmonyScore,
      balanceRatio,
      usageDays,
      grudgeTagCount,
      grudgePhotoCount,
      memoryPhotoCount,
      quickForgivCount,
      continuousDays,
      nightRecordCount,
      earlyRecordCount,
      deleteCount
    };
  }
}

/**
 * 图表服务 (预留)
 */
class ChartService {
  static prepareTimelineData(records: (Grudge | Memory)[]): any {
    // TODO: 准备时间线图表数据
    return null;
  }
  
  static prepareTagDistribution(records: (Grudge | Memory)[]): any {
    // TODO: 准备标签分布数据
    return null;
  }
}

// --- AI Service (Hidden for now) ---
// 这是一个预留的 AI 服务层，目前 UI 不调用它
class AIService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || 'dummy_key' });
  }

  /**
   * 构思一个有趣的“判决书”或润色生气的理由
   */
  async embellishGrudge(title: string, severity: number): Promise<string> {
    try {
      const model = this.ai.models;
      const response = await model.generateContent({
        model: 'gemini-2.5-flash',
        contents: `User is recording a grudge titled "${title}" with severity ${severity}/100. 
        Rewrite this into a funny, playful, slightly dramatic "court accusation" style text. Keep it short (under 50 words).`,
      });
      return response.text || "系统繁忙，只能你自己骂了。";
    } catch (e) {
      console.error("AI Error", e);
      return "AI 正在睡觉，无法润色。";
    }
  }
}

// --- Helper Hooks ---

// Persist state to local storage with IndexedDB fallback and debounce
function useStickyState<T>(defaultValue: T, key: string): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stickyValue = window.localStorage.getItem(key);
      return stickyValue !== null ? JSON.parse(stickyValue) : defaultValue;
    } catch (e) {
      console.warn(`Error reading localStorage key "${key}":`, e);
      return defaultValue;
    }
  });

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 防抖保存：延迟保存以减少写入频率
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const jsonValue = JSON.stringify(value);
        
        // 先尝试 localStorage（快速）
        try {
          window.localStorage.setItem(key, jsonValue);
        } catch (e) {
          // 如果 localStorage 满了，使用 IndexedDB
          console.warn(`localStorage full, using IndexedDB for key "${key}"`);
          await IndexedDBService.saveData(key, value);
        }
      } catch (e) {
        console.warn(`Error saving key "${key}":`, e);
      }
    }, 300); // 300ms 防抖

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [key, value]);

  return [value, setValue];
}

// --- Components ---

const PRESET_TAGS = ['偷吃', '迟到', '态度敷衍', '打游戏', '忘记纪念日', '拍照丑', '不回消息'];
const PRESET_MEMORY_TAGS = ['惊喜', '礼物', '陪伴', '道歉', '浪漫', '贴心', '温暖'];

// 情绪类型配置
const MOOD_OPTIONS: MoodOption[] = [
  { type: '愤怒', emoji: '😤', label: '愤怒', color: 'bg-red-500' },
  { type: '失望', emoji: '😔', label: '失望', color: 'bg-blue-500' },
  { type: '委屈', emoji: '😢', label: '委屈', color: 'bg-indigo-500' },
  { type: '无奈', emoji: '😑', label: '无奈', color: 'bg-gray-500' },
  { type: '嫌弃', emoji: '😒', label: '嫌弃', color: 'bg-purple-500' },
  { type: '无语', emoji: '🙄', label: '无语', color: 'bg-teal-500' },
];

// 生成唯一设备ID
const generateDeviceId = () => {
  return 'device-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
};

const App = () => {
  const [profile, setProfile] = useStickyState<UserProfile>({ 
    role: null, 
    name: '', 
    onboarded: false,
    paired: false,
    pairId: null,
    deviceId: generateDeviceId()
  }, 'love-ledger-profile');
  const [grudges, setGrudges] = useStickyState<Grudge[]>([], 'love-ledger-grudges');
  const [memories, setMemories] = useStickyState<Memory[]>([], 'love-ledger-memories');
  const [achievements, setAchievements] = useStickyState<Achievement[]>(
    AchievementService.initAchievements(), 
    'love-ledger-achievements'
  );
  const [currentPage, setCurrentPage] = useState<'home' | 'memories' | 'statistics' | 'settings'>('home');
  const [view, setView] = useState<'dashboard' | 'add' | 'addMemory'>('dashboard');
  const [showSearch, setShowSearch] = useState(false);
  const [newUnlockedAchievements, setNewUnlockedAchievements] = useState<Achievement[]>([]);
  const [viewingGrudge, setViewingGrudge] = useState<Grudge | null>(null);
  const [viewingMemory, setViewingMemory] = useState<Memory | null>(null);

  // Derived state - 使用 useMemo 优化
  const themeColor = useMemo(() => 
    profile.role === 'gf' ? 'text-love-500' : 'text-cool-500',
    [profile.role]
  );
  
  const bgGradient = useMemo(() => 
    profile.role === 'gf' ? 'from-love-50 to-love-100' : 'from-cool-50 to-cool-100',
    [profile.role]
  );
  
  const buttonColor = useMemo(() => 
    profile.role === 'gf' ? 'bg-love-500 hover:bg-love-600' : 'bg-cool-500 hover:bg-cool-600',
    [profile.role]
  );
  
  // 获取当前空间名称（使用自定义或默认）- 使用 useMemo 优化
  const getGrudgeSpaceName = useCallback(() => {
    return profile.spaceConfig?.grudgeSpaceName || 
           (profile.role === 'gf' ? DEFAULT_GRUDGE_SPACE_NAME.gf : DEFAULT_GRUDGE_SPACE_NAME.bf);
  }, [profile.spaceConfig?.grudgeSpaceName, profile.role]);
  
  const getMemorySpaceName = useCallback(() => {
    return profile.spaceConfig?.memorySpaceName || DEFAULT_MEMORY_SPACE_NAME;
  }, [profile.spaceConfig?.memorySpaceName]);

  // 获取对方称呼（使用自定义或默认）- 使用 useCallback 优化
  const getPartnerCallName = useCallback(() => {
    return profile.customCallName || (profile.role === 'gf' ? '男朋友' : '女朋友');
  }, [profile.customCallName, profile.role]);
  
  // --- Actions ---

  // 成就检测辅助函数
  const checkAndUpdateAchievements = useCallback((updatedGrudges: Grudge[], updatedMemories: Memory[]) => {
    const { achievements: newAchievements, newlyUnlocked } = AchievementService.checkAchievements(
      updatedGrudges,
      updatedMemories,
      achievements,
      profile
    );
    setAchievements(newAchievements);
    
    // 显示新解锁的成就通知
    if (newlyUnlocked.length > 0) {
      // 立即显示通知
      setNewUnlockedAchievements(prev => [...prev, ...newlyUnlocked]);
      
      // 为每个新解锁的成就单独设置清除定时器
      newlyUnlocked.forEach((achievement, index) => {
        setTimeout(() => {
          setNewUnlockedAchievements(prev => prev.filter(a => a.id !== achievement.id));
        }, 3000 + (index * 500)); // 如果有多个成就,稍微错开清除时间
      });
    }
  }, [achievements, profile]);

  const handleAddGrudge = useCallback((newGrudge: Grudge) => {
    console.log('Adding grudge:', newGrudge);
    // 设置作者设备ID和私密状态
    const grudgeWithAuthor: Grudge = {
      ...newGrudge,
      authorDeviceId: profile.deviceId,
      isPrivate: newGrudge.isPrivate ?? false
    };
    setGrudges(prev => {
      const updatedGrudges = [grudgeWithAuthor, ...prev];
      checkAndUpdateAchievements(updatedGrudges, memories);
      return updatedGrudges;
    });
    setView('dashboard');
  }, [profile.deviceId, memories, checkAndUpdateAchievements]);

  const handleForgive = useCallback((id: string) => {
    console.log('Forgiving grudge:', id);
    setGrudges(prev => {
      const updatedGrudges = prev.map(g => g.id === id ? { 
        ...g, 
        status: 'forgiven' as GrudgeStatus,
        forgivenAt: new Date().toISOString()
      } : g);
      checkAndUpdateAchievements(updatedGrudges, memories);
      return updatedGrudges;
    });
  }, [memories, checkAndUpdateAchievements]);

  const handleDelete = useCallback((id: string) => {
    console.log('Requesting delete for:', id);
    // 使用 window.confirm 确保它是浏览器原生行为
    if (window.confirm('确定要彻底删除这条记录吗？(删除后就不能翻旧账了哦)')) {
      console.log('Deleting confirmed');
      setGrudges(prev => {
        const updatedGrudges = prev.filter(g => g.id !== id);
        checkAndUpdateAchievements(updatedGrudges, memories);
        return updatedGrudges;
      });
    } else {
      console.log('Deleting cancelled');
    }
  }, [memories, checkAndUpdateAchievements]);

  // --- Memory Actions ---

  const handleAddMemory = useCallback((newMemory: Memory) => {
    console.log('Adding memory:', newMemory);
    // 设置作者设备ID和私密状态
    const memoryWithAuthor: Memory = {
      ...newMemory,
      authorDeviceId: profile.deviceId,
      isPrivate: newMemory.isPrivate ?? false
    };
    setMemories(prev => {
      const updatedMemories = [memoryWithAuthor, ...prev];
      checkAndUpdateAchievements(grudges, updatedMemories);
      return updatedMemories;
    });
    setView('dashboard');
  }, [profile.deviceId, grudges, checkAndUpdateAchievements]);

  const handleDeleteMemory = useCallback((id: string) => {
    console.log('Requesting delete memory:', id);
    if (window.confirm('确定要删除这条美好回忆吗？')) {
      console.log('Deleting memory confirmed');
      setMemories(prev => {
        const updatedMemories = prev.filter(m => m.id !== id);
        checkAndUpdateAchievements(grudges, updatedMemories);
        return updatedMemories;
      });
    } else {
      console.log('Deleting memory cancelled');
    }
  }, [grudges, checkAndUpdateAchievements]);

  const handleUpdateGrudgePrivacy = useCallback((id: string, isPrivate: boolean) => {
    console.log('Updating grudge privacy:', id, isPrivate);
    setGrudges(prev => prev.map(g => 
      g.id === id ? { ...g, isPrivate } : g
    ));
  }, []);

  const handleUpdateMemoryPrivacy = useCallback((id: string, isPrivate: boolean) => {
    console.log('Updating memory privacy:', id, isPrivate);
    setMemories(prev => prev.map(m => 
      m.id === id ? { ...m, isPrivate } : m
    ));
  }, []);

  const handleLogout = useCallback(() => {
    console.log('Requesting logout');
    if (window.confirm('确定要退出当前身份吗？数据会保留在本地，下次登录还可以使用现在的名字。')) {
      console.log('Logout confirmed');
      // 保留名字，只重置身份和 onboarded 状态
      setProfile(prev => {
        const newProfile = { ...prev, role: null, onboarded: false };
        console.log('New Profile state:', newProfile);
        return newProfile;
      });
      setView('dashboard');
    }
  }, []);

  // --- Settings Actions ---

  const handleUpdateProfile = useCallback((updatedProfile: UserProfile) => {
    setProfile(updatedProfile);
  }, []);

  const handleExportData = async () => {
    try {
      const data = {
        profile,
        grudges,
        memories,
        exportDate: new Date().toISOString(),
        version: '1.0.0'
      };
      
      const dataStr = JSON.stringify(data, null, 2);
      const fileName = `love-ledger-backup-${new Date().toISOString().split('T')[0]}.json`;
      
      // 检测是否在移动端（Capacitor环境）
      const { Capacitor } = await import('@capacitor/core');
      
      if (Capacitor.isNativePlatform()) {
        // 移动端：使用 Filesystem API
        const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
        
        // 写入文件到 Documents 目录
        await Filesystem.writeFile({
          path: fileName,
          data: dataStr,
          directory: Directory.Documents,
          encoding: Encoding.UTF8
        });
        
        alert(`数据已导出到 Documents/${fileName}`);
      } else {
        // 桌面浏览器：使用传统下载方式
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleImportData = useCallback((dataStr: string) => {
    const data = JSON.parse(dataStr);
    
    if (data.profile) setProfile(data.profile);
    if (data.grudges) setGrudges(data.grudges);
    if (data.memories) setMemories(data.memories);
  }, []);

  const handleClearData = useCallback(() => {
    setGrudges([]);
    setMemories([]);
  }, []);

  // --- Render ---

  if (!profile.onboarded) {
    return (
      <OnboardingScreen 
        initialName={profile.name}
        onComplete={(role, name, customSelfName, spaceNames) => {
          const updatedProfile: UserProfile = {
            ...profile,
            role,
            name,
            onboarded: true
          };

          // 保存自定义称呼
          if (customSelfName) {
            updatedProfile.customSelfName = customSelfName;
          }

          // 保存自定义空间名称
          if (spaceNames) {
            updatedProfile.spaceConfig = {
              grudgeSpaceName: spaceNames.grudge || (role === 'gf' ? DEFAULT_GRUDGE_SPACE_NAME.gf : DEFAULT_GRUDGE_SPACE_NAME.bf),
              memorySpaceName: spaceNames.memory || DEFAULT_MEMORY_SPACE_NAME
            };
          }

          setProfile(updatedProfile);
        }} 
      />
    );
  }

  return (
    <div className={`fixed inset-0 w-full bg-gradient-to-br ${bgGradient} text-slate-800 overflow-hidden`}>
      {/* Achievement Unlock Notifications */}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-4 pointer-events-none">
        <AnimatePresence>
          {newUnlockedAchievements.map(achievement => (
            <motion.div
              key={achievement.id}
              initial={{ opacity: 0, y: -50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              className="mb-3 pointer-events-auto"
            >
              <div className="bg-gradient-to-r from-amber-400 to-yellow-500 rounded-2xl p-4 shadow-2xl border-2 border-white/50">
                <div className="flex items-center gap-3">
                  <div className="text-4xl">{achievement.icon}</div>
                  <div className="flex-1">
                    <div className="text-white text-xs font-medium mb-0.5">🎉 成就解锁！</div>
                    <h3 className="text-white font-bold text-sm">{achievement.name}</h3>
                    <p className="text-white/90 text-xs mt-0.5">{achievement.description}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Background Decorative Elements */}
      {!shouldReduceMotion() && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Floating particles */}
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className={`absolute rounded-full ${profile.role === 'gf' ? 'bg-pink-300/20' : 'bg-blue-300/20'}`}
              style={{
                width: `${Math.random() * 60 + 20}px`,
                height: `${Math.random() * 60 + 20}px`,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -30, 0],
                x: [0, 15, 0],
                opacity: [0.2, 0.4, 0.2],
              }}
              transition={{
                duration: 6 + i * 0.5,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: i * 0.3,
              }}
            />
          ))}
        </div>
      )}
      
      <div className="max-w-md mx-auto h-full flex flex-col relative shadow-2xl glass-effect">
        
        {/* Header - Show only on home page in dashboard view */}
        {view === 'dashboard' && currentPage === 'home' && (
          <header className="flex-shrink-0 bg-white/80 backdrop-blur-lg z-30 shadow-level-1 transition-all">
            {/* 渐变背景装饰 */}
            <div className={`absolute inset-0 bg-gradient-to-r ${profile.role === 'gf' ? 'from-love-50/50 via-transparent to-love-100/30' : 'from-cool-50/50 via-transparent to-cool-100/30'} pointer-events-none`} />
            
            <div className="relative p-6 pb-4">
              {/* 顶部行：头像+名字+搜索 */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleLogout}
                    className="p-2 -ml-2 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-white/80 active:bg-white cursor-pointer z-50 shadow-sm"
                    title="切换账号"
                  >
                    <LogOut size={20} />
                  </button>
                  
                  {/* 头像和基本信息 */}
                  <div className="flex items-center gap-3">
                    <motion.div 
                      className={`w-12 h-12 rounded-full ${profile.role === 'gf' ? 'bg-gradient-to-br from-love-400 to-love-600' : 'bg-gradient-to-br from-cool-400 to-cool-600'} flex items-center justify-center text-white text-xl font-bold shadow-level-2`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {profile.name.charAt(0)}
                    </motion.div>
                    
                    <div>
                      <h1 className={`text-xl font-bold ${themeColor} flex items-center gap-2`}>
                        {profile.name}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${profile.role === 'gf' ? 'bg-love-100 text-love-600' : 'bg-cool-100 text-cool-600'}`}>
                          {profile.role === 'gf' ? '👧' : '👦'} {profile.customSelfName || (profile.role === 'gf' ? '女友' : '男友')}
                        </span>
                      </h1>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        {profile.paired && profile.partner ? (
                          <>
                            <Users size={10} className="text-pink-500" />
                            <span>和 {getPartnerCallName()} 在一起</span>
                            <span className="font-bold text-pink-500">
                              {profile.relationship?.anniversary 
                                ? Math.ceil((Date.now() - new Date(profile.relationship.anniversary).getTime()) / (1000 * 60 * 60 * 24))
                                : 0} 
                            </span>
                            <span>天 💕</span>
                          </>
                        ) : (
                          <>
                            <User size={10} />
                            {profile.role === 'gf' ? '👿' : '🛡️'} {getGrudgeSpaceName()}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={() => setShowSearch(true)}
                  className={`p-3 ${profile.role === 'gf' ? 'text-love-500 bg-love-50 hover:bg-love-100' : 'text-cool-500 bg-cool-50 hover:bg-cool-100'} transition-colors rounded-full shadow-sm active:scale-95`}
                  title="搜索"
                >
                  <Search size={20} />
                </button>
              </div>
              
              {/* 愤怒值仪表盘 - 圆形进度条 */}
              <div className={`bg-gradient-to-r ${profile.role === 'gf' ? 'from-love-50 to-pink-50' : 'from-cool-50 to-blue-50'} rounded-2xl p-4 shadow-sm border border-white/60`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-slate-700">当前愤怒值</span>
                      <motion.div
                        animate={grudges.filter(g => g.status === 'active').length > 0 ? {
                          scale: [1, 1.2, 1],
                        } : {}}
                        transition={{
                          duration: 0.6,
                          repeat: Infinity,
                          repeatDelay: 0.4,
                        }}
                      >
                        <Zap size={16} className={grudges.filter(g => g.status === 'active').length > 0 ? 'text-red-500' : 'text-slate-300'} />
                      </motion.div>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-3xl font-bold ${grudges.filter(g => g.status === 'active').reduce((acc, curr) => acc + curr.severity, 0) > 300 ? 'text-red-600' : 'text-slate-700'}`}>
                        {grudges.filter(g => g.status === 'active').reduce((acc, curr) => acc + curr.severity, 0)}
                      </span>
                      <span className="text-xs text-slate-500">
                        / {grudges.filter(g => g.status === 'active').length} 条记录
                      </span>
                    </div>
                  </div>
                  
                  {/* 圆形进度指示器 */}
                  <div className="relative w-20 h-20">
                    <svg className="transform -rotate-90 w-20 h-20">
                      {/* 背景圆环 */}
                      <circle
                        cx="40"
                        cy="40"
                        r="34"
                        stroke="currentColor"
                        strokeWidth="6"
                        fill="none"
                        className="text-slate-200"
                      />
                      {/* 进度圆环 */}
                      <motion.circle
                        cx="40"
                        cy="40"
                        r="34"
                        stroke="currentColor"
                        strokeWidth="6"
                        fill="none"
                        strokeLinecap="round"
                        className={grudges.filter(g => g.status === 'active').reduce((acc, curr) => acc + curr.severity, 0) > 300 ? 'text-red-500' : 'text-orange-400'}
                        initial={{ strokeDashoffset: 214 }}
                        animate={{
                          strokeDashoffset: 214 - (Math.min(grudges.filter(g => g.status === 'active').reduce((acc, curr) => acc + curr.severity, 0), 500) / 500) * 214
                        }}
                        style={{
                          strokeDasharray: 214
                        }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-600">
                      {Math.round((Math.min(grudges.filter(g => g.status === 'active').reduce((acc, curr) => acc + curr.severity, 0), 500) / 500) * 100)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </header>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4">
          <AnimatePresence mode="wait">
            {view === 'dashboard' && (
              <Suspense fallback={currentPage === 'statistics' ? <StatsSkeleton /> : <CardSkeleton count={5} />}>
                <AnimatePresence mode="wait">
                  {currentPage === 'home' && (
                    <Dashboard 
                      key="home"
                      grudges={grudges} 
                      onForgive={handleForgive} 
                      onDelete={handleDelete}
                      onView={(grudge) => setViewingGrudge(grudge)}
                      role={profile.role}
                      profile={profile}
                    />
                  )}
                  {currentPage === 'memories' && (
                    <MemoriesPage 
                      key="memories"
                      memories={memories}
                      onDelete={handleDeleteMemory}
                      onAdd={() => setView('addMemory')}
                      onView={(memory) => setViewingMemory(memory)}
                      role={profile.role}
                      profile={profile}
                    />
                  )}
                  {currentPage === 'statistics' && (
                    <StatisticsPage 
                      key="statistics"
                      grudges={grudges}
                      memories={memories}
                      achievements={achievements}
                      role={profile.role}
                      profile={profile} 
                    />
                  )}
                  {currentPage === 'settings' && (
                    <SettingsPage 
                      key="settings"
                      profile={profile}
                      grudges={grudges}
                      memories={memories}
                      onUpdateProfile={handleUpdateProfile}
                      onExportData={handleExportData}
                      onImportData={handleImportData}
                      onClearData={handleClearData}
                      role={profile.role}
                    />
                  )}
                </AnimatePresence>
              </Suspense>
            )}
            {view === 'add' && (
              <AddGrudgeForm 
                onSave={handleAddGrudge} 
                onCancel={() => setView('dashboard')} 
                role={profile.role}
              />
            )}
            {view === 'addMemory' && (
              <AddMemoryForm 
                onSave={handleAddMemory} 
                onCancel={() => setView('dashboard')} 
                role={profile.role}
              />
            )}
          </AnimatePresence>
        </main>

        {/* Floating Action Button (FAB) - Multi-button menu on home page */}
        {view === 'dashboard' && currentPage === 'home' && (
          <FABMenu 
            onAddGrudge={() => setView('add')}
            onAddMemory={() => setView('addMemory')}
            role={profile.role}
          />
        )}

        {/* Floating Action Button (FAB) - Memory page */}
        {view === 'dashboard' && currentPage === 'memories' && (
          <div className="absolute bottom-24 right-6 z-40">
            <motion.button 
              onClick={() => setView('addMemory')}
              className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white bg-gradient-to-br from-amber-400 to-orange-500"
              variants={fabPulseVariants}
              initial="initial"
              animate="pulse"
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.1 }}
            >
              <Sparkles size={24} strokeWidth={2.5} />
            </motion.button>
          </div>
        )}

        {/* Bottom Navigation Bar - Show only in dashboard view */}
        {view === 'dashboard' && (
          <div className="flex-shrink-0">
            <BottomTabBar 
              currentPage={currentPage} 
              onPageChange={setCurrentPage} 
              role={profile.role}
            />
          </div>
        )}

        {/* Search Overlay */}
        <AnimatePresence>
          {showSearch && (
            <SearchOverlay
              grudges={grudges}
              memories={memories}
              onClose={() => setShowSearch(false)}
              onForgive={handleForgive}
              onDelete={handleDelete}
              onDeleteMemory={handleDeleteMemory}
              role={profile.role}
            />
          )}
        </AnimatePresence>

        {/* Grudge Detail View */}
        <AnimatePresence>
          {viewingGrudge && (() => {
            const currentGrudge = grudges.find(g => g.id === viewingGrudge.id);
            return currentGrudge ? (
              <GrudgeDetailView
                grudge={currentGrudge}
                onClose={() => setViewingGrudge(null)}
                onForgive={handleForgive}
                onDelete={handleDelete}
                onUpdatePrivacy={handleUpdateGrudgePrivacy}
                role={profile.role}
                profile={profile}
              />
            ) : null;
          })()}
        </AnimatePresence>

        {/* Memory Detail View */}
        <AnimatePresence>
          {viewingMemory && (() => {
            const currentMemory = memories.find(m => m.id === viewingMemory.id);
            return currentMemory ? (
              <MemoryDetailView
                memory={currentMemory}
                onClose={() => setViewingMemory(null)}
                onDelete={handleDeleteMemory}
                onUpdatePrivacy={handleUpdateMemoryPrivacy}
                role={profile.role}
                profile={profile}
              />
            ) : null;
          })()}
        </AnimatePresence>
      </div>
    </div>
  );
};

// --- Sub-Components ---

// 作者信息组件
const AuthorFooter = () => {
  const handleGitHubClick = () => {
    // 直接打开链接
    window.open('https://github.com/luyu14039/lovers-notebook', '_blank');
  };

  return (
    <motion.div 
      className="text-center space-y-2 mt-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.5 }}
    >
      <p className="text-xs text-slate-400">Made with ❤️ by us.</p>
      <button
        onClick={handleGitHubClick}
        className="text-xs text-slate-500 hover:text-slate-700 active:text-slate-900 transition-colors underline decoration-dotted"
      >
        🔗 View on GitHub
      </button>
    </motion.div>
  );
};

const OnboardingScreen = ({ onComplete, initialName }: { onComplete: (role: Role, name: string, customSelfName?: string, spaceNames?: { grudge: string, memory: string }) => void, initialName?: string }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: 角色和昵称, 2: 称呼设置, 3: 空间名称
  const [role, setRole] = useState<Role>(null);
  const [name, setName] = useState(initialName || '');
  const [customSelfName, setCustomSelfName] = useState('');
  const [grudgeSpaceName, setGrudgeSpaceName] = useState('');
  const [memorySpaceName, setMemorySpaceName] = useState('');
  const [showSelfNamePresets, setShowSelfNamePresets] = useState(false);
  const [showSpacePresets, setShowSpacePresets] = useState(false);

  // Update name if initialName changes (e.g. loading from storage)
  useEffect(() => {
    if (initialName) setName(initialName);
  }, [initialName]);

  // 当角色改变时，更新默认值
  useEffect(() => {
    if (role) {
      // 设置默认称呼（自己的称呼）
      setCustomSelfName(role === 'gf' ? '女朋友' : '男朋友');
      // 设置默认空间名称
      setGrudgeSpaceName(role === 'gf' ? DEFAULT_GRUDGE_SPACE_NAME.gf : DEFAULT_GRUDGE_SPACE_NAME.bf);
      setMemorySpaceName(DEFAULT_MEMORY_SPACE_NAME);
    }
  }, [role]);

  const handleNext = () => {
    if (step === 1 && role && name) {
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  const handleComplete = () => {
    onComplete(role, name, customSelfName, {
      grudge: grudgeSpaceName,
      memory: memorySpaceName
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center p-6 relative overflow-hidden">
      {/* 背景装饰 - 浮动爱心 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-20 left-[10%] text-4xl opacity-20"
          animate={{ y: [0, -20, 0], rotate: [0, 10, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          💕
        </motion.div>
        <motion.div
          className="absolute top-[30%] right-[15%] text-5xl opacity-15"
          animate={{ y: [0, -30, 0], rotate: [0, -15, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        >
          💖
        </motion.div>
        <motion.div
          className="absolute bottom-[25%] left-[20%] text-3xl opacity-20"
          animate={{ y: [0, -15, 0], rotate: [0, 12, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        >
          💗
        </motion.div>
        <motion.div
          className="absolute top-[60%] right-[25%] text-4xl opacity-10"
          animate={{ y: [0, -25, 0], rotate: [0, -10, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        >
          💝
        </motion.div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div 
          key={step}
          className="w-full max-w-sm relative z-10"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-8 space-y-6 text-center border border-white/20">
            {/* 步骤指示器 */}
            <div className="flex justify-center gap-2 mb-4">
              {[1, 2, 3].map(s => (
                <div 
                  key={s}
                  className={`h-1.5 rounded-full transition-all ${
                    s === step ? 'w-8 bg-gradient-to-r from-pink-500 to-purple-500' : 
                    s < step ? 'w-1.5 bg-green-400' : 'w-1.5 bg-slate-200'
                  }`}
                />
              ))}
            </div>

            {/* 步骤 1: 角色和昵称 */}
            {step === 1 && (
              <>
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                >
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Heart className="w-14 h-14 text-red-400 mx-auto mb-3" fill="currentColor" />
                  </motion.div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
                    恋爱小本本
                  </h1>
                  <p className="text-slate-500 text-xs mt-2">选择你的身份并设置昵称</p>
                </motion.div>

                <div className="grid grid-cols-2 gap-3">
                  <motion.button 
                    onClick={() => setRole('bf')}
                    className={`p-5 rounded-2xl border-2 transition-all duration-300 ${
                      role === 'bf' 
                        ? 'border-cool-500 bg-gradient-to-br from-cool-50 to-cool-100 text-cool-700 shadow-cool-glow scale-105' 
                        : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:shadow-md'
                    }`}
                    whileHover={{ scale: role === 'bf' ? 1.05 : 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="text-4xl mb-2">👦</div>
                    <div className="font-bold text-sm">男朋友</div>
                  </motion.button>
                  <motion.button 
                    onClick={() => setRole('gf')}
                    className={`p-5 rounded-2xl border-2 transition-all duration-300 ${
                      role === 'gf' 
                        ? 'border-love-500 bg-gradient-to-br from-love-50 to-love-100 text-love-700 shadow-love-glow scale-105' 
                        : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:shadow-md'
                    }`}
                    whileHover={{ scale: role === 'gf' ? 1.05 : 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="text-4xl mb-2">👧</div>
                    <div className="font-bold text-sm">女朋友</div>
                  </motion.button>
                </div>

                <div className="space-y-2 text-left">
                  <label className="text-xs font-bold text-slate-500 ml-1 flex items-center gap-1">
                    <User size={12} />
                    <span>你的昵称</span>
                  </label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={role === 'bf' ? "例如：卑微小王" : role === 'gf' ? "例如：傲娇公主" : "输入你的昵称"}
                    className="w-full bg-slate-50 text-slate-900 placeholder:text-slate-400 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none transition-all"
                  />
                </div>

                <motion.button 
                  disabled={!role || !name}
                  onClick={handleNext}
                  className={`w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg ${
                    role === 'gf' 
                      ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:from-pink-600 hover:to-rose-600' 
                      : role === 'bf'
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600'
                      : 'bg-slate-300 text-slate-500'
                  }`}
                  whileHover={{ scale: (role && name) ? 1.02 : 1 }}
                  whileTap={{ scale: (role && name) ? 0.98 : 1 }}
                >
                  下一步 →
                </motion.button>
              </>
            )}

            {/* 步骤 2: 称呼设置 */}
            {step === 2 && (
              <>
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                >
                  <div className="text-4xl mb-3">💕</div>
                  <h2 className="text-xl font-bold text-slate-800">设置你的称呼</h2>
                  <p className="text-slate-500 text-xs mt-1">对方要怎么叫你？</p>
                </motion.div>

                <div className="space-y-3 text-left">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={customSelfName}
                      onChange={(e) => setCustomSelfName(e.target.value)}
                      placeholder="输入称呼"
                      className="flex-1 bg-slate-50 text-slate-900 placeholder:text-slate-400 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-pink-400 focus:border-transparent outline-none transition-all"
                      maxLength={10}
                    />
                    <button
                      onClick={() => setShowSelfNamePresets(!showSelfNamePresets)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                        role === 'gf' 
                          ? 'bg-pink-100 hover:bg-pink-200 text-pink-700' 
                          : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                      }`}
                    >
                      预设
                    </button>
                  </div>

                  {showSelfNamePresets && (
                    <motion.div 
                      className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2 max-h-48 overflow-y-auto"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                    >
                      {role === 'gf' ? (
                        <>
                          {Object.entries(BOYFRIEND_CALL_GIRLFRIEND_PRESETS).map(([category, presets]) => (
                            <div key={category}>
                              <div className="text-[10px] font-bold text-slate-400 mb-1">
                                {category === 'romantic' ? '🌹 浪漫系' : category === 'cute' ? '🐷 可爱系' : '💖 甜蜜系'}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {presets.map((preset: string) => (
                                  <button
                                    key={preset}
                                    onClick={() => {
                                      setCustomSelfName(preset);
                                      setShowSelfNamePresets(false);
                                    }}
                                    className="px-2 py-1 bg-pink-100 hover:bg-pink-200 text-pink-700 rounded text-xs transition-all"
                                  >
                                    {preset}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </>
                      ) : (
                        <>
                          {Object.entries(GIRLFRIEND_CALL_BOYFRIEND_PRESETS).map(([category, presets]) => (
                            <div key={category}>
                              <div className="text-[10px] font-bold text-slate-400 mb-1">
                                {category === 'romantic' ? '🌹 浪漫系' : category === 'cute' ? '🐷 可爱系' : '👑 霸气系'}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {presets.map((preset: string) => (
                                  <button
                                    key={preset}
                                    onClick={() => {
                                      setCustomSelfName(preset);
                                      setShowSelfNamePresets(false);
                                    }}
                                    className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-xs transition-all"
                                  >
                                    {preset}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </motion.div>
                  )}

                  <div className="text-center text-xs text-slate-400 py-2">
                    当前：{customSelfName || '未设置'}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={handleBack}
                    className="flex-1 py-3 rounded-xl font-bold text-sm bg-slate-200 hover:bg-slate-300 text-slate-700 transition-all"
                  >
                    ← 上一步
                  </button>
                  <button 
                    onClick={handleNext}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm text-white transition-all shadow-lg ${
                      role === 'gf' 
                        ? 'bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600' 
                        : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
                    }`}
                  >
                    下一步 →
                  </button>
                </div>
              </>
            )}

            {/* 步骤 3: 空间名称 */}
            {step === 3 && (
              <>
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                >
                  <div className="text-4xl mb-3">✨</div>
                  <h2 className="text-xl font-bold text-slate-800">给空间取个名字</h2>
                  <p className="text-slate-500 text-xs mt-1">个性化你的记录空间</p>
                </motion.div>

                <div className="space-y-3 text-left">
                  <div>
                    <label className="text-xs font-bold text-slate-500 ml-1 mb-1.5 block">负面记录空间</label>
                    <input 
                      type="text" 
                      value={grudgeSpaceName}
                      onChange={(e) => setGrudgeSpaceName(e.target.value)}
                      placeholder="例如：小本本、吐槽专区"
                      className="w-full bg-slate-50 text-slate-900 placeholder:text-slate-400 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none transition-all"
                      maxLength={10}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 ml-1 mb-1.5 block">正面回忆空间</label>
                    <input 
                      type="text" 
                      value={memorySpaceName}
                      onChange={(e) => setMemorySpaceName(e.target.value)}
                      placeholder="例如：甜蜜回忆、幸福时光"
                      className="w-full bg-slate-50 text-slate-900 placeholder:text-slate-400 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none transition-all"
                      maxLength={10}
                    />
                  </div>

                  <button
                    onClick={() => setShowSpacePresets(!showSpacePresets)}
                    className="w-full px-3 py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-xl text-xs font-medium transition-all"
                  >
                    {showSpacePresets ? '收起预设' : '查看预设选项'}
                  </button>

                  {showSpacePresets && (
                    <motion.div 
                      className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-3 max-h-56 overflow-y-auto"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-600 mb-2">负面空间预设</div>
                        {Object.entries(GRUDGE_SPACE_PRESETS).map(([category, presets]) => (
                          <div key={category} className="mb-2">
                            <div className="text-[10px] font-bold text-slate-400 mb-1">
                              {category === 'record' ? '📋 记录类' : 
                               category === 'archive' ? '📁 档案类' :
                               category === 'fun' ? '🎯 趣味类' : '💭 情绪类'}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {presets.map((preset: string) => (
                                <button
                                  key={preset}
                                  onClick={() => {
                                    setGrudgeSpaceName(preset);
                                    setShowSpacePresets(false);
                                  }}
                                  className="px-2 py-1 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded text-xs transition-all"
                                >
                                  {preset}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-slate-200 pt-2">
                        <div className="text-xs font-bold text-slate-600 mb-2">正面空间预设</div>
                        <div className="flex flex-wrap gap-1">
                          {MEMORY_SPACE_PRESETS.map(preset => (
                            <button
                              key={preset}
                              onClick={() => {
                                setMemorySpaceName(preset);
                                setShowSpacePresets(false);
                              }}
                              className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded text-xs transition-all"
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={handleBack}
                    className="flex-1 py-3 rounded-xl font-bold text-sm bg-slate-200 hover:bg-slate-300 text-slate-700 transition-all"
                  >
                    ← 上一步
                  </button>
                  <button 
                    onClick={handleComplete}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm text-white transition-all shadow-lg ${
                      role === 'gf' 
                        ? 'bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600' 
                        : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
                    }`}
                  >
                    {role === 'gf' ? '开始记仇 💢' : '开启生存模式 🛡️'}
                  </button>
                </div>
              </>
            )}

            {/* 作者信息 */}
            {step === 1 && <AuthorFooter />}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

// FAB多按钮菜单组件
const FABMenu = ({ onAddGrudge, onAddMemory, role }: { onAddGrudge: () => void, onAddMemory: () => void, role: Role }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const buttonColor = role === 'gf' ? 'bg-gradient-to-br from-love-400 to-love-600' : 'bg-gradient-to-br from-cool-400 to-cool-600';
  
  return (
    <div className="absolute bottom-24 right-6 z-40">
      {/* 子按钮 */}
      <AnimatePresence>
        {isExpanded && (
          <>
            {/* 添加记仇按钮 */}
            <motion.div
              className="absolute bottom-20 right-0 flex items-center gap-2"
              initial={{ opacity: 0, y: 20, scale: 0 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0 }}
              transition={{ delay: 0 }}
            >
              <span className="text-xs font-medium text-slate-700 bg-white px-2 py-1 rounded-full shadow-md whitespace-nowrap">
                记一笔仇
              </span>
              <motion.button
                onClick={() => {
                  onAddGrudge();
                  setIsExpanded(false);
                }}
                className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white ${buttonColor}`}
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
              >
                <Plus size={22} strokeWidth={3} />
              </motion.button>
            </motion.div>
            
            {/* 添加回忆按钮 */}
            <motion.div
              className="absolute bottom-36 right-0 flex items-center gap-2"
              initial={{ opacity: 0, y: 20, scale: 0 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0 }}
              transition={{ delay: 0.05 }}
            >
              <span className="text-xs font-medium text-slate-700 bg-white px-2 py-1 rounded-full shadow-md whitespace-nowrap">
                添加回忆
              </span>
              <motion.button
                onClick={() => {
                  onAddMemory();
                  setIsExpanded(false);
                }}
                className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white bg-gradient-to-br from-amber-400 to-orange-500"
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
              >
                <Sparkles size={20} strokeWidth={2.5} />
              </motion.button>
            </motion.div>

            {/* 遮罩层 */}
            <motion.div
              className="fixed inset-0 bg-black/20 backdrop-blur-[1px] -z-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsExpanded(false)}
            />
          </>
        )}
      </AnimatePresence>
      
      {/* 主按钮 */}
      <motion.button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white ${buttonColor} relative`}
        animate={{ 
          rotate: isExpanded ? 45 : 0,
          scale: isExpanded ? 1 : [1, 1.05, 1]
        }}
        transition={{ 
          rotate: { duration: 0.2 },
          scale: { duration: 2, repeat: isExpanded ? 0 : Infinity, ease: 'easeInOut' }
        }}
        whileTap={{ scale: 0.9 }}
      >
        <Plus size={28} strokeWidth={3} />
      </motion.button>
    </div>
  );
};

// 日期分组工具函数
const groupByDate = (items: (Grudge | Memory)[]): Map<string, (Grudge | Memory)[]> => {
  const groups = new Map<string, (Grudge | Memory)[]>();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(thisWeekStart.getDate() - today.getDay());

  items.forEach(item => {
    const itemDate = new Date(item.date);
    const itemDay = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());
    
    let groupKey: string;
    if (itemDay.getTime() === today.getTime()) {
      groupKey = '今天';
    } else if (itemDay.getTime() === yesterday.getTime()) {
      groupKey = '昨天';
    } else if (itemDay >= thisWeekStart) {
      groupKey = '本周';
    } else {
      groupKey = '更早';
    }
    
    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(item);
  });

  return groups;
};

const Dashboard = ({ grudges, onForgive, onDelete, onView, role, profile }: { grudges: Grudge[], onForgive: (id: string) => void, onDelete: (id: string) => void, onView: (grudge: Grudge) => void, role: Role, profile: UserProfile }) => {
  const [authorFilter, setAuthorFilter] = useState<'all' | 'mine' | 'partner'>('all');
  
  // 根据作者筛选 - 使用 useMemo 优化
  const filteredGrudges = useMemo(() => grudges.filter(g => {
    if (authorFilter === 'all') return true;
    const author = getAuthorLabel(g, profile);
    if (authorFilter === 'mine') return author.isMine;
    if (authorFilter === 'partner') return !author.isMine;
    return true;
  }), [grudges, authorFilter, profile]);
  
  const activeGrudges = useMemo(() => 
    filteredGrudges.filter(g => g.status === 'active'),
    [filteredGrudges]
  );
  
  const historyGrudges = useMemo(() => 
    filteredGrudges.filter(g => g.status === 'forgiven'),
    [filteredGrudges]
  );
  
  // 按日期分组 - 使用 useMemo 优化
  const groupedActiveGrudges = useMemo(() => 
    groupByDate(activeGrudges),
    [activeGrudges]
  );
  const groupOrder = ['今天', '昨天', '本周', '更早'];

  return (
    <motion.div 
      className="space-y-6"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* 作者筛选 */}
      {profile.paired && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setAuthorFilter('all')}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              authorFilter === 'all' 
                ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-md' 
                : 'bg-white text-slate-600 border border-slate-200 hover:border-purple-300'
            }`}
          >
            📊 全部
          </button>
          <button
            onClick={() => setAuthorFilter('mine')}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              authorFilter === 'mine' 
                ? 'bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-md' 
                : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300'
            }`}
          >
            ✍️ 我的记录
          </button>
          <button
            onClick={() => setAuthorFilter('partner')}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              authorFilter === 'partner' 
                ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md' 
                : 'bg-white text-slate-600 border border-slate-200 hover:border-rose-300'
            }`}
          >
            💌 {profile.partner?.callsMe || 'TA'}的记录
          </button>
        </div>
      )}

      {/* Active Section */}
      <section>
        <motion.h2 
          className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <AlertCircle size={14} />
          正在气头上 ({activeGrudges.length})
        </motion.h2>
        
        {activeGrudges.length === 0 ? (
          <motion.div 
            className="bg-white/60 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center"
            variants={emptyStateVariants}
            initial="hidden"
            animate="visible"
          >
            <div className="text-4xl mb-2">🕊️</div>
            <p className="text-slate-500 font-medium">天下太平</p>
            <p className="text-xs text-slate-400 mt-1">暂无待处理的恩怨</p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {groupOrder.map((groupKey, groupIndex) => {
              const groupGrudges = groupedActiveGrudges.get(groupKey);
              if (!groupGrudges || groupGrudges.length === 0) return null;
              
              return (
                <motion.div
                  key={groupKey}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: groupIndex * 0.1 }}
                >
                  {/* Sticky 日期标题 */}
                  <div className={`sticky top-0 z-10 backdrop-blur-md py-2 mb-2 flex items-center gap-2 ${
                    groupKey === '今天' ? 'text-red-600' : 
                    groupKey === '昨天' ? 'text-orange-600' : 
                    'text-slate-500'
                  }`}>
                    <div className="text-xs font-bold">{groupKey}</div>
                    <div className="flex-1 h-px bg-gradient-to-r from-current to-transparent opacity-20" />
                    <div className="text-xs bg-white/80 px-2 py-0.5 rounded-full border border-current/20">
                      {groupGrudges.length} 条
                    </div>
                  </div>
                  
                  {/* 分组内的卡片列表 */}
                  <motion.div
                    className="space-y-3"
                    variants={listContainerVariants}
                    initial="hidden"
                    animate="show"
                  >
                    <AnimatePresence mode="popLayout">
                      {(groupGrudges as Grudge[]).map(g => (
                        <GrudgeCard key={g.id} grudge={g} onForgive={onForgive} onDelete={onDelete} onView={onView} role={role} profile={profile} />
                      ))}
                    </AnimatePresence>
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* History Section */}
      {historyGrudges.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2">
            <CheckCircle size={14} />
            已成为历史 ({historyGrudges.length})
          </h2>
          <motion.div 
            className="space-y-3 opacity-70 grayscale hover:grayscale-0 transition-all duration-500"
            variants={listContainerVariants}
            initial="hidden"
            animate="show"
          >
            <AnimatePresence mode="popLayout">
              {historyGrudges.map(g => (
                <GrudgeCard key={g.id} grudge={g} onForgive={onForgive} onDelete={onDelete} onView={onView} role={role} profile={profile} />
              ))}
            </AnimatePresence>
          </motion.div>
        </motion.section>
      )}
    </motion.div>
  );
};

const GrudgeCard = React.memo(({ grudge, onForgive, onDelete, onView, role, profile }: { grudge: Grudge, onForgive: (id: string) => void, onDelete: (id: string) => void, onView: (grudge: Grudge) => void, role: Role, profile: UserProfile }) => {
  const isForgiven = grudge.status === 'forgiven';
  const accentColor = role === 'gf' ? 'text-love-500' : 'text-cool-500';
  const bgHighlight = role === 'gf' ? 'bg-love-50' : 'bg-cool-50';
  const [isForgiving, setIsForgiving] = useState(false);
  const [swipeAction, setSwipeAction] = useState<'forgive' | 'delete' | null>(null);

  // 向后兼容：如果旧数据没有 moodType，默认为 '愤怒'
  const currentMoodType = grudge.moodType || '愤怒';
  
  // 根据情绪类型获取 emoji
  const getMoodEmoji = (moodType: MoodType) => {
    const moodOption = MOOD_OPTIONS.find(m => m.type === moodType);
    return moodOption ? moodOption.emoji : '😤'; // 默认愤怒
  };

  const handleForgive = () => {
    setIsForgiving(true);
    setTimeout(() => {
      onForgive(grudge.id);
    }, 600);
  };

  const handleDragEnd = (event: any, info: any) => {
    const threshold = 100;
    if (!isForgiven && info.offset.x > threshold) {
      // 右滑原谅
      setSwipeAction('forgive');
      setTimeout(() => handleForgive(), 200);
    } else if (info.offset.x < -threshold) {
      // 左滑删除
      setSwipeAction('delete');
      setTimeout(() => onDelete(grudge.id), 200);
    }
  };

  const handleCardClick = () => {
    if (isForgiven) {
      onView(grudge);
    } else {
      const messages = [
        '确定要看吗？很多时候只会越想越气哦 😤',
        '再看一遍可能会更生气，确定继续吗？🌋',
        '回忆往事容易心态爆炸，真的要看吗？💢',
        '提醒：查看未原谅的记录可能影响心情 😔',
      ];
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      if (window.confirm(randomMessage)) {
        onView(grudge);
      }
    }
  };

  return (
    <motion.div 
      className={`bg-white rounded-2xl p-5 shadow-sm border border-slate-100 relative overflow-hidden cursor-pointer`}
      variants={listItemVariants}
      layout
      initial="hidden"
      animate={isForgiving ? "forgive" : "show"}
      exit="exit"
      drag={!isForgiven ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      onClick={handleCardClick}
      whileTap={{ scale: 0.98 }}
      style={{
        backgroundColor: swipeAction === 'forgive' ? 'rgba(34, 197, 94, 0.1)' : 
                        swipeAction === 'delete' ? 'rgba(239, 68, 68, 0.1)' : undefined
      }}
    >
        {/* Severity Bar */}
        {!isForgiven && (
          <div className="absolute top-0 left-0 h-1 w-full bg-slate-100">
            <div 
              className={`h-full ${role === 'gf' ? 'bg-gradient-to-r from-pink-400 to-red-500' : 'bg-gradient-to-r from-sky-400 to-blue-500'}`} 
              style={{ width: `${grudge.severity}%` }} 
            />
          </div>
        )}

      <div className="flex justify-between items-start mb-2 pr-6"> {/* Added pr-6 to prevent overlap with delete button if screen is narrow */}
        <div className="flex gap-2 items-center">
           <span className="text-2xl">{getMoodEmoji(currentMoodType)}</span>
           <div>
             <h3 className={`font-bold text-slate-800 ${isForgiven ? 'line-through text-slate-400' : ''}`}>{grudge.title}</h3>
             <div className="flex flex-wrap items-center gap-2 mt-1">
               <span className="text-[10px] text-slate-400 flex items-center gap-1">
                 <Calendar size={10} /> {new Date(grudge.date).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
               </span>
               {/* 作者标识 */}
               {(() => {
                 const author = getAuthorLabel(grudge, profile);
                 return (
                   <span className={`text-[10px] flex items-center gap-1 px-2 py-0.5 rounded-full ${
                     author.isMine ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'
                   }`}>
                     {author.emoji} {author.text}
                   </span>
                 );
               })()}
               {/* 同步状态 */}
               {profile.paired && (
                 <span className={`text-[10px] flex items-center gap-1 px-2 py-0.5 rounded-full ${
                   getSyncStatus(grudge, profile) === '不会被同步' ? 'bg-gray-100 text-gray-600' :
                   getSyncStatus(grudge, profile) === '会被同步' ? 'bg-green-100 text-green-700' :
                   'bg-blue-100 text-blue-700'
                 }`}>
                   {getSyncStatus(grudge, profile) === '不会被同步' && '🔒'}
                   {getSyncStatus(grudge, profile) === '会被同步' && '📤'}
                   {getSyncStatus(grudge, profile) === '已同步' && '✓'}
                   {' '}{getSyncStatus(grudge, profile)}
                 </span>
               )}
             </div>
           </div>
        </div>
        {!isForgiven ? (
          (() => {
            const author = getAuthorLabel(grudge, profile);
            // 如果是对方的记录，不显示原谅按钮，显示信息按钮
            if (!author.isMine) {
              return (
                <div className="text-xs px-3 py-1.5 rounded-full font-medium border border-rose-200 bg-rose-50 text-rose-600">
                  💔 TA记得
                </div>
              );
            }
            // 自己的记录，显示原谅按钮
            return (
              <motion.button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleForgive();
                }}
                className={`text-xs px-3 py-1.5 rounded-full font-medium border ${bgHighlight} ${accentColor}`}
                whileTap={buttonTapAnimation}
                whileHover={{ scale: 1.05 }}
              >
                原谅TA
              </motion.button>
            );
          })()
        ) : (
          <div className="text-xs px-3 py-1.5 rounded-full font-medium border border-green-200 bg-green-50 text-green-600">
            ✅ 已原谅
          </div>
        )}
      </div>

      {grudge.description && (
        <p className="text-sm text-slate-600 mb-3 leading-relaxed bg-slate-50 p-2 rounded-lg">
          {grudge.description}
        </p>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        {grudge.tags.map(tag => (
          <span key={tag} className="text-[10px] px-2 py-1 bg-slate-100 text-slate-500 rounded-md">#{tag}</span>
        ))}
      </div>

      {grudge.penalty && !isForgiven && (
        <div className={`text-xs p-2 rounded-lg ${bgHighlight} flex items-start gap-2 mb-2`}>
          <span className="font-bold shrink-0">⚖️ 惩罚:</span>
          <span className="opacity-80">{grudge.penalty}</span>
        </div>
      )}

      {/* Delete Button - Increased Z-Index and Click Area */}
      <div className="absolute bottom-2 right-2 z-20">
        <motion.button 
          onClick={(e) => {
            e.stopPropagation();
            console.log("Trash icon clicked for id:", grudge.id);
            onDelete(grudge.id);
          }} 
          className="p-2 text-slate-300 hover:text-red-500 active:text-red-500 transition-colors rounded-full hover:bg-red-50 cursor-pointer"
          title="删除记录"
          whileTap={{ scale: 0.9 }}
        >
          <Trash2 size={16} />
        </motion.button>
      </div>
    </motion.div>
  );
}, (prevProps, nextProps) => {
  // 只在关键props变化时重渲染
  return prevProps.grudge.id === nextProps.grudge.id &&
         prevProps.grudge.status === nextProps.grudge.status &&
         prevProps.grudge.title === nextProps.grudge.title &&
         prevProps.grudge.severity === nextProps.grudge.severity &&
         prevProps.role === nextProps.role;
});

// PhotoThumbnail Component
const PhotoThumbnail = React.memo(({ photoId, onRemove }: { photoId: string; onRemove: (id: string) => void }) => {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');

  useEffect(() => {
    PhotoService.getPhoto(photoId).then(p => {
      if (p) {
        setPhoto(p);
        setImageUrl(p.thumbnail);
      }
    });
  }, [photoId]);

  if (!photo) {
    return (
      <div className="aspect-square bg-slate-100 rounded-lg animate-pulse" />
    );
  }

  return (
    <div className="relative aspect-square group">
      <img 
        src={imageUrl} 
        alt="Photo" 
        className="w-full h-full object-cover rounded-lg"
      />
      <motion.button
        onClick={() => onRemove(photoId)}
        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
        whileTap={{ scale: 0.9 }}
      >
        <X size={14} />
      </motion.button>
    </div>
  );
});

// PhotoGallery Component - 显示照片网格
const PhotoGallery = ({ photoIds, onPhotoClick }: { photoIds: string[]; onPhotoClick: (index: number) => void }) => {
  const [photos, setPhotos] = useState<(Photo | null)[]>([]);

  useEffect(() => {
    const loadPhotos = async () => {
      const loadedPhotos = await Promise.all(
        photoIds.map(id => PhotoService.getPhoto(id))
      );
      setPhotos(loadedPhotos);
    };
    loadPhotos();
  }, [photoIds]);

  if (photoIds.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-bold text-slate-600 mb-2">📷 照片</h3>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo, index) => (
          <motion.div
            key={photoIds[index]}
            className="relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-slate-100"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onPhotoClick(index)}
          >
            {photo ? (
              <img
                src={photo.thumbnail}
                alt={`Photo ${index + 1}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full animate-pulse bg-slate-200" />
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// PhotoViewer Component - 全屏查看大图
const PhotoViewer = ({ 
  photoIds, 
  initialIndex, 
  onClose 
}: { 
  photoIds: string[]; 
  initialIndex: number; 
  onClose: () => void 
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [currentPhoto, setCurrentPhoto] = useState<Photo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPhoto = async () => {
      setLoading(true);
      const photo = await PhotoService.getPhoto(photoIds[currentIndex]);
      setCurrentPhoto(photo);
      setLoading(false);
    };
    loadPhoto();
  }, [currentIndex, photoIds]);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photoIds.length - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev < photoIds.length - 1 ? prev + 1 : 0));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') goToPrevious();
    if (e.key === 'ArrowRight') goToNext();
    if (e.key === 'Escape') onClose();
  };

  return (
    <motion.div
      className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
      >
        <X size={24} />
      </button>

      {/* Image Counter */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 px-4 py-2 bg-black/50 rounded-full text-white text-sm">
        {currentIndex + 1} / {photoIds.length}
      </div>

      {/* Previous Button */}
      {photoIds.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goToPrevious();
          }}
          className="absolute left-4 z-10 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
        >
          <ChevronLeft size={32} />
        </button>
      )}

      {/* Next Button */}
      {photoIds.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
          className="absolute right-4 z-10 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
        >
          <ChevronLeft size={32} className="rotate-180" />
        </button>
      )}

      {/* Image */}
      <div className="max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            <span className="text-white text-sm">加载中...</span>
          </div>
        ) : currentPhoto ? (
          <motion.img
            key={currentIndex}
            src={currentPhoto.data}
            alt={`Photo ${currentIndex + 1}`}
            className="max-w-full max-h-full object-contain rounded-lg"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
          />
        ) : (
          <div className="text-white text-center">
            <p>照片加载失败</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const AddGrudgeForm = ({ onSave, onCancel, role }: { onSave: (g: Grudge) => void, onCancel: () => void, role: Role }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState(50);
  const [moodType, setMoodType] = useState<MoodType>('愤怒'); // 默认选中愤怒
  const [tags, setTags] = useState<string[]>([]);
  const [penalty, setPenalty] = useState('');
  const [photoIds, setPhotoIds] = useState<string[]>([]); // 存储照片ID
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [date, setDate] = useState(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 16);
  });

  const accentColor = role === 'gf' ? 'bg-love-500' : 'bg-cool-500';
  const ringColor = role === 'gf' ? 'focus:ring-love-500' : 'focus:ring-cool-500';

  const toggleTag = (tag: string) => {
    if (tags.includes(tag)) {
      setTags(tags.filter(t => t !== tag));
    } else {
      setTags([...tags, tag]);
    }
  };

  const handleAddPhoto = async () => {
    try {
      setIsUploadingPhoto(true);
      const photo = await PhotoService.pickPhoto();
      if (photo) {
        setPhotoIds(prev => [...prev, photo.id]);
      }
    } catch (error) {
      console.error('添加照片失败:', error);
      alert('添加照片失败，请重试');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async (photoId: string) => {
    setPhotoIds(prev => prev.filter(id => id !== photoId));
    await PhotoService.deletePhoto(photoId);
  };

  const handleSubmit = () => {
    if (!title) return;
    
    // Use a safer ID generation method compatible with all browsers
    const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

    const newGrudge: Grudge = {
      id: generateId(),
      title,
      description,
      severity,
      moodType, // 添加情绪类型
      date: new Date(date).toISOString(),
      tags,
      penalty,
      status: 'active',
      photos: photoIds.length > 0 ? photoIds : undefined
    };
    onSave(newGrudge);
  };

  return (
    <motion.div 
      className="bg-white rounded-3xl p-6 shadow-lg space-y-6"
      variants={modalVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* Header with Back Button */}
      <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
        <motion.button 
            onClick={onCancel} 
            className="p-2 -ml-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition-colors"
            whileTap={{ scale: 0.9 }}
        >
            <ChevronLeft size={24} />
        </motion.button>
        <h2 className="text-lg font-bold text-slate-800">记一笔账</h2>
      </div>

      {/* Title - Style fixed: transparent bg, dark text */}
      <div>
        <label className="block text-xs font-bold text-slate-400 mb-1">罪名</label>
        <input 
          autoFocus
          type="text" 
          value={title} 
          onChange={e => setTitle(e.target.value)}
          placeholder="例如：居然说我胖"
          className={`w-full bg-transparent text-lg font-bold border-b-2 border-slate-100 py-2 outline-none focus:border-current transition-colors text-slate-900 placeholder:text-slate-400 ${role === 'gf' ? 'focus:text-love-600 focus:border-love-500' : 'focus:text-cool-600 focus:border-cool-500'}`}
        />
      </div>

      {/* Date Selection */}
      <div>
         <label className="block text-xs font-bold text-slate-400 mb-1">发生时间</label>
         <div className="relative">
            <input
              type="datetime-local"
              value={date}
              onChange={e => setDate(e.target.value)}
              className={`w-full bg-slate-50 rounded-xl pl-10 pr-3 py-3 text-sm text-slate-800 focus:ring-2 outline-none transition-all ${ringColor}`}
            />
            <div className="absolute left-3 top-3 text-slate-400">
              <Clock size={18} />
            </div>
         </div>
      </div>

      {/* Mood Type Selection */}
      <div>
        <label className="block text-xs font-bold text-slate-400 mb-2">当时心情</label>
        <div className="grid grid-cols-3 gap-2">
          {MOOD_OPTIONS.map(mood => (
            <motion.button
              key={mood.type}
              type="button"
              onClick={() => setMoodType(mood.type)}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                moodType === mood.type
                  ? `${mood.color} text-white border-transparent shadow-md`
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
              whileTap={{ scale: 0.95 }}
              animate={moodType === mood.type ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 0.2 }}
            >
              <span className="text-2xl mb-1">{mood.emoji}</span>
              <span className="text-xs font-medium">{mood.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Severity Slider */}
      <div>
         <div className="flex justify-between items-end mb-2">
            <label className="block text-xs font-bold text-slate-400">心情强度</label>
            <span className={`text-xl font-black ${role === 'gf' ? 'text-love-500' : 'text-cool-500'}`}>{severity}%</span>
         </div>
         <div className="relative">
           <input 
              type="range" 
              min="1" 
              max="100" 
              value={severity} 
              onChange={e => setSeverity(parseInt(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer slider-thumb"
              style={{
                background: `linear-gradient(to right, ${role === 'gf' ? '#ec4899' : '#3b82f6'} 0%, ${role === 'gf' ? '#ef4444' : '#06b6d4'} ${severity}%, #e2e8f0 ${severity}%, #e2e8f0 100%)`
              }}
           />
         </div>
         <div className="flex justify-between text-[10px] text-slate-400 mt-1">
           <span>轻微</span>
           <span>中等</span>
           <span>很强烈</span>
         </div>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-xs font-bold text-slate-400 mb-2">违规类型</label>
        <div className="flex flex-wrap gap-2">
          {PRESET_TAGS.map(tag => (
            <motion.button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                tags.includes(tag) 
                  ? `${accentColor} text-white border-transparent shadow-sm` 
                  : 'bg-slate-50 text-slate-500 border-slate-200'
              }`}
              whileTap={{ scale: 0.95 }}
              animate={tags.includes(tag) ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              {tag}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-bold text-slate-400 mb-1">详细经过 (选填)</label>
        <textarea 
          rows={3}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="记录一下案发经过..."
          className={`w-full bg-slate-50 rounded-xl p-3 text-sm text-slate-800 focus:ring-2 outline-none transition-all ${ringColor}`}
        />
      </div>

      {/* Penalty */}
      <div>
        <label className="block text-xs font-bold text-slate-400 mb-1">期望惩罚 (选填)</label>
        <div className="relative">
          <input 
            type="text" 
            value={penalty}
            onChange={e => setPenalty(e.target.value)}
            placeholder="例如：一杯奶茶"
            className={`w-full bg-slate-50 rounded-xl pl-10 pr-3 py-3 text-sm text-slate-800 focus:ring-2 outline-none transition-all ${ringColor}`}
          />
          <div className="absolute left-3 top-3 text-slate-400">⚖️</div>
        </div>
      </div>

      {/* Photo Upload */}
      <div>
        <label className="block text-xs font-bold text-slate-400 mb-2">照片证据 (选填)</label>
        <div className="space-y-2">
          {photoIds.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photoIds.map((photoId) => (
                <PhotoThumbnail key={photoId} photoId={photoId} onRemove={handleRemovePhoto} />
              ))}
            </div>
          )}
          <motion.button
            type="button"
            onClick={handleAddPhoto}
            disabled={isUploadingPhoto}
            className={`w-full py-3 rounded-xl border-2 border-dashed transition-all ${
              isUploadingPhoto 
                ? 'border-slate-200 bg-slate-50 cursor-wait' 
                : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
            }`}
            whileTap={!isUploadingPhoto ? { scale: 0.98 } : {}}
          >
            <div className="flex items-center justify-center gap-2 text-slate-500">
              {isUploadingPhoto ? (
                <>
                  <div className="animate-spin">⏳</div>
                  <span className="text-sm">上传中...</span>
                </>
              ) : (
                <>
                  <Camera size={20} />
                  <span className="text-sm font-medium">添加照片</span>
                </>
              )}
            </div>
          </motion.button>
        </div>
      </div>

      <motion.button 
        disabled={!title}
        onClick={handleSubmit}
        className={`w-full py-3.5 rounded-xl text-white font-bold shadow-lg ${accentColor} ${!title ? 'opacity-50 cursor-not-allowed' : ''}`}
        whileTap={!title ? {} : buttonTapAnimation}
        whileHover={!title ? {} : { scale: 1.02 }}
      >
        记入档案
      </motion.button>
    </motion.div>
  );
};

// --- AddMemoryForm Component ---

const AddMemoryForm = ({ onSave, onCancel, role }: { onSave: (m: Memory) => void; onCancel: () => void; role: Role }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sweetness, setSweetness] = useState(50);
  const [tags, setTags] = useState<string[]>([]);
  const [feeling, setFeeling] = useState('');
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const accentColor = role === 'gf' ? 'bg-love-500 hover:bg-love-600' : 'bg-cool-500 hover:bg-cool-600';
  const ringColor = role === 'gf' ? 'focus:ring-love-500' : 'focus:ring-cool-500';
  const textColor = role === 'gf' ? 'text-love-500' : 'text-cool-500';

  const toggleTag = (tag: string) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleAddPhoto = async () => {
    try {
      setIsUploadingPhoto(true);
      const photo = await PhotoService.pickPhoto();
      if (photo) {
        setPhotoIds(prev => [...prev, photo.id]);
      }
    } catch (error) {
      console.error('添加照片失败:', error);
      alert('添加照片失败，请重试');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async (photoId: string) => {
    setPhotoIds(prev => prev.filter(id => id !== photoId));
    await PhotoService.deletePhoto(photoId);
  };

  const handleSubmit = () => {
    const newMemory: Memory = {
      id: Date.now().toString(),
      title,
      description,
      sweetness,
      date: new Date().toISOString(),
      tags,
      feeling,
      photos: photoIds.length > 0 ? photoIds : undefined
    };
    onSave(newMemory);
  };

  return (
    <motion.div 
      className="space-y-6"
      variants={modalVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <motion.button 
          onClick={onCancel} 
          className="p-2 -ml-2 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-100"
          whileTap={{ scale: 0.9 }}
        >
          <ChevronLeft size={24} />
        </motion.button>
        <div>
          <h2 className={`text-2xl font-bold ${textColor} flex items-center gap-2`}>
            💕 记录甜蜜时刻
          </h2>
          <p className="text-xs text-slate-400 mt-1">留住那些温暖的瞬间</p>
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="block text-xs font-bold text-slate-400 mb-1">标题 *</label>
        <input 
          type="text" 
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="例如：给我买了最爱的奶茶"
          className={`w-full bg-slate-50 rounded-xl px-4 py-3 text-sm text-slate-800 focus:ring-2 outline-none transition-all ${ringColor}`}
          autoFocus
        />
      </div>

      {/* Sweetness Slider */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs font-bold text-slate-400">甜蜜度</label>
          <div className="flex items-center gap-2">
            <Heart size={16} className="text-pink-400" fill="currentColor" />
            <span className={`text-lg font-bold ${textColor}`}>{sweetness}</span>
          </div>
        </div>
        <input 
          type="range" 
          min="1" 
          max="100" 
          value={sweetness}
          onChange={e => setSweetness(parseInt(e.target.value))}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #fbbf24 0%, #fb923c ${sweetness}%, #e2e8f0 ${sweetness}%, #e2e8f0 100%)`
          }}
        />
        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>😊 温馨</span>
          <span>🥰 甜蜜</span>
          <span>😍 超感动</span>
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-xs font-bold text-slate-400 mb-2">类型标签</label>
        <div className="flex flex-wrap gap-2">
          {PRESET_MEMORY_TAGS.map(tag => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                tags.includes(tag) 
                  ? `${accentColor} text-white border-transparent shadow-sm` 
                  : 'bg-slate-50 text-slate-500 border-slate-200'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-bold text-slate-400 mb-1">详细描述 (选填)</label>
        <textarea 
          rows={3}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="记录下当时的美好细节..."
          className={`w-full bg-slate-50 rounded-xl p-3 text-sm text-slate-800 focus:ring-2 outline-none transition-all ${ringColor}`}
        />
      </div>

      {/* Feeling */}
      <div>
        <label className="block text-xs font-bold text-slate-400 mb-1">当时的心情 (选填)</label>
        <div className="relative">
          <input 
            type="text" 
            value={feeling}
            onChange={e => setFeeling(e.target.value)}
            placeholder="例如：感动到想哭"
            className={`w-full bg-slate-50 rounded-xl pl-10 pr-3 py-3 text-sm text-slate-800 focus:ring-2 outline-none transition-all ${ringColor}`}
          />
          <div className="absolute left-3 top-3 text-slate-400">✨</div>
        </div>
      </div>

      <motion.button 
        disabled={!title}
        onClick={handleSubmit}
        className={`w-full py-3.5 rounded-xl text-white font-bold shadow-lg ${accentColor} ${!title ? 'opacity-50 cursor-not-allowed' : ''}`}
        whileTap={!title ? {} : buttonTapAnimation}
        whileHover={!title ? {} : { scale: 1.02 }}
      >
        保存回忆
      </motion.button>
    </motion.div>
  );
};

// --- MemoryCard Component ---

const MemoryCard = React.memo(({ memory, onDelete, onView, role, profile }: { memory: Memory; onDelete: (id: string) => void; onView: (memory: Memory) => void; role: Role; profile: UserProfile }) => {
  const textColor = role === 'gf' ? 'text-love-500' : 'text-cool-500';
  const bgColor = role === 'gf' ? 'bg-love-50' : 'bg-cool-50';
  const [swipeAction, setSwipeAction] = useState<'delete' | null>(null);
  
  const handleDragEnd = (event: any, info: any) => {
    const threshold = 100;
    if (info.offset.x < -threshold) {
      // 左滑删除
      setSwipeAction('delete');
      setTimeout(() => onDelete(memory.id), 200);
    }
  };
  
  return (
    <motion.div 
      className={`${bgColor} rounded-2xl p-4 shadow-sm border border-transparent hover:border-amber-200 transition-all relative cursor-pointer`}
      variants={listItemVariants}
      initial="hidden"
      animate="show"
      exit="exit"
      layout
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      onClick={() => onView(memory)}
      whileTap={{ scale: 0.98 }}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="font-bold text-slate-800 text-base mb-1">{memory.title}</h3>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Calendar size={12} />
            <span>{new Date(memory.date).toLocaleDateString('zh-CN')}</span>
            <Clock size={12} className="ml-1" />
            <span>{new Date(memory.date).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {/* 作者标识 */}
            {(() => {
              const author = getAuthorLabel(memory, profile);
              return (
                <span className={`text-[10px] flex items-center gap-1 px-2 py-0.5 rounded-full ${
                  author.isMine ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'
                }`}>
                  {author.emoji} {author.text}
                </span>
              );
            })()}
            {/* 同步状态 */}
            {profile.paired && (
              <span className={`text-[10px] flex items-center gap-1 px-2 py-0.5 rounded-full ${
                getSyncStatus(memory, profile) === '不会被同步' ? 'bg-gray-100 text-gray-600' :
                getSyncStatus(memory, profile) === '会被同步' ? 'bg-green-100 text-green-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {getSyncStatus(memory, profile) === '不会被同步' && '🔒'}
                {getSyncStatus(memory, profile) === '会被同步' && '📤'}
                {getSyncStatus(memory, profile) === '已同步' && '✓'}
                {' '}{getSyncStatus(memory, profile)}
              </span>
            )}
          </div>
        </div>
        <motion.button 
          onClick={(e) => {
            e.stopPropagation();
            onDelete(memory.id);
          }}
          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          title="删除"
          whileTap={{ scale: 0.9 }}
        >
          <Trash2 size={16} />
        </motion.button>
      </div>

      {/* Sweetness Bar */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-slate-500">甜蜜度</span>
          <div className="flex items-center gap-1">
            <Heart size={12} className="text-amber-400" fill="currentColor" />
            <span className="text-xs font-bold text-amber-600">{memory.sweetness}</span>
          </div>
        </div>
        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-amber-300 to-orange-400 rounded-full transition-all"
            style={{ width: `${memory.sweetness}%` }}
          />
        </div>
      </div>

      {/* Description */}
      {memory.description && (
        <p className="text-sm text-slate-600 mb-3 leading-relaxed">{memory.description}</p>
      )}

      {/* Feeling */}
      {memory.feeling && (
        <div className="bg-white/60 rounded-lg px-3 py-2 mb-3">
          <span className="text-xs text-slate-500">💭 心情：</span>
          <span className="text-xs text-slate-700 ml-1">{memory.feeling}</span>
        </div>
      )}

      {/* Tags */}
      {memory.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {memory.tags.map(tag => (
            <span key={tag} className="text-xs px-2 py-1 bg-white/80 text-amber-600 rounded-full border border-amber-100">
              {tag}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}, (prevProps, nextProps) => {
  // 只在关键props变化时重渲染
  return prevProps.memory.id === nextProps.memory.id &&
         prevProps.memory.title === nextProps.memory.title &&
         prevProps.memory.sweetness === nextProps.memory.sweetness &&
         prevProps.role === nextProps.role;
});

// --- 底部导航栏组件 ---

const BottomTabBar = React.memo(({  
  currentPage, 
  onPageChange, 
  role 
}: { 
  currentPage: 'home' | 'memories' | 'statistics' | 'settings'; 
  onPageChange: (page: 'home' | 'memories' | 'statistics' | 'settings') => void;
  role: Role;
}) => {
  const accentColor = role === 'gf' ? 'text-love-500' : 'text-cool-500';
  const bgAccent = role === 'gf' ? 'bg-love-500' : 'bg-cool-500';
  
  const tabs = [
    { id: 'home' as const, icon: Home, label: '首页' },
    { id: 'memories' as const, icon: Sparkles, label: '回忆' },
    { id: 'statistics' as const, icon: BarChart3, label: '统计' },
    { id: 'settings' as const, icon: Settings, label: '设置' },
  ];

  return (
    <div className="bg-white/80 backdrop-blur-md border-t border-slate-200 shadow-lg">
      <div className="max-w-md mx-auto flex justify-around items-center h-16">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = currentPage === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onPageChange(tab.id)}
              className={`flex flex-col items-center justify-center gap-1 px-4 py-2 transition-all ${
                isActive ? accentColor : 'text-slate-400'
              }`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className={`text-xs font-medium ${isActive ? 'font-bold' : ''}`}>
                {tab.label}
              </span>
              {isActive && (
                <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 ${bgAccent} rounded-t-full`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});

// --- 占位页面组件 ---

const MemoriesPage = ({ 
  memories, 
  onDelete, 
  onAdd,
  onView,
  role,
  profile 
}: { 
  memories: Memory[]; 
  onDelete: (id: string) => void; 
  onAdd: () => void;
  onView: (memory: Memory) => void;
  role: Role;
  profile: UserProfile;
}) => {
  const [authorFilter, setAuthorFilter] = useState<'all' | 'mine' | 'partner'>('all');
  
  const themeColor = useMemo(() => 
    role === 'gf' ? 'text-love-500' : 'text-cool-500',
    [role]
  );
  
  const buttonColor = useMemo(() => 
    role === 'gf' ? 'bg-love-500 hover:bg-love-600' : 'bg-cool-500 hover:bg-cool-600',
    [role]
  );
  
  // 根据作者筛选 - 使用 useMemo 优化
  const filteredMemories = useMemo(() => memories.filter(m => {
    if (authorFilter === 'all') return true;
    const author = getAuthorLabel(m, profile);
    if (authorFilter === 'mine') return author.isMine;
    if (authorFilter === 'partner') return !author.isMine;
    return true;
  }), [memories, authorFilter, profile]);
  
  const totalSweetness = useMemo(() => 
    filteredMemories.reduce((sum, m) => sum + m.sweetness, 0),
    [filteredMemories]
  );
  
  if (memories.length === 0) {
    return (
      <motion.div 
        className="flex flex-col items-center justify-center h-full py-20 px-6 text-center"
        variants={emptyStateVariants}
        initial="hidden"
        animate="visible"
      >
        <Sparkles size={64} className={`${themeColor} mb-4 opacity-30`} />
        <h2 className="text-2xl font-bold text-slate-800 mb-2">{profile.spaceConfig?.memorySpaceName || DEFAULT_MEMORY_SPACE_NAME}</h2>
        <p className="text-slate-500 text-sm mb-6">
          还没有记录美好瞬间呢 💕
        </p>
        <motion.button 
          onClick={onAdd}
          className={`${buttonColor} text-white px-6 py-3 rounded-xl font-medium shadow-lg flex items-center gap-2`}
          whileTap={buttonTapAnimation}
          whileHover={{ scale: 1.05 }}
        >
          <Plus size={20} />
          记录第一个回忆
        </motion.button>
      </motion.div>
    );
  }
  
  return (
    <motion.div 
      className="space-y-4"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* 作者筛选 */}
      {profile.paired && (
        <div className="flex gap-2">
          <button
            onClick={() => setAuthorFilter('all')}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              authorFilter === 'all' 
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md' 
                : 'bg-white text-slate-600 border border-slate-200 hover:border-amber-300'
            }`}
          >
            📊 全部
          </button>
          <button
            onClick={() => setAuthorFilter('mine')}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              authorFilter === 'mine' 
                ? 'bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-md' 
                : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300'
            }`}
          >
            ✍️ 我的记录
          </button>
          <button
            onClick={() => setAuthorFilter('partner')}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              authorFilter === 'partner' 
                ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md' 
                : 'bg-white text-slate-600 border border-slate-200 hover:border-rose-300'
            }`}
          >
            💌 {profile.partner?.callsMe || 'TA'}的记录
          </button>
        </div>
      )}

      {/* Header Card */}
      <div className="bg-gradient-to-br from-amber-100 to-orange-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h2 className={`text-xl font-bold ${themeColor} flex items-center gap-2`}>
            <Sparkles size={24} />
            {profile.spaceConfig?.memorySpaceName || DEFAULT_MEMORY_SPACE_NAME}
          </h2>
          <button 
            onClick={onAdd}
            className={`${buttonColor} text-white p-2 rounded-full shadow-lg active:scale-90 transition-all`}
          >
            <Plus size={20} />
          </button>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div>
            <span className="text-slate-600">总回忆数：</span>
            <span className="font-bold text-slate-800">{filteredMemories.length}</span>
          </div>
          <div>
            <span className="text-slate-600">甜蜜总值：</span>
            <span className="font-bold text-amber-600">{totalSweetness}</span>
          </div>
        </div>
      </div>

      {/* Memory List */}
      <motion.div 
        className="space-y-3"
        variants={listContainerVariants}
        initial="hidden"
        animate="show"
      >
        <AnimatePresence mode="popLayout">
          {filteredMemories.map(memory => (
            <MemoryCard key={memory.id} memory={memory} onDelete={onDelete} onView={onView} role={role} profile={profile} />
          ))}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

// --- Statistics Calculation Functions ---

const calculateStatistics = (grudges: Grudge[], memories: Memory[]): Statistics => {
  const totalGrudges = grudges.length;
  const totalMemories = memories.length;
  const forgivenCount = grudges.filter(g => g.status === 'forgiven').length;
  const activeGrudgeCount = grudges.filter(g => g.status === 'active').length;
  
  const avgAngerLevel = totalGrudges > 0 
    ? Math.round(grudges.reduce((sum, g) => sum + g.severity, 0) / totalGrudges)
    : 0;
  
  const avgSweetnessLevel = totalMemories > 0
    ? Math.round(memories.reduce((sum, m) => sum + m.sweetness, 0) / totalMemories)
    : 0;
  
  const forgivenessRate = totalGrudges > 0
    ? Math.round((forgivenCount / totalGrudges) * 100)
    : 100;
  
  // 计算和谐度评分 (0-100)
  const activeAnger = grudges.filter(g => g.status === 'active').reduce((sum, g) => sum + g.severity, 0);
  const totalSweetness = memories.reduce((sum, m) => sum + m.sweetness, 0);
  const totalRecords = totalGrudges + totalMemories;
  
  let harmonyScore = 50; // 默认中等
  
  if (totalRecords > 0) {
    // 正向因素：甜蜜总值、原谅率
    const positiveScore = (totalSweetness / 10) + forgivenessRate;
    // 负向因素：活跃愤怒值
    const negativeScore = activeAnger / 2;
    
    harmonyScore = Math.round(Math.max(0, Math.min(100, 50 + (positiveScore - negativeScore) / 5)));
  }
  
  // 统计最常见的标签
  const tagMap = new Map<string, number>();
  [...grudges, ...memories].forEach(record => {
    record.tags.forEach(tag => {
      tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
    });
  });
  
  const mostCommonTags = Array.from(tagMap.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  return {
    totalGrudges,
    totalMemories,
    forgivenCount,
    activeGrudgeCount,
    avgAngerLevel,
    avgSweetnessLevel,
    harmonyScore,
    mostCommonTags,
    forgivenessRate,
  };
};

const getHarmonyLevel = (score: number): { label: string; emoji: string; color: string } => {
  if (score >= 80) return { label: '完美和谐', emoji: '🌟', color: 'text-green-600' };
  if (score >= 60) return { label: '甜蜜相处', emoji: '😊', color: 'text-blue-600' };
  if (score >= 40) return { label: '平稳发展', emoji: '😐', color: 'text-yellow-600' };
  if (score >= 20) return { label: '需要改善', emoji: '😕', color: 'text-orange-600' };
  return { label: '关系危机', emoji: '😰', color: 'text-red-600' };
};

// 生成最近N天的趋势数据
const generateTrendData = (grudges: Grudge[], memories: Memory[], days: number = 7) => {
  const now = new Date();
  const data = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    
    const dayGrudges = grudges.filter(g => {
      const gDate = new Date(g.date);
      return gDate >= date && gDate < nextDate;
    });
    
    const dayMemories = memories.filter(m => {
      const mDate = new Date(m.date);
      return mDate >= date && mDate < nextDate;
    });
    
    const avgAnger = dayGrudges.length > 0
      ? Math.round(dayGrudges.reduce((sum, g) => sum + g.severity, 0) / dayGrudges.length)
      : 0;
    
    const avgSweetness = dayMemories.length > 0
      ? Math.round(dayMemories.reduce((sum, m) => sum + m.sweetness, 0) / dayMemories.length)
      : 0;
    
    // 简化的和谐度计算
    const harmony = Math.round(Math.max(0, Math.min(100, 50 + avgSweetness/2 - avgAnger/2)));
    
    data.push({
      date: `${date.getMonth() + 1}/${date.getDate()}`,
      grudgeCount: dayGrudges.length,
      memoryCount: dayMemories.length,
      avgAnger,
      avgSweetness,
      harmony,
    });
  }
  
  return data;
};

// 生成日历热力图数据（最近30天）
const generateCalendarData = (grudges: Grudge[], memories: Memory[]) => {
  const now = new Date();
  const data = [];
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    
    const dayGrudges = grudges.filter(g => {
      const gDate = new Date(g.date);
      return gDate >= date && gDate < nextDate;
    });
    
    const dayMemories = memories.filter(m => {
      const mDate = new Date(m.date);
      return mDate >= date && mDate < nextDate;
    });
    
    const hasUnforgiven = dayGrudges.some(g => g.status === 'active');
    const allSweet = dayMemories.length > 0 && dayGrudges.length === 0;
    
    data.push({
      date: date.toISOString().split('T')[0],
      dayOfWeek: date.getDay(),
      grudgeCount: dayGrudges.length,
      memoryCount: dayMemories.length,
      total: dayGrudges.length + dayMemories.length,
      hasUnforgiven,
      allSweet,
    });
  }
  
  return data;
};

// --- StatisticsPage Component ---

const StatisticsPage = ({ 
  grudges, 
  memories, 
  achievements,
  role,
  profile 
}: { 
  grudges: Grudge[]; 
  memories: Memory[];
  achievements: Achievement[];
  role: Role;
  profile: UserProfile;
}) => {
  const themeColor = useMemo(() => 
    role === 'gf' ? 'text-love-500' : 'text-cool-500',
    [role]
  );
  
  // 使用 useMemo 优化统计计算
  const stats = useMemo(() => 
    calculateStatistics(grudges, memories),
    [grudges, memories]
  );
  
  const harmonyLevel = useMemo(() => 
    getHarmonyLevel(stats.harmonyScore),
    [stats.harmonyScore]
  );
  
  const totalRecords = useMemo(() => 
    stats.totalGrudges + stats.totalMemories,
    [stats.totalGrudges, stats.totalMemories]
  );
  
  if (totalRecords === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 px-6 text-center">
        <BarChart3 size={64} className={`${themeColor} mb-4 opacity-30`} />
        <h2 className="text-2xl font-bold text-slate-800 mb-2">还没有数据</h2>
        <p className="text-slate-500 text-sm">
          开始记录你们的点点滴滴吧 📊
        </p>
      </div>
    );
  }
  
  return (
    <motion.div 
      className="space-y-4"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Harmony Score Card */}
      <motion.div 
        className="bg-white rounded-3xl p-8 shadow-level-2 text-center relative overflow-hidden"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, ...springConfigs.gentle }}
      >
        {/* 背景渐变装饰 */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-50/50 via-blue-50/30 to-pink-50/50 pointer-events-none" />
        
        <div className="relative z-10">
          <h3 className="text-sm font-semibold text-slate-600 mb-6">关系和谐度</h3>
          
          {/* Enhanced Circular Progress */}
          <div className="relative w-40 h-40 mx-auto mb-6">
            <svg className="transform -rotate-90" width="160" height="160" viewBox="0 0 160 160">
              {/* 外圈装饰 - 浅色 */}
              <circle
                cx="80"
                cy="80"
                r="72"
                stroke="currentColor"
                strokeWidth="1"
                fill="none"
                className="text-slate-100"
                opacity="0.5"
              />
              
              {/* 背景圆环 */}
              <circle
                cx="80"
                cy="80"
                r="65"
                stroke="currentColor"
                strokeWidth="10"
                fill="none"
                className="text-slate-100"
              />
              
              {/* 进度圆环 - 带渐变 */}
              <defs>
                <linearGradient id="harmonyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={
                    stats.harmonyScore >= 80 ? '#10b981' :
                    stats.harmonyScore >= 60 ? '#3b82f6' :
                    stats.harmonyScore >= 40 ? '#f59e0b' :
                    stats.harmonyScore >= 20 ? '#f97316' : '#ef4444'
                  } />
                  <stop offset="100%" stopColor={
                    stats.harmonyScore >= 80 ? '#34d399' :
                    stats.harmonyScore >= 60 ? '#60a5fa' :
                    stats.harmonyScore >= 40 ? '#fbbf24' :
                    stats.harmonyScore >= 20 ? '#fb923c' : '#f87171'
                  } />
                </linearGradient>
              </defs>
              
              <motion.circle
                cx="80"
                cy="80"
                r="65"
                stroke="url(#harmonyGradient)"
                strokeWidth="10"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 65}`}
                strokeLinecap="round"
                initial={{ strokeDashoffset: 2 * Math.PI * 65 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 65 * (1 - stats.harmonyScore / 100) }}
                transition={{ duration: 1.8, ease: [0.4, 0, 0.2, 1], delay: 0.2 }}
              />
              
              {/* 内圈装饰光晕 */}
              <motion.circle
                cx="80"
                cy="80"
                r="58"
                stroke="url(#harmonyGradient)"
                strokeWidth="0.5"
                fill="none"
                opacity="0.3"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
            </svg>
            
            {/* 中心内容 */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.div
                className="text-5xl mb-1"
                initial={{ opacity: 0, scale: 0, rotate: -180 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ delay: 0.4, duration: 0.6, type: 'spring', stiffness: 180 }}
              >
                {harmonyLevel.emoji}
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6, duration: 0.4 }}
              >
                <span className={`text-4xl font-black ${harmonyLevel.color}`}>
                  {stats.harmonyScore}
                </span>
              </motion.div>
              
              <span className="text-xs text-slate-400 font-medium mt-0.5">分</span>
            </div>
          </div>
          
          {/* 状态标签 */}
          <motion.div 
            className={`text-xl font-bold ${harmonyLevel.color} mb-2`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            {harmonyLevel.label}
          </motion.div>
          
          <motion.p 
            className="text-xs text-slate-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            基于 {totalRecords} 条记录分析
          </motion.p>
        </div>
      </motion.div>
      
      {/* Statistics Grid */}
      <motion.div 
        className="grid grid-cols-2 gap-3"
        variants={listContainerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Grudges Card */}
        <motion.div 
          className="bg-red-50 rounded-xl p-4 border border-red-100"
          style={{ WebkitTapHighlightColor: 'transparent' }}
          variants={listItemVariants}
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={16} className="text-red-500" />
            <span className="text-xs font-medium text-slate-600">记仇记录</span>
          </div>
          <div className="text-2xl font-bold text-slate-800 mb-1">{stats.totalGrudges}</div>
          <div className="text-xs text-slate-500 mb-2">
            活跃 {stats.activeGrudgeCount} | 已原谅 {stats.forgivenCount}
          </div>
          {/* Mini Trend */}
          {(() => {
            const trendData = generateTrendData(grudges, memories, 7);
            const hasData = trendData.some(d => d.grudgeCount > 0);
            if (!hasData) return null;
            return (
              <div className="h-8 w-full -mx-2 -mb-2">
                <ResponsiveContainer width="100%" height={32} style={{ outline: 'none' }}>
                  <LineChart data={trendData}>
                    <Line 
                      type="monotone" 
                      dataKey="grudgeCount" 
                      stroke="#ef4444" 
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
        </motion.div>
        
        {/* Memories Card */}
        <motion.div 
          className="bg-amber-50 rounded-xl p-4 border border-amber-100"
          style={{ WebkitTapHighlightColor: 'transparent' }}
          variants={listItemVariants}
        >
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={16} className="text-amber-500" />
            <span className="text-xs font-medium text-slate-600">{profile.spaceConfig?.memorySpaceName || DEFAULT_MEMORY_SPACE_NAME}</span>
          </div>
          <div className="text-2xl font-bold text-slate-800 mb-1">{stats.totalMemories}</div>
          <div className="text-xs text-slate-500 mb-2">
            平均甜蜜度 {stats.avgSweetnessLevel}
          </div>
          {/* Mini Trend */}
          {(() => {
            const trendData = generateTrendData(grudges, memories, 7);
            const hasData = trendData.some(d => d.memoryCount > 0);
            if (!hasData) return null;
            return (
              <div className="h-8 w-full -mx-2 -mb-2">
                <ResponsiveContainer width="100%" height={32} style={{ outline: 'none' }}>
                  <LineChart data={trendData}>
                    <Line 
                      type="monotone" 
                      dataKey="memoryCount" 
                      stroke="#f59e0b" 
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
        </motion.div>
        
        {/* Forgiveness Rate Card */}
        <motion.div 
          className="bg-green-50 rounded-xl p-4 border border-green-100"
          style={{ WebkitTapHighlightColor: 'transparent' }}
          variants={listItemVariants}
        >
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={16} className="text-green-500" />
            <span className="text-xs font-medium text-slate-600">原谅率</span>
          </div>
          <div className="text-2xl font-bold text-slate-800 mb-1">{stats.forgivenessRate}%</div>
          <div className="text-xs text-slate-500 mb-2">
            {stats.forgivenessRate >= 70 ? '宽容大度 💚' : stats.forgivenessRate >= 40 ? '还算宽容' : '小心眼 😤'}
          </div>
          {/* Mini Trend */}
          {(() => {
            const trendData = generateTrendData(grudges, memories, 7).map(d => ({
              ...d,
              forgivenRate: d.grudgeCount > 0 
                ? Math.round((grudges.filter(g => {
                    const gDate = new Date(g.date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
                    return gDate === d.date && g.status === 'forgiven';
                  }).length / d.grudgeCount) * 100)
                : 0
            }));
            const hasData = trendData.some(d => d.grudgeCount > 0);
            if (!hasData) return null;
            return (
              <div className="h-8 w-full -mx-2 -mb-2">
                <ResponsiveContainer width="100%" height={32} style={{ outline: 'none' }}>
                  <LineChart data={trendData}>
                    <Line 
                      type="monotone" 
                      dataKey="forgivenRate" 
                      stroke="#10b981" 
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
        </motion.div>
        
        {/* Avg Emotion Intensity Card */}
        <motion.div 
          className="bg-orange-50 rounded-xl p-4 border border-orange-100"
          style={{ WebkitTapHighlightColor: 'transparent' }}
          variants={listItemVariants}
        >
          <div className="flex items-center gap-2 mb-2">
            <Zap size={16} className="text-orange-500" />
            <span className="text-xs font-medium text-slate-600">平均情绪强度</span>
          </div>
          <div className="text-2xl font-bold text-slate-800 mb-1">{stats.avgAngerLevel}</div>
          <div className="text-xs text-slate-500 mb-2">
            {stats.avgAngerLevel >= 70 ? '情绪波动大 🔥' : stats.avgAngerLevel >= 40 ? '偶有波动' : '情绪平和 😇'}
          </div>
          {/* Mini Trend */}
          {(() => {
            const trendData = generateTrendData(grudges, memories, 7);
            const hasData = trendData.some(d => d.avgAnger > 0);
            if (!hasData) return null;
            return (
              <div className="h-8 w-full -mx-2 -mb-2">
                <ResponsiveContainer width="100%" height={32} style={{ outline: 'none' }}>
                  <LineChart data={trendData}>
                    <Line 
                      type="monotone" 
                      dataKey="avgAnger" 
                      stroke="#f97316" 
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
        </motion.div>
      </motion.div>
      
      {/* Time Trend Chart - 情感温度曲线 */}
      <motion.div 
        className="bg-white rounded-2xl p-6 shadow-level-1 border border-slate-100"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-base font-bold ${themeColor} flex items-center gap-2`}>
            <TrendingUp className="w-5 h-5" />
            7日情感温度曲线
          </h3>
          <div className="flex gap-2 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              <span className="text-slate-600">和谐度</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span className="text-slate-600">愤怒值</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-amber-500"></div>
              <span className="text-slate-600">甜蜜度</span>
            </div>
          </div>
        </div>
        
        {(() => {
          const trendData = generateTrendData(grudges, memories, 7);
          const hasData = trendData.some(d => d.grudgeCount > 0 || d.memoryCount > 0);
          
          if (!hasData) {
            return (
              <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
                暂无数据，添加记录后即可查看趋势
              </div>
            );
          }
          
          // 自定义 Tooltip
          const CustomTooltip = ({ active, payload, label }: any) => {
            if (active && payload && payload.length) {
              return (
                <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl p-3 shadow-lg">
                  <p className="text-xs font-semibold text-slate-700 mb-2">{label}</p>
                  {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center justify-between gap-4 text-xs">
                      <span className="flex items-center gap-1.5">
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-slate-600">{entry.name}</span>
                      </span>
                      <span className="font-bold" style={{ color: entry.color }}>
                        {entry.value}
                      </span>
                    </div>
                  ))}
                </div>
              );
            }
            return null;
          };
          
          return (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height={256} style={{ outline: 'none' }}>
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorHarmony" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.05}/>
                    </linearGradient>
                    <linearGradient id="colorAnger" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f87171" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#f87171" stopOpacity={0.05}/>
                    </linearGradient>
                    <linearGradient id="colorSweetness" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#fbbf24" stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#94a3b8" 
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="harmony" 
                    stroke="#8b5cf6" 
                    fillOpacity={1}
                    fill="url(#colorHarmony)"
                    name="和谐度"
                    strokeWidth={2.5}
                    dot={{ fill: '#8b5cf6', r: 3 }}
                    activeDot={{ r: 5, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="avgAnger" 
                    stroke="#ef4444" 
                    fillOpacity={1}
                    fill="url(#colorAnger)"
                    name="愤怒值"
                    strokeWidth={2.5}
                    dot={{ fill: '#ef4444', r: 3 }}
                    activeDot={{ r: 5, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="avgSweetness" 
                    stroke="#f59e0b" 
                    fillOpacity={1}
                    fill="url(#colorSweetness)"
                    name="甜蜜值"
                    strokeWidth={2.5}
                    dot={{ fill: '#f59e0b', r: 3 }}
                    activeDot={{ r: 5, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          );
        })()}
      </motion.div>
      
      {/* Grudge vs Memory Comparison Chart - 记仇vs回忆对比 */}
      <motion.div 
        className="bg-white rounded-2xl p-6 shadow-level-1 border border-slate-100"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-base font-bold ${themeColor} flex items-center gap-2`}>
            <span>⚖️</span>
            7日记仇vs回忆对比
          </h3>
          <div className="flex gap-2 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-400"></div>
              <span className="text-slate-600">记仇</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-amber-400"></div>
              <span className="text-slate-600">回忆</span>
            </div>
          </div>
        </div>
        
        {(() => {
          const trendData = generateTrendData(grudges, memories, 7);
          const hasData = trendData.some(d => d.grudgeCount > 0 || d.memoryCount > 0);
          
          if (!hasData) {
            return (
              <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
                暂无数据，添加记录后即可查看对比
              </div>
            );
          }
          
          // 自定义 Tooltip
          const CustomBarTooltip = ({ active, payload, label }: any) => {
            if (active && payload && payload.length) {
              const total = payload.reduce((sum: number, item: any) => sum + item.value, 0);
              return (
                <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl p-3 shadow-lg">
                  <p className="text-xs font-semibold text-slate-700 mb-2">{label}</p>
                  {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center justify-between gap-4 text-xs mb-1">
                      <span className="flex items-center gap-1.5">
                        <div 
                          className="w-2 h-2 rounded-sm" 
                          style={{ backgroundColor: entry.fill }}
                        />
                        <span className="text-slate-600">{entry.name}</span>
                      </span>
                      <span className="font-bold" style={{ color: entry.fill }}>
                        {entry.value}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-slate-200 mt-2 pt-2 flex justify-between text-xs">
                    <span className="text-slate-600">总计</span>
                    <span className="font-bold text-slate-800">{total}</span>
                  </div>
                </div>
              );
            }
            return null;
          };
          
          return (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height={256} style={{ outline: 'none' }}>
                <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grudgeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f87171" />
                      <stop offset="100%" stopColor="#ef4444" />
                    </linearGradient>
                    <linearGradient id="memoryGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fbbf24" />
                      <stop offset="100%" stopColor="#f59e0b" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#94a3b8" 
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <Tooltip content={<CustomBarTooltip />} cursor={{ fill: '#f1f5f9' }} />
                  <Bar 
                    dataKey="grudgeCount" 
                    fill="url(#grudgeGradient)"
                    name="记仇"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={40}
                  />
                  <Bar 
                    dataKey="memoryCount" 
                    fill="url(#memoryGradient)"
                    name="回忆"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          );
        })()}
      </motion.div>
      
      {/* Emotion Calendar Heatmap - 情感日历热力图 */}
      <motion.div 
        className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <h3 className={`text-base font-bold ${themeColor} mb-4 flex items-center gap-2`}>
          <span>📅</span>
          30日情感日历
        </h3>
        
        {(() => {
          const calendarData = generateCalendarData(grudges, memories);
          const hasData = calendarData.some(d => d.total > 0);
          
          if (!hasData) {
            return (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
                暂无数据，添加记录后即可查看日历
              </div>
            );
          }
          
          // 按周分组数据
          type CalendarDay = {
            date: string;
            dayOfWeek: number;
            grudgeCount: number;
            memoryCount: number;
            total: number;
            hasUnforgiven: boolean;
            allSweet: boolean;
          };
          
          const weeks: CalendarDay[][] = [];
          let currentWeek: CalendarDay[] = [];
          
          calendarData.forEach((day, index) => {
            if (day.dayOfWeek === 0 && currentWeek.length > 0) {
              weeks.push(currentWeek);
              currentWeek = [];
            }
            currentWeek.push(day);
            
            if (index === calendarData.length - 1 && currentWeek.length > 0) {
              weeks.push(currentWeek);
            }
          });
          
          const getHeatColor = (day: CalendarDay) => {
            if (day.total === 0) return 'bg-slate-50';
            
            // 特殊状态优先
            if (day.allSweet) return 'bg-amber-400'; // 全是甜蜜回忆
            if (day.hasUnforgiven) return 'bg-red-400'; // 有未原谅的记仇
            
            // 根据数量显示深浅
            const intensity = Math.min(day.total / 5, 1); // 5条以上为最深
            if (intensity > 0.75) return 'bg-purple-500';
            if (intensity > 0.5) return 'bg-purple-400';
            if (intensity > 0.25) return 'bg-purple-300';
            return 'bg-purple-200';
          };
          
          return (
            <div className="space-y-3">
              {/* 日历网格 */}
              <div className="overflow-x-auto">
                <div className="inline-flex flex-col gap-1 min-w-full">
                  {/* 星期标签 */}
                  <div className="flex gap-1 mb-1">
                    <div className="w-8" /> {/* 占位 */}
                    {['日', '一', '二', '三', '四', '五', '六'].map(day => (
                      <div key={day} className="w-8 text-center text-xs text-slate-500">
                        {day}
                      </div>
                    ))}
                  </div>
                  
                  {/* 日历格子 */}
                  {weeks.map((week, weekIndex) => (
                    <div key={weekIndex} className="flex gap-1">
                      <div className="w-8 text-xs text-slate-500 flex items-center">
                        {weekIndex === 0 ? '最近' : ''}
                      </div>
                      {Array.from({ length: 7 }, (_, dayIndex) => {
                        const day = week.find(d => d.dayOfWeek === dayIndex);
                        if (!day) {
                          return <div key={dayIndex} className="w-8 h-8" />;
                        }
                        
                        const color = getHeatColor(day);
                        const dateObj = new Date(day.date);
                        const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
                        
                        return (
                          <motion.div
                            key={day.date}
                            className={`w-8 h-8 ${color} rounded border border-slate-200 cursor-pointer transition-transform hover:scale-110`}
                            whileHover={{ scale: 1.2 }}
                            title={`${dateStr}\n记仇: ${day.grudgeCount} | 回忆: ${day.memoryCount}`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* 图例 */}
              <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap">
                <span className="text-slate-500">图例:</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-slate-50 border border-slate-200 rounded" />
                  <span>无记录</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-purple-200 rounded" />
                  <span>少量</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-purple-400 rounded" />
                  <span>较多</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-purple-500 rounded" />
                  <span>很多</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-amber-400 rounded" />
                  <span>全是甜蜜</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-red-400 rounded" />
                  <span>有未原谅</span>
                </div>
              </div>
            </div>
          );
        })()}
      </motion.div>
      
      {/* Tag Cloud */}
      {stats.mostCommonTags.length > 0 && (
        <motion.div 
          className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h3 className={`text-base font-bold ${themeColor} mb-4 flex items-center gap-2`}>
            <span>🏷️</span>
            常见标签
          </h3>
          <div className="flex flex-wrap gap-2">
            {stats.mostCommonTags.map(({ tag, count }) => {
              const isGrudgeTag = PRESET_TAGS.includes(tag);
              const isMemoryTag = PRESET_MEMORY_TAGS.includes(tag);
              const bgColor = isGrudgeTag ? 'bg-red-100 text-red-700 border-red-200' : 
                              isMemoryTag ? 'bg-amber-100 text-amber-700 border-amber-200' : 
                              'bg-slate-100 text-slate-700 border-slate-200';
              
              const fontSize = count >= 10 ? 'text-base' : count >= 5 ? 'text-sm' : 'text-xs';
              
              return (
                <div 
                  key={tag} 
                  className={`${bgColor} ${fontSize} px-3 py-1.5 rounded-full border font-medium flex items-center gap-1.5`}
                >
                  <span>{tag}</span>
                  <span className="text-xs opacity-60">×{count}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
      
      {/* Insights */}
      <motion.div 
        className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-6 shadow-sm border border-slate-200"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <h3 className={`text-base font-bold ${themeColor} mb-3 flex items-center gap-2`}>
          <span>💡</span>
          数据洞察
        </h3>
        <div className="space-y-2 text-sm text-slate-600">
          {stats.harmonyScore >= 60 && (
            <p>✨ 你们的关系很和谐，继续保持！</p>
          )}
          {stats.harmonyScore < 40 && (
            <p>💔 最近矛盾有点多，多记录些美好瞬间吧。</p>
          )}
          {stats.forgivenessRate >= 70 && (
            <p>🤗 原谅率很高，说明你们很会化解矛盾。</p>
          )}
          {stats.activeGrudgeCount > stats.forgivenCount && (
            <p>⚠️ 还有 {stats.activeGrudgeCount} 条未原谅的记录，是时候和解了吗？</p>
          )}
          {stats.totalMemories > stats.totalGrudges && (
            <p>💕 甜蜜回忆比记仇多，这是健康关系的标志！</p>
          )}
          {stats.totalMemories < stats.totalGrudges / 2 && (
            <p>🎁 建议多记录美好瞬间，平衡一下心态。</p>
          )}
          {stats.avgAngerLevel < 30 && stats.avgSweetnessLevel > 70 && (
            <p>🌈 数据显示你们相处得非常好！</p>
          )}
        </div>
      </motion.div>

      {/* Achievement Wall - Redesigned */}
      <motion.div 
        className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-6 shadow-level-1 border border-slate-200"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className={`text-base font-bold ${themeColor} flex items-center gap-2`}>
            <span>🏆</span>
            成就墙
          </h3>
          <div className="flex items-center gap-2">
            <div className="text-xs text-slate-500">
              已解锁 <span className="font-bold text-slate-700">{achievements.filter(a => a.unlocked).length}</span>/{achievements.length}
            </div>
            <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
                style={{ width: `${(achievements.filter(a => a.unlocked).length / achievements.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
        
        {(() => {
          // 成就稀有度分级
          const getRarity = (achievement: Achievement) => {
            if (achievement.target >= 100) return 'legendary';
            if (achievement.target >= 50) return 'epic';
            if (achievement.target >= 20) return 'rare';
            return 'common';
          };
          
          // 瓷砖尺寸分配 - 减少小卡片,确保内容可读性
          const getTileSize = (achievement: Achievement, index: number) => {
            const rarity = getRarity(achievement);
            // legendary: 2x2大方块
            if (rarity === 'legendary') return 'col-span-2 row-span-2';
            // epic: 全部至少2x1,已解锁2x2
            if (rarity === 'epic') {
              if (achievement.unlocked) return 'col-span-2 row-span-2';
              return 'col-span-2 row-span-1';
            }
            // rare: 主要2x1,少量1x1点缀
            if (rarity === 'rare') {
              // 只有每5个才用1x1
              if (index % 5 === 4) return 'col-span-1 row-span-1';
              return 'col-span-2 row-span-1';
            }
            // common: 主要2x1,极少1x1
            if (index % 6 === 5) return 'col-span-1 row-span-1';
            return 'col-span-2 row-span-1';
          };
          
          const rarityStyles = {
            legendary: {
              bg: 'from-amber-100 via-yellow-100 to-orange-100',
              border: 'border-amber-400',
              glow: 'shadow-[0_0_20px_rgba(251,191,36,0.3)]',
              text: 'text-amber-700',
              badge: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
            },
            epic: {
              bg: 'from-purple-100 via-violet-100 to-fuchsia-100',
              border: 'border-purple-400',
              glow: 'shadow-[0_0_15px_rgba(168,85,247,0.25)]',
              text: 'text-purple-700',
              badge: 'bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white'
            },
            rare: {
              bg: 'from-blue-100 via-cyan-100 to-teal-100',
              border: 'border-blue-400',
              glow: 'shadow-[0_0_10px_rgba(59,130,246,0.2)]',
              text: 'text-blue-700',
              badge: 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
            },
            common: {
              bg: 'from-slate-100 to-slate-200',
              border: 'border-slate-300',
              glow: '',
              text: 'text-slate-700',
              badge: 'bg-slate-400 text-white'
            }
          };
          
          const rarityLabels = {
            legendary: '传说',
            epic: '史诗',
            rare: '稀有',
            common: '普通'
          };
          
          // Masonry 布局:根据稀有度决定尺寸
          const getCardSize = (rarity: string, index: number) => {
            if (rarity === 'legendary') return 'col-span-2'; // 2倍宽
            if (rarity === 'epic' && index % 3 === 0) return 'col-span-2'; // 部分2倍宽
            return 'col-span-1'; // 标准宽度
          };
          
          const [selectedAchievement, setSelectedAchievement] = React.useState<Achievement | null>(null);
          const [isExpanded, setIsExpanded] = React.useState(false);
          
          // 默认显示前6个,折叠时优先显示已解锁的
          const displayAchievements = isExpanded ? achievements : [
            ...achievements.filter(a => a.unlocked).slice(0, 4),
            ...achievements.filter(a => !a.unlocked).slice(0, Math.max(0, 6 - achievements.filter(a => a.unlocked).length))
          ].slice(0, 6);
          
          return (
            <>
              {/* 瓷砖式网格布局 - 自动填充,增加1x1卡片高度到120px */}
              <motion.div 
                className="grid grid-cols-4 auto-rows-[120px] gap-2.5 relative overflow-hidden"
                layout
                animate={{ 
                  height: 'auto',
                  transition: { duration: 0.6, ease: [0.43, 0.13, 0.23, 0.96] }
                }}
              >
                <AnimatePresence initial={false} mode="wait">
                  {displayAchievements.map((achievement, index) => {
                    const rarity = getRarity(achievement);
                    const styles = rarityStyles[rarity];
                    const tileSize = getTileSize(achievement, index);
                    const isLarge = tileSize.includes('span-2');
                    
                    return (
                      <motion.div
                        key={achievement.id}
                        layout
                        className={`${tileSize} relative rounded-xl text-center cursor-pointer flex flex-col items-center overflow-hidden ${
                          achievement.unlocked 
                            ? `bg-gradient-to-br ${styles.bg} border-2 ${styles.border} ${styles.glow}` 
                            : 'bg-white border-2 border-slate-200 opacity-60'
                        } ${isLarge ? 'p-3 pb-10' : 'p-2.5 pb-9'}`}
                        initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
                        animate={{ 
                          opacity: 1, 
                          scale: 1, 
                          rotate: 0,
                          transition: {
                            duration: 0.6,
                            delay: index * 0.05,
                            ease: [0.43, 0.13, 0.23, 0.96],
                            scale: { type: 'spring', stiffness: 300, damping: 25 }
                          }
                        }}
                        exit={{ 
                          opacity: 0, 
                          scale: 0.8,
                          y: -10,
                          transition: {
                            duration: 0.2,
                            ease: 'easeIn'
                          }
                        }}
                        whileHover={achievement.unlocked ? { 
                          scale: 1.05, 
                          rotate: [0, -1, 1, 0],
                          transition: { duration: 0.3 }
                        } : { scale: 1.02 }}
                        whileTap={achievement.unlocked ? { scale: 0.97 } : {}}
                        onClick={() => achievement.unlocked && setSelectedAchievement(achievement)}
                      >
                        {/* 稀有度标签 - 使用绝对定位确保不被遮挡 */}
                        {achievement.unlocked && (
                          <motion.div 
                            className={`absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full ${isLarge ? 'text-[11px]' : 'text-[9px]'} font-bold ${styles.badge} shadow-sm z-10`}
                            style={{ backdropFilter: 'blur(2px)' }}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ 
                              scale: 1, 
                              opacity: 1,
                              transition: {
                                delay: 0.3 + index * 0.05,
                                duration: 0.3,
                                type: 'spring',
                                stiffness: 400,
                                damping: 20
                              }
                            }}
                          >
                            {rarityLabels[rarity]}
                          </motion.div>
                        )}
                        
                        {/* 上半部分：图标和名称 */}
                        <div className="flex-1 flex flex-col items-center justify-center">
                          {/* 图标 */}
                          <motion.div 
                            className={`${isLarge ? 'text-4xl mb-1.5' : 'text-3xl mb-1'} flex-shrink-0 ${!achievement.unlocked && 'grayscale'}`}
                            initial={{ scale: 0 }}
                            animate={{
                              scale: 1,
                              rotate: achievement.unlocked ? [0, 5, -5, 0] : 0,
                              transition: {
                                scale: { delay: 0.2 + index * 0.05, type: 'spring', stiffness: 300 },
                                rotate: { duration: 4, repeat: Infinity, repeatDelay: 6 }
                              }
                            }}
                          >
                            {achievement.unlocked ? achievement.icon : '🔒'}
                          </motion.div>
                          
                          {/* 名称 - 优化字号和行高,确保在图标下方且不被进度条遮挡 */}
                          <h4 className={`${isLarge ? 'text-sm' : 'text-xs'} font-bold leading-tight px-1 line-clamp-2 relative z-20 ${
                            achievement.unlocked ? styles.text : 'text-slate-400'
                          }`}>
                            {achievement.name}
                          </h4>
                        </div>
                      
                        {/* 进度/状态 - 放在最底部,添加 margin-top auto 推到底部 */}
                        {achievement.unlocked ? (
                          <motion.div 
                            className={`flex items-center justify-center gap-1 ${isLarge ? 'text-sm mt-1' : 'text-[11px] mt-0.5'} font-semibold text-emerald-600 relative z-10`}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ 
                              opacity: 1, 
                              scale: 1,
                              transition: {
                                delay: 0.4 + index * 0.05,
                                duration: 0.2
                              }
                            }}
                          >
                            <span>已完成 ✓</span>
                          </motion.div>
                        ) : (
                          <div className="absolute bottom-0 left-0 right-0 px-2 pb-1.5">
                            <div className={`${isLarge ? 'h-1.5' : 'h-1'} bg-slate-200/80 rounded-full overflow-hidden mb-0.5`}>
                              <motion.div 
                                className="h-full bg-gradient-to-r from-slate-400 to-slate-500"
                                initial={{ width: 0, opacity: 0 }}
                                animate={{ 
                                  width: `${(achievement.progress / achievement.target) * 100}%`,
                                  opacity: 1,
                                  transition: {
                                    width: { duration: 0.8, delay: 0.5 + index * 0.05, ease: [0.43, 0.13, 0.23, 0.96] },
                                    opacity: { duration: 0.3, delay: 0.4 + index * 0.05 }
                                  }
                                }}
                              />
                            </div>
                            <div className={`${isLarge ? 'text-[11px]' : 'text-[10px]'} text-slate-500 font-medium text-center`}>
                              {achievement.progress}/{achievement.target}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
              
              {/* 展开/收起按钮 */}
              {achievements.length > 6 && (
                <motion.button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="mt-3 w-full py-2.5 bg-gradient-to-r from-white to-slate-50 hover:from-slate-50 hover:to-slate-100 border-2 border-slate-300 rounded-xl font-medium text-slate-700 text-sm flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-shadow"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.4, ease: [0.43, 0.13, 0.23, 0.96] }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span>{isExpanded ? '收起成就' : `展开全部 (${achievements.length})`}</span>
                  <motion.span
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.4, ease: [0.43, 0.13, 0.23, 0.96] }}
                  >
                    ▼
                  </motion.span>
                </motion.button>
              )}
              
              {/* 成就详情模态框 */}
              <AnimatePresence>
                {selectedAchievement && (
                  <motion.div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setSelectedAchievement(null)}
                  >
                    <motion.div
                      className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl"
                      initial={{ scale: 0.9, opacity: 0, y: 20 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.9, opacity: 0, y: 20 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="text-center">
                        <div className="text-6xl mb-4">{selectedAchievement.icon}</div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">{selectedAchievement.name}</h3>
                        <p className="text-sm text-slate-600 mb-4">{selectedAchievement.description}</p>
                        
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4">
                          <div className="text-xs font-semibold text-emerald-700 mb-1">解锁条件</div>
                          <div className="text-sm font-bold text-emerald-600">
                            达到 {selectedAchievement.target} 次
                          </div>
                        </div>
                        
                        <button
                          onClick={() => setSelectedAchievement(null)}
                          className="w-full py-2.5 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-700 transition-colors"
                        >
                          关闭
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          );
        })()}
        
        {/* Category Summary */}
        <div className="mt-6 pt-4 border-t border-slate-300/50 grid grid-cols-3 gap-3 text-center text-xs">
          <div className="bg-white/50 rounded-lg p-2">
            <div className="text-slate-500 mb-1 font-medium">记仇类</div>
            <div className="font-bold text-red-600 text-base">
              {achievements.filter(a => a.category === 'grudge' && a.unlocked).length}/
              {achievements.filter(a => a.category === 'grudge').length}
            </div>
          </div>
          <div className="bg-white/50 rounded-lg p-2">
            <div className="text-slate-500 mb-1 font-medium">回忆类</div>
            <div className="font-bold text-amber-600 text-base">
              {achievements.filter(a => a.category === 'memory' && a.unlocked).length}/
              {achievements.filter(a => a.category === 'memory').length}
            </div>
          </div>
          <div className="bg-white/50 rounded-lg p-2">
            <div className="text-slate-500 mb-1 font-medium">和谐类</div>
            <div className="font-bold text-green-600 text-base">
              {achievements.filter(a => a.category === 'harmony' && a.unlocked).length}/
              {achievements.filter(a => a.category === 'harmony').length}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// --- 数据同步相关组件 ---

const SyncQRModal = ({
  isOpen,
  onClose,
  profile,
  grudges,
  memories
}: {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  grudges: Grudge[];
  memories: Memory[];
}) => {
  const [qrData, setQrData] = useState<string>('');
  const [stats, setStats] = useState({ totalGrudges: 0, totalMemories: 0 });

  useEffect(() => {
    if (isOpen && profile.deviceId) {
      const syncData = PairingService.generateSyncData(profile.deviceId, grudges, memories);
      const encoded = PairingService.encodeQRData(syncData);
      setQrData(encoded);
      setStats(syncData.stats);
    }
  }, [isOpen, profile.deviceId, grudges, memories]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800">🔄 数据同步码</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        <div className="text-center">
          <div className="mb-4">
            <p className="text-sm text-slate-600 mb-2">让 Ta 扫描此二维码</p>
            {qrData && (
              <div className="bg-white p-4 rounded-lg inline-block border-2 border-slate-200">
                <QRCodeSVG value={qrData} size={200} level="L" />
              </div>
            )}
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-sm space-y-1">
            <p className="text-slate-700">📊 本次同步内容:</p>
            <p className="font-medium text-blue-700">记仇 {stats.totalGrudges} 条</p>
            <p className="font-medium text-amber-700">回忆 {stats.totalMemories} 条</p>
            <p className="text-xs text-slate-500 mt-2">💡 私密内容不会同步</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-700 font-medium transition-colors"
        >
          关闭
        </button>
      </motion.div>
    </div>
  );
};

const ScanSyncModal = ({
  isOpen,
  onClose,
  onScanned,
  profile
}: {
  isOpen: boolean;
  onClose: () => void;
  onScanned: (data: QRCodeData) => void;
  profile: UserProfile;
}) => {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string>('');

  const handleScan = async () => {
    setScanning(true);
    setError('');
    try {
      const result = await PairingService.scanQRCode();
      if (result) {
        const decoded = PairingService.decodeQRData(result);
        if (decoded) {
          onScanned(decoded);
        } else {
          setError('无法解析二维码数据');
        }
      }
    } catch (err: any) {
      console.error('扫描错误:', err);
      if (err.message?.includes('Google Barcode Scanner')) {
        setError('摄像头扫描暂不可用，请使用"从相册选择"功能');
      } else {
        setError('扫描失败: ' + err.message);
      }
    } finally {
      setScanning(false);
    }
  };

  const handlePickImage = async () => {
    setError('');
    try {
      const result = await PairingService.pickQRCodeFromGallery();
      if (result) {
        const decoded = PairingService.decodeQRData(result);
        if (decoded) {
          onScanned(decoded);
        } else {
          setError('无法解析二维码数据');
        }
      } else {
        setError('未能从图片中识别二维码');
      }
    } catch (err) {
      console.error('读取图片错误:', err);
      setError('读取图片失败: ' + (err as Error).message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800">📥 扫描同步码</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-slate-600 text-center">
            扫描对方的同步二维码以接收数据
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            onClick={handleScan}
            disabled={scanning}
            className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Camera size={20} />
            {scanning ? '扫描中...' : '打开摄像头扫描'}
          </button>

          <button
            onClick={handlePickImage}
            className="w-full py-3 bg-green-500 hover:bg-green-600 rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
          >
            <ImageIcon size={20} />
            从相册选择
          </button>

          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-700 font-medium transition-colors"
          >
            取消
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// --- 配对相关组件 ---

const PairInviteModal = ({
  isOpen,
  onClose,
  profile
}: {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
}) => {
  const [qrData, setQrData] = useState<string>('');
  const [myCallName, setMyCallName] = useState<string>(''); // 我期望对方怎么叫我
  const [qrGenerated, setQrGenerated] = useState(false);

  // 重置状态
  useEffect(() => {
    if (isOpen) {
      setMyCallName('');
      setQrGenerated(false);
      setQrData('');
    }
  }, [isOpen]);

  const handleGenerateQR = () => {
    if (!myCallName.trim()) {
      alert('请输入您期望的称呼');
      return;
    }
    if (profile.role && profile.name) {
      const invite = PairingService.generatePairInvite(profile, myCallName.trim());
      const encoded = PairingService.encodeQRData(invite);
      setQrData(encoded);
      setQrGenerated(true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800">💑 生成配对码</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        {!qrGenerated ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-600 mb-2">我的昵称：{profile.name}</p>
              <p className="text-sm text-slate-600 mb-4">
                角色：{profile.role === 'bf' ? '男友' : '女友'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                💬 我期望 Ta 叫我:
              </label>
              <input
                type="text"
                value={myCallName}
                onChange={(e) => setMyCallName(e.target.value)}
                placeholder="例如: 老公/老婆/宝贝..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={handleGenerateQR}
              className="w-full py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-lg font-medium transition-colors"
            >
              生成配对码
            </button>
          </div>
        ) : (
          <div className="text-center">
            <div className="mb-4">
              <p className="text-sm text-slate-600 mb-2">让 Ta 扫描此二维码</p>
              {qrData && (
                <div className="bg-white p-4 rounded-lg inline-block border-2 border-slate-200">
                  <QRCodeSVG value={qrData} size={200} level="L" />
                </div>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-4 space-y-1">
              <p>你的昵称：{profile.name}</p>
              <p>期望称呼：{myCallName}</p>
            </div>
            <button
              onClick={onClose}
              className="w-full mt-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-700 font-medium transition-colors"
            >
              关闭
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

const PairScanModal = ({
  isOpen,
  onClose,
  onScanned,
  profile
}: {
  isOpen: boolean;
  onClose: () => void;
  onScanned: (data: QRCodeData) => void;
  profile: UserProfile;
}) => {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string>('');

  const handleScan = async () => {
    setScanning(true);
    setError('');
    try {
      const result = await PairingService.scanQRCode();
      if (result) {
        const decoded = PairingService.decodeQRData(result);
        if (decoded) {
          onScanned(decoded);
        } else {
          setError('无法解析二维码数据');
        }
      }
    } catch (err) {
      const errorMsg = (err as Error).message;
      console.error('扫描失败:', errorMsg);
      
      // 检测是否是 Google 模块下载失败
      if (errorMsg.includes('Google Barcode Scanner') || 
          errorMsg.includes('download') || 
          errorMsg.includes('network') ||
          errorMsg.includes('install')) {
        setError('⚠️ 无法下载 Google 扫描模块（可能网络受限）\n\n📸 请使用下方"从相册选择"按钮，先截图保存对方的二维码，然后从相册选择识别');
      } else {
        setError('扫描失败: ' + errorMsg);
      }
    } finally {
      setScanning(false);
    }
  };

  const handlePickImage = async () => {
    setScanning(true);
    setError('');
    try {
      const result = await PairingService.pickQRCodeFromGallery();
      if (result) {
        const decoded = PairingService.decodeQRData(result);
        if (decoded) {
          onScanned(decoded);
        } else {
          setError('无法解析二维码数据，请确保选择的是配对二维码截图');
        }
      } else {
        setError('未选择图片或无法识别二维码');
      }
    } catch (err) {
      setError('读取图片失败: ' + (err as Error).message);
    } finally {
      setScanning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800">📷 扫描配对码</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-slate-600 text-center">
            扫描对方的配对二维码以建立连接
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            onClick={handleScan}
            disabled={scanning}
            className="w-full py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-slate-300 rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Camera size={20} />
            {scanning ? '扫描中...' : '打开摄像头扫描'}
          </button>

          <button
            onClick={handlePickImage}
            className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
          >
            <ImageIcon size={20} />
            从相册选择
          </button>

          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-700 font-medium transition-colors"
          >
            取消
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const PairConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  inviteData,
  profile
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (myCallName: string, partnerCallsMe: string, anniversary?: string) => void;
  inviteData: PairInvite | null;
  profile: UserProfile;
}) => {
  const [myCallName, setMyCallName] = useState('');
  const [anniversary, setAnniversary] = useState('');

  useEffect(() => {
    if (isOpen && inviteData) {
      // 根据角色设置默认称呼
      if (profile.role === 'bf') {
        setMyCallName('老婆');
      } else {
        setMyCallName('老公');
      }
      setAnniversary(''); // 重置
    }
  }, [isOpen, inviteData, profile.role]);

  const handleConfirm = () => {
    if (!myCallName.trim()) {
      alert('请填写您对Ta的称呼');
      return;
    }
    // partnerCallsMe 来自邀请码中的 callName
    const partnerCallsMe = inviteData?.inviter.callName || '';
    onConfirm(myCallName.trim(), partnerCallsMe, anniversary || undefined);
  };

  if (!isOpen || !inviteData) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800">💕 确认配对</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-purple-50 rounded-lg p-4 text-sm space-y-2">
            <div>
              <p className="text-slate-600 text-xs">对方信息：</p>
              <p className="font-medium text-purple-700">{inviteData.inviter.name}</p>
              <p className="text-slate-500 text-xs">
                {inviteData.inviter.role === 'bf' ? '男友' : '女友'}
              </p>
            </div>
            {inviteData.inviter.callName && (
              <div className="pt-2 border-t border-purple-200">
                <p className="text-slate-600 text-xs">Ta 希望你叫 Ta：</p>
                <p className="font-medium text-purple-700">{inviteData.inviter.callName}</p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              💬 我叫 Ta：
            </label>
            <input
              type="text"
              value={myCallName}
              onChange={(e) => setMyCallName(e.target.value)}
              placeholder="例如：老公、宝贝"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              📅 纪念日（可选）：
            </label>
            <input
              type="date"
              value={anniversary}
              onChange={(e) => setAnniversary(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-700 font-medium transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg text-white font-medium transition-colors"
            >
              确认配对
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const SettingsPage = ({ 
  profile,
  grudges,
  memories,
  onUpdateProfile,
  onExportData,
  onImportData,
  onClearData,
  role 
}: { 
  profile: UserProfile;
  grudges: Grudge[];
  memories: Memory[];
  onUpdateProfile: (profile: UserProfile) => void;
  onExportData: () => void;
  onImportData: (data: string) => void;
  onClearData: () => void;
  role: Role;
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(profile.name);
  const [showRoleSwitch, setShowRoleSwitch] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 配对相关状态
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [scannedData, setScannedData] = useState<PairInvite | null>(null);
  
  // 数据同步相关状态
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showScanSyncModal, setShowScanSyncModal] = useState(false);
  const [syncData, setSyncData] = useState<SyncData | null>(null);

  // 自定义称呼状态
  const [isEditingCallName, setIsEditingCallName] = useState(false);
  const [newCallName, setNewCallName] = useState(profile.customCallName || (role === 'gf' ? '男朋友' : '女朋友'));
  const [showCallNamePresets, setShowCallNamePresets] = useState(false);

  // 空间名称状态
  const [isEditingSpaceName, setIsEditingSpaceName] = useState(false);
  const [newGrudgeSpaceName, setNewGrudgeSpaceName] = useState(
    profile.spaceConfig?.grudgeSpaceName || (role === 'gf' ? DEFAULT_GRUDGE_SPACE_NAME.gf : DEFAULT_GRUDGE_SPACE_NAME.bf)
  );
  const [newMemorySpaceName, setNewMemorySpaceName] = useState(
    profile.spaceConfig?.memorySpaceName || DEFAULT_MEMORY_SPACE_NAME
  );
  const [showSpaceNamePresets, setShowSpaceNamePresets] = useState(false);

  const themeColor = role === 'gf' ? 'text-love-500' : 'text-cool-500';
  const accentColor = role === 'gf' ? 'bg-love-500 hover:bg-love-600' : 'bg-cool-500 hover:bg-cool-600';

  // 计算存储使用情况
  const calculateStorageSize = () => {
    const dataStr = JSON.stringify({ grudges, memories, profile });
    const bytes = new Blob([dataStr]).size;
    const kb = (bytes / 1024).toFixed(2);
    return kb;
  };

  const handleSaveName = () => {
    if (newName.trim()) {
      onUpdateProfile({ ...profile, name: newName.trim() });
      setIsEditingName(false);
    }
  };

  const handleRoleSwitch = (newRole: Role) => {
    if (window.confirm('确定要切换身份吗？数据会保留，只是角色视角不同。')) {
      onUpdateProfile({ ...profile, role: newRole });
      setShowRoleSwitch(false);
    }
  };

  // 保存自定义称呼
  const handleSaveCallName = () => {
    if (newCallName.trim()) {
      onUpdateProfile({ ...profile, customCallName: newCallName.trim() });
      setIsEditingCallName(false);
    }
  };

  // 选择预设称呼
  const handleSelectCallNamePreset = (preset: string) => {
    setNewCallName(preset);
    setShowCallNamePresets(false);
  };

  // 保存空间名称
  const handleSaveSpaceNames = () => {
    if (newGrudgeSpaceName.trim() && newMemorySpaceName.trim()) {
      onUpdateProfile({ 
        ...profile, 
        spaceConfig: {
          grudgeSpaceName: newGrudgeSpaceName.trim(),
          memorySpaceName: newMemorySpaceName.trim()
        }
      });
      setIsEditingSpaceName(false);
    }
  };

  // 选择预设空间名称
  const handleSelectSpaceNamePreset = (type: 'grudge' | 'memory', preset: string) => {
    if (type === 'grudge') {
      setNewGrudgeSpaceName(preset);
    } else {
      setNewMemorySpaceName(preset);
    }
    setShowSpaceNamePresets(false);
  };

  const handleExport = () => {
    onExportData();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        try {
          onImportData(content);
          alert('数据导入成功！');
        } catch (error) {
          alert('导入失败，文件格式可能不正确');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleClear = () => {
    if (window.confirm('⚠️ 警告：此操作将删除所有记录数据，无法恢复！\n\n确定要继续吗？')) {
      if (window.confirm('🚨 最后确认：真的要删除所有数据吗？建议先导出备份！')) {
        onClearData();
        alert('数据已清空');
      }
    }
  };

  // 配对相关处理函数
  const handleScanned = (data: PairInvite) => {
    setScannedData(data);
    setShowScanModal(false);
    setShowConfirmModal(true);
  };

  const handleConfirmPair = (myCallName: string, partnerCallsMe: string, anniversary: string) => {
    if (!scannedData) return;

    // 使用对方邀请码中的信息直接完成配对
    const updatedProfile: UserProfile = {
      ...profile,
      paired: true,
      pairId: scannedData.inviter.id, // 使用对方的设备ID作为配对标识
      partner: {
        id: scannedData.inviter.id,
        name: scannedData.inviter.name,
        role: scannedData.inviter.role,
        callName: myCallName,          // 我对TA的称呼
        callsMe: scannedData.inviter.callName  // 对方期望我怎么叫TA（来自邀请码）
      },
      relationship: {
        anniversary: anniversary || new Date().toISOString().split('T')[0],
        pairDate: new Date().toISOString().split('T')[0],
        partnerBirthday: undefined
      }
    };

    onUpdateProfile(updatedProfile);
    setShowConfirmModal(false);
    setScannedData(null);

    // 配对成功后自动显示配对码模态框，方便对方扫描
    setTimeout(() => {
      setShowInviteModal(true);
      alert('✅ 配对成功！\n\n现在请让对方扫描您的配对码来完成配对。');
    }, 300);
  };

  const handleUnpair = () => {
    if (window.confirm('确定要解除配对吗？这不会删除已有的记录。')) {
      const updatedProfile: UserProfile = {
        ...profile,
        paired: false,
        pairId: null,
        partner: undefined,
        relationship: undefined
      };
      onUpdateProfile(updatedProfile);
      alert('已解除配对');
    }
  };

  // 计算在一起天数
  const getDaysTogether = () => {
    if (!profile.paired || !profile.relationship?.anniversary) return 0;
    const now = new Date();
    const start = new Date(profile.relationship.anniversary);
    const diffTime = Math.abs(now.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // 处理接收到的同步数据
  const handleSyncScanned = (data: QRCodeData) => {
    if (data.type === 'data_sync') {
      setSyncData(data);
      setShowScanSyncModal(false);
      // 显示确认对话框
      const confirmMsg = `收到来自 ${profile.partner?.name || '对方'} 的同步数据：\n\n` +
        `记仇: ${data.stats.totalGrudges} 条\n` +
        `回忆: ${data.stats.totalMemories} 条\n\n` +
        `确定要导入这些数据吗？`;
      
      if (window.confirm(confirmMsg)) {
        handleImportSyncData(data);
      } else {
        setSyncData(null);
      }
    } else {
      alert('这不是数据同步码，请扫描正确的同步二维码');
    }
  };

  // 导入同步数据
  const handleImportSyncData = (data: SyncData) => {
    try {
      // 创建现有数据的映射表
      const existingGrudgesMap = new Map(grudges.map(g => [g.id, g]));
      const existingMemoriesMap = new Map(memories.map(m => [m.id, m]));
      
      let newGrudgesCount = 0;
      let updatedGrudgesCount = 0;
      let newMemoriesCount = 0;
      let updatedMemoriesCount = 0;
      
      // 处理记仇数据：区分新增和更新
      const mergedGrudges = [...grudges];
      data.data.grudges.forEach(syncGrudge => {
        const existingGrudge = existingGrudgesMap.get(syncGrudge.id);
        
        if (!existingGrudge) {
          // 新记录：直接添加
          mergedGrudges.push(syncGrudge);
          newGrudgesCount++;
        } else {
          // 已存在的记录：检查是否需要更新
          // 只更新对方创建的记录（不是我自己的）
          if (syncGrudge.authorDeviceId !== profile.deviceId) {
            // 查找并更新状态（特别是原谅状态）
            const index = mergedGrudges.findIndex(g => g.id === syncGrudge.id);
            if (index !== -1) {
              // 保留本地的一些字段，更新对方可能修改的字段
              mergedGrudges[index] = {
                ...mergedGrudges[index],
                status: syncGrudge.status, // 更新原谅状态
                forgivenAt: syncGrudge.forgivenAt, // 更新原谅时间
                // 也可以更新其他字段
                title: syncGrudge.title,
                description: syncGrudge.description,
                severity: syncGrudge.severity,
                tags: syncGrudge.tags,
                penalty: syncGrudge.penalty
              };
              updatedGrudgesCount++;
            }
          }
        }
      });
      
      // 处理回忆数据：区分新增和更新
      const mergedMemories = [...memories];
      data.data.memories.forEach(syncMemory => {
        const existingMemory = existingMemoriesMap.get(syncMemory.id);
        
        if (!existingMemory) {
          // 新记录：直接添加
          mergedMemories.push(syncMemory);
          newMemoriesCount++;
        } else {
          // 已存在的记录：检查是否需要更新
          // 只更新对方创建的记录
          if (syncMemory.authorDeviceId !== profile.deviceId) {
            const index = mergedMemories.findIndex(m => m.id === syncMemory.id);
            if (index !== -1) {
              // 更新对方可能修改的字段
              mergedMemories[index] = {
                ...mergedMemories[index],
                title: syncMemory.title,
                description: syncMemory.description,
                sweetness: syncMemory.sweetness,
                tags: syncMemory.tags
              };
              updatedMemoriesCount++;
            }
          }
        }
      });
      
      // 导出包含合并后数据的JSON
      const mergedData = {
        grudges: mergedGrudges,
        memories: mergedMemories,
        profile
      };
      
      // 使用导入功能
      onImportData(JSON.stringify(mergedData));
      
      // 详细的同步结果提示
      const resultMsg = `✅ 同步成功！\n\n` +
        `📊 记仇：\n` +
        `  - 新增: ${newGrudgesCount} 条\n` +
        `  - 更新: ${updatedGrudgesCount} 条\n\n` +
        `💕 回忆：\n` +
        `  - 新增: ${newMemoriesCount} 条\n` +
        `  - 更新: ${updatedMemoriesCount} 条`;
      
      alert(resultMsg);
      setSyncData(null);
    } catch (err) {
      alert('同步失败: ' + (err as Error).message);
      setSyncData(null);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Profile Section */}
      <div className="bg-gradient-to-br from-purple-100 to-blue-100 rounded-2xl p-6 shadow-sm">
        <h3 className={`text-base font-bold ${themeColor} mb-4 flex items-center gap-2`}>
          <User size={18} />
          个人信息
        </h3>

        {/* Name */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-600 mb-2">昵称</label>
          {isEditingName ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white rounded-lg text-sm border border-slate-200 focus:ring-2 focus:ring-purple-300 outline-none"
                  placeholder="输入昵称"
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-all"
                >
                  保存
                </button>
                <button
                  onClick={() => {
                    setNewName(profile.name);
                    setIsEditingName(false);
                  }}
                  className="px-4 py-2 bg-slate-300 hover:bg-slate-400 text-slate-700 rounded-lg text-sm font-medium transition-all"
                >
                  取消
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-white rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-slate-800">{profile.name}</span>
                <button
                  onClick={() => setIsEditingName(true)}
                  className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                >
                  编辑
                </button>
              </div>
            )}
          </div>

        {/* Role */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">当前身份</label>
          <div className="flex items-center justify-between bg-white rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{role === 'gf' ? '👿' : '🛡️'}</span>
              <span className="text-sm font-medium text-slate-800">
                {role === 'gf' ? '女朋友视角' : '男朋友视角'}
              </span>
            </div>
            <button
              onClick={() => setShowRoleSwitch(true)}
              className="text-xs text-purple-600 hover:text-purple-700 font-medium"
            >
              切换
            </button>
          </div>
        </div>
      </div>

      {/* Custom Call Names */}
      <div className="bg-gradient-to-br from-rose-100 to-pink-100 rounded-2xl p-6 shadow-sm">
        <h3 className={`text-base font-bold ${themeColor} mb-4 flex items-center gap-2`}>
          <Heart size={18} />
          自定义称呼
        </h3>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">
              Ta 的称呼 <span className="text-slate-400">(你叫Ta什么)</span>
            </label>
            {isEditingCallName ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCallName}
                    onChange={e => setNewCallName(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white rounded-lg text-sm border border-slate-200 focus:ring-2 focus:ring-pink-300 outline-none"
                    placeholder="例如：宝宝、亲爱的"
                    maxLength={10}
                  />
                  <button
                    onClick={() => setShowCallNamePresets(!showCallNamePresets)}
                    className="px-3 py-2 bg-pink-100 hover:bg-pink-200 text-pink-700 rounded-lg text-xs font-medium transition-all"
                  >
                    预设
                  </button>
                </div>
                
                {/* 预设选项 */}
                {showCallNamePresets && (
                  <motion.div 
                    className="bg-white rounded-lg p-3 border border-pink-200 space-y-2"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {role === 'gf' ? (
                      // 女友叫男友
                      <>
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 mb-1">🌹 浪漫系</div>
                          <div className="flex flex-wrap gap-1">
                            {GIRLFRIEND_CALL_BOYFRIEND_PRESETS.romantic.map(preset => (
                              <button
                                key={preset}
                                onClick={() => handleSelectCallNamePreset(preset)}
                                className="px-2 py-1 bg-pink-50 hover:bg-pink-100 text-pink-700 rounded text-xs transition-all"
                              >
                                {preset}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 mb-1">🐷 可爱系</div>
                          <div className="flex flex-wrap gap-1">
                            {GIRLFRIEND_CALL_BOYFRIEND_PRESETS.cute.map(preset => (
                              <button
                                key={preset}
                                onClick={() => handleSelectCallNamePreset(preset)}
                                className="px-2 py-1 bg-pink-50 hover:bg-pink-100 text-pink-700 rounded text-xs transition-all"
                              >
                                {preset}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 mb-1">👑 霸气系</div>
                          <div className="flex flex-wrap gap-1">
                            {GIRLFRIEND_CALL_BOYFRIEND_PRESETS.cool.map(preset => (
                              <button
                                key={preset}
                                onClick={() => handleSelectCallNamePreset(preset)}
                                className="px-2 py-1 bg-pink-50 hover:bg-pink-100 text-pink-700 rounded text-xs transition-all"
                              >
                                {preset}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      // 男友叫女友
                      <>
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 mb-1">🌹 浪漫系</div>
                          <div className="flex flex-wrap gap-1">
                            {BOYFRIEND_CALL_GIRLFRIEND_PRESETS.romantic.map(preset => (
                              <button
                                key={preset}
                                onClick={() => handleSelectCallNamePreset(preset)}
                                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-xs transition-all"
                              >
                                {preset}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 mb-1">🐷 可爱系</div>
                          <div className="flex flex-wrap gap-1">
                            {BOYFRIEND_CALL_GIRLFRIEND_PRESETS.cute.map(preset => (
                              <button
                                key={preset}
                                onClick={() => handleSelectCallNamePreset(preset)}
                                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-xs transition-all"
                              >
                                {preset}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 mb-1">💖 甜蜜系</div>
                          <div className="flex flex-wrap gap-1">
                            {BOYFRIEND_CALL_GIRLFRIEND_PRESETS.sweet.map(preset => (
                              <button
                                key={preset}
                                onClick={() => handleSelectCallNamePreset(preset)}
                                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-xs transition-all"
                              >
                                {preset}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleSaveCallName}
                    className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-all"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => {
                      setNewCallName(profile.customCallName || (role === 'gf' ? '男朋友' : '女朋友'));
                      setIsEditingCallName(false);
                      setShowCallNamePresets(false);
                    }}
                    className="flex-1 px-4 py-2 bg-slate-300 hover:bg-slate-400 text-slate-700 rounded-lg text-sm font-medium transition-all"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-white rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-slate-800">
                  {profile.customCallName || (role === 'gf' ? '男朋友' : '女朋友')}
                </span>
                <button
                  onClick={() => setIsEditingCallName(true)}
                  className="text-xs text-pink-600 hover:text-pink-700 font-medium"
                >
                  编辑
                </button>
              </div>
            )}
          </div>

          <div className="p-3 bg-white/50 rounded-lg text-xs text-slate-500 text-center">
            💡 自定义称呼会在整个应用中生效
          </div>
        </div>
      </div>

      {/* Custom Space Names */}
      <div className="bg-gradient-to-br from-amber-100 to-orange-100 rounded-2xl p-6 shadow-sm">
        <h3 className={`text-base font-bold ${themeColor} mb-4 flex items-center gap-2`}>
          <Sparkles size={18} />
          空间名称
        </h3>

        <div className="space-y-4">
          {isEditingSpaceName ? (
            <div className="space-y-3">
              {/* 负面空间 */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">
                  负面记录空间
                </label>
                <input
                  type="text"
                  value={newGrudgeSpaceName}
                  onChange={e => setNewGrudgeSpaceName(e.target.value)}
                  className="w-full px-3 py-2 bg-white rounded-lg text-sm border border-slate-200 focus:ring-2 focus:ring-orange-300 outline-none"
                  placeholder="例如：小本本、吐槽专区"
                  maxLength={10}
                />
              </div>

              {/* 正面空间 */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">
                  正面回忆空间
                </label>
                <input
                  type="text"
                  value={newMemorySpaceName}
                  onChange={e => setNewMemorySpaceName(e.target.value)}
                  className="w-full px-3 py-2 bg-white rounded-lg text-sm border border-slate-200 focus:ring-2 focus:ring-orange-300 outline-none"
                  placeholder="例如：甜蜜回忆、幸福时光"
                  maxLength={10}
                />
              </div>

              {/* 预设按钮 */}
              <button
                onClick={() => setShowSpaceNamePresets(!showSpaceNamePresets)}
                className="w-full px-3 py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg text-xs font-medium transition-all"
              >
                {showSpaceNamePresets ? '收起预设' : '查看预设选项'}
              </button>

              {/* 预设选项 */}
              {showSpaceNamePresets && (
                <motion.div 
                  className="bg-white rounded-lg p-3 border border-orange-200 space-y-3"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div>
                    <div className="text-xs font-bold text-slate-600 mb-2">负面空间预设（中性化）</div>
                    {Object.entries(GRUDGE_SPACE_PRESETS).map(([category, presets]) => (
                      <div key={category} className="mb-2">
                        <div className="text-[10px] font-bold text-slate-400 mb-1">
                          {category === 'record' ? '📋 记录类' : 
                           category === 'archive' ? '📁 档案类' :
                           category === 'fun' ? '🎯 趣味类' : '💭 情绪类'}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {presets.map((preset: string) => (
                            <button
                              key={preset}
                              onClick={() => handleSelectSpaceNamePreset('grudge', preset)}
                              className="px-2 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded text-xs transition-all"
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-slate-200 pt-2">
                    <div className="text-xs font-bold text-slate-600 mb-2">正面空间预设</div>
                    <div className="flex flex-wrap gap-1">
                      {MEMORY_SPACE_PRESETS.map(preset => (
                        <button
                          key={preset}
                          onClick={() => handleSelectSpaceNamePreset('memory', preset)}
                          className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded text-xs transition-all"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* 保存/取消按钮 */}
              <div className="flex gap-2">
                <button
                  onClick={handleSaveSpaceNames}
                  className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-all"
                >
                  保存
                </button>
                <button
                  onClick={() => {
                    setNewGrudgeSpaceName(profile.spaceConfig?.grudgeSpaceName || (role === 'gf' ? DEFAULT_GRUDGE_SPACE_NAME.gf : DEFAULT_GRUDGE_SPACE_NAME.bf));
                    setNewMemorySpaceName(profile.spaceConfig?.memorySpaceName || DEFAULT_MEMORY_SPACE_NAME);
                    setIsEditingSpaceName(false);
                    setShowSpaceNamePresets(false);
                  }}
                  className="flex-1 px-4 py-2 bg-slate-300 hover:bg-slate-400 text-slate-700 rounded-lg text-sm font-medium transition-all"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-white rounded-lg p-4">
                <div className="text-xs text-slate-500 mb-1">负面记录</div>
                <div className="text-sm font-bold text-slate-800">
                  {profile.spaceConfig?.grudgeSpaceName || (role === 'gf' ? DEFAULT_GRUDGE_SPACE_NAME.gf : DEFAULT_GRUDGE_SPACE_NAME.bf)}
                </div>
              </div>
              <div className="bg-white rounded-lg p-4">
                <div className="text-xs text-slate-500 mb-1">正面回忆</div>
                <div className="text-sm font-bold text-slate-800">
                  {profile.spaceConfig?.memorySpaceName || DEFAULT_MEMORY_SPACE_NAME}
                </div>
              </div>
              <button
                onClick={() => setIsEditingSpaceName(true)}
                className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-all"
              >
                编辑空间名称
              </button>
            </div>
          )}

          <div className="p-3 bg-white/50 rounded-lg text-xs text-slate-500 text-center">
            💡 空间名称会显示在首页和导航栏
          </div>
        </div>
      </div>

      {/* Pairing Management */}
      <div className="bg-gradient-to-br from-pink-100 to-purple-100 rounded-2xl p-6 shadow-sm">
        <h3 className={`text-base font-bold ${themeColor} mb-4 flex items-center gap-2`}>
          <Users size={18} />
          配对管理
        </h3>

        {profile.paired && profile.partner ? (
          // 已配对状态
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{profile.partner.role === 'gf' ? '👿' : '🛡️'}</span>
                <div className="flex-1">
                  <div className="text-base font-bold text-slate-800">
                    {profile.partner.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    我叫TA：{profile.partner.callName} · TA叫我：{profile.partner.callsMe}
                  </div>
                </div>
              </div>
              
              {profile.relationship?.anniversary && (
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className="text-xs text-slate-600">在一起</span>
                  <span className="text-sm font-bold text-purple-600">
                    {getDaysTogether()} 天 💕
                  </span>
                </div>
              )}
            </div>

            {/* 配对码按钮 */}
            <button
              onClick={() => setShowInviteModal(true)}
              className="w-full py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
            >
              <Heart size={16} fill="currentColor" />
              查看我的配对码
            </button>

            {/* 数据同步按钮 */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowSyncModal(true)}
                className="py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
              >
                <span>🔄</span>
                生成同步码
              </button>
              <button
                onClick={() => setShowScanSyncModal(true)}
                className="py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
              >
                <span>📥</span>
                接收同步
              </button>
            </div>

            <button
              onClick={handleUnpair}
              className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-sm font-medium transition-all"
            >
              解除配对
            </button>
          </div>
        ) : (
          // 未配对状态
          <div className="space-y-3">
            <button
              onClick={() => setShowInviteModal(true)}
              className="w-full flex items-center justify-between p-4 bg-purple-500 hover:bg-purple-600 rounded-xl transition-all group text-white"
            >
              <div className="flex items-center gap-3">
                <QrCode size={24} />
                <div className="text-left">
                  <div className="text-sm font-medium">生成配对码</div>
                  <div className="text-xs opacity-90">让对方扫描配对</div>
                </div>
              </div>
              <ChevronLeft size={18} className="opacity-80 rotate-180" />
            </button>

            <button
              onClick={() => setShowScanModal(true)}
              className="w-full flex items-center justify-between p-4 bg-pink-500 hover:bg-pink-600 rounded-xl transition-all group text-white"
            >
              <div className="flex items-center gap-3">
                <Camera size={24} />
                <div className="text-left">
                  <div className="text-sm font-medium">扫描配对码</div>
                  <div className="text-xs opacity-90">扫描对方的配对码</div>
                </div>
              </div>
              <ChevronLeft size={18} className="opacity-80 rotate-180" />
            </button>

            <div className="p-3 bg-white rounded-lg text-xs text-slate-500 text-center">
              💡 配对后可以看到对方信息，未来还能同步数据
            </div>
          </div>
        )}
      </div>

      {/* Statistics Summary */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h3 className={`text-base font-bold ${themeColor} mb-4 flex items-center gap-2`}>
          <BarChart3 size={18} />
          数据概览
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{grudges.length}</div>
            <div className="text-xs text-slate-600 mt-1">{profile.spaceConfig?.grudgeSpaceName || (profile.role === 'gf' ? DEFAULT_GRUDGE_SPACE_NAME.gf : DEFAULT_GRUDGE_SPACE_NAME.bf)}</div>
          </div>
          <div className="text-center p-3 bg-amber-50 rounded-lg">
            <div className="text-2xl font-bold text-amber-600">{memories.length}</div>
            <div className="text-xs text-slate-600 mt-1">{profile.spaceConfig?.memorySpaceName || DEFAULT_MEMORY_SPACE_NAME}</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {grudges.filter(g => g.status === 'forgiven').length}
            </div>
            <div className="text-xs text-slate-600 mt-1">已原谅</div>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{calculateStorageSize()}</div>
            <div className="text-xs text-slate-600 mt-1">存储 (KB)</div>
          </div>
        </div>
      </div>
      
      {/* Data Management */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h3 className={`text-base font-bold ${themeColor} mb-4 flex items-center gap-2`}>
          <Settings size={18} />
          数据管理
        </h3>
        
        <div className="space-y-3">
          {/* Export */}
          <button
            onClick={handleExport}
            className="w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-lg">📤</span>
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-slate-800">导出数据</div>
                <div className="text-xs text-slate-500">备份到本地文件</div>
              </div>
            </div>
            <ChevronLeft size={18} className="text-slate-400 group-hover:text-slate-600 rotate-180" />
          </button>

          {/* Import */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-between p-4 bg-green-50 hover:bg-green-100 rounded-xl transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-lg">📥</span>
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-slate-800">导入数据</div>
                <div className="text-xs text-slate-500">从备份文件恢复</div>
              </div>
            </div>
            <ChevronLeft size={18} className="text-slate-400 group-hover:text-slate-600 rotate-180" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />

          {/* Clear */}
          <button
            onClick={handleClear}
            className="w-full flex items-center justify-between p-4 bg-red-50 hover:bg-red-100 rounded-xl transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-lg">🗑️</span>
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-slate-800">清空数据</div>
                <div className="text-xs text-red-500">⚠️ 危险操作，无法恢复</div>
              </div>
            </div>
            <ChevronLeft size={18} className="text-slate-400 group-hover:text-slate-600 rotate-180" />
          </button>
        </div>
      </div>
      
      {/* About */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-6 shadow-sm">
        <h3 className={`text-base font-bold ${themeColor} mb-4 flex items-center gap-2`}>
          <Heart size={18} />
          关于
        </h3>
        <div className="space-y-2 text-sm text-slate-600">
          <div className="flex justify-between py-2 border-b border-slate-200">
            <span>应用名称</span>
            <span className="font-medium text-slate-800">恋爱小本本</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-200">
            <span>版本</span>
            <span className="font-medium text-slate-800">v1.3.0</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-200">
            <span>数据存储</span>
            <span className="font-medium text-slate-800">本地离线</span>
          </div>
          <div className="flex justify-between py-2">
            <span>隐私保护</span>
            <span className="font-medium text-green-600">✓ 完全本地</span>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-white rounded-lg text-xs text-slate-500 text-center">
          💕 记录你们的点点滴滴
        </div>
      </div>
      
      {/* Role Switch Modal - 保留在外层 */}
      {showRoleSwitch && (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-slate-800 mb-4">选择新身份</h3>
            <div className="space-y-3 mb-6">
              <button
                onClick={() => handleRoleSwitch('gf')}
                className={`w-full p-4 rounded-xl border-2 transition-all ${
                  role === 'gf' 
                    ? 'border-love-500 bg-love-50' 
                    : 'border-slate-200 hover:border-love-300'
                }`}
              >
                <div className="text-3xl mb-2">👿</div>
                <div className="font-bold text-slate-800">女朋友</div>
                <div className="text-xs text-slate-500 mt-1">记住他的"罪行"</div>
              </button>
              <button
                onClick={() => handleRoleSwitch('bf')}
                className={`w-full p-4 rounded-xl border-2 transition-all ${
                  role === 'bf' 
                    ? 'border-cool-500 bg-cool-50' 
                    : 'border-slate-200 hover:border-cool-300'
                }`}
              >
                <div className="text-3xl mb-2">🛡️</div>
                <div className="font-bold text-slate-800">男朋友</div>
                <div className="text-xs text-slate-500 mt-1">记录生存日志</div>
              </button>
            </div>
            <button
              onClick={() => setShowRoleSwitch(false)}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-medium text-slate-700 transition-all"
            >
              取消
            </button>
          </div>
        </div>
      )}
      
      {/* Pairing Modals - 保留在外层 */}
      <PairInviteModal
        isOpen={showInviteModal}
        profile={profile}
        onClose={() => setShowInviteModal(false)}
      />

      <PairScanModal
        isOpen={showScanModal}
        profile={profile}
        onScanned={handleScanned}
        onClose={() => setShowScanModal(false)}
      />

      {scannedData && (
        <PairConfirmModal
          isOpen={showConfirmModal}
          profile={profile}
          inviteData={scannedData}
          onConfirm={handleConfirmPair}
          onClose={() => {
            setShowConfirmModal(false);
            setScannedData(null);
          }}
        />
      )}

      {/* Sync Modals - 保留在外层 */}
      <SyncQRModal
        isOpen={showSyncModal}
        profile={profile}
        grudges={grudges}
        memories={memories}
        onClose={() => setShowSyncModal(false)}
      />

      <ScanSyncModal
        isOpen={showScanSyncModal}
        profile={profile}
        onScanned={handleSyncScanned}
        onClose={() => setShowScanSyncModal(false)}
      />
      
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImport}
        className="hidden"
      />
    </div>
  );
};

// --- SearchOverlay Component ---

type SearchResultType = 'grudge' | 'memory';

interface SearchResult {
  id: string;
  type: SearchResultType;
  data: Grudge | Memory;
  score: number; // 相关度评分
}

const SearchOverlay = ({
  grudges,
  memories,
  onClose,
  onForgive,
  onDelete,
  onDeleteMemory,
  role
}: {
  grudges: Grudge[];
  memories: Memory[];
  onClose: () => void;
  onForgive: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteMemory: (id: string) => void;
  role: Role;
}) => {
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'grudge' | 'memory'>('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const themeColor = role === 'gf' ? 'text-love-500' : 'text-cool-500';
  const accentColor = role === 'gf' ? 'bg-love-500 hover:bg-love-600' : 'bg-cool-500 hover:bg-cool-600';

  // 搜索函数
  const performSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    const lowerQuery = searchQuery.toLowerCase().trim();
    const searchResults: SearchResult[] = [];

    // 搜索 Grudges
    if (filterType === 'all' || filterType === 'grudge') {
      grudges.forEach(grudge => {
        let score = 0;
        
        // 标题匹配 (权重最高)
        if (grudge.title.toLowerCase().includes(lowerQuery)) score += 10;
        
        // 描述匹配
        if (grudge.description.toLowerCase().includes(lowerQuery)) score += 5;
        
        // 标签匹配
        if (grudge.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) score += 7;
        
        // 惩罚匹配
        if (grudge.penalty.toLowerCase().includes(lowerQuery)) score += 3;

        if (score > 0) {
          searchResults.push({
            id: grudge.id,
            type: 'grudge',
            data: grudge,
            score
          });
        }
      });
    }

    // 搜索 Memories
    if (filterType === 'all' || filterType === 'memory') {
      memories.forEach(memory => {
        let score = 0;
        
        // 标题匹配
        if (memory.title.toLowerCase().includes(lowerQuery)) score += 10;
        
        // 描述匹配
        if (memory.description.toLowerCase().includes(lowerQuery)) score += 5;
        
        // 标签匹配
        if (memory.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) score += 7;
        
        // 心情匹配
        if (memory.feeling.toLowerCase().includes(lowerQuery)) score += 3;

        if (score > 0) {
          searchResults.push({
            id: memory.id,
            type: 'memory',
            data: memory,
            score
          });
        }
      });
    }

    // 按相关度排序
    searchResults.sort((a, b) => b.score - a.score);
    setResults(searchResults);
  };

  // 防抖搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, filterType, grudges, memories]);

  // 自动聚焦
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 高亮匹配文本
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === query.toLowerCase() 
        ? <mark key={index} className="bg-yellow-200 text-slate-800">{part}</mark>
        : part
    );
  };

  return (
    <motion.div 
      className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
      variants={searchOverlayVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <motion.div 
        className="max-w-md mx-auto h-full bg-white flex flex-col"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      >
        {/* Header */}
        <div className="flex-shrink-0 p-4 bg-white border-b border-slate-200">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={onClose}
              className="p-2 -ml-2 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-100"
            >
              <ChevronLeft size={24} />
            </button>
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="搜索标题、描述、标签..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 rounded-xl text-sm focus:ring-2 focus:ring-slate-300 outline-none transition-all"
              />
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`flex-1 py-2 px-4 rounded-lg text-xs font-medium transition-all ${
                filterType === 'all' 
                  ? `${accentColor} text-white` 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setFilterType('grudge')}
              className={`flex-1 py-2 px-4 rounded-lg text-xs font-medium transition-all ${
                filterType === 'grudge' 
                  ? 'bg-red-500 text-white' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              记仇 ({grudges.length})
            </button>
            <button
              onClick={() => setFilterType('memory')}
              className={`flex-1 py-2 px-4 rounded-lg text-xs font-medium transition-all ${
                filterType === 'memory' 
                  ? 'bg-amber-500 text-white' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              回忆 ({memories.length})
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {!query.trim() && (
            <div className="text-center py-20">
              <Search size={48} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-400 text-sm">输入关键词开始搜索</p>
              <p className="text-slate-300 text-xs mt-2">支持搜索标题、描述和标签</p>
            </div>
          )}

          {query.trim() && results.length === 0 && (
            <div className="text-center py-20">
              <AlertCircle size={48} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-400 text-sm">没有找到匹配的结果</p>
              <p className="text-slate-300 text-xs mt-2">试试其他关键词</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 mb-3">找到 {results.length} 条结果</p>
              {results.map(result => {
                if (result.type === 'grudge') {
                  const grudge = result.data as Grudge;
                  return (
                    <div key={grudge.id} className="bg-red-50 rounded-xl p-4 border border-red-100">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                            <h3 className="font-bold text-slate-800 text-sm">
                              {highlightText(grudge.title, query)}
                            </h3>
                          </div>
                          <p className="text-xs text-slate-500">
                            {new Date(grudge.date).toLocaleDateString('zh-CN')}
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          grudge.status === 'active' 
                            ? 'bg-red-100 text-red-600' 
                            : 'bg-green-100 text-green-600'
                        }`}>
                          {grudge.status === 'active' ? '未原谅' : '已原谅'}
                        </span>
                      </div>

                      {grudge.description && (
                        <p className="text-xs text-slate-600 mb-2">
                          {highlightText(grudge.description, query)}
                        </p>
                      )}

                      {grudge.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {grudge.tags.map(tag => (
                            <span key={tag} className="text-xs px-2 py-0.5 bg-white/60 text-red-600 rounded-full">
                              {highlightText(tag, query)}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2">
                        {grudge.status === 'active' && (
                          <button
                            onClick={() => onForgive(grudge.id)}
                            className="flex-1 py-2 px-3 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium transition-all"
                          >
                            原谅
                          </button>
                        )}
                        <button
                          onClick={() => onDelete(grudge.id)}
                          className="flex-1 py-2 px-3 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium transition-all"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  );
                } else {
                  const memory = result.data as Memory;
                  return (
                    <div key={memory.id} className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Sparkles size={14} className="text-amber-500 flex-shrink-0" />
                            <h3 className="font-bold text-slate-800 text-sm">
                              {highlightText(memory.title, query)}
                            </h3>
                          </div>
                          <p className="text-xs text-slate-500">
                            {new Date(memory.date).toLocaleDateString('zh-CN')}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Heart size={12} className="text-amber-400" fill="currentColor" />
                          <span className="text-xs font-bold text-amber-600">{memory.sweetness}</span>
                        </div>
                      </div>

                      {memory.description && (
                        <p className="text-xs text-slate-600 mb-2">
                          {highlightText(memory.description, query)}
                        </p>
                      )}

                      {memory.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {memory.tags.map(tag => (
                            <span key={tag} className="text-xs px-2 py-0.5 bg-white/60 text-amber-600 rounded-full">
                              {highlightText(tag, query)}
                            </span>
                          ))}
                        </div>
                      )}

                      <button
                        onClick={() => onDeleteMemory(memory.id)}
                        className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium transition-all"
                      >
                        删除
                      </button>
                    </div>
                  );
                }
              })}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

// --- Detail View Components ---

const GrudgeDetailView = ({
  grudge,
  onClose,
  onForgive,
  onDelete,
  onUpdatePrivacy,
  role,
  profile
}: {
  grudge: Grudge;
  onClose: () => void;
  onForgive: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdatePrivacy: (id: string, isPrivate: boolean) => void;
  role: Role;
  profile: UserProfile;
}) => {
  const isForgiven = grudge.status === 'forgiven';
  const accentColor = role === 'gf' ? 'bg-love-500' : 'bg-cool-500';
  const textColor = role === 'gf' ? 'text-love-500' : 'text-cool-500';
  
  const getMoodEmoji = (moodType: MoodType) => {
    const moodOption = MOOD_OPTIONS.find(m => m.type === moodType);
    return moodOption ? moodOption.emoji : '😤';
  };

  const handleForgive = () => {
    onForgive(grudge.id);
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm('确定要删除这条记录吗？')) {
      onDelete(grudge.id);
      onClose();
    }
  };

  return (
    <motion.div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-white rounded-3xl max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl"
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`${isForgiven ? 'bg-green-50' : 'bg-red-50'} p-6 relative`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/50 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
          
          <div className="flex items-start gap-4 pr-10">
            <span className="text-5xl">{getMoodEmoji(grudge.moodType || '愤怒')}</span>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">{grudge.title}</h2>
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                <Calendar size={14} />
                <span>{new Date(grudge.date).toLocaleString('zh-CN')}</span>
              </div>
              {/* 作者信息 */}
              {(() => {
                const author = getAuthorLabel(grudge, profile);
                return (
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                    author.isMine ? 'bg-indigo-100 text-indigo-700' : 'bg-rose-100 text-rose-700'
                  }`}>
                    <span>{author.emoji}</span>
                    <span>{author.text}</span>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Severity */}
          {!isForgiven && (
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-600">生气程度</span>
                <span className="text-sm font-bold text-red-600">{grudge.severity}%</span>
              </div>
              <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-400 to-red-500"
                  style={{ width: `${grudge.severity}%` }}
                />
              </div>
            </div>
          )}

          {isForgiven && (
            <div className="mt-4 p-3 bg-green-100 rounded-lg text-center">
              <span className="text-green-600 font-medium">✓ 已原谅</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Description */}
          {grudge.description && (
            <div>
              <h3 className="text-sm font-bold text-slate-600 mb-2">详细描述</h3>
              <p className="text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl">
                {grudge.description}
              </p>
            </div>
          )}

          {/* Tags */}
          {grudge.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-600 mb-2">标签</h3>
              <div className="flex flex-wrap gap-2">
                {grudge.tags.map(tag => (
                  <span key={tag} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Penalty */}
          {grudge.penalty && (
            <div>
              <h3 className="text-sm font-bold text-slate-600 mb-2">⚖️ 惩罚措施</h3>
              <p className="text-slate-700 bg-amber-50 p-4 rounded-xl border border-amber-100">
                {grudge.penalty}
              </p>
            </div>
          )}

          {/* Photos */}
          {grudge.photos && grudge.photos.length > 0 && (
            <PhotoGallery 
              photoIds={grudge.photos} 
              onPhotoClick={(index) => {
                const viewerDiv = document.createElement('div');
                viewerDiv.id = 'photo-viewer-root';
                document.body.appendChild(viewerDiv);
                const root = createRoot(viewerDiv);
                root.render(
                  <PhotoViewer
                    photoIds={grudge.photos!}
                    initialIndex={index}
                    onClose={() => {
                      root.unmount();
                      document.body.removeChild(viewerDiv);
                    }}
                  />
                );
              }}
            />
          )}

          {/* Privacy Toggle */}
          <div className="border-t border-slate-200 pt-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={grudge.isPrivate || false}
                onChange={(e) => onUpdatePrivacy(grudge.id, e.target.checked)}
                className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-700">🔒 私密条目</div>
                <div className="text-xs text-slate-500">私密条目不会在同步时分享给对方</div>
              </div>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 pt-0 flex gap-3">
          {!isForgiven && (
            <button
              onClick={handleForgive}
              className={`flex-1 ${accentColor} text-white py-3 rounded-xl font-medium hover:opacity-90 transition-opacity`}
            >
              原谅 TA
            </button>
          )}
          <button
            onClick={handleDelete}
            className="px-6 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors"
          >
            删除
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const MemoryDetailView = ({
  memory,
  onClose,
  onDelete,
  onUpdatePrivacy,
  role,
  profile
}: {
  memory: Memory;
  onClose: () => void;
  onDelete: (id: string) => void;
  onUpdatePrivacy: (id: string, isPrivate: boolean) => void;
  role: Role;
  profile: UserProfile;
}) => {
  const bgColor = role === 'gf' ? 'bg-love-50' : 'bg-cool-50';
  const textColor = role === 'gf' ? 'text-love-500' : 'text-cool-500';

  const handleDelete = () => {
    if (window.confirm('确定要删除这条美好回忆吗？')) {
      onDelete(memory.id);
      onClose();
    }
  };

  return (
    <motion.div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-white rounded-3xl max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl"
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/50 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
          
          <div className="pr-10">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={24} className="text-amber-500" />
              <h2 className="text-2xl font-bold text-slate-800">{memory.title}</h2>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
              <Calendar size={14} />
              <span>{new Date(memory.date).toLocaleDateString('zh-CN')}</span>
              <Clock size={14} className="ml-2" />
              <span>{new Date(memory.date).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            {/* 作者信息 */}
            {(() => {
              const author = getAuthorLabel(memory, profile);
              return (
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                  author.isMine ? 'bg-indigo-100 text-indigo-700' : 'bg-rose-100 text-rose-700'
                }`}>
                  <span>{author.emoji}</span>
                  <span>{author.text}</span>
                </div>
              );
            })()}
          </div>

          {/* Sweetness */}
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-slate-600">甜蜜度</span>
              <div className="flex items-center gap-1">
                <Heart size={14} className="text-amber-400" fill="currentColor" />
                <span className="text-sm font-bold text-amber-600">{memory.sweetness}</span>
              </div>
            </div>
            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-300 to-orange-400"
                style={{ width: `${memory.sweetness}%` }}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Description */}
          {memory.description && (
            <div>
              <h3 className="text-sm font-bold text-slate-600 mb-2">详细描述</h3>
              <p className="text-slate-700 leading-relaxed bg-amber-50/50 p-4 rounded-xl">
                {memory.description}
              </p>
            </div>
          )}

          {/* Feeling */}
          {memory.feeling && (
            <div>
              <h3 className="text-sm font-bold text-slate-600 mb-2">💭 当时心情</h3>
              <p className="text-slate-700 bg-blue-50 p-4 rounded-xl border border-blue-100">
                {memory.feeling}
              </p>
            </div>
          )}

          {/* Tags */}
          {memory.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-600 mb-2">标签</h3>
              <div className="flex flex-wrap gap-2">
                {memory.tags.map(tag => (
                  <span key={tag} className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm border border-amber-200">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Photos */}
          {memory.photos && memory.photos.length > 0 && (
            <PhotoGallery 
              photoIds={memory.photos} 
              onPhotoClick={(index) => {
                const viewerDiv = document.createElement('div');
                viewerDiv.id = 'photo-viewer-root';
                document.body.appendChild(viewerDiv);
                const root = createRoot(viewerDiv);
                root.render(
                  <PhotoViewer
                    photoIds={memory.photos!}
                    initialIndex={index}
                    onClose={() => {
                      root.unmount();
                      document.body.removeChild(viewerDiv);
                    }}
                  />
                );
              }}
            />
          )}

          {/* Privacy Toggle */}
          <div className="border-t border-slate-200 pt-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={memory.isPrivate || false}
                onChange={(e) => onUpdatePrivacy(memory.id, e.target.checked)}
                className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-700">🔒 私密回忆</div>
                <div className="text-xs text-slate-500">私密回忆不会在同步时分享给对方</div>
              </div>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 pt-0">
          <button
            onClick={handleDelete}
            className="w-full py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors"
          >
            删除回忆
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);