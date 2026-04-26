import React, { useState, useMemo } from 'react';
import { NeoCard } from '../components/ui/NeoCard';
import { NeoButton } from '../components/ui/NeoButton';
import { NeoModal } from '../components/ui/NeoModal';
import { PlayCircle, CheckCircle, BookOpen, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { EducationModule } from '../types';

const DETAILED_MODULES: EducationModule[] = [
  {
    id: "e1", title: "The Greenhouse Effect", description: "Understand how gases trap heat and why it's accelerating.", readTime: "3 min", category: "Climate", completed: true,
    content: `
# 🌍 The Greenhouse Effect: Earth's Blanket

**What is it?**
Imagine Earth wrapped in a giant, invisible blanket. Sunlight hits the Earth, warms it up, and then that heat tries to escape back into space. Greenhouse gases (like Carbon Dioxide, Methane, and Nitrous Oxide) act like the fibers in that blanket, trapping some of the heat to keep the planet warm enough for life.

### ⚠️ The Core Problem
We are making the blanket too thick! Burning fossil fuels (coal, oil, gas) adds massive amounts of CO2 into the atmosphere. 
*   **Natural CO2 level:** ~280 parts per million (ppm)
*   **Current CO2 level:** Over 420 ppm!

This traps too much heat, leading to **Global Warming**, which causes melting ice caps, rising sea levels, and extreme weather events.

### 💡 Key Takeaway
The greenhouse effect isn't inherently "bad" (without it, Earth would be a frozen ice ball at -18°C!). The issue is that human activities are supercharging it way beyond natural, balanced levels.
    `
  },
  {
    id: "e2", title: "Ocean Acidification", description: "The evil twin of climate change explained.", readTime: "5 min", category: "Oceans", completed: false,
    content: `
# 🌊 Ocean Acidification: The Evil Twin

While global warming gets all the media attention, ocean acidification is just as terrifying for our planetary ecosystem. The ocean acts as a massive carbon sink, absorbing about **30% of all the CO2 we release**.

### 🧪 The Chemistry (Simplified)
When CO2 dissolves in seawater, it reacts with water molecules to form **carbonic acid**. This lowers the pH of the ocean, making it more acidic. Since the Industrial Revolution, ocean acidity has increased by roughly 30%.

### 🦪 Why it matters:
Shellfish, corals, and vital plankton rely on carbonate ions to build their shells and skeletons. Highly acidic water literally *steals* these ions, causing shells to dissolve or become incredibly brittle. 

If the bottom of the marine food web collapses (like plankton), the entire ocean ecosystem—including the fish humans rely on for food—collapses with it.
    `
  },
  {
    id: "e3", title: "Recycling 101: The Hard Truth", description: "What actually happens to your plastic?", readTime: "4 min", category: "Waste", completed: false,
    content: `
# ♻️ Recycling: Fact vs. Fiction

**The Hard Truth:** Only about **9% of all plastic ever produced has been recycled.** The vast majority ends up in landfills, incinerators, or polluting the natural environment.

### 🛑 The Danger of "Wish-cycling"
This is when you throw something in the recycling bin *hoping* it's recyclable (like a greasy pizza box, a tangled wire, or a mixed-material coffee cup). 
**Why it's bad:** It contaminates the entire batch. One greasy box can ruin a whole ton of clean cardboard, sending it all to the landfill.

### ✅ The Golden Rules of Waste:
1. **Reduce first:** The absolute best way to manage waste is to not create it. Buy less packaging.
2. **Reuse second:** Glass jars, sturdy bags, repairing clothes.
3. **Recycle last:** And make sure it is *clean, dry, and actually accepted* by your local municipality.
    `
  },
  {
    id: "e4", title: "Renewable Energy Revolution", description: "Solar, Wind, and Hydro explained.", readTime: "6 min", category: "Energy", completed: false,
    content: `
# ⚡ The Renewable Revolution

Fossil fuels are out. Clean energy is in. Here's how the big three work:

### ☀️ Solar Power
Photovoltaic (PV) cells convert sunlight directly into electricity. 
*   **The Good News:** The cost of solar energy has dropped by **89%** in the last decade! It is now the cheapest source of electricity in history in many parts of the world.

### 🌬️ Wind Power
Massive turbines capture the kinetic energy of the wind. Just one rotation of a modern offshore wind turbine can power an average home for an entire day!

### 🔋 The Grid Challenge
The sun doesn't always shine, and the wind doesn't always blow. To rely 100% on renewables, we need massive advancements in **battery storage technology** and a "smart grid" that can move electricity instantly from where it's generated to where it's needed.
    `
  },
  {
    id: "e5", title: "The True Cost of Fast Fashion", description: "Why that $5 t-shirt costs the earth.", readTime: "5 min", category: "Lifestyle", completed: false,
    content: `
# 👕 Fast Fashion: A Toxic Trend

Fast fashion refers to cheap, trendy clothing rapidly pumped out by mass-market retailers. 

### 💧 The Thirsty Industry
The fashion industry is the second-largest consumer of water worldwide. It takes about **2,700 liters of water** to make just one cotton shirt—that’s enough water for one person to drink for two and a half years!

### ☠️ Microplastics in your washing machine
Most fast fashion clothes are made from synthetic fibers like polyester and nylon (which are literally plastics derived from oil). Every time you wash them, they shed thousands of **microplastics** that flow straight through wastewater treatment plants and into the ocean.

### 💡 What you can do:
*   **Thrift & Vintage:** Buy second-hand.
*   **Quality over Quantity:** Buy fewer, well-made items that last years.
*   **Wear it out:** Wear your clothes longer before tossing them.
    `
  },
  {
    id: "e6", title: "Plant-Based Diets & Land Use", description: "How what you eat changes the map.", readTime: "4 min", category: "Diet", completed: false,
    content: `
# 🍔 The Carbon Footprint of Food

You don't have to be a strict vegan to help the planet, but understanding the impact of your diet is crucial.

### 🐄 The Beef with Beef
Beef has the highest carbon footprint of almost any food. This is due to two factors:
1. **Methane:** Cows burp and burp methane, a greenhouse gas 25x more potent than CO2.
2. **Deforestation:** Vast swaths of the Amazon rainforest are cut down simply to create grazing land for cattle, or to grow soy to feed cattle.

### 🌾 Land Use Inefficiency
Globally, **80% of agricultural land** is used for livestock (grazing and growing animal feed), yet meat and dairy only provide **18% of global calories**. 

Swapping beef for poultry, or better yet, beans and lentils just one or two days a week drastically cuts your personal carbon footprint.
    `
  },
  {
    id: "e7", title: "E-Waste Demystified", description: "Where do old phones go to die?", readTime: "4 min", category: "Waste", completed: false,
    content: `
# 📱 Electronic Waste (E-Waste)

E-waste is the fastest-growing waste stream in the world. We generate over **50 million tonnes** of it annually.

### ⛏️ Toxic Mining & Heavy Metals
Smartphones and laptops contain rare earth metals (cobalt, lithium, gold) that require highly destructive mining practices. When thrown in a landfill, heavy metals like lead and mercury leak into the groundwater.

### 🔄 The Solution:
*   **Don't upgrade yearly:** Keep your phone for 3-4 years instead of 1-2.
*   **Right to Repair:** Support legislation that forces tech companies to make devices repairable.
*   **Certified Recycling:** Never throw electronics in the normal trash. Take them to certified e-waste recycling centers so the precious metals can be extracted and reused.
    `
  },
  {
    id: "e8", title: "Composting 101", description: "Turn trash into black gold.", readTime: "3 min", category: "Waste", completed: false,
    content: `
# 🍂 Composting: Nature's Recycling

Food waste in landfills doesn't harmlessly break down. Because it's buried under tons of trash without oxygen, it decomposes *anaerobically*, releasing massive amounts of **methane**.

### 🌿 The Magic of Composting
Composting allows organic matter to break down aerobically (with oxygen), turning it into nutrient-rich soil ("black gold") without producing methane.

### ⚖️ The Balance (Greens & Browns)
A healthy compost needs a mix:
*   **Greens (Nitrogen):** Vegetable scraps, fruit peels, coffee grounds, grass clippings.
*   **Browns (Carbon):** Dry leaves, cardboard, paper, twigs.

Mix them up, keep them slightly damp, and let the microbes do the rest!
    `
  }
];

const EXPANDED_MYTHS = [
  { q: "Myth: Climate change is just a natural cycle.", a: "Fact: While Earth has natural cycles, the warming rate over the last century is unprecedented and 100% driven by human greenhouse gas emissions." },
  { q: "Myth: One person can't make a difference.", a: "Fact: Individual actions drive market demand, influence peers, and pressure politicians. Systemic change starts with collective individual choices!" },
  { q: "Myth: Renewable energy is too expensive.", a: "Fact: Solar and wind are now the cheapest sources of new electricity in most of the world, far undercutting coal and gas." },
  { q: "Myth: Electric Vehicles (EVs) are worse because of battery mining.", a: "Fact: While battery mining has an impact, over its lifetime, an EV emits significantly less carbon than a gas-powered car, even when charged on a dirty grid." },
  { q: "Myth: We can just plant trees to solve global warming.", a: "Fact: Trees are great, but there is not enough land on Earth to plant the trillions of trees needed to offset current fossil fuel emissions. We must cut emissions first." },
  { q: "Myth: Sustainable living is only for the rich.", a: "Fact: True sustainability is about consuming less. Thrifting, repairing, eating plant-based, and reducing energy use actually saves you massive amounts of money." },
  { q: "Myth: A few degrees of warming is nice, especially in winter.", a: "Fact: Global average temperatures rising by just 2°C completely disrupts global weather systems, destroys agriculture, and raises sea levels enough to flood major cities." },
  { q: "Myth: Recycling is a scam so I shouldn't bother.", a: "Fact: Plastic recycling is deeply flawed, but recycling aluminum, glass, and paper is highly efficient and saves enormous amounts of energy compared to mining raw materials." }
];

export const Education: React.FC = () => {
  const [flippedCard, setFlippedCard] = useState<number | null>(null);
  const [selectedModule, setSelectedModule] = useState<EducationModule | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  const categories = ['All', ...Array.from(new Set(DETAILED_MODULES.map(m => m.category)))];

  const filteredModules = useMemo(() => {
    if (categoryFilter === 'All') return DETAILED_MODULES;
    return DETAILED_MODULES.filter(m => m.category === categoryFilter);
  }, [categoryFilter]);

  return (
    <div className="space-y-12 pb-12 animate-fade-in">
      <div className="text-center mt-8">
        <div className="inline-block bg-neo-pink text-white border-4 border-neo-black px-6 py-2 rounded-full font-bold shadow-neo-sm transform rotate-2 mb-4">
          <BookOpen className="inline mr-2" />
          Brain Gain
        </div>
        <h2 className="text-5xl font-black mb-4">Knowledge is Power</h2>
        <p className="text-xl text-gray-700 font-medium max-w-2xl mx-auto">
          Arm yourself with peer-reviewed facts. Bust the myths, understand the science, and become the smartest eco-warriot in the room.
        </p>
      </div>

      {/* Bite-sized Modules */}
      <section>
        <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4">
          <h3 className="text-3xl font-black border-b-4 border-neo-black inline-block">Micro-Learning Modules</h3>
          
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <button 
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-4 py-1 text-sm font-bold border-2 border-black rounded-lg transition-all ${
                  categoryFilter === cat ? 'bg-neo-yellow shadow-[2px_2px_0px_0px_black]' : 'bg-white hover:bg-gray-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredModules.map((mod) => (
            <NeoCard key={mod.id} color={mod.completed ? 'green' : 'white'} className="flex flex-col h-full hover:-translate-y-2 transition-transform">
              <div className="flex-1">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-xs font-black border-2 border-black px-2 py-1 rounded bg-white shadow-sm uppercase tracking-wider">
                    {mod.category}
                  </span>
                  {mod.completed && <CheckCircle size={24} className="text-green-800" />}
                </div>
                <h4 className="text-2xl font-black mb-3 leading-tight">{mod.title}</h4>
                <p className="text-base text-gray-700 mb-6 font-medium leading-relaxed">{mod.description}</p>
              </div>
              <NeoButton 
                size="md" 
                variant={mod.completed ? 'outline' : 'secondary'} 
                className="w-full border-2"
                onClick={() => setSelectedModule(mod)}
              >
                {mod.completed ? 'Review Material' : `Start Module (${mod.readTime})`} <PlayCircle size={18} />
              </NeoButton>
            </NeoCard>
          ))}
        </div>
      </section>

      {/* Myth Buster Cards */}
      <section className="pt-8">
        <h3 className="text-3xl font-black mb-8 border-b-4 border-neo-black inline-block flex items-center gap-3">
          <AlertTriangle className="text-neo-pink" size={32} /> Myth Busters
        </h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {EXPANDED_MYTHS.map((item, idx) => (
            <div 
              key={idx} 
              className="h-72 cursor-pointer perspective-1000 group"
              onClick={() => setFlippedCard(flippedCard === idx ? null : idx)}
            >
              <div className={`relative w-full h-full transition-all duration-500 preserve-3d ${flippedCard === idx ? 'rotate-y-180' : ''}`}>
                {/* Front */}
                <div className="absolute inset-0 backface-hidden">
                  <NeoCard color="pink" className="h-full flex flex-col items-center justify-center text-center p-6 border-4">
                    <span className="text-4xl mb-4">🛑</span>
                    <h4 className="text-xl font-black leading-snug">{item.q}</h4>
                    <p className="absolute bottom-4 text-sm font-bold opacity-60 uppercase tracking-widest">Tap for truth</p>
                  </NeoCard>
                </div>
                {/* Back */}
                <div className="absolute inset-0 backface-hidden rotate-y-180">
                  <NeoCard color="blue" className="h-full flex flex-col items-center justify-center text-center p-6 border-4">
                    <span className="text-4xl mb-4">✅</span>
                    <h4 className="text-lg font-bold leading-relaxed text-white drop-shadow-md">{item.a}</h4>
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
          <div className="prose prose-lg prose-p:my-3 prose-p:leading-relaxed prose-h1:text-3xl prose-h1:font-black prose-h1:mb-6 prose-h1:border-b-4 prose-h1:border-neo-yellow prose-h1:pb-2 prose-h3:text-xl prose-h3:font-bold prose-h3:mt-8 prose-li:font-medium">
            <ReactMarkdown>{selectedModule.content}</ReactMarkdown>
            
            <div className="mt-12 text-center pt-8 border-t-4 border-dashed border-gray-200">
              <NeoButton onClick={() => setSelectedModule(null)} variant="primary" size="lg" className="mx-auto">
                Mark as Complete (+50 XP)
              </NeoButton>
            </div>
          </div>
        )}
      </NeoModal>
    </div>
  );
};