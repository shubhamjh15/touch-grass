import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ActionLog } from '../types';

interface ImpactChartProps {
  logs: ActionLog[];
}
    
const COLORS = ['#00C853', '#2962FF', '#FFD600', '#FF1744', '#AA00FF', '#00E5FF'];

export const ImpactChart: React.FC<ImpactChartProps> = ({ logs }) => {
  // Aggregate data by action type
  const dataMap = logs.reduce((acc, log) => {
    acc[log.type] = (acc[log.type] || 0) + log.co2Impact;           
    return acc;
  }, {} as Record<string, number>);

  const data = Object.entries(dataMap).map(([name, value]) => ({
    name,
    value: parseFloat(value.toFixed(1))
  })).filter(item => item.value > 0);

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500 font-bold border-2 border-dashed border-gray-300 rounded-lg">
        Log actions to see your impact! 📉
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            fill="#8884d8"
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="black" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'white', 
              border: '2px solid black', 
              borderRadius: '8px',
              fontWeight: 'bold',
              boxShadow: '4px 4px 0px 0px black'
            }} 
          />
          <Legend iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
