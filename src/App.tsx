/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef, ChangeEvent } from 'react';
import { Clock, MapPin, Users, Trophy, ChevronRight, AlertCircle, Upload, Download, Settings, X, FileSpreadsheet, Maximize, Minimize, Volume2, Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';

// --- 初始默认比赛数据 ---
const INITIAL_MATCH_DATA = [
  {
    id: '1',
    date: '2026-04-07',
    startTime: '08:00',
    endTime: '09:00',
    field: '1号场地',
    grade: '三年级组',
    stage: '小组赛第1轮',
    teamA: '红星队',
    teamB: '蓝天队',
  },
  {
    id: '2',
    date: '2026-04-07',
    startTime: '09:15',
    endTime: '10:15',
    field: '2号场地',
    grade: '四年级组',
    stage: '小组赛第1轮',
    teamA: '猛虎队',
    teamB: '雄鹰队',
  },
];

export default function App() {
  const [now, setNow] = useState(new Date());
  const [matches, setMatches] = useState(INITIAL_MATCH_DATA);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [broadcastMinutes, setBroadcastMinutes] = useState<number[]>([5, 10]);
  const [isBroadcastEnabled, setIsBroadcastEnabled] = useState(true);
  const [broadcastHistory, setBroadcastHistory] = useState<Record<string, number[]>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 语音播报函数
  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.9; // 稍微慢一点，更清晰
    window.speechSynthesis.speak(utterance);
  };

  // 监听全屏状态变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // 实时更新时间
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 格式化当前日期和时间
  const formattedDate = now.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
  });
  const formattedTime = now.toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // 下载模板
  const downloadTemplate = () => {
    const templateData = [
      ['日期(YYYY-MM-DD)', '开始时间(HH:mm)', '结束时间(HH:mm)', '场地', '年级/组别', '赛程阶段', '主队', '客队'],
      ['2026-04-07', '08:00', '09:00', '1号场地', '三年级组', '小组赛第1轮', '红星队', '蓝天队'],
      ['2026-04-07', '09:15', '10:15', '2号场地', '四年级组', '小组赛第1轮', '猛虎队', '雄鹰队'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "赛程模板");
    XLSX.writeFile(wb, "顽石之光足球俱乐部赛程导入模板.xlsx");
  };

  // 处理文件上传
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // 使用 raw: false 获取格式化后的字符串
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false }) as any[][];

        if (data.length <= 1) {
          alert("文件似乎是空的或只有表头。");
          return;
        }

        // 解析数据并进行清洗
        const importedMatches = data.slice(1)
          .filter(row => row.length >= 8 && row[0] && row[1]) // 至少要有日期和开始时间
          .map((row, index) => {
            // 尝试标准化日期格式 (处理可能出现的不同分隔符)
            let dateStr = String(row[0]).trim().replace(/\//g, '-');
            
            // 如果日期是 YYYY-M-D 格式，补全为 YYYY-MM-DD
            if (dateStr.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
              const parts = dateStr.split('-');
              dateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            }

            // 尝试标准化时间格式 (处理 H:mm -> HH:mm)
            let startStr = String(row[1]).trim();
            if (startStr.match(/^\d{1,2}:\d{2}$/)) {
              const [h, m] = startStr.split(':');
              startStr = `${h.padStart(2, '0')}:${m}`;
            }

            let endStr = String(row[2]).trim();
            if (endStr.match(/^\d{1,2}:\d{2}$/)) {
              const [h, m] = endStr.split(':');
              endStr = `${h.padStart(2, '0')}:${m}`;
            }

            return {
              id: `imported-${Date.now()}-${index}`,
              date: dateStr,
              startTime: startStr,
              endTime: endStr,
              field: String(row[3] || '').trim(),
              grade: String(row[4] || '').trim(),
              stage: String(row[5] || '').trim(),
              teamA: String(row[6] || '').trim(),
              teamB: String(row[7] || '').trim(),
            };
          });

        if (importedMatches.length > 0) {
          setMatches(importedMatches);
          setShowSettings(false);
          alert(`成功导入 ${importedMatches.length} 场比赛！`);
          // 清除 input 值，方便下次选择同一文件
          if (fileInputRef.current) fileInputRef.current.value = '';
        } else {
          alert("未发现有效比赛数据，请确保日期和时间格式正确。");
        }
      } catch (err) {
        console.error("Excel 解析错误:", err);
        alert("解析文件时出错，请确保文件格式正确。");
      }
    };
    reader.readAsBinaryString(file);
  };

  // 匹配比赛逻辑
  const { currentMatches, nextMatches, status } = useMemo(() => {
    // 使用本地时间获取日期字符串 YYYY-MM-DD
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    
    const currentTimeStr = now.toTimeString().slice(0, 5); // HH:mm

    // 只看今天的比赛，增加 trim 处理防止空格导致匹配失败
    const todayMatches = matches
      .filter(m => m.date.trim() === todayStr)
      .sort((a, b) => a.startTime.trim().localeCompare(b.startTime.trim()));

    if (todayMatches.length === 0) {
      return { currentMatches: [], nextMatches: [], status: 'NO_MATCHES_TODAY' };
    }

    const firstMatch = todayMatches[0];
    const lastMatch = todayMatches[todayMatches.length - 1];

    // 查找当前正在进行的比赛 (最多取2场)
    const current = todayMatches.filter(m => {
      const start = m.startTime.trim();
      const end = m.endTime.trim();
      return currentTimeStr >= start && currentTimeStr <= end;
    }).slice(0, 2);
    
    // 查找下一场比赛 (最多取2场)
    const next = todayMatches.filter(m => m.startTime.trim() > currentTimeStr).slice(0, 2);

    // 还没到第一场比赛
    if (currentTimeStr < firstMatch.startTime.trim()) {
      return { currentMatches: [], nextMatches: next, status: 'SOON' };
    }

    // 已经过了最后一场比赛
    if (currentTimeStr > lastMatch.endTime.trim()) {
      return { currentMatches: [], nextMatches: [], status: 'ENDED' };
    }

    // 如果当前没有正在进行的比赛（处于两场之间）
    if (current.length === 0 && next.length > 0) {
      return { currentMatches: [], nextMatches: next, status: 'BETWEEN' };
    }

    return { currentMatches: current, nextMatches: next, status: 'ONGOING' };
  }, [now, matches]);

  // 语音播报触发逻辑
  useEffect(() => {
    if (!isBroadcastEnabled || currentMatches.length === 0 || nextMatches.length === 0) return;

    currentMatches.forEach(currentMatch => {
      const [endH, endM] = currentMatch.endTime.split(':').map(Number);
      const endTime = new Date(now);
      endTime.setHours(endH, endM, 0, 0);

      const diffMs = endTime.getTime() - now.getTime();
      const diffMinutes = Math.ceil(diffMs / 60000); // 使用向上取整，确保在进入那一分钟时触发

      if (broadcastMinutes.includes(diffMinutes) && diffMinutes > 0) {
        const history = broadcastHistory[currentMatch.id] || [];
        if (!history.includes(diffMinutes)) {
          // 找到该场地对应的下一场比赛（如果存在）
          const nextForThisField = nextMatches.find(m => m.field === currentMatch.field) || nextMatches[0];
          
          const text = `本场比赛将在${diffMinutes}分钟后结束，请下一场比赛对阵双方：${nextForThisField.teamA} 和 ${nextForThisField.teamB}，做好比赛准备。`;
          speak(text);
          
          setBroadcastHistory(prev => ({
            ...prev,
            [currentMatch.id]: [...(prev[currentMatch.id] || []), diffMinutes]
          }));
        }
      }
    });
  }, [now, currentMatches, nextMatches, isBroadcastEnabled, broadcastMinutes, broadcastHistory]);

  return (
    <div ref={containerRef} className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-amber-500 selection:text-black overflow-hidden flex flex-col relative">
      {/* 顶部：标题 + 当前日期时间 */}
      <header className="border-b-4 border-amber-500 bg-[#111] p-6 flex justify-between items-center shadow-2xl relative z-20">
        <div className="flex items-center gap-4">
          <div className="bg-amber-500 p-2 rounded">
            <Trophy className="text-black w-10 h-10" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase italic">Wanshi Zhiguang FIDS</h1>
            <p className="text-amber-500 font-mono text-lg tracking-widest">顽石之光足球俱乐部赛程实时显示系统</p>
          </div>
        </div>
        <div className="flex items-center gap-8">
          <div className="text-right font-mono">
            <div className="text-2xl text-gray-400">{formattedDate}</div>
            <div className="text-6xl font-bold text-amber-500 tabular-nums leading-none mt-1">
              {formattedTime}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={toggleFullscreen}
              className="p-3 bg-[#222] hover:bg-[#333] rounded-full transition-colors border border-[#444]"
              title={isFullscreen ? "退出全屏" : "全屏显示"}
            >
              {isFullscreen ? (
                <Minimize className="w-8 h-8 text-gray-400" />
              ) : (
                <Maximize className="w-8 h-8 text-gray-400" />
              )}
            </button>
            <button 
              onClick={() => setShowSettings(true)}
              className="p-3 bg-[#222] hover:bg-[#333] rounded-full transition-colors border border-[#444]"
              title="设置"
            >
              <Settings className="w-8 h-8 text-gray-400" />
            </button>
          </div>
        </div>
      </header>

      {/* 中间：主展示区 */}
      <main className="flex-1 p-8 flex flex-col gap-6 relative z-10">
        <AnimatePresence mode="wait">
          {/* 当前比赛 / 状态提示 */}
          <motion.section 
            key={status + currentMatches.map(m => m.id).join(',')}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-3 h-8 bg-amber-500"></div>
              <h2 className="text-3xl font-bold uppercase tracking-wider text-gray-400">
                {status === 'ONGOING' ? 'Current Matches / 当前比赛' : 'Status / 赛事状态'}
              </h2>
            </div>

            <div className="flex-1 flex flex-col gap-4">
              {currentMatches.length > 0 ? (
                currentMatches.map((match) => (
                  <div key={match.id} className="flex-1 bg-[#151515] border-2 border-[#333] rounded-xl p-8 flex flex-col justify-center relative overflow-hidden shadow-inner">
                    <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
                    
                    <div className="grid grid-cols-12 gap-8 items-center relative z-10">
                      <div className="col-span-3">
                        <div className="text-amber-500 font-mono text-lg mb-1 uppercase tracking-widest">Time / 比赛时间</div>
                        <div className="text-6xl font-black tabular-nums leading-none">{match.startTime}</div>
                        <div className="text-xl text-gray-500 font-mono mt-1">~ {match.endTime}</div>
                      </div>

                      <div className="col-span-6 flex flex-col items-center gap-4">
                        <div className="flex items-center justify-center gap-8 w-full">
                          <div className="flex-1 text-right">
                            <div className="text-6xl font-black tracking-tight text-white uppercase truncate">{match.teamA}</div>
                          </div>
                          <div className="text-4xl font-black text-amber-500 italic">VS</div>
                          <div className="flex-1 text-left">
                            <div className="text-6xl font-black tracking-tight text-white uppercase truncate">{match.teamB}</div>
                          </div>
                        </div>
                        <div className="inline-flex items-center gap-3 px-4 py-1 bg-amber-500 text-black font-bold text-xl rounded-full uppercase tracking-tighter">
                          <Trophy size={20} />
                          {match.stage}
                        </div>
                      </div>

                      <div className="col-span-3 text-right space-y-4 border-l-2 border-[#333] pl-8">
                        <div>
                          <div className="text-amber-500 font-mono text-lg mb-0 uppercase tracking-widest flex items-center justify-end gap-2">
                            <MapPin size={18} /> Field / 场地
                          </div>
                          <div className="text-3xl font-bold">{match.field}</div>
                        </div>
                        <div>
                          <div className="text-amber-500 font-mono text-lg mb-0 uppercase tracking-widest flex items-center justify-end gap-2">
                            <Users size={18} /> Grade / 组别
                          </div>
                          <div className="text-3xl font-bold">{match.grade}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex-1 bg-[#151515] border-2 border-[#333] rounded-xl p-10 flex flex-col items-center justify-center text-center relative overflow-hidden shadow-inner">
                  {status === 'SOON' && (
                    <>
                      <Clock className="w-24 h-24 text-amber-500 mb-6 animate-pulse" />
                      <h3 className="text-6xl font-black uppercase tracking-tighter mb-4">Upcoming Events</h3>
                      <p className="text-4xl text-gray-400 font-bold">今日赛事即将开始</p>
                    </>
                  )}
                  {status === 'ENDED' && (
                    <>
                      <AlertCircle className="w-24 h-24 text-gray-500 mb-6" />
                      <h3 className="text-6xl font-black uppercase tracking-tighter mb-4 text-gray-500">All Matches Ended</h3>
                      <p className="text-4xl text-gray-600 font-bold">今日比赛已全部结束</p>
                    </>
                  )}
                  {status === 'BETWEEN' && (
                    <>
                      <Clock className="w-24 h-24 text-amber-500 mb-6" />
                      <h3 className="text-6xl font-black uppercase tracking-tighter mb-4">Intermission</h3>
                      <p className="text-4xl text-gray-400 font-bold">中场休息 / 等待下场比赛</p>
                    </>
                  )}
                  {status === 'NO_MATCHES_TODAY' && (
                    <>
                      <AlertCircle className="w-24 h-24 text-gray-500 mb-6" />
                      <h3 className="text-6xl font-black uppercase tracking-tighter mb-4 text-gray-500">No Schedule</h3>
                      <p className="text-4xl text-gray-600 font-bold">今日暂无比赛安排</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </motion.section>

          {/* 下一场比赛 */}
          {nextMatches.length > 0 && (
            <motion.section 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex flex-col gap-4"
            >
              <div className="flex items-center gap-3">
                <ChevronRight className="text-blue-500 w-8 h-8" />
                <h2 className="text-2xl font-bold uppercase tracking-widest text-blue-500">
                  Next Matches / 下一场比赛
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {nextMatches.map((match) => (
                  <div key={match.id} className="bg-[#111] border-l-8 border-blue-500 p-4 rounded-r-xl shadow-xl">
                    <div className="grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-2">
                        <div className="text-gray-500 font-mono text-[10px] mb-0.5 uppercase tracking-widest">Start Time</div>
                        <div className="text-3xl font-black text-white tabular-nums leading-none">{match.startTime}</div>
                      </div>
                      
                      <div className="col-span-5 flex items-center gap-4">
                        <div className="text-2xl font-bold text-white truncate max-w-[40%]">{match.teamA}</div>
                        <div className="text-lg font-black text-blue-500 italic shrink-0">VS</div>
                        <div className="text-2xl font-bold text-white truncate max-w-[40%]">{match.teamB}</div>
                      </div>

                      <div className="col-span-3 space-y-0.5">
                        <div className="flex items-center gap-2 text-blue-400">
                          <Users size={14} />
                          <span className="text-lg font-bold truncate leading-tight">{match.grade}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400">
                          <Trophy size={14} />
                          <span className="text-base truncate leading-tight">{match.stage}</span>
                        </div>
                      </div>

                      <div className="col-span-2 text-right space-y-1">
                        <div className="flex items-center justify-end gap-1.5 text-white">
                          <MapPin size={14} className="text-blue-500" />
                          <span className="text-lg font-bold">{match.field}</span>
                        </div>
                        <div className="inline-block bg-blue-900/30 border border-blue-500/50 text-blue-400 px-2 py-0.5 rounded text-[10px] font-bold animate-pulse uppercase">
                          Ready / 准备
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* 底部：滚动提示信息 */}
      <footer className="bg-amber-500 text-black p-4 overflow-hidden relative z-20">
        <div className="flex whitespace-nowrap animate-marquee font-black text-2xl uppercase tracking-tighter">
          <span className="mx-8">Fair Play / 公平竞赛</span>
          <span className="mx-8">Respect the Referee / 尊重裁判</span>
          <span className="mx-8">Safety First / 安全第一</span>
          <span className="mx-8">Enjoy the Game / 享受足球</span>
          <span className="mx-8">Fair Play / 公平竞赛</span>
          <span className="mx-8">Respect the Referee / 尊重裁判</span>
          <span className="mx-8">Safety First / 安全第一</span>
          <span className="mx-8">Enjoy the Game / 享受足球</span>
        </div>
      </footer>

      {/* 设置模态框 */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSettings(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1a1a1a] border-2 border-[#333] rounded-2xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[90vh]"
            >
              {/* 固定头部 */}
              <div className="flex justify-between items-center p-6 border-b border-[#333]">
                <h3 className="text-2xl font-bold flex items-center gap-3">
                  <Settings className="text-amber-500" /> 系统设置
                </h3>
                <button 
                  onClick={() => setShowSettings(false)} 
                  className="p-2 hover:bg-[#333] rounded-full text-gray-400 hover:text-white transition-colors"
                  title="关闭"
                >
                  <X size={28} />
                </button>
              </div>

              {/* 可滚动内容区 */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                {/* 第一步：下载模板 */}
                <div className="p-6 bg-[#222] rounded-xl border border-[#333] space-y-4">
                  <div className="flex items-center gap-3 text-amber-500 font-bold">
                    <Download size={20} /> 第一步：下载模板
                  </div>
                  <p className="text-gray-400 text-sm">请先下载标准的 Excel 模板，并按照格式填写比赛信息。</p>
                  <button 
                    onClick={downloadTemplate}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    <FileSpreadsheet size={20} /> 下载 Excel 模板
                  </button>
                </div>

                {/* 语音播报设置 */}
                <div className="p-6 bg-[#222] rounded-xl border border-[#333] space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-green-500 font-bold">
                      <Volume2 size={20} /> 语音播报设置
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={isBroadcastEnabled} 
                        onChange={(e) => setIsBroadcastEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                    </label>
                  </div>
                  
                  <div className="space-y-3">
                    <p className="text-gray-400 text-sm">设置距离比赛结束多少分钟时进行语音提醒：</p>
                    <div className="flex flex-wrap gap-2">
                      {broadcastMinutes.sort((a, b) => b - a).map((min) => (
                        <div key={min} className="flex items-center gap-2 bg-[#333] px-3 py-1 rounded-lg border border-[#444]">
                          <span className="text-white font-mono">{min} 分钟</span>
                          <button 
                            onClick={() => setBroadcastMinutes(prev => prev.filter(m => m !== min))}
                            className="text-gray-500 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <button 
                        onClick={() => {
                          const val = prompt("请输入提醒分钟数（距离结束）：");
                          if (val && !isNaN(Number(val))) {
                            const num = Math.abs(Math.floor(Number(val)));
                            if (num > 0 && !broadcastMinutes.includes(num)) {
                              setBroadcastMinutes(prev => [...prev, num]);
                            }
                          }
                        }}
                        className="flex items-center gap-1 bg-green-600/20 text-green-500 px-3 py-1 rounded-lg border border-green-600/30 hover:bg-green-600/30 transition-colors"
                      >
                        <Plus size={14} /> 添加
                      </button>
                    </div>
                  </div>
                </div>

                {/* 第二步：上传数据 */}
                <div className="p-6 bg-[#222] rounded-xl border border-[#333] space-y-4">
                  <div className="flex items-center gap-3 text-blue-500 font-bold">
                    <Upload size={20} /> 第二步：上传数据
                  </div>
                  <p className="text-gray-400 text-sm">选择填写好的 Excel 文件，系统将自动解析并更新显示屏。</p>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".xlsx, .xls"
                    className="hidden"
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    <Upload size={20} /> 上传并导入赛程
                  </button>
                </div>

                <p className="text-center text-gray-600 text-xs pb-4">
                  提示：导入新数据后将覆盖当前显示的赛程。
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 20s linear infinite;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1a1a1a;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #333;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #444;
        }
      `}</style>
    </div>
  );
}
