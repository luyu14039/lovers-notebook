import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Heart, Zap, Plus, Trash2, CheckCircle, AlertCircle, Calendar, Thermometer, ChevronLeft, LogOut, Clock, User, Home, Sparkles, BarChart3, Search, Settings } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

// --- Types ---

type Role = 'bf' | 'gf' | null;

type GrudgeStatus = 'active' | 'forgiven';

interface Grudge {
  id: string;
  title: string;
  description: string;
  severity: number; // 1-100
  date: string;
  tags: string[];
  penalty: string;
  status: GrudgeStatus;
}

interface UserProfile {
  role: Role;
  name: string;
  onboarded: boolean;
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

// --- App Settings ---

interface AppSettings {
  theme: 'light' | 'dark' | 'auto';
  primaryColor: string;
  enablePhotos: boolean;
  enableAchievements: boolean;
  enableCharts: boolean;
}

// --- Utility Functions (预留接口) ---

/**
 * 照片服务 (预留)
 */
class PhotoService {
  static uploadPhoto(file: File): Promise<Photo> {
    // TODO: 实现照片上传、压缩、转 base64
    throw new Error('Photo feature not implemented yet');
  }
  
  static deletePhoto(id: string): boolean {
    // TODO: 实现照片删除
    return false;
  }
  
  static getStorageUsage(): { used: number; total: number } {
    // TODO: 计算存储空间使用情况
    return { used: 0, total: 50 * 1024 * 1024 }; // 50MB
  }
}

/**
 * 成就服务 (预留)
 */
class AchievementService {
  static checkAchievements(grudges: Grudge[], memories: Memory[]): Achievement[] {
    // TODO: 检查并返回新解锁的成就
    return [];
  }
  
  static getProgress(achievementId: string, grudges: Grudge[], memories: Memory[]): number {
    // TODO: 计算成就进度
    return 0;
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

// Persist state to local storage
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

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn(`Error saving to localStorage key "${key}":`, e);
    }
  }, [key, value]);

  return [value, setValue];
}

// --- Components ---

const PRESET_TAGS = ['偷吃', '迟到', '态度敷衍', '打游戏', '忘记纪念日', '拍照丑', '不回消息'];
const PRESET_MEMORY_TAGS = ['惊喜', '礼物', '陪伴', '道歉', '浪漫', '贴心', '温暖'];

const App = () => {
  const [profile, setProfile] = useStickyState<UserProfile>({ role: null, name: '', onboarded: false }, 'love-ledger-profile');
  const [grudges, setGrudges] = useStickyState<Grudge[]>([], 'love-ledger-grudges');
  const [memories, setMemories] = useStickyState<Memory[]>([], 'love-ledger-memories');
  const [currentPage, setCurrentPage] = useState<'home' | 'memories' | 'statistics' | 'settings'>('home');
  const [view, setView] = useState<'dashboard' | 'add' | 'addMemory'>('dashboard');
  const [showSearch, setShowSearch] = useState(false);

  // Derived state
  const themeColor = profile.role === 'gf' ? 'text-love-500' : 'text-cool-500';
  const bgGradient = profile.role === 'gf' 
    ? 'from-love-50 to-love-100' 
    : 'from-cool-50 to-cool-100';
  const buttonColor = profile.role === 'gf' ? 'bg-love-500 hover:bg-love-600' : 'bg-cool-500 hover:bg-cool-600';
  
  // --- Actions ---

  const handleAddGrudge = (newGrudge: Grudge) => {
    console.log('Adding grudge:', newGrudge);
    setGrudges([newGrudge, ...grudges]);
    setView('dashboard');
  };

  const handleForgive = (id: string) => {
    console.log('Forgiving grudge:', id);
    setGrudges(grudges.map(g => g.id === id ? { ...g, status: 'forgiven' } : g));
  };

  const handleDelete = (id: string) => {
    console.log('Requesting delete for:', id);
    // 使用 window.confirm 确保它是浏览器原生行为
    if (window.confirm('确定要彻底删除这条记录吗？(删除后就不能翻旧账了哦)')) {
      console.log('Deleting confirmed');
      setGrudges(grudges.filter(g => g.id !== id));
    } else {
      console.log('Deleting cancelled');
    }
  };

  // --- Memory Actions ---

  const handleAddMemory = (newMemory: Memory) => {
    console.log('Adding memory:', newMemory);
    setMemories([newMemory, ...memories]);
    setView('dashboard');
  };

  const handleDeleteMemory = (id: string) => {
    console.log('Requesting delete memory:', id);
    if (window.confirm('确定要删除这条美好回忆吗？')) {
      console.log('Deleting memory confirmed');
      setMemories(memories.filter(m => m.id !== id));
    } else {
      console.log('Deleting memory cancelled');
    }
  };

  const handleLogout = () => {
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
  };

  // --- Render ---

  if (!profile.onboarded) {
    return (
      <OnboardingScreen 
        initialName={profile.name}
        onComplete={(role, name) => setProfile({ role, name, onboarded: true })} 
      />
    );
  }

  return (
    <div className={`fixed inset-0 w-full bg-gradient-to-br ${bgGradient} text-slate-800`}>
      <div className="max-w-md mx-auto h-full flex flex-col relative shadow-2xl bg-white/50 backdrop-blur-sm">
        
        {/* Header - Show only on home page in dashboard view */}
        {view === 'dashboard' && currentPage === 'home' && (
          <header className="flex-shrink-0 p-6 flex justify-between items-center bg-white/80 z-30 backdrop-blur-md shadow-sm transition-all">
            <div className="flex items-center gap-3">
              <button 
                onClick={handleLogout}
                className="p-2 -ml-2 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-100 active:bg-slate-200 cursor-pointer z-50"
                title="切换账号"
              >
                <LogOut size={20} />
              </button>
              <div>
                <h1 className={`text-2xl font-bold ${themeColor} flex items-center gap-2`}>
                  {profile.role === 'gf' ? '👿 记仇本本' : '🛡️ 生存记录'}
                </h1>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                  <User size={10} />
                  {profile.name} 的专属领地
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setShowSearch(true)}
                className="p-2 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-100 active:bg-slate-200"
                title="搜索"
              >
                <Search size={20} />
              </button>
              <div className="text-right">
                <span className="text-xs font-medium text-slate-400 block">当前愤怒值</span>
                <div className="flex items-center justify-end gap-1">
                  <Zap size={16} className={grudges.filter(g => g.status === 'active').length > 0 ? 'text-red-500 animate-pulse' : 'text-slate-300'} />
                  <span className="font-bold text-lg">
                    {grudges.filter(g => g.status === 'active').reduce((acc, curr) => acc + curr.severity, 0)}
                  </span>
                </div>
              </div>
            </div>
          </header>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4">
          {view === 'dashboard' && (
            <>
              {currentPage === 'home' && (
                <Dashboard 
                  grudges={grudges} 
                  onForgive={handleForgive} 
                  onDelete={handleDelete} 
                  role={profile.role}
                />
              )}
              {currentPage === 'memories' && (
                <MemoriesPage 
                  memories={memories}
                  onDelete={handleDeleteMemory}
                  onAdd={() => setView('addMemory')}
                  role={profile.role} 
                />
              )}
              {currentPage === 'statistics' && (
                <StatisticsPage 
                  grudges={grudges}
                  memories={memories}
                  role={profile.role} 
                />
              )}
              {currentPage === 'settings' && <SettingsPage role={profile.role} />}
            </>
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
        </main>

        {/* Floating Action Button (FAB) - Only on home page */}
        {view === 'dashboard' && currentPage === 'home' && (
          <div className="absolute bottom-24 right-6 z-40">
            <button 
              onClick={() => setView('add')}
              className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-transform active:scale-90 ${buttonColor}`}
            >
              <Plus size={28} strokeWidth={3} />
            </button>
          </div>
        )}

        {/* Floating Action Button (FAB) - Memory page */}
        {view === 'dashboard' && currentPage === 'memories' && (
          <div className="absolute bottom-24 right-6 z-40">
            <button 
              onClick={() => setView('addMemory')}
              className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-transform active:scale-90 bg-gradient-to-br from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600`}
            >
              <Sparkles size={24} strokeWidth={2.5} />
            </button>
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
      </div>
    </div>
  );
};

// --- Sub-Components ---

const OnboardingScreen = ({ onComplete, initialName }: { onComplete: (role: Role, name: string) => void, initialName?: string }) => {
  const [role, setRole] = useState<Role>(null);
  const [name, setName] = useState(initialName || '');

  // Update name if initialName changes (e.g. loading from storage)
  useEffect(() => {
    if (initialName) setName(initialName);
  }, [initialName]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8 space-y-8 text-center">
        <div>
          <Heart className="w-12 h-12 text-red-400 mx-auto mb-4 animate-bounce-slight" fill="currentColor" />
          <h1 className="text-2xl font-bold text-slate-800">恋爱身份认证</h1>
          <p className="text-slate-500 text-sm mt-2">请亮出你的身份牌</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => setRole('bf')}
            className={`p-4 rounded-xl border-2 transition-all ${role === 'bf' ? 'border-cool-500 bg-cool-50 text-cool-600' : 'border-slate-200 text-slate-400'}`}
          >
            <div className="text-4xl mb-2">👦</div>
            <div className="font-bold">男朋友</div>
          </button>
          <button 
            onClick={() => setRole('gf')}
            className={`p-4 rounded-xl border-2 transition-all ${role === 'gf' ? 'border-love-500 bg-love-50 text-love-600' : 'border-slate-200 text-slate-400'}`}
          >
            <div className="text-4xl mb-2">👧</div>
            <div className="font-bold">女朋友</div>
          </button>
        </div>

        <div className="space-y-2 text-left">
          <div className="flex justify-between items-end">
            <label className="text-xs font-bold text-slate-400 ml-1">代号 / 昵称</label>
            {initialName && name === initialName && (
               <span className="text-[10px] text-green-500 bg-green-50 px-2 py-0.5 rounded-full">欢迎回来</span>
            )}
          </div>
          <input 
            type="text" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={role === 'bf' ? "例如：卑微小王" : "例如：傲娇公主"}
            className="w-full bg-slate-100 text-slate-900 placeholder:text-slate-400 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
        </div>

        <button 
          disabled={!role || !name}
          onClick={() => onComplete(role, name)}
          className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all shadow-lg"
        >
          开始记仇
        </button>
      </div>
    </div>
  );
};

const Dashboard = ({ grudges, onForgive, onDelete, role }: { grudges: Grudge[], onForgive: (id: string) => void, onDelete: (id: string) => void, role: Role }) => {
  const activeGrudges = grudges.filter(g => g.status === 'active');
  const historyGrudges = grudges.filter(g => g.status === 'forgiven');

  return (
    <div className="space-y-6">
      {/* Active Section */}
      <section>
        <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2">
          <AlertCircle size={14} />
          正在气头上 ({activeGrudges.length})
        </h2>
        
        {activeGrudges.length === 0 ? (
          <div className="bg-white/60 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
            <div className="text-4xl mb-2">🕊️</div>
            <p className="text-slate-500 font-medium">天下太平</p>
            <p className="text-xs text-slate-400 mt-1">暂无待处理的恩怨</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeGrudges.map(g => (
              <GrudgeCard key={g.id} grudge={g} onForgive={onForgive} onDelete={onDelete} role={role} />
            ))}
          </div>
        )}
      </section>

      {/* History Section */}
      {historyGrudges.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2">
            <CheckCircle size={14} />
            已成为历史 ({historyGrudges.length})
          </h2>
          <div className="space-y-3 opacity-70 grayscale hover:grayscale-0 transition-all duration-500">
            {historyGrudges.map(g => (
              <GrudgeCard key={g.id} grudge={g} onForgive={onForgive} onDelete={onDelete} role={role} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

const GrudgeCard = ({ grudge, onForgive, onDelete, role }: { grudge: Grudge, onForgive: (id: string) => void, onDelete: (id: string) => void, role: Role }) => {
  const isForgiven = grudge.status === 'forgiven';
  const accentColor = role === 'gf' ? 'text-love-500' : 'text-cool-500';
  const bgHighlight = role === 'gf' ? 'bg-love-50' : 'bg-cool-50';

  // Severity visualizer
  const getSeverityEmoji = (s: number) => {
    if (s < 30) return '😒';
    if (s < 60) return '😠';
    if (s < 90) return '😡';
    return '🤬';
  };

  return (
    <div className={`bg-white rounded-2xl p-5 shadow-sm border border-slate-100 relative overflow-hidden transform transition-all duration-200`}>
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
           <span className="text-2xl">{getSeverityEmoji(grudge.severity)}</span>
           <div>
             <h3 className={`font-bold text-slate-800 ${isForgiven ? 'line-through text-slate-400' : ''}`}>{grudge.title}</h3>
             <span className="text-[10px] text-slate-400 flex items-center gap-1">
               <Calendar size={10} /> {new Date(grudge.date).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
             </span>
           </div>
        </div>
        {!isForgiven && (
          <button 
            onClick={() => onForgive(grudge.id)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium border ${bgHighlight} ${accentColor} active:scale-95 transition-transform`}
          >
            原谅TA
          </button>
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
        <button 
          onClick={(e) => {
            e.stopPropagation();
            console.log("Trash icon clicked for id:", grudge.id);
            onDelete(grudge.id);
          }} 
          className="p-2 text-slate-300 hover:text-red-500 active:text-red-500 transition-colors rounded-full hover:bg-red-50 cursor-pointer"
          title="删除记录"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};

const AddGrudgeForm = ({ onSave, onCancel, role }: { onSave: (g: Grudge) => void, onCancel: () => void, role: Role }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState(50);
  const [tags, setTags] = useState<string[]>([]);
  const [penalty, setPenalty] = useState('');
  const [date, setDate] = useState(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 16);
  });

  const accentColor = role === 'gf' ? 'bg-love-500' : 'bg-cool-500';
  const ringColor = role === 'gf' ? 'focus:ring-love-500' : 'focus:ring-cool-500';
  const sliderColor = role === 'gf' ? 'accent-love-500' : 'accent-cool-500';

  const toggleTag = (tag: string) => {
    if (tags.includes(tag)) {
      setTags(tags.filter(t => t !== tag));
    } else {
      setTags([...tags, tag]);
    }
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
      date: new Date(date).toISOString(),
      tags,
      penalty,
      status: 'active'
    };
    onSave(newGrudge);
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-lg animate-slide-up space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
        <button 
            onClick={onCancel} 
            className="p-2 -ml-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition-colors"
        >
            <ChevronLeft size={24} />
        </button>
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

      {/* Severity Slider */}
      <div>
         <div className="flex justify-between items-end mb-2">
            <label className="block text-xs font-bold text-slate-400">愤怒指数</label>
            <span className={`text-xl font-black ${role === 'gf' ? 'text-love-500' : 'text-cool-500'}`}>{severity}%</span>
         </div>
         <input 
            type="range" 
            min="1" 
            max="100" 
            value={severity} 
            onChange={e => setSeverity(parseInt(e.target.value))}
            className={`w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer ${sliderColor}`}
         />
         <div className="flex justify-between text-[10px] text-slate-400 mt-1">
           <span>有点不爽</span>
           <span>很生气</span>
           <span>气炸了</span>
         </div>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-xs font-bold text-slate-400 mb-2">违规类型</label>
        <div className="flex flex-wrap gap-2">
          {PRESET_TAGS.map(tag => (
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

      <button 
        disabled={!title}
        onClick={handleSubmit}
        className={`w-full py-3.5 rounded-xl text-white font-bold shadow-lg active:scale-95 transition-all ${accentColor} ${!title ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        记入档案
      </button>
    </div>
  );
};

// --- AddMemoryForm Component ---

const AddMemoryForm = ({ onSave, onCancel, role }: { onSave: (m: Memory) => void; onCancel: () => void; role: Role }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sweetness, setSweetness] = useState(50);
  const [tags, setTags] = useState<string[]>([]);
  const [feeling, setFeeling] = useState('');

  const accentColor = role === 'gf' ? 'bg-love-500 hover:bg-love-600' : 'bg-cool-500 hover:bg-cool-600';
  const ringColor = role === 'gf' ? 'focus:ring-love-500' : 'focus:ring-cool-500';
  const textColor = role === 'gf' ? 'text-love-500' : 'text-cool-500';

  const toggleTag = (tag: string) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
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
    };
    onSave(newMemory);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onCancel} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-100">
          <ChevronLeft size={24} />
        </button>
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

      <button 
        disabled={!title}
        onClick={handleSubmit}
        className={`w-full py-3.5 rounded-xl text-white font-bold shadow-lg active:scale-95 transition-all ${accentColor} ${!title ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        保存回忆
      </button>
    </div>
  );
};

// --- MemoryCard Component ---

const MemoryCard = ({ memory, onDelete, role }: { memory: Memory; onDelete: (id: string) => void; role: Role }) => {
  const textColor = role === 'gf' ? 'text-love-500' : 'text-cool-500';
  const bgColor = role === 'gf' ? 'bg-love-50' : 'bg-cool-50';
  
  return (
    <div className={`${bgColor} rounded-2xl p-4 shadow-sm border border-transparent hover:border-amber-200 transition-all`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="font-bold text-slate-800 text-base mb-1">{memory.title}</h3>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Calendar size={12} />
            <span>{new Date(memory.date).toLocaleDateString('zh-CN')}</span>
            <Clock size={12} className="ml-1" />
            <span>{new Date(memory.date).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
        <button 
          onClick={() => onDelete(memory.id)}
          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          title="删除"
        >
          <Trash2 size={16} />
        </button>
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
    </div>
  );
};

// --- 底部导航栏组件 ---

const BottomTabBar = ({ 
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
};

// --- 占位页面组件 ---

const MemoriesPage = ({ 
  memories, 
  onDelete, 
  onAdd, 
  role 
}: { 
  memories: Memory[]; 
  onDelete: (id: string) => void; 
  onAdd: () => void; 
  role: Role;
}) => {
  const themeColor = role === 'gf' ? 'text-love-500' : 'text-cool-500';
  const buttonColor = role === 'gf' ? 'bg-love-500 hover:bg-love-600' : 'bg-cool-500 hover:bg-cool-600';
  
  const totalSweetness = memories.reduce((sum, m) => sum + m.sweetness, 0);
  
  if (memories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 px-6 text-center">
        <Sparkles size={64} className={`${themeColor} mb-4 opacity-30`} />
        <h2 className="text-2xl font-bold text-slate-800 mb-2">甜蜜回忆录</h2>
        <p className="text-slate-500 text-sm mb-6">
          还没有记录美好瞬间呢 💕
        </p>
        <button 
          onClick={onAdd}
          className={`${buttonColor} text-white px-6 py-3 rounded-xl font-medium shadow-lg active:scale-95 transition-all flex items-center gap-2`}
        >
          <Plus size={20} />
          记录第一个回忆
        </button>
      </div>
    );
  }
  
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header Card */}
      <div className="bg-gradient-to-br from-amber-100 to-orange-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h2 className={`text-xl font-bold ${themeColor} flex items-center gap-2`}>
            <Sparkles size={24} />
            甜蜜回忆录
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
            <span className="font-bold text-slate-800">{memories.length}</span>
          </div>
          <div>
            <span className="text-slate-600">甜蜜总值：</span>
            <span className="font-bold text-amber-600">{totalSweetness}</span>
          </div>
        </div>
      </div>

      {/* Memory List */}
      <div className="space-y-3">
        {memories.map(memory => (
          <MemoryCard key={memory.id} memory={memory} onDelete={onDelete} role={role} />
        ))}
      </div>
    </div>
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

// --- StatisticsPage Component ---

const StatisticsPage = ({ 
  grudges, 
  memories, 
  role 
}: { 
  grudges: Grudge[]; 
  memories: Memory[]; 
  role: Role;
}) => {
  const themeColor = role === 'gf' ? 'text-love-500' : 'text-cool-500';
  const stats = calculateStatistics(grudges, memories);
  const harmonyLevel = getHarmonyLevel(stats.harmonyScore);
  
  const totalRecords = stats.totalGrudges + stats.totalMemories;
  
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
    <div className="space-y-4 animate-fade-in">
      {/* Harmony Score Card */}
      <div className="bg-gradient-to-br from-purple-100 to-blue-100 rounded-2xl p-6 shadow-sm text-center">
        <h3 className="text-sm font-medium text-slate-600 mb-3">关系和谐度</h3>
        
        {/* Circular Progress */}
        <div className="relative w-32 h-32 mx-auto mb-4">
          <svg className="transform -rotate-90 w-32 h-32">
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              className="text-slate-200"
            />
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={`${2 * Math.PI * 56}`}
              strokeDashoffset={`${2 * Math.PI * 56 * (1 - stats.harmonyScore / 100)}`}
              className={`${harmonyLevel.color} transition-all duration-1000`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-slate-800">{stats.harmonyScore}</span>
            <span className="text-xs text-slate-500">分</span>
          </div>
        </div>
        
        <div className={`text-lg font-bold ${harmonyLevel.color} mb-1`}>
          {harmonyLevel.emoji} {harmonyLevel.label}
        </div>
        <p className="text-xs text-slate-500">
          总记录数：{totalRecords}
        </p>
      </div>
      
      {/* Statistics Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Grudges Card */}
        <div className="bg-red-50 rounded-xl p-4 border border-red-100">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={16} className="text-red-500" />
            <span className="text-xs font-medium text-slate-600">记仇记录</span>
          </div>
          <div className="text-2xl font-bold text-slate-800 mb-1">{stats.totalGrudges}</div>
          <div className="text-xs text-slate-500">
            活跃 {stats.activeGrudgeCount} | 已原谅 {stats.forgivenCount}
          </div>
        </div>
        
        {/* Memories Card */}
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={16} className="text-amber-500" />
            <span className="text-xs font-medium text-slate-600">甜蜜回忆</span>
          </div>
          <div className="text-2xl font-bold text-slate-800 mb-1">{stats.totalMemories}</div>
          <div className="text-xs text-slate-500">
            平均甜蜜度 {stats.avgSweetnessLevel}
          </div>
        </div>
        
        {/* Forgiveness Rate Card */}
        <div className="bg-green-50 rounded-xl p-4 border border-green-100">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={16} className="text-green-500" />
            <span className="text-xs font-medium text-slate-600">原谅率</span>
          </div>
          <div className="text-2xl font-bold text-slate-800 mb-1">{stats.forgivenessRate}%</div>
          <div className="text-xs text-slate-500">
            {stats.forgivenessRate >= 70 ? '宽容大度 💚' : stats.forgivenessRate >= 40 ? '还算宽容' : '小心眼 😤'}
          </div>
        </div>
        
        {/* Avg Anger Card */}
        <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={16} className="text-orange-500" />
            <span className="text-xs font-medium text-slate-600">平均愤怒值</span>
          </div>
          <div className="text-2xl font-bold text-slate-800 mb-1">{stats.avgAngerLevel}</div>
          <div className="text-xs text-slate-500">
            {stats.avgAngerLevel >= 70 ? '经常发火 🔥' : stats.avgAngerLevel >= 40 ? '偶尔生气' : '脾气温和 😇'}
          </div>
        </div>
      </div>
      
      {/* Tag Cloud */}
      {stats.mostCommonTags.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
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
        </div>
      )}
      
      {/* Insights */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-6 shadow-sm border border-slate-200">
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
      </div>
    </div>
  );
};

const SettingsPage = ({ role }: { role: Role }) => {
  const themeColor = role === 'gf' ? 'text-love-500' : 'text-cool-500';
  
  return (
    <div className="flex flex-col items-center justify-center h-full py-20 px-6 text-center">
      <Settings size={64} className={`${themeColor} mb-4 animate-pulse`} />
      <h2 className="text-2xl font-bold text-slate-800 mb-2">设置</h2>
      <p className="text-slate-500 text-sm">
        个性化你的记账本
      </p>
      <p className="text-slate-400 text-xs mt-4">
        即将上线...
      </p>
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
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="max-w-md mx-auto h-full bg-white flex flex-col">
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
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);