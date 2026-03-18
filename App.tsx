import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { Dashboard } from './pages/Dashboard';
import { Tracker } from './pages/Tracker';
import { Education } from './pages/Education';
import { Community } from './pages/Community';
import { AiAssistant } from './pages/AiAssistant';
import { Missions } from './pages/Missions';
import { Loader } from './components/ui/Loader';
import { Page, UserStats, ActionLog } from './types';
import { INITIAL_USER_STATS, RECENT_LOGS } from './constants';
import { AnimatePresence } from 'framer-motion';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>(Page.HOME);
  const [loading, setLoading] = useState(true);

  // Loader Logic
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2500); // Show loader for 2.5 seconds
    return () => clearTimeout(timer);
  }, []);
  
  // Global State for Gamification
  const [stats, setStats] = useState<UserStats>(() => {
    const saved = localStorage.getItem('userStats');
    return saved ? JSON.parse(saved) : INITIAL_USER_STATS;
  });
  
  const [logs, setLogs] = useState<ActionLog[]>(() => {
    const saved = localStorage.getItem('actionLogs');
    return saved ? JSON.parse(saved) : RECENT_LOGS;
  });

  // Persistence
  React.useEffect(() => {
    localStorage.setItem('userStats', JSON.stringify(stats));
    localStorage.setItem('actionLogs', JSON.stringify(logs));
  }, [stats, logs]);

  const checkUnlocks = (currentStats: UserStats) => {
    const newBadges = [...currentStats.badges];
    let unlocked = false;

    if (currentStats.co2Saved >= 10 && !newBadges.includes('10kg Club')) {
      newBadges.push('10kg Club');
      unlocked = true;
    }
    if (currentStats.level >= 10 && !newBadges.includes('Eco Master')) {
      newBadges.push('Eco Master');
      unlocked = true;
    }

    return unlocked ? newBadges : null;
  };

  // Badge Unlock Notification Effect
  const prevBadgesRef = React.useRef(stats.badges);
  useEffect(() => {
    const newBadges = stats.badges.filter(b => !prevBadgesRef.current.includes(b));
    newBadges.forEach(badge => {
      alert(`🎉 BADGE UNLOCKED: ${badge}!`);
    });
    prevBadgesRef.current = stats.badges;
  }, [stats.badges]);

  // Centralized XP and Action Logging Logic
  const handleLogAction = (actionName: string, xp: number, co2: number, icon: string) => {
    const newLog: ActionLog = {
      id: Date.now().toString(),
      type: actionName,
      co2Impact: co2,
      xpReward: xp,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      icon
    };
    
    setLogs(prevLogs => [newLog, ...prevLogs]);
    
    setStats(prev => {
      const newXp = prev.xp + xp;
      const newLevel = Math.floor(newXp / 1000) + 1;
      const newCo2 = prev.co2Saved + co2;
      
      const tempStats = { ...prev, xp: newXp, level: newLevel, co2Saved: newCo2 };
      const newBadges = checkUnlocks(tempStats);

      return {
        ...tempStats,
        badges: newBadges || prev.badges
      };
    });
  };

  const handleAddXpOnly = (xp: number) => {
    setStats(prev => {
      const newXp = prev.xp + xp;
      const newLevel = Math.floor(newXp / 1000) + 1;
      return { ...prev, xp: newXp, level: newLevel };
    });
  };

  const renderPage = () => {
    switch (currentPage) {
      case Page.HOME: return <Home setPage={setCurrentPage} />;
      case Page.DASHBOARD: return <Dashboard />;
      case Page.TRACKER: return <Tracker stats={stats} logs={logs} onLogAction={handleLogAction} />;
      case Page.EDUCATION: return <Education />;
      case Page.COMMUNITY: return <Community />;
      case Page.ASSISTANT: return <AiAssistant userStats={stats} />;
      case Page.MISSIONS: return <Missions onCompleteMission={handleAddXpOnly} />;
      default: return <Home setPage={setCurrentPage} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#f0fdf4] text-neo-black selection:bg-neo-pink selection:text-white pb-8">
      <AnimatePresence>
        {loading && <Loader />}
      </AnimatePresence>

      {!loading && (
        <>
          <Navbar currentPage={currentPage} setPage={setCurrentPage} />
          <main className="max-w-7xl mx-auto px-4 md:px-6">
            {renderPage()}
          </main>
        </>
      )}
    </div>
  );
}

export default App;