import React from 'react';
import { Page } from '../types';
import { NeoButton } from '../components/ui/NeoButton';
import { NeoCard } from '../components/ui/NeoCard';
import { ArrowRight, Globe, Zap, Heart } from 'lucide-react';

interface HomeProps {
  setPage: (page: Page) => void;
}

export const Home: React.FC<HomeProps> = ({ setPage }) => {
  return (
    <div className="space-y-12 pb-12">
      {/* Hero Section */}
      <section className="text-center space-y-6 mt-8">
        <div className="inline-block bg-neo-yellow border-2 border-neo-black px-4 py-1 rounded-full font-bold shadow-neo-sm transform -rotate-2 mb-4">
          👋 Hey Earthling!
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold leading-tight">
          Together We Can <br />
          <span className="text-neo-green underline decoration-4 underline-offset-4 decoration-neo-black">Fix This.</span>
        </h1>
        <p className="text-xl md:text-2xl max-w-2xl mx-auto text-gray-700 font-medium">
          Join the movement. Track your impact, learn the facts, and level up your sustainability game. No doomscrolling allowed.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
          <NeoButton size="lg" onClick={() => setPage(Page.TRACKER)}>
            Start Tracking <ArrowRight className="ml-2" />
          </NeoButton>
          <NeoButton size="lg" variant="outline" onClick={() => setPage(Page.EDUCATION)}>
            Learn More
          </NeoButton>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="grid md:grid-cols-3 gap-6 px-4">
        <NeoCard color="blue" className="rotate-1">
          <div className="bg-white w-12 h-12 rounded-lg border-2 border-neo-black flex items-center justify-center mb-4 shadow-neo-sm">
            <Globe size={28} />
          </div>
          <h3 className="text-2xl font-bold mb-2">Real Impact</h3>
          <p>Visualize CO₂ reduction and see how your daily choices affect global temperatures.</p>
        </NeoCard>
        
        <NeoCard color="pink" className="-rotate-1">
          <div className="bg-white w-12 h-12 rounded-lg border-2 border-neo-black flex items-center justify-center mb-4 shadow-neo-sm">
            <Zap size={28} />
          </div>
          <h3 className="text-2xl font-bold mb-2">Gamified Action</h3>
          <p>Earn XP, unlock badges, and climb the leaderboard by completing simple eco-missions.</p>
        </NeoCard>
        
        <NeoCard color="yellow" className="rotate-1">
          <div className="bg-white w-12 h-12 rounded-lg border-2 border-neo-black flex items-center justify-center mb-4 shadow-neo-sm">
            <Heart size={28} />
          </div>
          <h3 className="text-2xl font-bold mb-2">Supportive Community</h3>
          <p>Connect with others, share ideas, and get motivated by our AI sustainability coach.</p>
        </NeoCard>
      </section>

      {/* Stats Teaser */}
      <section className="bg-neo-black text-white p-8 md:p-12 rounded-xl mx-4 border-4 border-neo-black shadow-neo-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-neo-green rounded-full blur-3xl opacity-20 transform translate-x-1/2 -translate-y-1/2"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="text-left">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Join 10,000+ Youth Activists</h2>
            <p className="text-lg text-gray-300">We've already saved over 500 tons of CO₂ together. Your actions matter more than you think.</p>
          </div>
          <div className="flex gap-4">
             <div className="text-center">
                <div className="text-4xl font-bold text-neo-yellow">500t</div>
                <div className="text-sm font-bold uppercase tracking-wider">CO₂ Saved</div>
             </div>
             <div className="w-1 bg-gray-700"></div>
             <div className="text-center">
                <div className="text-4xl font-bold text-neo-pink">120k</div>
                <div className="text-sm font-bold uppercase tracking-wider">Actions</div>
             </div>
          </div>
        </div>
      </section>
    </div>
  );
};