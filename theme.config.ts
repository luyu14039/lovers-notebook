/**
 * 主题配置文件
 * 为第二阶段的个性化功能预留接口
 * 包括：深色模式、自定义主题、字体大小等
 */

// 主题模式类型
export type ThemeMode = 'light' | 'dark' | 'auto';

// 主题色预设
export type ThemeColor = 'pink' | 'blue' | 'purple' | 'green' | 'orange' | 'red' | 'cyan' | 'gold';

// 字体大小档位
export type FontSize = 'small' | 'normal' | 'large' | 'extra-large';

// 主题配置接口
export interface ThemeConfig {
  mode: ThemeMode;
  color: ThemeColor;
  fontSize: FontSize;
  enableAnimations: boolean;
  enableSounds: boolean;
  customBackground?: string;
  backgroundOpacity: number;
}

// 默认主题配置
export const defaultThemeConfig: ThemeConfig = {
  mode: 'light',
  color: 'pink', // 女友默认粉色
  fontSize: 'normal',
  enableAnimations: true,
  enableSounds: false,
  backgroundOpacity: 0,
};

// 主题色配置映射
export const themeColors: Record<ThemeColor, {
  light: {
    primary: string;
    secondary: string;
    gradient: string;
  };
  dark: {
    primary: string;
    secondary: string;
    gradient: string;
  };
}> = {
  pink: {
    light: {
      primary: '#f472b6',
      secondary: '#ff6b9d',
      gradient: 'linear-gradient(135deg, #fb7185 0%, #f43f5e 50%, #ec4899 100%)',
    },
    dark: {
      primary: '#ff6ba9',
      secondary: '#ff8dc7',
      gradient: 'linear-gradient(135deg, #ff6ba9 0%, #ff8dc7 50%, #ffa8d5 100%)',
    },
  },
  blue: {
    light: {
      primary: '#3b82f6',
      secondary: '#22d3ee',
      gradient: 'linear-gradient(135deg, #22d3ee 0%, #0ea5e9 50%, #3b82f6 100%)',
    },
    dark: {
      primary: '#00d4ff',
      secondary: '#60a5fa',
      gradient: 'linear-gradient(135deg, #00d4ff 0%, #3b82f6 50%, #60a5fa 100%)',
    },
  },
  purple: {
    light: {
      primary: '#a855f7',
      secondary: '#c084fc',
      gradient: 'linear-gradient(135deg, #c084fc 0%, #a855f7 50%, #9333ea 100%)',
    },
    dark: {
      primary: '#c084fc',
      secondary: '#d8b4fe',
      gradient: 'linear-gradient(135deg, #d8b4fe 0%, #c084fc 50%, #a855f7 100%)',
    },
  },
  green: {
    light: {
      primary: '#10b981',
      secondary: '#34d399',
      gradient: 'linear-gradient(135deg, #34d399 0%, #10b981 50%, #059669 100%)',
    },
    dark: {
      primary: '#34d399',
      secondary: '#6ee7b7',
      gradient: 'linear-gradient(135deg, #6ee7b7 0%, #34d399 50%, #10b981 100%)',
    },
  },
  orange: {
    light: {
      primary: '#f97316',
      secondary: '#fb923c',
      gradient: 'linear-gradient(135deg, #fb923c 0%, #f97316 50%, #ea580c 100%)',
    },
    dark: {
      primary: '#fb923c',
      secondary: '#fdba74',
      gradient: 'linear-gradient(135deg, #fdba74 0%, #fb923c 50%, #f97316 100%)',
    },
  },
  red: {
    light: {
      primary: '#ef4444',
      secondary: '#f87171',
      gradient: 'linear-gradient(135deg, #f87171 0%, #ef4444 50%, #dc2626 100%)',
    },
    dark: {
      primary: '#f87171',
      secondary: '#fca5a5',
      gradient: 'linear-gradient(135deg, #fca5a5 0%, #f87171 50%, #ef4444 100%)',
    },
  },
  cyan: {
    light: {
      primary: '#06b6d4',
      secondary: '#22d3ee',
      gradient: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 50%, #0891b2 100%)',
    },
    dark: {
      primary: '#22d3ee',
      secondary: '#67e8f9',
      gradient: 'linear-gradient(135deg, #67e8f9 0%, #22d3ee 50%, #06b6d4 100%)',
    },
  },
  gold: {
    light: {
      primary: '#f59e0b',
      secondary: '#fbbf24',
      gradient: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)',
    },
    dark: {
      primary: '#fbbf24',
      secondary: '#fcd34d',
      gradient: 'linear-gradient(135deg, #fcd34d 0%, #fbbf24 50%, #f59e0b 100%)',
    },
  },
};

// 字体大小配置
export const fontSizeConfig: Record<FontSize, {
  base: string;
  small: string;
  large: string;
  heading: string;
}> = {
  small: {
    base: '14px',
    small: '12px',
    large: '16px',
    heading: '20px',
  },
  normal: {
    base: '16px',
    small: '14px',
    large: '18px',
    heading: '24px',
  },
  large: {
    base: '18px',
    small: '16px',
    large: '20px',
    heading: '28px',
  },
  'extra-large': {
    base: '20px',
    small: '18px',
    large: '22px',
    heading: '32px',
  },
};

// 深色模式配色方案
export const darkModeColors = {
  background: '#1A1A2E',
  surface: '#16213E',
  text: {
    primary: '#E0E0E0',
    secondary: '#A0A0A0',
    tertiary: '#707070',
  },
  border: '#2A2A3E',
};

// 主题工具函数

/**
 * 获取当前主题配置
 */
export const getCurrentTheme = (): ThemeConfig => {
  if (typeof window === 'undefined') return defaultThemeConfig;
  
  const saved = localStorage.getItem('theme_config');
  if (saved) {
    try {
      return { ...defaultThemeConfig, ...JSON.parse(saved) };
    } catch {
      return defaultThemeConfig;
    }
  }
  return defaultThemeConfig;
};

/**
 * 保存主题配置
 */
export const saveThemeConfig = (config: Partial<ThemeConfig>): void => {
  if (typeof window === 'undefined') return;
  
  const current = getCurrentTheme();
  const updated = { ...current, ...config };
  localStorage.setItem('theme_config', JSON.stringify(updated));
  
  // 触发主题更新事件（用于组件响应）
  window.dispatchEvent(new CustomEvent('theme-change', { detail: updated }));
};

/**
 * 检测系统主题偏好
 */
export const getSystemThemePreference = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

/**
 * 获取实际应用的主题模式
 */
export const getEffectiveThemeMode = (config: ThemeConfig): 'light' | 'dark' => {
  if (config.mode === 'auto') {
    return getSystemThemePreference();
  }
  return config.mode;
};

/**
 * 应用主题到DOM
 * @param config 主题配置
 */
export const applyTheme = (config: ThemeConfig): void => {
  if (typeof window === 'undefined') return;
  
  const mode = getEffectiveThemeMode(config);
  const root = document.documentElement;
  
  // 设置主题模式类
  root.classList.remove('light', 'dark');
  root.classList.add(mode);
  
  // 设置主题色变量
  const colorScheme = themeColors[config.color][mode];
  root.style.setProperty('--theme-primary', colorScheme.primary);
  root.style.setProperty('--theme-secondary', colorScheme.secondary);
  root.style.setProperty('--theme-gradient', colorScheme.gradient);
  
  // 设置字体大小
  const fontSize = fontSizeConfig[config.fontSize];
  root.style.setProperty('--font-size-base', fontSize.base);
  root.style.setProperty('--font-size-small', fontSize.small);
  root.style.setProperty('--font-size-large', fontSize.large);
  root.style.setProperty('--font-size-heading', fontSize.heading);
  
  // 设置背景透明度
  root.style.setProperty('--background-opacity', config.backgroundOpacity.toString());
  
  // 设置自定义背景
  if (config.customBackground) {
    root.style.setProperty('--custom-background', `url(${config.customBackground})`);
  }
};

/**
 * 初始化主题系统
 */
export const initThemeSystem = (): void => {
  if (typeof window === 'undefined') return;
  
  const config = getCurrentTheme();
  applyTheme(config);
  
  // 监听系统主题变化（auto模式下）
  if (config.mode === 'auto') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      applyTheme(config);
    });
  }
};

// 导出类型和默认配置
export default {
  defaultThemeConfig,
  themeColors,
  fontSizeConfig,
  darkModeColors,
  getCurrentTheme,
  saveThemeConfig,
  getSystemThemePreference,
  getEffectiveThemeMode,
  applyTheme,
  initThemeSystem,
};
