import React, { useState } from 'react';
import { Page } from '../types';
import { Menu, X, Leaf, BarChart3, Target, BookOpen, Users, MessageSquare } from 'lucide-react';

interface NavbarProps {
  currentPage: Page;
  setPage: (page: Page) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPage, setPage }) => {
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { page: Page.HOME, label: 'Home', icon: Leaf },
    { page: Page.DASHBOARD, label: 'Impact', icon: BarChart3 },
    { page: Page.TRACKER, label: 'Tracker', icon: Target },
    { page: Page.MISSIONS, label: 'Missions', icon: Target },
    { page: Page.EDUCATION, label: 'Learn', icon: BookOpen },
    { page: Page.COMMUNITY, label: 'Community', icon: Users },
    { page: Page.ASSISTANT, label: 'AI Helper', icon: MessageSquare },
  ];

  const handleNav = (page: Page) => {
    setPage(page);
    setIsOpen(false);
  };

  return (
    <nav className="sticky top-4 z-50 mx-4 mb-8">
      <div className="bg-white border-4 border-neo-black shadow-neo rounded-xl px-4 py-3 flex justify-between items-center">
        <div 
          className="flex items-center gap-2 cursor-pointer" 
          onClick={() => handleNav(Page.HOME)}
        >
          <div className="bg-neo-green p-2 border-2 border-neo-black rounded-lg">
            <Leaf size={24} className="text-neo-black" />
          </div>
          <span className="text-xl font-bold tracking-tight hidden sm:block">Sustain-a-thon</span>
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex gap-2">
          {navItems.map((item) => (
            <button
              key={item.page}
              onClick={() => handleNav(item.page)}
              className={`px-3 py-2 rounded-lg font-bold border-2 transition-all ${
                currentPage === item.page 
                  ? 'bg-neo-yellow border-neo-black shadow-neo-sm translate-x-[-2px] translate-y-[-2px]' 
                  : 'border-transparent hover:bg-gray-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Mobile Menu Button */}
        <button 
          className="md:hidden p-2 border-2 border-neo-black bg-neo-pink rounded-lg shadow-neo-sm active:shadow-none active:translate-x-1 active:translate-y-1 transition-all"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border-4 border-neo-black shadow-neo-lg rounded-xl p-4 md:hidden flex flex-col gap-2">
          {navItems.map((item) => (
            <button
              key={item.page}
              onClick={() => handleNav(item.page)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg font-bold border-2 transition-all text-left ${
                currentPage === item.page 
                  ? 'bg-neo-yellow border-neo-black' 
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
};