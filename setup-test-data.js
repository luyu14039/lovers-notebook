// 测试数据设置脚本
// 在浏览器控制台运行此脚本来设置已配对且有同步数据的测试状态

// 1. 生成设备ID
function generateDeviceId() {
  return 'device_' + Math.random().toString(36).substring(2, 15);
}

const myDeviceId = generateDeviceId();
const partnerDeviceId = 'device_partner_test_' + Date.now();

// 2. 设置用户Profile（已配对状态）
const testProfile = {
  role: 'gf', // 女朋友角色
  name: '傲娇公主',
  onboarded: true,
  paired: true,
  pairId: partnerDeviceId,
  deviceId: myDeviceId,
  customSelfName: '女朋友', // 对自己的称呼
  partner: {
    id: partnerDeviceId,
    name: '卑微小王',
    role: 'bf',
    callName: '老公', // 我叫他什么
    callsMe: '老婆'    // 他叫我什么
  },
  relationship: {
    anniversary: '2024-01-14', // 纪念日
    pairDate: new Date().toISOString().split('T')[0],
    partnerBirthday: '1995-06-15'
  },
  spaceConfig: {
    grudgeSpaceName: '记仇本本',
    memorySpaceName: '甜蜜回忆'
  }
};

// 3. 创建测试记仇数据（包含自己的和对方的）
const testGrudges = [
  // 我的记仇
  {
    id: 'grudge_1_' + Date.now(),
    title: '忘记纪念日',
    description: '明明说好要一起过的，结果他居然忘记了！😤',
    severity: 80,
    moodType: 'angry',
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ['纪念日', '粗心'],
    penalty: '请我吃大餐一个月',
    status: 'active',
    isPrivate: false,
    authorDeviceId: myDeviceId,
    photos: []
  },
  {
    id: 'grudge_2_' + Date.now(),
    title: '说话不算数',
    description: '答应周末陪我逛街，结果又去打游戏了',
    severity: 60,
    moodType: 'disappointed',
    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ['承诺', '游戏'],
    penalty: '下周末必须陪我',
    status: 'active',
    isPrivate: false,
    authorDeviceId: myDeviceId,
    photos: []
  },
  {
    id: 'grudge_3_' + Date.now(),
    title: '不接电话',
    description: '打了三次电话都不接，说在忙工作',
    severity: 45,
    moodType: 'sad',
    date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ['电话', '冷落'],
    penalty: '主动打电话一周',
    status: 'forgiven',
    forgivenAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    isPrivate: false,
    authorDeviceId: myDeviceId,
    photos: []
  },
  // 对方的记仇（同步过来的）
  {
    id: 'grudge_partner_1_' + Date.now(),
    title: '乱发脾气',
    description: '心情不好就冲我发火，明明不是我的错',
    severity: 70,
    moodType: 'frustrated',
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ['脾气', '情绪'],
    penalty: '道歉并保证控制情绪',
    status: 'active',
    isPrivate: false,
    authorDeviceId: partnerDeviceId,
    photos: []
  },
  {
    id: 'grudge_partner_2_' + Date.now(),
    title: '买东西太贵',
    description: '又买了一个贵包包，说好要理性消费的',
    severity: 55,
    moodType: 'worried',
    date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ['消费', '理财'],
    penalty: '这个月不能再买奢侈品',
    status: 'active',
    isPrivate: false,
    authorDeviceId: partnerDeviceId,
    photos: []
  }
];

// 4. 创建测试回忆数据（包含自己的和对方的）
const testMemories = [
  // 我的回忆
  {
    id: 'memory_1_' + Date.now(),
    title: '第一次约会',
    description: '在咖啡馆第一次见面，他紧张得连话都说不清楚，好可爱~',
    sweetness: 95,
    date: '2024-01-01',
    tags: ['约会', '第一次', '咖啡馆'],
    authorDeviceId: myDeviceId,
    photos: []
  },
  {
    id: 'memory_2_' + Date.now(),
    title: '雨天送伞',
    description: '突然下雨，他淋着雨给我送伞来，虽然自己淋湿了',
    sweetness: 88,
    date: '2024-03-15',
    tags: ['雨天', '感动', '贴心'],
    authorDeviceId: myDeviceId,
    photos: []
  },
  {
    id: 'memory_3_' + Date.now(),
    title: '生病照顾',
    description: '我生病的时候，他请假一整天照顾我，给我煮粥',
    sweetness: 92,
    date: '2024-05-20',
    tags: ['生病', '照顾', '暖心'],
    authorDeviceId: myDeviceId,
    photos: []
  },
  // 对方的回忆（同步过来的）
  {
    id: 'memory_partner_1_' + Date.now(),
    title: '第一次做饭',
    description: '她第一次给我做饭，虽然有点糊了，但特别好吃',
    sweetness: 85,
    date: '2024-02-14',
    tags: ['做饭', '情人节', '用心'],
    authorDeviceId: partnerDeviceId,
    photos: []
  },
  {
    id: 'memory_partner_2_' + Date.now(),
    title: '支持我工作',
    description: '加班到很晚，她一直在等我，还给我准备了夜宵',
    sweetness: 90,
    date: '2024-04-10',
    tags: ['工作', '理解', '支持'],
    authorDeviceId: partnerDeviceId,
    photos: []
  }
];

// 5. 设置成就数据
const testAchievements = [
  {
    id: 'first_grudge',
    title: '第一次记仇',
    description: '记录了第一条恩怨',
    icon: '📝',
    unlocked: true,
    unlockedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'milestone'
  },
  {
    id: 'first_memory',
    title: '第一个回忆',
    description: '记录了第一个美好回忆',
    icon: '💕',
    unlocked: true,
    unlockedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'milestone'
  },
  {
    id: 'paired',
    title: '心有灵犀',
    description: '成功完成配对',
    icon: '💑',
    unlocked: true,
    unlockedAt: new Date().toISOString(),
    category: 'social'
  },
  {
    id: 'first_forgive',
    title: '宽容之心',
    description: '第一次原谅对方',
    icon: '🕊️',
    unlocked: true,
    unlockedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'relationship'
  },
  {
    id: '10_grudges',
    title: '记仇达人',
    description: '累计记录10条恩怨',
    icon: '📚',
    unlocked: false,
    category: 'collection'
  },
  {
    id: '10_memories',
    title: '回忆收藏家',
    description: '累计记录10个美好回忆',
    icon: '🎁',
    unlocked: false,
    category: 'collection'
  }
];

// 6. 保存到 localStorage
console.log('🚀 开始设置测试数据...');

localStorage.setItem('love-ledger-profile', JSON.stringify(testProfile));
console.log('✅ Profile 设置完成');

localStorage.setItem('love-ledger-grudges', JSON.stringify(testGrudges));
console.log('✅ Grudges 设置完成 (包含 ' + testGrudges.length + ' 条记录)');

localStorage.setItem('love-ledger-memories', JSON.stringify(testMemories));
console.log('✅ Memories 设置完成 (包含 ' + testMemories.length + ' 条回忆)');

localStorage.setItem('love-ledger-achievements', JSON.stringify(testAchievements));
console.log('✅ Achievements 设置完成');

console.log('\n🎉 测试数据设置完成！');
console.log('\n📋 测试账号信息：');
console.log('角色: 女朋友 (傲娇公主)');
console.log('配对状态: 已配对');
console.log('对方: 男朋友 (卑微小王)');
console.log('我叫他: 老公');
console.log('他叫我: 老婆');
console.log('\n📊 数据统计：');
console.log('- 记仇总数: ' + testGrudges.length + ' 条 (我的: 3 条, 对方的: 2 条)');
console.log('- 回忆总数: ' + testMemories.length + ' 条 (我的: 3 条, 对方的: 2 条)');
console.log('- 已解锁成就: 4 个');
console.log('\n🔄 请刷新页面查看效果！');
