/**
 * 第二阶段功能接口配置
 * 为信息架构优化和个性化功能预留接口
 */

// ========== 首页布局配置 ==========

/**
 * 头部配置接口
 */
export interface HeaderConfig {
  showAvatar: boolean;
  showNickname: boolean;
  showRoleTag: boolean;
  showAngerMeter: boolean;
  showSearchIcon: boolean;
  showPairingStatus: boolean;
  showDaysCounter: boolean; // 在一起X天
}

export const defaultHeaderConfig: HeaderConfig = {
  showAvatar: false, // 第二阶段启用
  showNickname: false, // 第二阶段启用
  showRoleTag: false, // 第二阶段启用
  showAngerMeter: true,
  showSearchIcon: true,
  showPairingStatus: false, // 第二阶段启用
  showDaysCounter: false, // 第二阶段启用
};

/**
 * 列表显示配置
 */
export interface ListDisplayConfig {
  groupByDate: boolean; // 按日期分组
  enableVirtualScroll: boolean; // 虚拟滚动
  itemsPerPage: number;
  showLoadMore: boolean;
}

export const defaultListDisplayConfig: ListDisplayConfig = {
  groupByDate: false, // 第二阶段启用
  enableVirtualScroll: false, // 第二阶段启用
  itemsPerPage: 20,
  showLoadMore: true,
};

/**
 * FAB 配置
 */
export interface FABConfig {
  enableMultiButton: boolean; // 多按钮菜单
  showMemoryButton: boolean; // 添加回忆快捷键
  showCameraButton: boolean; // 快速拍照
}

export const defaultFABConfig: FABConfig = {
  enableMultiButton: false, // 第二阶段启用
  showMemoryButton: false, // 第二阶段启用
  showCameraButton: false, // 第二阶段启用
};

// ========== 统计页面配置 ==========

/**
 * 和谐度显示配置
 */
export interface HarmonyDisplayConfig {
  use3DRing: boolean; // 3D圆环效果
  showAnimatedEmoji: boolean; // 动态表情
  enableParticleEffect: boolean; // 粒子效果
}

export const defaultHarmonyDisplayConfig: HarmonyDisplayConfig = {
  use3DRing: false, // 第二阶段启用
  showAnimatedEmoji: false, // 第二阶段启用
  enableParticleEffect: false, // 第二阶段启用
};

/**
 * 图表配置
 */
export interface ChartConfig {
  useGradientFill: boolean; // 渐变填充
  enableInteraction: boolean; // 交互详情
  showDateLabels: boolean; // 优化日期标签
  animateOnLoad: boolean; // 加载动画
}

export const defaultChartConfig: ChartConfig = {
  useGradientFill: false, // 第二阶段启用
  enableInteraction: false, // 第二阶段启用
  showDateLabels: false, // 第二阶段启用
  animateOnLoad: true,
};

/**
 * 成就墙配置
 */
export interface AchievementConfig {
  useMasonryLayout: boolean; // 瀑布流布局
  showRaritySize: boolean; // 稀有度影响大小
  enableDetailModal: boolean; // 详情弹窗
  showUnlockTime: boolean; // 解锁时间
}

export const defaultAchievementConfig: AchievementConfig = {
  useMasonryLayout: false, // 第二阶段启用
  showRaritySize: false, // 第二阶段启用
  enableDetailModal: false, // 第二阶段启用
  showUnlockTime: false, // 第二阶段启用
};

// ========== 设置页面配置 ==========

/**
 * 设置页面布局
 */
export interface SettingsLayoutConfig {
  useAccordion: boolean; // 折叠面板
  sections: {
    profile: boolean; // 个人信息
    pairing: boolean; // 配对管理
    data: boolean; // 数据管理
    privacy: boolean; // 隐私与安全
    about: boolean; // 关于
  };
}

export const defaultSettingsLayoutConfig: SettingsLayoutConfig = {
  useAccordion: false, // 第二阶段启用
  sections: {
    profile: true,
    pairing: true,
    data: true,
    privacy: false, // 第二阶段启用
    about: true,
  },
};

/**
 * 配对流程配置
 */
export interface PairingFlowConfig {
  showGuideAnimation: boolean; // 引导动画
  enableScanAnimation: boolean; // 扫码动画
  showSuccessCelebration: boolean; // 成功庆祝
}

export const defaultPairingFlowConfig: PairingFlowConfig = {
  showGuideAnimation: false, // 第二阶段启用
  enableScanAnimation: false, // 第二阶段启用
  showSuccessCelebration: false, // 第二阶段启用
};

/**
 * 数据导出配置
 */
export interface DataExportConfig {
  showPreview: boolean; // 导出预览
  formats: ('json' | 'csv' | 'pdf')[];
  enableShare: boolean; // 分享功能
}

export const defaultDataExportConfig: DataExportConfig = {
  showPreview: false, // 第二阶段启用
  formats: ['json'],
  enableShare: false, // 第二阶段启用
};

// ========== 个性化功能配置 ==========

/**
 * 自定义标签配置
 */
export interface CustomTagsConfig {
  enabled: boolean;
  maxCustomTags: number;
  allowEmoji: boolean;
  allowColorCustomization: boolean;
}

export const defaultCustomTagsConfig: CustomTagsConfig = {
  enabled: false, // 第二阶段启用
  maxCustomTags: 10,
  allowEmoji: true,
  allowColorCustomization: true,
};

/**
 * 节日彩蛋配置
 */
export interface HolidayEasterEggConfig {
  enabled: boolean;
  valentinesDay: boolean; // 情人节
  qixi: boolean; // 七夕
  anniversary: boolean; // 纪念日
  birthday: boolean; // 生日
}

export const defaultHolidayEasterEggConfig: HolidayEasterEggConfig = {
  enabled: false, // 第二阶段启用
  valentinesDay: true,
  qixi: true,
  anniversary: true,
  birthday: true,
};

/**
 * 声音反馈配置
 */
export interface SoundFeedbackConfig {
  enabled: boolean;
  addRecord: string | null;
  forgive: string | null;
  delete: string | null;
  achievement: string | null;
}

export const defaultSoundFeedbackConfig: SoundFeedbackConfig = {
  enabled: false, // 第二阶段启用
  addRecord: null,
  forgive: null,
  delete: null,
  achievement: null,
};

// ========== 性能优化配置 ==========

/**
 * 性能优化选项
 */
export interface PerformanceConfig {
  enableCodeSplitting: boolean;
  lazyLoadImages: boolean;
  cacheChartData: boolean;
  enableServiceWorker: boolean;
}

export const defaultPerformanceConfig: PerformanceConfig = {
  enableCodeSplitting: false, // 第二阶段启用
  lazyLoadImages: false, // 第二阶段启用
  cacheChartData: false, // 第二阶段启用
  enableServiceWorker: false, // 第二阶段启用
};

// ========== 功能开关总配置 ==========

/**
 * 第二阶段功能总开关
 */
export interface Phase2Features {
  // 首页功能
  enhancedHeader: boolean;
  dateGrouping: boolean;
  virtualScroll: boolean;
  multiFAB: boolean;
  
  // 统计页面功能
  enhanced3DHarmony: boolean;
  interactiveCharts: boolean;
  masonryAchievements: boolean;
  
  // 设置页面功能
  accordionSettings: boolean;
  enhancedPairing: boolean;
  advancedExport: boolean;
  
  // 个性化功能
  customTheme: boolean;
  customTags: boolean;
  holidayEasterEggs: boolean;
  soundEffects: boolean;
  
  // 性能优化
  performanceOptimizations: boolean;
}

export const defaultPhase2Features: Phase2Features = {
  // 所有第二阶段功能默认关闭
  enhancedHeader: false,
  dateGrouping: false,
  virtualScroll: false,
  multiFAB: false,
  
  enhanced3DHarmony: false,
  interactiveCharts: false,
  masonryAchievements: false,
  
  accordionSettings: false,
  enhancedPairing: false,
  advancedExport: false,
  
  customTheme: false,
  customTags: false,
  holidayEasterEggs: false,
  soundEffects: false,
  
  performanceOptimizations: false,
};

// ========== 功能工具函数 ==========

/**
 * 检查功能是否启用
 */
export const isFeatureEnabled = (feature: keyof Phase2Features): boolean => {
  if (typeof window === 'undefined') return false;
  
  const saved = localStorage.getItem('phase2_features');
  if (saved) {
    try {
      const features = JSON.parse(saved) as Phase2Features;
      return features[feature] || false;
    } catch {
      return false;
    }
  }
  return defaultPhase2Features[feature];
};

/**
 * 启用/禁用功能
 */
export const toggleFeature = (feature: keyof Phase2Features, enabled: boolean): void => {
  if (typeof window === 'undefined') return;
  
  const saved = localStorage.getItem('phase2_features');
  const current = saved ? JSON.parse(saved) : defaultPhase2Features;
  const updated = { ...current, [feature]: enabled };
  
  localStorage.setItem('phase2_features', JSON.stringify(updated));
  
  // 触发功能更新事件
  window.dispatchEvent(new CustomEvent('feature-toggle', { 
    detail: { feature, enabled } 
  }));
};

/**
 * 批量启用第二阶段功能
 */
export const enablePhase2Features = (features: Partial<Phase2Features>): void => {
  if (typeof window === 'undefined') return;
  
  const saved = localStorage.getItem('phase2_features');
  const current = saved ? JSON.parse(saved) : defaultPhase2Features;
  const updated = { ...current, ...features };
  
  localStorage.setItem('phase2_features', JSON.stringify(updated));
  
  // 触发批量更新事件
  window.dispatchEvent(new CustomEvent('features-batch-update', { 
    detail: updated 
  }));
};

// 导出所有配置
export default {
  // 默认配置
  defaultHeaderConfig,
  defaultListDisplayConfig,
  defaultFABConfig,
  defaultHarmonyDisplayConfig,
  defaultChartConfig,
  defaultAchievementConfig,
  defaultSettingsLayoutConfig,
  defaultPairingFlowConfig,
  defaultDataExportConfig,
  defaultCustomTagsConfig,
  defaultHolidayEasterEggConfig,
  defaultSoundFeedbackConfig,
  defaultPerformanceConfig,
  defaultPhase2Features,
  
  // 工具函数
  isFeatureEnabled,
  toggleFeature,
  enablePhase2Features,
};
