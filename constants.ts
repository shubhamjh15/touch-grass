import { UserStats, ActionLog, Mission, EducationModule } from './types';

export const INITIAL_USER_STATS: UserStats = {
  xp: 4250, // Corresponds to Level 5 (4000-4999 range)
  level: 5,
  co2Saved: 45.2,
  streak: 12,
  badges: ['Eco Starter', 'Plastic Free', 'Bike Rider']
};

export const RECENT_LOGS: ActionLog[] = [
  { id: '1', type: 'Recycled Glass', co2Impact: 0.5, xpReward: 50, date: 'Today', icon: '♻️' },
  { id: '2', type: 'Biked to Work', co2Impact: 2.1, xpReward: 100, date: 'Yesterday', icon: '🚲' },
  { id: '3', type: 'Meat-free Meal', co2Impact: 1.5, xpReward: 75, date: 'Yesterday', icon: '🥗' },
];

export const MISSIONS: Mission[] = [
  { id: 'm1', title: 'Plastic-Free Week', description: 'Avoid single-use plastics for 7 days.', rewardXP: 500, completed: false, type: 'weekly' },
  { id: 'm2', title: 'Zero Waste Day', description: 'Produce no landfill trash today.', rewardXP: 200, completed: true, type: 'daily' },
  { id: 'm3', title: 'Save 10 Litres', description: 'Take a shorter shower or fix a leak.', rewardXP: 100, completed: false, type: 'daily' },
  { id: 'm4', title: 'Plant a Tree', description: 'Plant a local species or donate to a planting org.', rewardXP: 1000, completed: false, type: 'weekly' },
];

export const EDUCATION_MODULES: EducationModule[] = [
  {
    id: 'e1',
    title: 'The Greenhouse Effect',
    description: 'Understand how gases trap heat.',
    readTime: '3 min',
    category: 'Climate',
    completed: true,
    content: `
      **What is it?**
      Imagine Earth wrapped in a blanket. Sunlight hits the Earth, warms it up, and then that heat tries to escape back into space. Greenhouse gases (like CO2 and Methane) act like that blanket, trapping some of the heat to keep the planet warm enough for life.

      **The Problem:**
      We are making the blanket too thick! Burning fossil fuels adds massive amounts of CO2, trapping too much heat. This leads to global warming, melting ice caps, and extreme weather.

      **Key Takeaway:**
      It's not that the greenhouse effect is "bad" (we need it to survive!), but we are supercharging it way beyond natural levels.
    `
  },
  {
    id: 'e2',
    title: 'Ocean Acidification',
    description: 'Why our oceans are changing pH.',
    readTime: '5 min',
    category: 'Climate',
    completed: false,
    content: `
      **The Evil Twin of Climate Change**
      While global warming gets all the attention, ocean acidification is just as scary. The ocean absorbs about 30% of the CO2 we release.

      **The Chemistry:**
      When CO2 dissolves in seawater, it forms carbonic acid. This lowers the pH of the ocean, making it more acidic.

      **Why it matters:**
      Shellfish, coral, and plankton rely on carbonate ions to build their shells/skeletons. Acidic water steals these ions, causing shells to dissolve or become weak. This threatens the entire marine food web!
    `
  },
  {
    id: 'e3',
    title: 'Recycling 101',
    description: 'What actually happens to your plastic?',
    readTime: '4 min',
    category: 'Waste',
    completed: false,
    content: `
      **The Hard Truth**
      Only about 9% of plastic ever produced has been recycled. Most ends up in landfills or the ocean.

      **Wish-cycling:**
      This is when you throw something in the bin *hoping* it's recyclable (like a greasy pizza box). This actually contaminates the whole batch!

      **Rule of Thumb:**
      1. **Reduce** first (buy less).
      2. **Reuse** second (jars, bags).
      3. **Recycle** last (and make sure it's clean and actually recyclable in your area).
    `
  },
  {
    id: 'e4',
    title: 'Renewable Energy',
    description: 'Solar, Wind, and Hydro explained.',
    readTime: '6 min',
    category: 'Energy',
    completed: false,
    content: `
      **Solar Power ☀️**
      Photovoltaic cells convert sunlight directly into electricity. Costs have dropped 89% in the last decade!

      **Wind Power 🌬️**
      Turbines capture kinetic energy from wind. One rotation can power a home for a day.

      **The Grid Challenge:**
      The sun doesn't always shine, and wind doesn't always blow. That's why we need better **battery storage** and a "smart grid" to balance supply and demand efficiently.
    `
  },
];