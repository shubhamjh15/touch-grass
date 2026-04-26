import { UserStats } from "../types";

// Free Ollama server proxies (via ollamafreeapi community servers)
// Proxied through Vite dev server to avoid CORS
const OLLAMA_ENDPOINTS = ['/ollama-1', '/ollama-2', '/ollama-3'];
const MODEL = 'llama3.2:3b';

async function callOllamaServer(endpoint: string, messages: any[]): Promise<string> {
    const response = await fetch(`${endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: MODEL,
            messages: messages,
            stream: false,
        }),
    });

    if (!response.ok) {
        throw new Error(`Server ${endpoint} returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.message?.content || '';
}

export const getAiResponse = async (
    history: { role: string; text: string }[],
    message: string,
    userStats?: UserStats
): Promise<string> => {
    try {
        // Construct user context string
        let userContext = "";
        if (userStats) {
            userContext = `
      USER CONTEXT:
      - Sustain-a-thon Level: ${userStats.level}
      - Experience Points: ${userStats.xp}
      - Total CO2 Saved: ${userStats.co2Saved.toFixed(2)} kg
      - Achievements: ${userStats.badges.join(', ')}
      - Current Streak: ${userStats.streak} days
      `;
        }

        const systemPrompt = `
    You are the "Sustain-a-thon AI Coach" — an extremely energetic, highly knowledgeable, and friendly sustainability expert! 🌍✨

    **YOUR PERSONALITY:**
    - You are deeply passionate about saving the planet and hyping up the user! 🙌
    - You MUST use AT LEAST 5-10 emojis in EVERY response! ♻️🌱💡🌊
    - You are interactive, friendly, and speak casually but with real scientific/economic facts. 📊
    
    **YOUR MISSION:**
    1. Give detailed, actionable advice about sustainability.
    2. Format nicely with short paragraphs and bullet points.
    3. **CRITICAL REQUIREMENT:** You MUST end EVERY single response with a relevant, engaging question to keep the conversation going! 🗣️❓

    **USER CONTEXT:**
    ${userContext}
    `;

        const messages = [
            { role: "system", content: systemPrompt },
            ...history.map(h => ({
                role: h.role === 'model' ? 'assistant' : 'user',
                content: h.text
            })),
            { role: "user", content: message + "\n\n(IMPORTANT INSTRUCTION FOR AI: Reply with extremely high energy, use lots of emojis 🌍🌱, and ALWAYS end your response with a question for me!)" }
        ];

        // Try each server endpoint with fallback
        let lastError: Error | null = null;
        for (const endpoint of OLLAMA_ENDPOINTS) {
            try {
                console.log(`Trying Ollama server: ${endpoint}...`);
                const result = await callOllamaServer(endpoint, messages);
                if (result) {
                    console.log(`Success with ${endpoint}`);
                    return result;
                }
            } catch (err: any) {
                console.warn(`Server ${endpoint} failed:`, err.message);
                lastError = err;
                // Continue to next server
            }
        }

        throw lastError || new Error("All servers unavailable");
    } catch (error: any) {
        console.error("Ollama API Error:", error);
        throw new Error(error.message || "Service temporarily unavailable. Please try again later.");
    }
};
