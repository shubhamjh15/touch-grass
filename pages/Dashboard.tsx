import React from 'react';
import { NeoCard } from '../components/ui/NeoCard';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Info } from 'lucide-react';

const tempData = [
  { year: '2020', temp: 0.9 },
  { year: '2021', temp: 0.95 },
  { year: '2022', temp: 1.0 },
  { year: '2023', temp: 1.1 },
  { year: '2024', temp: 1.15 },
  { year: '2025', temp: 1.2 },
];

const impactData = [
  { name: 'Transport', value: 400 },
  { name: 'Energy', value: 300 },
  { name: 'Diet', value: 300 },
  { name: 'Waste', value: 200 },
];

export const Dashboard: React.FC = () => {
  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h2 className="text-4xl font-extrabold mb-2">Global Impact Dashboard</h2>
          <p className="text-lg font-medium text-gray-600">See the numbers. Change the future.</p>
        </div>
        <div className="bg-neo-yellow px-4 py-2 border-2 border-neo-black rounded-lg font-bold shadow-neo-sm">
          Live Data Sync 🟢
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Global Temp Graph */}
        <NeoCard className="h-[400px] flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              Global Temp Rise (°C)
              <div className="group relative">
                <Info size={16} className="text-gray-500 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 bg-black text-white text-xs p-2 rounded z-10">
                  Anomaly relative to 1951-1980 average.
                </div>
              </div>
            </h3>
          </div>
          <div className="flex-1 w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={tempData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="year" tick={{fontFamily: 'Space Grotesk'}} />
                <YAxis tick={{fontFamily: 'Space Grotesk'}} />
                <Tooltip 
                  contentStyle={{ border: '2px solid black', borderRadius: '8px', boxShadow: '4px 4px 0px 0px black' }}
                />
                <Area type="monotone" dataKey="temp" stroke="#ef4444" fill="#fca5a5" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </NeoCard>

        {/* CO2 Savings Breakdown */}
        <NeoCard className="h-[400px] flex flex-col" color="white">
           <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">Community Savings (kg CO₂)</h3>
          </div>
          <div className="flex-1 w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={impactData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{fontFamily: 'Space Grotesk'}} />
                <YAxis tick={{fontFamily: 'Space Grotesk'}} />
                <Tooltip 
                  cursor={{fill: '#f3f4f6'}}
                  contentStyle={{ border: '2px solid black', borderRadius: '8px', boxShadow: '4px 4px 0px 0px black' }}
                />
                <Bar dataKey="value" fill="#4ade80" stroke="#000" strokeWidth={2} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </NeoCard>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         <NeoCard color="blue" className="text-center py-8">
            <div className="text-3xl font-bold mb-1">1,240</div>
            <div className="text-sm font-bold uppercase">Trees Planted</div>
         </NeoCard>
         <NeoCard color="pink" className="text-center py-8">
            <div className="text-3xl font-bold mb-1">45k</div>
            <div className="text-sm font-bold uppercase">Plastic Bottles Saved</div>
         </NeoCard>
         <NeoCard color="yellow" className="text-center py-8">
            <div className="text-3xl font-bold mb-1">890</div>
            <div className="text-sm font-bold uppercase">Active Missions</div>
         </NeoCard>
         <NeoCard color="green" className="text-center py-8">
            <div className="text-3xl font-bold mb-1">12</div>
            <div className="text-sm font-bold uppercase">Countries Reached</div>
         </NeoCard>
      </div>
    </div>
  );
};