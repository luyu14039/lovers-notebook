/**
 * 骨架屏加载组件
 * 用于列表、卡片、统计数据的加载状态展示
 */

import React from 'react';
import { motion } from 'framer-motion';

// 骨架屏样式组件（使用CSS动画实现闪烁效果）
const SkeletonBox: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 ${className}`}
    style={{
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite linear',
    }}
  />
);

// 卡片骨架屏
export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="space-y-3 px-4">
      {Array.from({ length: count }).map((_, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="bg-white rounded-xl p-4 shadow-level-1"
        >
          {/* 顶部：表情和类型 */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <SkeletonBox className="w-10 h-10 rounded-full" />
              <SkeletonBox className="w-16 h-5 rounded" />
            </div>
            <SkeletonBox className="w-20 h-6 rounded-full" />
          </div>

          {/* 标题 */}
          <SkeletonBox className="w-3/4 h-6 rounded mb-2" />

          {/* 描述文字 */}
          <SkeletonBox className="w-full h-4 rounded mb-1" />
          <SkeletonBox className="w-5/6 h-4 rounded" />

          {/* 底部：日期和按钮 */}
          <div className="flex items-center justify-between mt-3">
            <SkeletonBox className="w-24 h-4 rounded" />
            <div className="flex space-x-2">
              <SkeletonBox className="w-8 h-8 rounded-full" />
              <SkeletonBox className="w-8 h-8 rounded-full" />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

// 统计卡片骨架屏
export const StatsSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 px-4">
      {/* 和谐度圆环骨架 */}
      <div className="bg-white rounded-xl p-6 shadow-level-1">
        <SkeletonBox className="w-32 h-32 rounded-full mx-auto" />
        <SkeletonBox className="w-24 h-6 rounded mx-auto mt-4" />
      </div>

      {/* 统计卡片组 */}
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-xl p-4 shadow-level-1"
          >
            <SkeletonBox className="w-8 h-8 rounded-full mx-auto" />
            <SkeletonBox className="w-12 h-8 rounded mx-auto mt-2" />
            <SkeletonBox className="w-16 h-4 rounded mx-auto mt-2" />
          </motion.div>
        ))}
      </div>

      {/* 图表骨架 */}
      <div className="bg-white rounded-xl p-6 shadow-level-1">
        <SkeletonBox className="w-32 h-6 rounded mb-4" />
        <SkeletonBox className="w-full h-48 rounded" />
      </div>
    </div>
  );
};

// 成就网格骨架屏
export const AchievementsSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-3 gap-3 px-4">
      {Array.from({ length: 9 }).map((_, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.05 }}
          className="bg-white rounded-xl p-3 shadow-level-1 aspect-square flex flex-col items-center justify-center"
        >
          <SkeletonBox className="w-12 h-12 rounded-full" />
          <SkeletonBox className="w-16 h-3 rounded mt-2" />
        </motion.div>
      ))}
    </div>
  );
};

// 通用加载指示器（心形跳动）
export const HeartLoader: React.FC<{ size?: 'sm' | 'md' | 'lg'; color?: string }> = ({
  size = 'md',
  color = '#f472b6',
}) => {
  const sizeClasses = {
    sm: 'text-2xl',
    md: 'text-4xl',
    lg: 'text-6xl',
  };

  return (
    <motion.div
      animate={{
        scale: [1, 1.2, 1],
      }}
      transition={{
        duration: 0.8,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      className={`${sizeClasses[size]} flex items-center justify-center`}
      style={{ color }}
    >
      ❤️
    </motion.div>
  );
};

// 全屏加载覆盖层
export const FullScreenLoader: React.FC<{ message?: string }> = ({ message = '加载中...' }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-white/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center"
    >
      <HeartLoader size="lg" />
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-4 text-gray-600 text-lg"
      >
        {message}
      </motion.p>
    </motion.div>
  );
};
