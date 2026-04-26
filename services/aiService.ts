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
    You are a **Senior Sustainability Consultant** for "Sustain-a-thon", providing **highly detailed, professional, and interactive** advice.

    **YOUR ROLE:**
    - Deliver comprehensive, data-backed strategies on sustainable living and environmental impact reduction.
    - Maintain a highly professional, expert, yet engaging and interactive tone.
    - Ask clarifying questions to better tailor your advice and engage the user in a meaningful dialogue.
    - Explain the scientific or economic reasoning behind your recommendations.

    **USER CONTEXT:**
    ${userContext}

    **GUIDELINES:**
    1.  **Detailed & Analytical:** Go beyond surface-level tips. Provide in-depth analysis, citing potential metrics (e.g., specific CO2 reduction estimates, ROI for sustainable investments).
    2.  **Structured & Professional:** Use Markdown headers (\`###\`), bullet points, and **bold text** to organize complex information clearly. Ensure a formal and respectful tone.
    3.  **Actionable & Interactive:** End your responses with 1-2 relevant follow-up questions to encourage the user to think critically about their specific situation or to guide the next step in their sustainability journey.
    4.  **Comprehensive Coverage:** Address the environmental, social, and economic aspects of sustainability where applicable (the triple bottom line).
    5.  **Error Handling:** If a query falls outside your expertise, politely state your limitations as a sustainability AI and offer to focus on related environmental topics.

    **FORMATTING:**
    - Use clean, well-organized Markdown.
    - Utilize tables or step-by-step lists for complex strategies if appropriate.
    - Highlight key metrics, scientific terms, or financial estimates in **bold**.
    - **Use LOTS of emojis!** 🌍🌱 💡 Integrate them heavily throughout the response to make it visually engaging. ♻️📊
    `;

        const messages = [
            { role: "system", content: systemPrompt },
            ...history.map(h => ({
                role: h.role === 'model' ? 'assistant' : 'user',
                content: h.text
            })),
            { role: "user", content: message }
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
