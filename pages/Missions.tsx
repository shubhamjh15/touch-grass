import React, { useState } from 'react';
import { MISSIONS } from '../constants';
import { NeoCard } from '../components/ui/NeoCard';
import { CheckCircle2, Circle, Share2 } from 'lucide-react';

interface MissionsProps {
  onCompleteMission: (xp: number) => void;
}

export const Missions: React.FC<MissionsProps> = ({ onCompleteMission }) => {
  const [missions, setMissions] = useState(MISSIONS);

  const toggleMission = (id: string) => {
    setMissions(missions.map(m => {
      if (m.id === id) {
        // Only give XP if transitioning from incomplete to complete
        if (!m.completed) {
          onCompleteMission(m.rewardXP);
        }
        return { ...m, completed: !m.completed };
      }
      return m;
    }));
  };

  const handleShare = (missionTitle: string) => {
     const text = `I just completed the "${missionTitle}" mission on Sustain-a-thon! 🌿 #FixTheFuture`;
    if (navigator.share) {
      navigator.share({
        title: 'Mission Accomplished!',
        text: text,
        url: window.location.href
      }).catch(console.error);
    } else {
      alert(`Share this achievement:\n\n"${text}"`);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="text-4xl font-extrabold mb-4">Weekly Missions</h2>
        <p className="text-xl text-gray-600">Complete challenges to earn massive XP boosts and real-world impact.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {missions.map((mission) => (
          <NeoCard 
            key={mission.id} 
            color={mission.completed ? 'green' : 'white'}
            className={`transition-all duration-300 ${mission.completed ? 'opacity-90' : ''}`}
          >
            <div className="flex flex-col h-full justify-between">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded border border-black ${mission.type === 'weekly' ? 'bg-neo-pink' : 'bg-neo-blue'}`}>
                      {mission.type.toUpperCase()}
                    </span>
                    <span className="text-xs font-bold text-gray-500">+{mission.rewardXP} XP</span>
                  </div>
                  <h3 className={`text-2xl font-bold mb-2 ${mission.completed ? 'line-through decoration-4' : ''}`}>
                    {mission.title}
                  </h3>
                  <p className="font-medium">{mission.description}</p>
                </div>
                <button onClick={() => toggleMission(mission.id)}>
                  {mission.completed ? (
                    <CheckCircle2 size={40} className="fill-black text-white" />
                  ) : (
                    <Circle size={40} className="text-black hover:fill-gray-200" />
                  )}
                </button>
              </div>
              
              {mission.completed && (
                <div className="mt-4 pt-4 border-t-2 border-black/10 flex justify-end">
                  <button 
                    onClick={() => handleShare(mission.title)}
                    className="flex items-center gap-2 text-sm font-bold hover:text-white transition-colors"
                  >
                    <Share2 size={16} /> Share Achievement
                  </button>
                </div>
              )}
            </div>
          </NeoCard>
        ))}
      </div>
    </div>
  );
};