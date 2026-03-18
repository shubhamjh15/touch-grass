import React, { useState } from 'react';
import { NeoCard } from '../components/ui/NeoCard';
import { NeoButton } from '../components/ui/NeoButton';
import { NeoModal } from '../components/ui/NeoModal';
import { ImpactChart } from '../components/ImpactChart';
import { UserStats, ActionLog } from '../types';
import { Flame, Trophy, Share2, PlusCircle } from 'lucide-react';

interface TrackerProps {
  stats: UserStats;
  logs: ActionLog[];
  onLogAction: (name: string, xp: number, co2: number, icon: string) => void;
}

export const Tracker: React.FC<TrackerProps> = ({ stats, logs, onLogAction }) => {
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customAction, setCustomAction] = useState({ name: '', co2: '1.0' });
  
  // Progress within the current level (0-999)
  const currentLevelProgress = stats.xp % 1000;
  const progressPercentage = (currentLevelProgress / 1000) * 100;

  const handleShare = () => {
    const text = `I just reached Level ${stats.level} on Sustain-a-thon! 🌍 Saved ${stats.co2Saved.toFixed(1)}kg of CO2. #FixTheFuture`;
    if (navigator.share) {
      navigator.share({
        title: 'Sustain-a-thon Progress',
        text: text,
        url: window.location.href
      }).catch(console.error);
    } else {
      alert(`Share this to your socials:\n\n"${text}"`);
    }
  };

  const submitCustomAction = () => {
    if (customAction.name) {
      onLogAction(customAction.name, 50, parseFloat(customAction.co2), '✨');
      setShowCustomModal(false);
      setCustomAction({ name: '', co2: '1.0' });
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header Stats */}
      <div className="grid md:grid-cols-3 gap-6">
        <NeoCard color="yellow" className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold uppercase mb-1">Current Streak</div>
            <div className="text-4xl font-extrabold flex items-center gap-2">
              {stats.streak} <Flame className="text-orange-500 fill-orange-500" />
            </div>
            <div className="text-xs font-medium mt-1">Days on fire!</div>
          </div>
        </NeoCard>

        <NeoCard color="blue" className="md:col-span-2">
           <div className="flex justify-between items-center mb-2">
              <div className="font-bold text-lg">Level {stats.level} Eco-Warrior</div>
              <div className="font-bold">{stats.xp} XP</div>
           </div>
           <div className="w-full h-8 bg-white border-2 border-neo-black rounded-full overflow-hidden relative">
              <div 
                className="h-full bg-neo-green transition-all duration-500"
                style={{ width: `${progressPercentage}%` }}
              ></div>
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold pointer-events-none mix-blend-multiply">
                {Math.round(progressPercentage)}% to Level {stats.level + 1}
              </div>
           </div>
        </NeoCard>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Quick Actions */}
        <div className="md:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
             <h2 className="text-3xl font-bold">Log Action</h2>
             <NeoButton size="sm" onClick={() => setShowCustomModal(true)}>
               <PlusCircle size={16} /> Custom
             </NeoButton>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { name: 'Recycled', xp: 50, co2: 0.5, icon: '♻️', color: 'bg-green-200' },
              { name: 'Veggie Meal', xp: 75, co2: 1.5, icon: '🥗', color: 'bg-green-300' },
              { name: 'Public Transport', xp: 100, co2: 2.2, icon: '🚌', color: 'bg-blue-200' },
              { name: 'Thrifting', xp: 80, co2: 1.1, icon: '👕', color: 'bg-pink-200' },
              { name: 'Cold Wash', xp: 60, co2: 0.8, icon: '🧺', color: 'bg-blue-300' },
              { name: 'Refill Bottle', xp: 30, co2: 0.2, icon: '🚰', color: 'bg-yellow-200' },
            ].map((action) => (
              <button
                key={action.name}
                onClick={() => onLogAction(action.name, action.xp, action.co2, action.icon)}
                className={`${action.color} border-4 border-neo-black rounded-xl p-4 shadow-neo hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all flex flex-col items-center justify-center gap-2`}
              >
                <span className="text-3xl">{action.icon}</span>
                <span className="font-bold text-sm text-center">{action.name}</span>
                <span className="text-xs font-medium bg-white px-2 py-0.5 rounded border border-black">+{action.xp} XP</span>
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
               <h2 className="text-3xl font-bold pt-4 mb-4">Your Impact</h2>
               <NeoCard className="h-80 flex items-center justify-center">
                  <ImpactChart logs={logs} />
               </NeoCard>
            </div>
            <div>
              <h2 className="text-3xl font-bold pt-4 mb-4">Recent History</h2>
              <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                {logs.length === 0 && <div className="text-gray-500 italic">No actions logged yet. Start now!</div>}
                {logs.map((log) => (
                  <div key={log.id} className="bg-white border-2 border-neo-black p-4 rounded-lg flex justify-between items-center shadow-neo-sm animate-fade-in">
                    <div className="flex items-center gap-4">
                      <span className="text-2xl bg-gray-100 p-2 rounded-lg border border-black">{log.icon}</span>
                      <div>
                        <div className="font-bold">{log.type}</div>
                        <div className="text-sm text-gray-500">{log.date}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-neo-green">+{log.xpReward} XP</div>
                      <div className="text-xs font-medium">Saved {log.co2Impact}kg</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Leaderboard & Badges */}
        <div className="space-y-6">
          <NeoCard>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Trophy className="text-neo-yellow fill-neo-yellow" />
                <h3 className="text-xl font-bold">Your Badges</h3>
              </div>
              <button onClick={handleShare} className="text-xs font-bold flex items-center gap-1 hover:text-neo-blue">
                <Share2 size={14} /> Share
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {stats.badges.map((badge, idx) => (
                <div key={idx} className="bg-neo-pink text-xs font-bold px-2 py-1 border-2 border-black rounded shadow-[2px_2px_0px_0px_black]">
                  {badge}
                </div>
              ))}
              <div className="bg-gray-200 text-xs font-bold px-2 py-1 border-2 border-gray-400 rounded text-gray-400 border-dashed">
                +3 Locked
              </div>
            </div>
          </NeoCard>

          <NeoCard color="white">
            <h3 className="text-xl font-bold mb-4">Global Leaderboard</h3>
            <div className="space-y-3">
              {[
                { name: 'EcoQueen99', xp: 5400, rank: 1 },
                { name: 'GreenNinja', xp: 4800, rank: 2 },
                { name: 'You', xp: stats.xp, rank: 3, active: true },
                { name: 'PlanetSaver', xp: 1100, rank: 4 },
              ].map((user) => (
                <div key={user.name} className={`flex justify-between items-center p-2 rounded border-2 ${user.active ? 'bg-neo-yellow border-black' : 'border-transparent'}`}>
                  <div className="flex items-center gap-3">
                    <span className={`font-bold w-6 text-center ${user.rank <= 3 ? 'text-xl' : 'text-base'}`}>
                      {user.rank === 1 ? '🥇' : user.rank === 2 ? '🥈' : user.rank === 3 ? '🥉' : `#${user.rank}`}
                    </span>
                    <span className="font-bold">{user.name}</span>
                  </div>
                  <span className="font-mono text-sm">{user.xp} XP</span>
                </div>
              ))}
            </div>
            <NeoButton size="sm" variant="outline" className="w-full mt-4">
              View All <Share2 size={16} />
            </NeoButton>
          </NeoCard>
        </div>
      </div>

      {/* Custom Action Modal */}
      <NeoModal
        isOpen={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        title="Log Custom Action"
      >
        <div className="space-y-4">
           <div>
             <label className="block font-bold mb-2">Activity Name</label>
             <input 
               className="w-full border-2 border-black rounded p-2"
               placeholder="e.g. Planted a garden"
               value={customAction.name}
               onChange={(e) => setCustomAction({...customAction, name: e.target.value})} 
             />
           </div>
           <div>
             <label className="block font-bold mb-2">Est. CO2 Saved (kg)</label>
             <input 
               type="number"
               className="w-full border-2 border-black rounded p-2"
               value={customAction.co2}
               onChange={(e) => setCustomAction({...customAction, co2: e.target.value})} 
             />
           </div>
           <NeoButton className="w-full" onClick={submitCustomAction}>
             Log Activity (+50 XP)
           </NeoButton>
        </div>
      </NeoModal>
    </div>
  );
};