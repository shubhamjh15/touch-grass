# Submission Form Answers

## Project Title
Sustain-a-thon

## Describe your project in one sentence (max 100 characters)
Gamifying sustainability with AI coaching and real-time tracking to make saving the planet fun.

## Describe what your project does and its main features. How does it work from a user's perspective?
Sustain-a-thon is a gamified platform attacking eco-anxiety. Users log actions (like recycling) to earn XP and unlock badges, visualizing their impact with interactive charts. It features **EcoBot**, a GenAI coach (powered by Gemini) that gives personalized, optimistic advice based on user stats. It also includes micro-learning modules to demystify climate science. From a user's perspective, it feels like a game: you login, complete daily "missions," chat with the AI for tips, and watch your "CO2 Saved" graph grow, turning a daunting global crisis into a manageable, rewarding personal challenge.

## What were the biggest obstacles you faced during development? How did you attempt to overcome them?
One major hurdle was **hallucinations in the AI**. We wanted EcoBot to be "youthful" but scientifically accurate. We overcame this by implementing strict system prompts and feeding the AI real-time user state (level, badges) context, grounding its responses. Another challenge was **state persistence**. Ensuring the "gamified" feel meant level-ups needed to be instant. We struggled with React render loops when syncing complex XP logic with local storage, but resolved it by building a custom hook for optimized state synchronization.

## What are you most proud of achieving? What milestones did you hit that felt significant?
We are proud of **Zero-Latency Interactions**; the app feels native. We also nailed the **EcoBot persona**—it feels like a friend. Finally, building a dynamic **Leveling System** that unlocks badges based on real user data was a major milestone.

## What new skills, technologies, or concepts did you learn while building this project?
We learned deep **Prompt Engineering** to control LLM tone with JSON context. We also mastered **Neo-Brutalist design** (hard shadows/borders) in Tailwind, and learned **Client-Side Optimization** to structure data models for future SQL migration.

## What are your plans for future development? What features would you like to add?
We plan to migrate persistence to **Supabase** for multiplayer features and "Guild" competitions. We also want to launch a **React Native mobile app** using computer vision to automatically verify recycled items via camera.

## How does your project address environmental or social sustainability? What impact could it have?
Sustain-a-thon directly addresses **Social Sustainability** by combating "Climate Doomism." By shifting the narrative from fear to fun, we empower individuals who feel helpless. Environmentally, if just 1,000 users complete our daily "Meat-Free Meal" mission, we save tons of CO2 weekly. It bridges the gap between *knowing* you should help and actually *doing* it by leveraging the psychology of video games for the planet good.

## List all technologies, APIs, frameworks, and tools used
React, Vite, TypeScript, Tailwind CSS, Google Gemini API, Recharts, Lucide Icons, LocalStorage API, Node.js, PostCSS, GitHub, Git, JSON, Markdown, React Hooks, Browser APIs, Semantic HTML5, WAI-ARIA Standards.
