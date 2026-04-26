import React, { useState } from 'react';
import { NeoCard } from '../components/ui/NeoCard';
import { CheckCircle2, Circle, Share2, Flame, Leaf, Zap, Droplets } from 'lucide-react';

interface MissionsProps {
  onCompleteMission: (xp: number) => void;
}

const EXPANDED_MISSIONS = [
  // Daily
  { id: 'd1', title: 'Vampire Slayer', description: 'Unplug 3 "vampire" appliances (chargers, TVs, microwaves) when not in use.', rewardXP: 50, completed: false, type: 'daily', category: 'Energy', icon: <Zap size={20} /> },
  { id: 'd2', title: 'Zero-Waste Lunch', description: 'Pack a lunch using 0 single-use plastics or disposable bags.', rewardXP: 75, completed: false, type: 'daily', category: 'Waste', icon: <Leaf size={20} /> },
  { id: 'd3', title: 'The Cold Wash', description: 'Wash today\'s load of laundry entirely on the cold water setting.', rewardXP: 60, completed: false, type: 'daily', category: 'Energy', icon: <Droplets size={20} /> },
  { id: 'd4', title: 'Meatless Day', description: 'Eat 100% plant-based meals for the entire day. Save water and cut methane!', rewardXP: 100, completed: true, type: 'daily', category: 'Diet', icon: <Leaf size={20} /> },
  { id: 'd5', title: '5-Minute Shower', description: 'Time your shower and keep it under 5 minutes to save up to 15 gallons of water.', rewardXP: 80, completed: false, type: 'daily', category: 'Water', icon: <Droplets size={20} /> },
  // Weekly
  { id: 'w1', title: 'Plastic-Free Week', description: 'Avoid buying ANY new single-use plastics for 7 consecutive days.', rewardXP: 500, completed: false, type: 'weekly', category: 'Waste', icon: <Leaf size={20} /> },
  { id: 'w2', title: 'Transit Commuter', description: 'Take public transit, walk, or bike to work/school for at least 3 days this week.', rewardXP: 400, completed: false, type: 'weekly', category: 'Transport', icon: <Flame size={20} /> },
  { id: 'w3', title: 'Local Locavore', description: 'Buy your weekly groceries entirely from local farmers or local produce sections.', rewardXP: 350, completed: false, type: 'weekly', category: 'Diet', icon: <Leaf size={20} /> },
  { id: 'w4', title: 'The Fixer', description: 'Instead of throwing something away, repair a broken item of clothing, tech, or furniture.', rewardXP: 300, completed: false, type: 'weekly', category: 'Waste', icon: <Zap size={20} /> },
  { id: 'w5', title: 'Compost Starter', description: 'Collect all your organic food waste for a week and start a compost bin (or drop it off).', rewardXP: 450, completed: false, type: 'weekly', category: 'Waste', icon: <Leaf size={20} /> },
  // Epic
  { id: 'e1', title: 'Plant a Tree', description: 'Physically plant a native tree in your community or donate to a certified tree-planting organization.', rewardXP: 1000, completed: false, type: 'epic', category: 'Nature', icon: <Leaf size={20} /> },
  { id: 'e2', title: 'Energy Audit', description: 'Conduct a full home energy audit. Switch 100% of bulbs to LEDs and seal window drafts.', rewardXP: 1500, completed: false, type: 'epic', category: 'Energy', icon: <Zap size={20} /> },
  { id: 'e3', title: 'Community Cleanup', description: 'Organize or participate in a local neighborhood, beach, or park trash cleanup event.', rewardXP: 2000, completed: false, type: 'epic', category: 'Community', icon: <Flame size={20} /> },
  { id: 'e4', title: 'Advocate', description: 'Write a letter or call your local representative demanding action on a specific climate policy.', rewardXP: 1200, completed: false, type: 'epic', category: 'Advocacy', icon: <Flame size={20} /> },
];

export const Missions: React.FC<MissionsProps> = ({ onCompleteMission }) => {
  const [missions, setMissions] = useState(EXPANDED_MISSIONS);
  const [filter, setFilter] = useState<'all' | 'daily' | 'weekly' | 'epic'>('all');

  const toggleMission = (id: string) => {
    setMissions(missions.map(m => {
      if (m.id === id) {
        if (!m.completed) {
          onCompleteMission(m.rewardXP);
        }
        return { ...m, completed: !m.completed };
      }
      return m;
    }));
  };

  const handleShare = (missionTitle: string) => {
     const text = `I just completed the Epic "${missionTitle}" mission on Sustain-a-thon! 🌿 I'm leveling up my eco-impact. #FixTheFuture`;
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

  const filteredMissions = missions.filter(m => filter === 'all' || m.type === filter);

  return (
    <div className="space-y-8 pb-12 animate-fade-in">
      <div className="text-center max-w-3xl mx-auto mt-8">
        <h2 className="text-5xl font-black mb-4 tracking-tight">Eco-Missions</h2>
        <p className="text-xl text-gray-600 font-medium">Accept challenges, build habits, and earn massive XP. Small daily actions stack up to global change.</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap justify-center gap-3">
        {['all', 'daily', 'weekly', 'epic'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`px-6 py-2 rounded-full font-bold border-4 border-neo-black transition-all ${
              filter === f 
                ? 'bg-neo-yellow shadow-neo translate-x-[-2px] translate-y-[-2px]' 
                : 'bg-white hover:bg-gray-100'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)} Missions
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {filteredMissions.map((mission) => (
          <NeoCard 
            key={mission.id} 
            color={mission.completed ? 'green' : 'white'}
            className={`transition-all duration-300 ${mission.completed ? 'opacity-90' : 'hover:-translate-y-2'} flex flex-col`}
          >
            <div className="flex flex-col h-full justify-between">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-xs font-bold px-3 py-1 rounded-md border-2 border-black flex items-center gap-1 ${
                      mission.type === 'epic' ? 'bg-neo-yellow' : 
                      mission.type === 'weekly' ? 'bg-neo-pink' : 'bg-neo-blue text-white'
                    }`}>
                      {mission.icon} {mission.type.toUpperCase()}
                    </span>
                    <span className="text-sm font-black text-gray-700 bg-white border-2 border-black px-2 py-0.5 rounded-md">
                      +{mission.rewardXP} XP
                    </span>
                  </div>
                  <h3 className={`text-2xl font-black mb-2 ${mission.completed ? 'line-through decoration-4 opacity-70' : ''}`}>
                    {mission.title}
                  </h3>
                  <p className="font-medium text-lg leading-relaxed text-gray-800">{mission.description}</p>
                </div>
                <button 
                  onClick={() => toggleMission(mission.id)}
                  className="active:scale-90 transition-transform flex-shrink-0 mt-2"
                >
                  {mission.completed ? (
                    <CheckCircle2 size={48} className="fill-black text-neo-green" />
                  ) : (
                    <Circle size={48} className="text-gray-300 hover:text-black transition-colors" />
                  )}
                </button>
              </div>
              
              {mission.completed && (
                <div className="mt-6 pt-4 border-t-4 border-black/10 flex justify-between items-center">
                  <span className="font-bold text-sm text-green-900">Awesome job! 🌍</span>
                  <button 
                    onClick={() => handleShare(mission.title)}
                    className="flex items-center gap-2 text-sm font-black bg-white px-3 py-1.5 rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-50 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                  >
                    <Share2 size={16} /> Flex on Socials
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