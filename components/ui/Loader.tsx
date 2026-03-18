import React from 'react';
import { motion } from 'framer-motion';
import { Leaf, Recycle, Globe } from 'lucide-react';

export const Loader: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#f0fdf4]"
    >
      <div className="relative flex flex-col items-center">
        {/* Spinning Outer Ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
          className="w-32 h-32 border-4 border-neo-black rounded-full border-t-neo-green border-r-neo-blue border-b-neo-pink border-l-neo-yellow"
        />

        {/* Pulsing Core Icon */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
             <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
             >
                 <Leaf size={48} className="text-neo-green fill-neo-green" />
             </motion.div>
        </div>

        {/* Text Animation */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="mt-8 text-4xl font-black text-neo-black tracking-tighter"
        >
          Sustain-a-thon
        </motion.h1>

        {/* Loading Dots */}
        <div className="flex gap-2 mt-4">
            {[0, 1, 2].map((i) => (
                <motion.div
                    key={i}
                    animate={{ y: [0, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.2 }}
                    className={`w-3 h-3 rounded-full border-2 border-neo-black ${i === 0 ? 'bg-neo-green' : i === 1 ? 'bg-neo-blue' : 'bg-neo-pink'}`}
                />
            ))}
        </div>
        
        <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="mt-2 text-sm font-bold text-gray-500"
        >
            Loading your eco-journey...
        </motion.p>
      </div>
    </motion.div>
  );
};
