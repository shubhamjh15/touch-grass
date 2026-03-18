import React, { useState } from 'react';
import { EDUCATION_MODULES } from '../constants';
import { NeoCard } from '../components/ui/NeoCard';
import { NeoButton } from '../components/ui/NeoButton';
import { NeoModal } from '../components/ui/NeoModal';
import { PlayCircle, CheckCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { EducationModule } from '../types';

export const Education: React.FC = () => {
  const [flippedCard, setFlippedCard] = useState<number | null>(null);
  const [selectedModule, setSelectedModule] = useState<EducationModule | null>(null);

  const myths = [
    { q: "Myth: Climate change is just a natural cycle.", a: "Fact: While Earth has cycles, the current warming rate is unprecedented and 100% driven by human greenhouse gas emissions." },
    { q: "Myth: One person can't make a difference.", a: "Fact: Individual actions drive market demand and policy change. Collective action is powerful!" },
    { q: "Myth: Renewable energy is too expensive.", a: "Fact: Solar and wind are now the cheapest sources of new electricity in most of the world." },
  ];

  return (
    <div className="space-y-12 pb-12">
      <div className="text-center">
        <h2 className="text-4xl font-extrabold mb-4">Knowledge is Power</h2>
        <p className="text-lg text-gray-600">Learn the facts, bust the myths, and become a climate genius.</p>
      </div>

      {/* Bite-sized Modules */}
      <section>
        <h3 className="text-2xl font-bold mb-6 border-b-4 border-neo-black inline-block">Micro-Learning Modules</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {EDUCATION_MODULES.map((mod) => (
            <NeoCard key={mod.id} color={mod.completed ? 'green' : 'white'} className="flex flex-col h-full">
              <div className="flex-1">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold border border-black px-1 rounded bg-gray-100">{mod.category}</span>
                  {mod.completed && <CheckCircle size={20} />}
                </div>
                <h4 className="text-xl font-bold mb-2">{mod.title}</h4>
                <p className="text-sm text-gray-600 mb-4">{mod.description}</p>
              </div>
              <NeoButton 
                size="sm" 
                variant={mod.completed ? 'outline' : 'secondary'} 
                className="w-full"
                onClick={() => setSelectedModule(mod)}
              >
                {mod.completed ? 'Review' : 'Start (+' + mod.readTime + ')'} <PlayCircle size={16} />
              </NeoButton>
            </NeoCard>
          ))}
        </div>
      </section>

      {/* Myth Buster Cards */}
      <section>
        <h3 className="text-2xl font-bold mb-6 border-b-4 border-neo-black inline-block">Myth Busters</h3>
        <div className="grid md:grid-cols-3 gap-6">
          {myths.map((item, idx) => (
            <div 
              key={idx} 
              className="h-64 cursor-pointer perspective-1000 group"
              onClick={() => setFlippedCard(flippedCard === idx ? null : idx)}
            >
              <div className={`relative w-full h-full transition-all duration-500 preserve-3d ${flippedCard === idx ? 'rotate-y-180' : ''}`}>
                {/* Front */}
                <div className="absolute inset-0 backface-hidden">
                  <NeoCard color="pink" className="h-full flex items-center justify-center text-center p-6">
                    <h4 className="text-xl font-bold">{item.q}</h4>
                    <p className="absolute bottom-4 text-sm font-bold opacity-50">Tap to reveal truth</p>
                  </NeoCard>
                </div>
                {/* Back */}
                <div className="absolute inset-0 backface-hidden rotate-y-180">
                  <NeoCard color="blue" className="h-full flex items-center justify-center text-center p-6">
                    <h4 className="text-lg font-bold">{item.a}</h4>
                  </NeoCard>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Learning Modal */}
      <NeoModal
        isOpen={!!selectedModule}
        onClose={() => setSelectedModule(null)}
        title={selectedModule?.title || ''}
      >
        {selectedModule && (
          <div className="prose prose-lg prose-p:my-2 prose-h2:text-xl prose-h2:font-bold prose-h2:mt-4">
            <ReactMarkdown>{selectedModule.content}</ReactMarkdown>
            
            <div className="mt-8 text-center">
              <NeoButton onClick={() => setSelectedModule(null)} variant="primary" size="lg">
                Mark as Complete (+50 XP)
              </NeoButton>
            </div>
          </div>
        )}
      </NeoModal>
    </div>
  );
};