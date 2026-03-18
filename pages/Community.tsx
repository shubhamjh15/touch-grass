import React from 'react';
import { NeoCard } from '../components/ui/NeoCard';
import { NeoButton } from '../components/ui/NeoButton';
import { Heart, MessageCircle, Share2 } from 'lucide-react';

const posts = [
  { id: 1, user: 'EcoWarrior22', content: 'Just started my zero-waste journey! Swapped plastic bags for totes today. 🌿', likes: 24, comments: 5, color: 'bg-green-100' },
  { id: 2, user: 'SolarFanatic', content: 'Did you know switching to LED bulbs saves 75% energy? Small change, big impact!', likes: 45, comments: 12, color: 'bg-yellow-100' },
  { id: 3, user: 'CityBiker', content: 'Organizing a community cleanup this Saturday at Central Park. Who is in? 🚮', likes: 89, comments: 34, color: 'bg-blue-100' },
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