/**
 * 动画配置文件
 * 集中管理所有动画变体和配置,便于维护和统一风格
 */

// 页面切换动画变体 - 升级为弹簧物理效果
export const pageVariants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
      mass: 0.8,
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

// 不同页面的专用切换动画
export const homePageVariants = {
  initial: { opacity: 0, y: 30 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
      mass: 0.8,
    },
  },
  exit: { opacity: 0, y: -20, transition: { duration: 0.2 } },
};

export const statsPageVariants = {
  initial: { opacity: 0, y: -30 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
      mass: 0.8,
    },
  },
  exit: { opacity: 0, y: 20, transition: { duration: 0.2 } },
};

export const settingsPageVariants = {
  initial: { opacity: 0, x: 30 },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
      mass: 0.8,
    },
  },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2 } },
};

// 卡片列表交错动画
export const listContainerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08, // 每个子项延迟 80ms
      delayChildren: 0.05,
    },
  },
};

export const listItemVariants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.95,
  },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: {
      duration: 0.2,
    },
  },
};

// 按钮点击动画
export const buttonTapAnimation = {
  scale: 0.95,
  transition: {
    type: 'spring',
    stiffness: 400,
    damping: 17,
  },
};

// FAB 按钮脉冲动画
export const fabPulseVariants = {
  initial: { scale: 1 },
  pulse: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// 模态框/表单从底部弹出
export const modalVariants = {
  hidden: {
    y: '100%',
    opacity: 0,
  },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      damping: 25,
      stiffness: 200,
    },
  },
  exit: {
    y: '100%',
    opacity: 0,
    transition: {
      duration: 0.2,
    },
  },
};

// 数字滚动动画配置
export const counterAnimation = {
  duration: 1.5,
  ease: 'easeOut',
};

// 进度条填充动画
export const progressBarVariants = {
  initial: { width: 0 },
  animate: (width: number) => ({
    width: `${width}%`,
    transition: {
      duration: 1,
      ease: 'easeOut',
    },
  }),
};

// 圆形进度条动画 (SVG strokeDashoffset)
export const circularProgressVariants = {
  initial: { strokeDashoffset: 352 }, // 2 * π * 56
  animate: (progress: number) => ({
    strokeDashoffset: 352 * (1 - progress / 100),
    transition: {
      duration: 1.5,
      ease: 'easeOut',
    },
  }),
};

// 标签选择动画
export const tagVariants = {
  initial: { scale: 1 },
  selected: {
    scale: 1.05,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 17,
    },
  },
  tap: { scale: 0.95 },
};

// 卡片交互微动效 - 完整升级版
export const cardInteractionVariants = {
  initial: { 
    scale: 1,
    y: 0,
  },
  // 悬停效果（桌面端）
  hover: {
    y: -2,
    scale: 1.01,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 25,
    },
  },
  // 点击/按压效果
  tap: {
    scale: 0.98,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 30,
    },
  },
  // 长按抖动提示
  longPress: {
    rotate: [0, -1, 1, -1, 1, 0],
    transition: {
      duration: 0.4,
      ease: 'easeInOut',
    },
  },
};

// 按钮交互增强版
export const buttonInteractionVariants = {
  initial: { scale: 1 },
  hover: {
    scale: 1.05,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 25,
    },
  },
  tap: {
    scale: 0.95,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 30,
    },
  },
};

// 原谅操作特效 - 增强版
export const forgiveAnimationVariants = {
  initial: { scale: 1, opacity: 1, x: 0 },
  forgive: {
    scale: [1, 1.1, 0.95, 0],
    opacity: [1, 1, 0.8, 0],
    x: [0, 0, 0, 100],
    transition: {
      duration: 0.6,
      times: [0, 0.2, 0.5, 1],
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

// 删除操作滑出动画
export const deleteAnimationVariants = {
  initial: { scale: 1, opacity: 1, x: 0 },
  delete: {
    scale: [1, 0.95, 0.9],
    opacity: [1, 0.8, 0],
    x: [0, -20, -100],
    transition: {
      duration: 0.4,
      times: [0, 0.3, 1],
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

// 滑动操作背景渐变反馈
export const swipeBackgroundVariants = {
  initial: { opacity: 0 },
  swipeRight: {
    opacity: 1,
    backgroundColor: 'rgba(52, 211, 153, 0.2)', // success green
    transition: { duration: 0.2 },
  },
  swipeLeft: {
    opacity: 1,
    backgroundColor: 'rgba(248, 113, 113, 0.2)', // danger red
    transition: { duration: 0.2 },
  },
};

// 删除操作晃动提醒
export const shakeVariants = {
  shake: {
    x: [0, -10, 10, -10, 10, 0],
    transition: {
      duration: 0.5,
    },
  },
};

// 空状态动画
export const emptyStateVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: 'easeOut',
    },
  },
};

// 搜索叠加层动画
export const searchOverlayVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.2,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.15,
    },
  },
};

// 背景粒子动画 (轻量级版本)
export const particleVariants = {
  float: {
    y: [0, -20, 0],
    x: [0, 10, 0],
    opacity: [0.3, 0.6, 0.3],
    transition: {
      duration: 6,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// 心跳动画 (用于愤怒值图标)
export const heartbeatVariants = {
  beat: {
    scale: [1, 1.2, 1],
    transition: {
      duration: 0.6,
      repeat: Infinity,
      repeatDelay: 0.4,
    },
  },
};

// 成功反馈动画（爆炸粒子效果的基础）
export const successFeedbackVariants = {
  initial: { scale: 0, opacity: 0 },
  animate: {
    scale: [0, 1.2, 1],
    opacity: [0, 1, 1],
    transition: {
      duration: 0.5,
      times: [0, 0.6, 1],
      ease: 'easeOut',
    },
  },
  exit: {
    scale: 1.5,
    opacity: 0,
    transition: { duration: 0.3 },
  },
};

// 添加操作成功从底部弹入
export const addSuccessVariants = {
  initial: { y: 100, opacity: 0, scale: 0.9 },
  animate: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 350,
      damping: 25,
      mass: 0.8,
    },
  },
};

// 弹簧配置预设
export const springConfigs = {
  gentle: {
    type: 'spring' as const,
    stiffness: 120,
    damping: 14,
  },
  snappy: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 25,
  },
  bouncy: {
    type: 'spring' as const,
    stiffness: 300,
    damping: 10,
  },
};

// 过渡配置预设
export const transitionPresets = {
  fast: {
    duration: 0.2,
    ease: [0.4, 0, 0.2, 1],
  },
  normal: {
    duration: 0.3,
    ease: [0.4, 0, 0.2, 1],
  },
  slow: {
    duration: 0.5,
    ease: [0.4, 0, 0.2, 1],
  },
};

// 检测用户是否偏好减少动画
export const shouldReduceMotion = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// 获取适配后的动画配置
export const getAdaptiveTransition = (transition: any) => {
  if (shouldReduceMotion()) {
    return { duration: 0.01 }; // 几乎瞬间完成
  }
  return transition;
};
