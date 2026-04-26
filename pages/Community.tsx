import React, { useState, useMemo } from 'react';
import { NeoCard } from '../components/ui/NeoCard';
import { NeoButton } from '../components/ui/NeoButton';
import { NeoModal } from '../components/ui/NeoModal';
import { Heart, MessageCircle, Share2, TrendingUp, Search, X } from 'lucide-react';

// Define our post type
interface Post {
  id: number;
  user: string;
  time: string;
  tag: string;
  content: string;
  likes: number;
  comments: number;
  color: string;
  userComments: string[]; // Track local comments added by the user
}

const INITIAL_POSTS: Post[] = [
  { 
    id: 1, 
    user: 'EcoWarrior22', 
    time: '2 hours ago',
    tag: 'Zero Waste',
    content: 'Just successfully completed a zero-waste audit of my kitchen! 🌿 I realized that 40% of my trash was just single-use packaging from vegetables. Today I took my own reusable mesh bags to the farmers market instead of the supermarket. Not only is it package-free, but I ended up saving $15 and supporting local farmers! Anyone else have good tips for zero-waste grocery shopping?', 
    likes: 124, 
    comments: 28, 
    color: 'bg-green-100',
    userComments: []
  },
  { 
    id: 2, 
    user: 'SolarFanatic', 
    time: '4 hours ago',
    tag: 'Energy',
    content: '🚨 Mind-blowing fact of the day: Did you know that phantom power (electronics plugged in but turned off) can account for up to 10% of your home energy use?! I just installed smart power strips across my entire apartment that automatically cut power when devices go to standby. Highly recommend looking into this if you want an easy way to cut your footprint and your electric bill! ⚡🌍', 
    likes: 345, 
    comments: 56, 
    color: 'bg-yellow-100',
    userComments: []
  },
  { 
    id: 3, 
    user: 'CityBiker', 
    time: '5 hours ago',
    tag: 'Action',
    content: 'We did it! 🚲✨ Our community cleanup at Central Park was a massive success. Over 40 volunteers showed up, and together we collected over 200 lbs of trash, including countless microplastics near the duck pond. It\'s incredible what a small group of dedicated people can achieve in just a few hours. Let\'s keep this momentum going! 🚮💚', 
    likes: 589, 
    comments: 92, 
    color: 'bg-blue-100',
    userComments: []
  },
  { 
    id: 4, 
    user: 'VeganVibes', 
    time: '8 hours ago',
    tag: 'Diet',
    content: 'Tried making a 100% plant-based lasagna for my skeptical meat-eating family tonight... and they LOVED it! 🌱 Replacing the beef with a mix of lentils and mushrooms not only tastes amazing but cuts the carbon footprint of the meal by nearly 80%. Small dietary swaps really do add up on a global scale. Who wants the recipe? 🍝', 
    likes: 210, 
    comments: 45, 
    color: 'bg-pink-100',
    userComments: []
  },
  { 
    id: 5, 
    user: 'ThriftKing', 
    time: '12 hours ago',
    tag: 'Fashion',
    content: 'Just learned that the fashion industry produces 10% of all humanity\'s carbon emissions. 🤯 I\'ve officially pledged to buy ZERO new clothes for the next 12 months. It\'s thrift stores, clothing swaps, and repairing what I already own from here on out. Who is with me on the #NoNewClothes challenge? 👕♻️', 
    likes: 432, 
    comments: 112, 
    color: 'bg-purple-100',
    userComments: []
  },
  { 
    id: 6, 
    user: 'PolicyNerd', 
    time: '1 day ago',
    tag: 'Advocacy',
    content: 'Just got off the phone with my local city council member! 🏛️ I urged them to support the upcoming bill to mandate solar panels on all new commercial buildings. It took exactly 3 minutes of my day. If you haven\'t called your reps yet, do it! They actually tally these calls and it heavily influences their voting. Speak up! 🗣️', 
    likes: 890, 
    comments: 41, 
    color: 'bg-orange-100',
    userComments: []
  }
];

const CARD_COLORS = ['bg-green-100', 'bg-blue-100', 'bg-yellow-100', 'bg-pink-100', 'bg-purple-100', 'bg-orange-100'];
const AVAILABLE_TAGS = ['Zero Waste', 'Energy', 'Action', 'Diet', 'Fashion', 'Advocacy', 'Oceans', 'General'];

export const Community: React.FC = () => {
  // State
  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS);
  const [likedPosts, setLikedPosts] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  
  // Post Creation Modal State
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostTag, setNewPostTag] = useState(AVAILABLE_TAGS[0]);

  // Comment Expansion State
  const [expandedComments, setExpandedComments] = useState<number | null>(null);
  const [commentInput, setCommentInput] = useState('');

  // Handlers
  const handleLike = (id: number) => {
    const newLiked = new Set(likedPosts);
    if (newLiked.has(id)) {
      newLiked.delete(id);
      setPosts(posts.map(p => p.id === id ? { ...p, likes: p.likes - 1 } : p));
    } else {
      newLiked.add(id);
      setPosts(posts.map(p => p.id === id ? { ...p, likes: p.likes + 1 } : p));
    }
    setLikedPosts(newLiked);
  };

  const handleCreatePost = () => {
    if (!newPostContent.trim()) return;

    const newPost: Post = {
      id: Date.now(),
      user: 'You',
      time: 'Just now',
      tag: newPostTag,
      content: newPostContent.trim(),
      likes: 0,
      comments: 0,
      color: CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)],
      userComments: []
    };

    setPosts([newPost, ...posts]);
    setIsPostModalOpen(false);
    setNewPostContent('');
    setNewPostTag(AVAILABLE_TAGS[0]);
  };

  const handleAddComment = (postId: number) => {
    if (!commentInput.trim()) return;
    
    setPosts(posts.map(p => {
      if (p.id === postId) {
        return { 
          ...p, 
          comments: p.comments + 1, 
          userComments: [...p.userComments, commentInput.trim()] 
        };
      }
      return p;
    }));
    setCommentInput('');
  };

  const toggleTagFilter = (tag: string) => {
    // Convert trending tag (e.g. #ZeroWaste) to normal tag (e.g. Zero Waste)
    const normalizedFilterTag = tag.replace(/#|\s/g, '').toLowerCase();
    
    if (selectedTagFilter === normalizedFilterTag) {
      setSelectedTagFilter(null); // Toggle off
    } else {
      setSelectedTagFilter(normalizedFilterTag);
    }
  };

  // Filter Posts
  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      const matchesSearch = 
        post.content.toLowerCase().includes(searchQuery.toLowerCase()) || 
        post.user.toLowerCase().includes(searchQuery.toLowerCase());
      
      const normalizedPostTag = post.tag.replace(/\s/g, '').toLowerCase();
      const matchesTag = selectedTagFilter ? normalizedPostTag === selectedTagFilter : true;
      
      return matchesSearch && matchesTag;
    });
  }, [posts, searchQuery, selectedTagFilter]);

  return (
    <div className="max-w-7xl mx-auto pb-12 animate-fade-in grid grid-cols-1 lg:grid-cols-4 gap-8 mt-8">
      
      {/* Left Sidebar - Trending */}
      <div className="hidden lg:block col-span-1 space-y-6">
        <NeoCard color="yellow" className="sticky top-28 border-4">
          <div className="flex items-center gap-2 mb-6 border-b-4 border-black pb-2">
            <TrendingUp size={24} />
            <h3 className="text-xl font-black">Trending Topics</h3>
          </div>
          <div className="space-y-4">
            {['#ZeroWaste', '#Diet', '#Fashion', '#Action', '#Energy'].map((tag, i) => {
              const normalized = tag.replace(/#|\s/g, '').toLowerCase();
              const isActive = selectedTagFilter === normalized;
              return (
                <div 
                  key={i} 
                  onClick={() => toggleTagFilter(tag)}
                  className={`cursor-pointer group p-2 rounded-lg border-2 transition-all ${
                    isActive ? 'bg-white border-black shadow-sm' : 'border-transparent hover:bg-white/50'
                  }`}
                >
                  <div className={`font-bold text-lg transition-colors ${isActive ? 'text-neo-blue' : 'group-hover:text-neo-blue'}`}>
                    {tag}
                  </div>
                  <div className="text-sm text-gray-600 font-medium">
                    {Math.floor(Math.random() * 500 + 100)} posts today
                  </div>
                </div>
              );
            })}
          </div>
        </NeoCard>
      </div>

      {/* Main Feed */}
      <div className="col-span-1 lg:col-span-3 space-y-8">
        
        {/* Controls Header */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4 bg-white p-4 rounded-xl border-4 border-neo-black shadow-neo-sm">
          <h2 className="text-4xl font-black tracking-tight">Community Feed</h2>
          <div className="flex gap-4 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={20} />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search topics or users..." 
                className="w-full pl-10 pr-10 py-2 border-2 border-black rounded-lg font-bold focus:outline-none focus:ring-2 focus:ring-neo-pink"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-black"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <NeoButton 
              variant="primary" 
              className="whitespace-nowrap flex-shrink-0"
              onClick={() => setIsPostModalOpen(true)}
            >
              + New Post
            </NeoButton>              
          </div>
        </div>

        {/* Empty State */}
        {filteredPosts.length === 0 && (
          <div className="text-center py-12 bg-white border-4 border-dashed border-gray-300 rounded-2xl">
            <h3 className="text-2xl font-bold text-gray-400 mb-2">No posts found.</h3>
            <p className="text-gray-500">Try searching for something else or be the first to post!</p>
          </div>
        )}
        
        {/* Posts List */}
        <div className="space-y-8">
          {filteredPosts.map((post) => {
            const isLiked = likedPosts.has(post.id);
            const isCommentsOpen = expandedComments === post.id;

            return (
              <NeoCard key={post.id} className={`${post.color} border-4 transition-transform ${isCommentsOpen ? '' : 'hover:-translate-y-1'}`}>
                {/* Post Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-neo-black rounded-xl flex items-center justify-center text-white font-black text-xl shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] border-2 border-white">
                      {post.user[0]}
                    </div>
                    <div>
                      <div className="font-black text-lg leading-tight">{post.user}</div>
                      <div className="text-sm font-bold text-gray-600">{post.time}</div>
                    </div>
                  </div>
                  <span className="hidden sm:block text-xs font-black bg-white px-3 py-1 border-2 border-black rounded-full shadow-sm">
                    {post.tag}
                  </span>
                </div>
                
                {/* Post Content */}
                <p className="text-xl font-medium leading-relaxed mb-6 text-gray-900 whitespace-pre-wrap">
                  {post.content}
                </p>
                
                {/* Post Actions */}
                <div className="flex gap-6 border-t-4 border-black/10 pt-4">
                  <button 
                    onClick={() => handleLike(post.id)}
                    className={`flex items-center gap-2 font-black text-lg transition-transform active:scale-90 ${isLiked ? 'text-red-500' : 'hover:text-red-500'}`}
                  >
                    <Heart size={24} className={isLiked ? "fill-current" : ""} /> 
                    {post.likes}
                  </button>
                  <button 
                    onClick={() => setExpandedComments(isCommentsOpen ? null : post.id)}
                    className={`flex items-center gap-2 font-black text-lg hover:text-neo-blue transition-colors ${isCommentsOpen ? 'text-neo-blue' : ''}`}
                  >
                    <MessageCircle size={24} className={isCommentsOpen ? "fill-current" : ""} /> 
                    {post.comments}
                  </button>
                  <button className="flex items-center gap-2 font-black text-lg hover:text-neo-green transition-colors ml-auto">
                    <Share2 size={24} /> Share
                  </button>
                </div>

                {/* Interactive Comments Section */}
                {isCommentsOpen && (
                  <div className="mt-6 pt-4 border-t-4 border-black/10 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex gap-2 mb-4">
                      <input 
                        type="text" 
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                        placeholder="Add a comment..."
                        className="flex-1 border-2 border-black rounded-lg px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-neo-blue"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddComment(post.id)}
                      />
                      <NeoButton size="sm" onClick={() => handleAddComment(post.id)} disabled={!commentInput.trim()}>
                        Reply
                      </NeoButton>
                    </div>
                    
                    <div className="space-y-3">
                      {/* Render local user comments */}
                      {post.userComments.map((comment, i) => (
                        <div key={i} className="bg-white/60 border-2 border-black p-3 rounded-lg text-sm shadow-sm flex items-start gap-3">
                           <div className="w-8 h-8 bg-neo-black rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                              Y
                            </div>
                           <div>
                             <div className="font-black mb-1">You <span className="font-medium text-xs text-gray-500 ml-2">Just now</span></div>
                             <div className="font-medium">{comment}</div>
                           </div>
                        </div>
                      ))}
                      
                      {/* Fake existing comments UI to make it feel populated */}
                      {post.comments > post.userComments.length && (
                        <div className="text-sm font-bold text-gray-500 italic p-2 text-center bg-black/5 rounded-lg border-2 border-dashed border-black/20">
                          View {post.comments - post.userComments.length} previous comments...
                        </div>
                      )}
                      {post.comments === 0 && post.userComments.length === 0 && (
                        <div className="text-sm font-bold text-gray-500 italic p-2 text-center">
                          Be the first to comment!
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </NeoCard>
            );
          })}
        </div>
      </div>

      {/* Create Post Modal */}
      <NeoModal
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
        title="Create New Post"
      >
        <div className="space-y-6">
          <div>
            <label className="block font-black mb-2 text-lg">What's on your eco-mind?</label>
            <textarea 
              rows={4}
              className="w-full border-4 border-black rounded-xl p-3 font-medium text-lg focus:outline-none focus:ring-4 focus:ring-neo-pink/30 resize-none"
              placeholder="Share your sustainability wins, tips, or questions..."
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)} 
            />
          </div>
          
          <div>
            <label className="block font-black mb-2 text-lg">Category Tag</label>
            <select 
              className="w-full border-4 border-black rounded-xl p-3 font-bold text-lg bg-white cursor-pointer focus:outline-none focus:ring-4 focus:ring-neo-pink/30"
              value={newPostTag}
              onChange={(e) => setNewPostTag(e.target.value)}
            >
              {AVAILABLE_TAGS.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <NeoButton variant="outline" onClick={() => setIsPostModalOpen(false)}>
              Cancel
            </NeoButton>
            <NeoButton variant="primary" onClick={handleCreatePost} disabled={!newPostContent.trim()}>
              Post to Community
            </NeoButton>
          </div>
        </div>
      </NeoModal>

    </div>
  );
};