## Inspiration
In a world grappling with the "climate crisis," a parallel epidemic has emerged: **Eco-Anxiety**. Millions of people feel paralyzed by the sheer magnitude of the problem, leading to inaction and despair. We realized that the traditional narrative—fear, guilt, and austerity—was failing to motivate the digital generation. We asked ourselves: *What if saving the planet felt less like a chore and more like a massive multiplayer online game (MMO)?*

## What it does
**Sustain-a-thon** is a gamified sustainability platform that transforms eco-conscious living into a high-dopamine, rewarding sport.
1.  **AI-Powered Coaching:** Meets users with **EcoBot**, a context-aware AI driven by Google's Gemini model. Unlike generic chatbots, EcoBot analyzes user stats (XP, streak, badges) to provide hyper-personalized, optimistic encouragement.
2.  **Visualized Impact:** Replaces abstract CO2 numbers with interactive, real-time data visualizations, making "invisible" contributions tangible.
3.  **Gamification Engine:** A comprehensive system of XP, leveling curves, and unlocking badges (e.g., "10kg Club") to drive long-term user retention and habit formation.
4.  **Micro-Learning:** Deconstructs complex climate science (Ocean Acidification, Grid Storage) into digestible, interactive modules.

## How we built it
We architected **Sustain-a-thon** as a high-performance Single Page Application (SPA), leveraging the bleeding edge of the modern web ecosystem:

*   **Core Architecture:** Built on **React 19** and **Vite**, utilizing a modular component-based architecture. We employed TypeScript for strict type safety across our data models (`UserStats`, `ActionLogs`), ensuring a robust and maintainable codebase.
*   **Generative AI Integration:** We engineered a seamless integration with **Google's Gemini 1.5 Flash API**. By implementing **dynamic prompt injection**, we feed real-time application state—user level, recent activities, and unlocked achievements—into the system context. This allows the LLM to generate responses that are not just accurate, but contextually aware and emotionally resonant.
*   **Data Visualization:** We integrated **Recharts** to render responsive, SVG-based data visualizations. The charts are data-bound to our state management system, updating reactively as users log new actions.
*   **Persistence Layer:** To ensure a frictionless user experience (UX) without the latency of server-side roundtrips for the MVP, we implemented an optimized **localStorage persistence layer**. This uses custom hooks to synchronize state changes instantly, providing offline-first capabilities.
*   **Design System:** We bypassed generic UI libraries to build a custom **Neo-Brutalist design system** using **Tailwind CSS**. This involves high-contrast borders, hard-edged shadows (`box-shadow`), and tailored CSS transitions (`transform-gpu`) to ensure 60fps animations even on lower-end devices.

## Challenges we ran into
*   **Prompt Engineering vs. Hallucination:** Balancing the AI's "youthful, optimistic" persona while ensuring scientific accuracy was difficult. We iterated through multiple system instruction sets to strictly bound the AI's creativity within the realm of factual climate science.
*   **State Synchronization:** Managing the complex state dependencies between the gamification engine (XP calculations, Badge unlocking logic) and the persistence layer required careful handling of React's `useEffect` dependency arrays to avoid infinite render loops.
*   **Visual Consistency:** Implementing the Neo-Brutalist aesthetic required precise control over CSS borders and layout shifts, challenging standard responsive design patterns.

## Accomplishments that we're proud of
*   **The "EcoBot" Personality:** We successfully tuned the LLM to avoid "cringe" slang while remaining genuinely engaging and supportive.
*   **Zero-Latency Interactions:** The app feels instantaneous. Action logging, level-ups, and page transitions happen in <16ms thanks to our aggressive client-side optimizations.
*   **Educational Depth:** We didn't just make a tracker; we built an educational tool that simplifies complex topics like "The Greenhouse Effect" without dumbing them down.

## What we learned
*   **The Power of Context:** Large Language Models (LLMs) become exponentially more useful when grounded in structured application data.
*   **Gamification Psychology:** Small UI feedbacks—like a progress bar filling up or a badge unlocking—have a disproportionate impact on user motivation.
*   **Sustainable Web Design:** Just as we track carbon, we optimized our asset delivery and code splitting to ensure the website itself has a low digital carbon footprint.

## What's next for Sustain-a-thon
*   **Backend Migration:** Migrating our persistence layer to **Supabase (PostgreSQL)** to enable social features and real-time multiplayer leaderboards.
*   **Mobile Native:** Porting the React code to **React Native** (Expo) for iOS/Android deployment.
*   **IoT Integration:** Connecting to smart home APIs to automatically log energy savings.

---

### Built with
React, Vite, TypeScript, Tailwind CSS, Google Gemini API, Recharts, Lucide Icons, LocalStorage API, Node.js, npm, PostCSS, Autoprefixer, ESBuild, HTML5 Canvas, DOM API, CSS3 Variables, Vercel Edge Networks, GitHub, Git, RESTful Architecture, JSON, Markdown, React Hooks, Custom React Context, Browser APIs, Semantic HTML5, WAI-ARIA Standards, Responsive Design Principles, GPU Acceleration, Single Page Application (SPA), Client-Side Rendering (CSR).
