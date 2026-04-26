import React from 'react';
import { Page } from '../types';
import { NeoButton } from '../components/ui/NeoButton';
import { NeoCard } from '../components/ui/NeoCard';
import { ArrowRight, Globe, Zap, Heart, Leaf, Star, Sparkles } from 'lucide-react';
import { motion, useScroll, useTransform } from 'framer-motion';

interface HomeProps {
  setPage: (page: Page) => void;
}

// Animation Variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { y: 30, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 100, damping: 10 },
  },
};

const floatingAnimation = {
  y: ['-10px', '10px'],
  transition: {
    duration: 3,
    repeat: Infinity,
    repeatType: "reverse" as const,
    ease: "easeInOut",
  },
};

export const Home: React.FC<HomeProps> = ({ setPage }) => {
  const { scrollYProgress } = useScroll();
  const yPosAnim = useTransform(scrollYProgress, [0, 1], [0, -100]);

  return (
    <div className="space-y-20 pb-20 overflow-hidden">
      {/* Hero Section */}
      <motion.section 
        className="relative text-center space-y-8 mt-12 px-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Decorative background elements */}
        <motion.div animate={floatingAnimation} className="absolute top-10 left-[10%] text-neo-yellow hidden md:block">
          <Star size={48} fill="currentColor" />
        </motion.div>
        <motion.div animate={{ ...floatingAnimation, transition: { ...floatingAnimation.transition, delay: 1 } }} className="absolute bottom-10 right-[15%] text-neo-pink hidden md:block">
          <Sparkles size={56} />
        </motion.div>
        <motion.div animate={{ ...floatingAnimation, transition: { ...floatingAnimation.transition, delay: 0.5 } }} className="absolute top-0 right-[20%] text-neo-green hidden lg:block">
          <Leaf size={40} />
        </motion.div>

        <motion.div variants={itemVariants}>
          <div className="inline-block bg-neo-yellow border-4 border-neo-black px-6 py-2 rounded-full font-bold shadow-neo-sm transform -rotate-3 hover:rotate-0 transition-transform duration-300 cursor-pointer text-xl">
            👋 Hey Earthling!
          </div>
        </motion.div>
        
        <motion.h1 variants={itemVariants} className="text-6xl md:text-8xl font-black leading-[1.1] tracking-tight relative z-10">
          Together We Can <br />
          <span className="relative inline-block">
            <span className="relative z-10 text-neo-green">Fix This.</span>
            <motion.span 
              className="absolute bottom-1 left-0 w-full h-4 bg-neo-black -z-10 transform -rotate-2"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 1, duration: 0.5, ease: "easeOut" }}
              style={{ transformOrigin: "left" }}
            />
          </span>
        </motion.h1>
        
        <motion.p variants={itemVariants} className="text-xl md:text-3xl max-w-3xl mx-auto text-gray-800 font-bold leading-relaxed">
          Join the movement. Track your impact, learn the facts, and level up your sustainability game. <span className="bg-neo-pink text-white px-2 py-1 rounded border-2 border-neo-black inline-block transform rotate-1">No doomscrolling allowed.</span>
        </motion.p>
        
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row justify-center gap-6 mt-12 relative z-20">
          <motion.div whileHover={{ scale: 1.05, rotate: -2 }} whileTap={{ scale: 0.95 }}>
            <NeoButton size="lg" className="text-xl py-4 px-8 border-4" onClick={() => setPage(Page.TRACKER)}>
              Start Tracking <ArrowRight className="ml-2 inline-block" />
            </NeoButton>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05, rotate: 2 }} whileTap={{ scale: 0.95 }}>
            <NeoButton size="lg" variant="outline" className="text-xl py-4 px-8 border-4 bg-white" onClick={() => setPage(Page.EDUCATION)}>
              Learn More
            </NeoButton>
          </motion.div>
        </motion.div>
      </motion.section>

      {/* Feature Grid */}
      <motion.section 
        className="grid md:grid-cols-3 gap-8 px-4 max-w-7xl mx-auto"
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6, staggerChildren: 0.2 }}
      >
        {[
          { color: "blue", icon: <Globe size={32} />, title: "Real Impact", desc: "Visualize CO₂ reduction and see how your daily choices affect global temperatures.", rotate: "rotate-2" },
          { color: "pink", icon: <Zap size={32} />, title: "Gamified Action", desc: "Earn XP, unlock badges, and climb the leaderboard by completing simple eco-missions.", rotate: "-rotate-2" },
          { color: "yellow", icon: <Heart size={32} />, title: "Community", desc: "Connect with others, share ideas, and get motivated by our AI sustainability coach.", rotate: "rotate-2" }
        ].map((feature, i) => (
          <motion.div 
            key={i}
            whileHover={{ y: -10, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <NeoCard color={feature.color as any} className={\`h-full \${feature.rotate} hover:rotate-0 transition-all duration-300 border-4\`}>
              <div className="bg-white w-16 h-16 rounded-xl border-4 border-neo-black flex items-center justify-center mb-6 shadow-neo-sm transform transition-transform group-hover:scale-110">
                {feature.icon}
              </div>
              <h3 className="text-3xl font-black mb-3">{feature.title}</h3>
              <p className="text-lg font-medium leading-relaxed">{feature.desc}</p>
            </NeoCard>
          </motion.div>
        ))}
      </motion.section>

      {/* Stats Teaser */}
      <motion.section 
        className="px-4 max-w-6xl mx-auto"
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <div className="bg-neo-black text-white p-10 md:p-16 rounded-3xl border-8 border-neo-black shadow-neo-lg relative overflow-hidden group">
          <motion.div 
            className="absolute -top-32 -right-32 w-96 h-96 bg-neo-green rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity duration-700"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="text-left flex-1">
              <h2 className="text-4xl md:text-5xl font-black mb-6 leading-tight">Join 10,000+ <br/><span className="text-neo-yellow">Youth Activists</span></h2>
              <p className="text-xl text-gray-300 font-medium">We've already saved over 500 tons of CO₂ together. Your actions matter more than you think.</p>
            </div>
            <div className="flex gap-8 bg-white/10 p-8 rounded-2xl backdrop-blur-sm border-2 border-white/20">
               <motion.div className="text-center" whileHover={{ scale: 1.1 }}>
                  <div className="text-5xl font-black text-neo-yellow mb-2">500t</div>
                  <div className="text-sm font-bold uppercase tracking-widest text-gray-400">CO₂ Saved</div>
               </motion.div>
               <div className="w-1 bg-white/20 rounded-full"></div>
               <motion.div className="text-center" whileHover={{ scale: 1.1 }}>
                  <div className="text-5xl font-black text-neo-pink mb-2">120k</div>
                  <div className="text-sm font-bold uppercase tracking-widest text-gray-400">Actions</div>
               </motion.div>
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  );
};