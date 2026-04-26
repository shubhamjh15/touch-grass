import React from 'react';
import { NeoCard } from '../components/ui/NeoCard';
import { NeoButton } from '../components/ui/NeoButton';
import { Heart, MessageCircle, Share2 } from 'lucide-react';

const posts = [
  { 
    id: 1, 
    user: 'EcoWarrior22', 
    content: 'Just successfully completed a zero-waste audit of my kitchen! 🌿 I realized that 40% of my trash was just single-use packaging from vegetables. Today I took my own reusable mesh bags to the farmers market instead of the supermarket. Not only is it package-free, but I ended up saving $15 and supporting local farmers! Anyone else have good tips for zero-waste grocery shopping?', 
    likes: 124, 
    comments: 28, 
    color: 'bg-green-100' 
  },
  { 
    id: 2, 
    user: 'SolarFanatic', 
    content: '🚨 Mind-blowing fact of the day: Did you know that phantom power (electronics plugged in but turned off) can account for up to 10% of your home energy use?! I just installed smart power strips across my entire apartment that automatically cut power when devices go to standby. Highly recommend looking into this if you want an easy way to cut your footprint and your electric bill! ⚡🌍', 
    likes: 345, 
    comments: 56, 
    color: 'bg-yellow-100' 
  },
  { 
    id: 3, 
    user: 'CityBiker', 
    content: 'We did it! 🚲✨ Our community cleanup at Central Park was a massive success. Over 40 volunteers showed up, and together we collected over 200 lbs of trash, including countless microplastics near the duck pond. It\'s incredible what a small group of dedicated people can achieve in just a few hours. Check out the before/after pictures below! Let\'s keep this momentum going! 🚮💚', 
    likes: 589, 
    comments: 92, 
    color: 'bg-blue-100' 
  },
  { 
    id: 4, 
    user: 'VeganVibes', 
    content: 'Tried making a 100% plant-based lasagna for my skeptical meat-eating family tonight... and they LOVED it! 🌱 Replacing the beef with a mix of lentils and mushrooms not only tastes amazing but cuts the carbon footprint of the meal by nearly 80%. Small dietary swaps really do add up on a global scale. Who wants the recipe? 🍝', 
    likes: 210, 
    comments: 45, 
    color: 'bg-pink-100' 
  },
];

export const Community: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto pb-12">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-4xl font-extrabold">Community Zone</h2>
        <NeoButton>+ New Post</NeoButton>              
      </div>
      <div className="space-y-6">
        {posts.map((post) => (
          <NeoCard key={post.id} className={`${post.color} animate-fade-in-up`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-neo-black rounded-full flex items-center justify-center text-white font-bold">
                {post.user[0]}
              </div>
              <div>
                <div className="font-bold">{post.user}</div>
                <div className="text-xs text-gray-500">2 hours ago</div>
              </div>
            </div>
            <p className="text-lg font-medium mb-6">{post.content}</p>
            <div className="flex gap-4">
              <button className="flex items-center gap-2 font-bold hover:text-neo-pink transition-colors">
                <Heart size={20} /> {post.likes}
              </button>
              <button className="flex items-center gap-2 font-bold hover:text-neo-blue transition-colors">
                <MessageCircle size={20} /> {post.comments}
              </button>
              <button className="flex items-center gap-2 font-bold hover:text-neo-green transition-colors">
                <Share2 size={20} /> Share
              </button>
            </div>
          </NeoCard>
        ))}
      </div>
    </div>
  );
};
