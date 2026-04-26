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
  { 
    id: 'm1', 
    title: 'Zero-Waste Kitchen Audit', 
    description: 'Go through your pantry and fridge. Identify 3 single-use plastic items you currently buy and research sustainable, package-free alternatives for your next grocery run. Swap them out this week!', 
    rewardXP: 500, 
    completed: false, 
    type: 'weekly' 
  },
  { 
    id: 'm2', 
    title: 'The "Vampire Power" Hunt', 
    description: 'Unplug all electronics that are turned off but still drawing phantom power (microwaves, chargers, TVs). Keep them unplugged for the entire day. You can save up to 10% on your energy bill!', 
    rewardXP: 200, 
    completed: true, 
    type: 'daily' 
  },
  { 
    id: 'm3', 
    title: 'Plant-Based Power Day', 
    description: 'Commit to eating 100% vegan meals for the entire day. Skipping meat and dairy for just one day saves roughly 1,500 liters of water and drastically cuts your carbon footprint.', 
    rewardXP: 300, 
    completed: false, 
    type: 'daily' 
  },
  { 
    id: 'm4', 
    title: 'Community Guerrilla Gardening', 
    description: 'Find a barren patch of dirt in your neighborhood and plant native wildflower seeds to support local pollinators like bees and butterflies. Make sure the seeds are non-invasive and native to your region!', 
    rewardXP: 1000, 
    completed: false, 
    type: 'weekly' 
  },
  { 
    id: 'm5', 
    title: 'Fast Fashion Fasting', 
    description: 'Commit to buying zero new clothing items this week. If you desperately need something, you must source it from a thrift store, borrow it, or repair something you already own.', 
    rewardXP: 800, 
    completed: false, 
    type: 'weekly' 
  },
  { 
    id: 'm6', 
    title: 'Cold Wash Challenge', 
    description: 'Wash all your laundry on the cold water setting today. About 90% of the energy used by washing machines goes towards heating the water. Cold water cleans just as well for most loads!', 
    rewardXP: 150, 
    completed: false, 
    type: 'daily' 
  },
];

export const EDUCATION_MODULES: EducationModule[] = [
  {
    id: 'e1',
    title: 'The Carbon Cycle & Greenhouse Effect',
    description: 'Dive deep into how gases trap heat and why the balance is broken.',
    readTime: '4 min',
    category: 'Climate',
    completed: true,
    content: `
      ### 🌍 What is the Greenhouse Effect?
      Imagine Earth wrapped in a giant, invisible thermal blanket. When sunlight hits the Earth, it warms the surface, and that heat tries to radiate back into space. **Greenhouse gases (GHGs)** like Carbon Dioxide (CO2), Methane (CH4), and Nitrous Oxide (N2O) act like the fabric of that blanket, trapping some of the heat to keep our planet at a habitable 59°F (15°C) on average. Without it, Earth would be a freezing 0°F (-18°C)!

      ### 🚨 The Modern Problem
      The system is designed to be in balance via the **Carbon Cycle**, where nature absorbs as much carbon as it releases. However, since the Industrial Revolution, humanity has been digging up millions of years' worth of stored carbon (fossil fuels) and burning it in a matter of decades. 
      
      We are essentially throwing extra, extremely thick blankets onto the bed. The heat can't escape, leading to **global warming**. 

      ### 📉 The Impact
      This excess heat melts polar ice (causing sea-level rise), supercharges hurricanes, and disrupts agriculture. 
      
      **Key Takeaway:** The greenhouse effect isn't inherently evil—it's necessary! The crisis is entirely about the *unprecedented speed and volume* at which we are altering the atmospheric chemistry.
    `
  },
  {
    id: 'e2',
    title: 'Ocean Acidification: The Evil Twin',
    description: 'Discover why our oceans are changing pH and why marine life is threatened.',
    readTime: '5 min',
    category: 'Oceans',
    completed: false,
    content: `
      ### 🌊 The Ocean's Hidden Burden
      While global warming dominates the headlines, **Ocean Acidification** is its equally terrifying twin. The ocean acts as a massive carbon sink, absorbing about **30% of all CO2** emissions we release into the atmosphere.

      ### 🧪 The Chemistry
      When CO2 dissolves in seawater, it reacts with water molecules ($H_2O$) to form **carbonic acid** ($H_2CO_3$). This reaction releases hydrogen ions, which lowers the pH of the ocean, making it more acidic. 

      Since the Industrial Revolution, surface ocean acidity has increased by roughly **30%**.

      ### 🐚 Why it Matters (The Shell Crisis)
      Marine creatures like oysters, clams, sea urchins, and vital coral reefs rely on **carbonate ions** in the water to build their calcium carbonate shells and skeletons. 
      
      However, the excess hydrogen ions bond with the carbonate, "stealing" it from the marine life. In highly acidic waters, shells don't just stop growing—they actively begin to **dissolve**. If the base of the marine food web collapses, the entire ocean ecosystem is at risk.
    `
  },
  {
    id: 'e3',
    title: 'Circular Economy vs. Linear Economy',
    description: 'Rethinking waste: from "take-make-dispose" to closed loops.',
    readTime: '6 min',
    category: 'Economics',
    completed: false,
    content: `
      ### 🏭 The Flawed Linear Economy
      Since the industrial age, our global economy has operated on a straight line: **Take, Make, Dispose**. 
      We extract finite raw materials, manufacture products with built-in planned obsolescence, use them briefly, and then throw them in a landfill. This model relies on the impossible assumption of infinite resources on a finite planet.

      ### ♻️ The Circular Solution
      A **Circular Economy** aims to completely eliminate the concept of "waste". It is designed around three core principles:
      1. **Eliminate waste and pollution** at the design stage.
      2. **Circulate products and materials** at their highest value for as long as possible (through repair, refurbishment, and true recycling).
      3. **Regenerate nature** by returning biological materials safely to the earth.

      ### 🛠️ Real-World Example
      Instead of buying a washing machine that breaks in 5 years and gets trashed, imagine subscribing to "washing as a service". The manufacturer owns the machine, maintains it, and when it breaks, they take it back to harvest the parts for new machines. They are financially incentivized to make it last 30 years!
    `
  },
  {
    id: 'e4',
    title: 'The Truth About Recycling',
    description: 'Debunking wish-cycling and understanding the plastic crisis.',
    readTime: '4 min',
    category: 'Waste',
    completed: false,
    content: `
      ### 🗑️ The Hard Truth
      Recycling is often sold as the ultimate environmental solution, but it's actually the *last resort*. Globally, only about **9% of plastic ever produced has been recycled**. Most ends up in landfills, incinerated, or in the ocean.

      ### 🛑 The Danger of "Wish-Cycling"
      Wish-cycling is when you throw questionable items (like greasy pizza boxes, plastic bags, or mixed-material coffee cups) into the recycling bin, *hoping* they'll be recycled. 
      
      **This is highly destructive.** It contaminates the entire batch, causing recycling facilities to throw thousands of pounds of perfectly good recyclables straight into the landfill because it's too expensive to sort out the trash.

      ### 📋 The Hierarchy of Action
      1. **Refuse:** Say no to things you don't need (free promotional plastic pens).
      2. **Reduce:** Buy less stuff overall.
      3. **Reuse:** Switch to reusable water bottles, bags, and containers.
      4. **Repair:** Fix your phone or sew your jacket instead of buying new.
      5. **Recycle:** ONLY recycle materials you are 100% sure your local facility accepts.
    `
  },
];
