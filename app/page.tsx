'use client';

import { useEffect, useState, useCallback } from 'react';
import { User } from '@/lib/db/schema';

// Types for the AI response from server
interface AiContext {
  style: string;
  title: string;
  description: string;
  emoji: string;
  borderColor: string;
  textColor: string;
  bgColor: string;
}

interface RecentWin {
  player: string;
  amount: number;
  roll: number;
  isJackpot: boolean;
}

interface GameResult {
  roll: number;
  isWin: boolean;
  payout: number;
  profit: number;
  aiContext: AiContext;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jackpot, setJackpot] = useState<number | null>(null); // null = loading
  const [recentWins, setRecentWins] = useState<RecentWin[]>([]);
  const [betAmount, setBetAmount] = useState<number>(10);
  const [isLoading, setIsLoading] = useState(true);
  const [isRolling, setIsRolling] = useState(false);
  
  // State for game result
  const [gameResult, setGameResult] = useState<GameResult | null>(null);

  // Fetch current game state (jackpot + recent wins)
  const fetchGameState = useCallback(async () => {
    try {
      const res = await fetch('/api/gamble', { method: 'GET' });
      const data = await res.json();
      if (data.success) {
        setJackpot(data.jackpot);
        setRecentWins(data.recentWins || []);
      }
    } catch (e) {
      console.error('Failed to fetch game state:', e);
    }
  }, []);

  // Auth + initial state load
  useEffect(() => {
    const authenticate = async () => {
      if (typeof window !== 'undefined') {
        const WebApp = (await import('@twa-dev/sdk')).default;
        WebApp.ready();
        WebApp.expand();

        // Fetch game state regardless of auth
        fetchGameState();

        if (WebApp.initData) {
          try {
            const response = await fetch('/api/auth', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ initData: WebApp.initData }),
            });

            if (response.ok) {
              const data = await response.json();
              setUser(data.user);
            } else {
              setError('Authentication failed');
            }
          } catch (e) {
            setError('Network error');
          } finally {
            setIsLoading(false);
          }
        } else {
          setError('Please open this inside Telegram');
          setIsLoading(false);
        }
      }
    };
    authenticate();
  }, [fetchGameState]);

  // Periodic jackpot refresh (every 30 seconds)
  useEffect(() => {
    const interval = setInterval(fetchGameState, 30000);
    return () => clearInterval(interval);
  }, [fetchGameState]);

  const handleDailyClaim = async () => {
    if (!user) return;
    const WebApp = (await import('@twa-dev/sdk')).default;

    try {
      const res = await fetch('/api/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId: user.telegramId }),
      });
      const data = await res.json();
      
      if (data.success) {
        setUser({ ...user, balance: data.balance });
        WebApp.HapticFeedback.notificationOccurred('success');
        WebApp.showAlert(data.message);
      } else {
        WebApp.HapticFeedback.notificationOccurred('error');
        WebApp.showAlert(data.error || "Failed to claim");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleGamble = async () => {
    if (!user || betAmount <= 0 || betAmount > user.balance) return;
    
    // UI Reset
    setIsRolling(true);
    setGameResult(null);
    
    const WebApp = (await import('@twa-dev/sdk')).default;
    WebApp.HapticFeedback.impactOccurred('medium');
    
    try {
      const res = await fetch('/api/gamble', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          telegramId: user.telegramId,
          betAmount: Math.floor(betAmount) // Ensure integer
        }),
      });
      const data = await res.json();

      // Artificial delay for suspense
      setTimeout(() => {
        setIsRolling(false);
        if (data.success) {
          setUser({ ...user, balance: data.balance });
          setJackpot(data.jackpot);
          
          // Set complete game result
          setGameResult({
            roll: data.roll,
            isWin: data.isWin,
            payout: data.payout,
            profit: data.profit,
            aiContext: data.aiContext
          });
          
          if (data.aiContext.style === "success" || data.aiContext.style === "jackpot") {
            WebApp.HapticFeedback.notificationOccurred('success');
          } else {
            WebApp.HapticFeedback.notificationOccurred('warning');
          }

          // Refresh recent wins after a bet
          fetchGameState();
        } else {
          WebApp.HapticFeedback.notificationOccurred('error');
          WebApp.showAlert(data.error || "Error");
        }
      }, 800);

    } catch (e) {
      setIsRolling(false);
      const WebApp = (await import('@twa-dev/sdk')).default;
      WebApp.showAlert("Network Error");
    }
  };

  // Bet amount helpers
  const handleSetMax = () => {
    if (user) setBetAmount(user.balance);
  };

  const handleHalf = () => {
    setBetAmount(prev => Math.max(1, Math.floor(prev / 2)));
  };

  const handleDouble = () => {
    if (user) {
      setBetAmount(prev => Math.min(user.balance, prev * 2));
    }
  };

  if (isLoading) return (
    <div className="flex h-screen w-full items-center justify-center bg-[#0f172a] text-blue-500">
      <svg className="animate-spin h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>
  );

  if (error) return (
    <div className="flex h-screen w-full items-center justify-center bg-[#0f172a] text-red-400 font-medium p-6 text-center">
      {error}
    </div>
  );

  return (
    <div className="min-h-screen w-full p-4 flex flex-col gap-6 max-w-lg mx-auto pb-12 bg-[#0f172a] text-slate-100 font-sans selection:bg-blue-500/30">
      
      {/* Navbar */}
      <header className="flex justify-between items-center py-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20 ring-2 ring-slate-800">
            {user?.firstName?.charAt(0) || "U"}
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Player</span>
            <span className="font-bold text-slate-100 leading-tight">{user?.firstName}</span>
          </div>
        </div>
        
        <div className="glass-card px-4 py-2 rounded-full flex items-center gap-2 bg-slate-800/50 border border-slate-700/50">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.5)]"></div>
          <span className="font-mono font-bold text-emerald-400 tracking-tight">${user?.balance.toLocaleString()}</span>
        </div>
      </header>

      {/* Jackpot Hero */}
      <section className="relative w-full rounded-3xl overflow-hidden p-8 text-center shadow-2xl shadow-amber-500/10 border border-amber-500/20 bg-gradient-to-b from-slate-900 to-slate-900">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/20 via-slate-900/0 to-slate-900/0 pointer-events-none"></div>
        
        <h2 className="text-amber-500 font-bold tracking-[0.2em] text-[10px] uppercase mb-1">Global Vault</h2>
        <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-200 to-amber-600 drop-shadow-sm mb-4 tracking-tight">
          {jackpot !== null ? `$${jackpot.toLocaleString()}` : (
            <span className="inline-block w-32 h-12 bg-slate-800 rounded-lg animate-pulse"></span>
          )}
        </div>
        
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-950/30 border border-amber-500/20 text-amber-400 text-xs font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            Roll 100 to Win 50%
          </div>
        </div>
      </section>

      {/* Recent Wins Ticker */}
      {recentWins.length > 0 && (
        <div className="overflow-hidden rounded-xl bg-slate-800/30 border border-slate-700/30 py-2 px-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-bold uppercase tracking-wider shrink-0">Recent:</span>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide">
              {recentWins.map((win, idx) => (
                <span key={idx} className={`shrink-0 ${win.isJackpot ? 'text-amber-400' : 'text-green-400'}`}>
                  {win.player} won ${win.amount.toLocaleString()}
                  {win.isJackpot && ' 🎰'}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="flex flex-col gap-4">
        
        {/* Daily Claim */}
        <div className="glass-card rounded-2xl p-5 flex justify-between items-center bg-slate-800/40 border border-slate-700/50">
          <div className="flex flex-col gap-1">
            <span className="text-slate-100 font-bold">Daily Supply</span>
            <span className="text-slate-400 text-xs">Resets every 24h</span>
          </div>
          <button 
            onClick={handleDailyClaim}
            className="px-5 py-2.5 bg-gradient-to-b from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-slate-200 text-sm font-bold rounded-xl border-t border-slate-600 shadow-lg active:scale-95 transition-all"
          >
            + $100
          </button>
        </div>

        {/* Betting Interface */}
        <div className="glass-card rounded-3xl p-6 flex flex-col gap-6 bg-slate-900/60 border border-slate-800 shadow-xl backdrop-blur-xl">
          
          {/* Win Probability Info */}
          <div className="flex justify-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <span className="text-slate-400">49% Win (2x)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span className="text-slate-400">1% Jackpot</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              <span className="text-slate-400">50% Lose</span>
            </div>
          </div>

          {/* Bet Controls */}
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-end px-1">
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider">Wager</label>
              <span className="text-xs text-slate-500 font-mono">MAX: ${user?.balance.toLocaleString()}</span>
            </div>

            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="text-slate-500 font-bold text-lg">$</span>
              </div>
              <input 
                type="number" 
                value={betAmount}
                onChange={(e) => setBetAmount(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-10 pr-4 text-2xl font-bold text-white placeholder-slate-700 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all font-mono"
              />
            </div>

            {/* Quick Bet Buttons */}
            <div className="grid grid-cols-5 gap-2">
              {[10, 50, 100, 500].map(amt => (
                <button 
                  key={amt}
                  onClick={() => setBetAmount(amt)}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${
                    betAmount === amt 
                      ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' 
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                  }`}
                >
                  ${amt}
                </button>
              ))}
              <button 
                onClick={handleSetMax}
                className="py-2.5 rounded-xl text-xs font-bold transition-all border bg-amber-900/50 border-amber-700/50 text-amber-400 hover:bg-amber-800/50"
              >
                MAX
              </button>
            </div>

            {/* Half / Double Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={handleHalf}
                disabled={betAmount <= 1}
                className="py-2 rounded-xl text-xs font-bold transition-all border bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ½ Half
              </button>
              <button 
                onClick={handleDouble}
                disabled={!user || betAmount * 2 > user.balance}
                className="py-2 rounded-xl text-xs font-bold transition-all border bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                2× Double
              </button>
            </div>
          </div>

          {/* Action Button */}
          <button 
            onClick={handleGamble}
            disabled={!user || user.balance < betAmount || isRolling || betAmount <= 0}
            className={`
              relative w-full py-4 rounded-2xl font-black text-lg tracking-wide uppercase transition-all duration-200 overflow-hidden group
              ${(!user || user.balance < betAmount || betAmount <= 0)
                ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-900/20 active:scale-[0.98] hover:shadow-blue-600/30 border-t border-blue-400/20'
              }
            `}
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 blur-md"></div>
            <div className="relative flex items-center justify-center gap-2">
              {isRolling ? (
                <>
                  <span className="animate-pulse">Processing</span>
                  <svg className="animate-spin h-5 w-5 text-white/50" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </>
              ) : (
                <>
                  <span>Initiate Roll</span>
                  <svg className="w-5 h-5 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                </>
              )}
            </div>
          </button>

          {/* Result Display Area */}
          <div className="min-h-[120px] relative">
            {isRolling ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-2 animate-pulse">
                <span className="font-mono text-xs uppercase tracking-widest">Calculations pending...</span>
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></span>
                </div>
              </div>
            ) : gameResult ? (
              <div className={`
                flex flex-col gap-3 p-4 rounded-xl border animate-in slide-in-from-bottom-2 duration-500
                ${gameResult.aiContext.bgColor} ${gameResult.aiContext.borderColor}
              `}>
                {/* Roll Number Display */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`
                      w-14 h-14 rounded-xl flex items-center justify-center font-black text-2xl
                      ${gameResult.roll === 100 
                        ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-900' 
                        : gameResult.isWin 
                          ? 'bg-gradient-to-br from-green-500 to-green-700 text-white' 
                          : 'bg-gradient-to-br from-red-500 to-red-700 text-white'
                      }
                    `}>
                      {gameResult.roll}
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${gameResult.aiContext.textColor} opacity-80`}>
                        {gameResult.aiContext.title}
                      </span>
                      <span className={`text-lg font-bold ${gameResult.aiContext.textColor}`}>
                        {gameResult.isWin ? `+$${gameResult.profit.toLocaleString()}` : `-$${Math.abs(gameResult.profit).toLocaleString()}`}
                      </span>
                    </div>
                  </div>
                  <span className="text-3xl">{gameResult.aiContext.emoji}</span>
                </div>
                
                {/* AI Message */}
                <p className={`text-sm font-medium leading-relaxed ${gameResult.aiContext.textColor} opacity-90`}>
                  {gameResult.aiContext.description}
                </p>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-slate-700 text-sm font-medium border-2 border-dashed border-slate-800 rounded-xl">
                Ready for input
              </div>
            )}
          </div>

        </div>
      </main>

      <footer className="text-center">
        <p className="text-[10px] uppercase tracking-widest text-slate-600 font-bold">
          Provably Fair • Neon DB • Ver 1.1
        </p>
      </footer>
    </div>
  );
}