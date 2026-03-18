import OpenAI from 'openai';
import { UserStats } from "../types";

const apiKey = process.env.OPENROUTER_API_KEY || '';

// Initialize OpenAI client pointing to OpenRouter
const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: apiKey,
    dangerouslyAllowBrowser: true, // Required for client-side usage
});

export const getAiResponse = async (
    history: { role: string; text: string }[],
    message: string,
    userStats?: UserStats
): Promise<string> => {
    if (!apiKey) {
        throw new Error("OpenRouter API Key is missing. Please configure the environment variables.");
    }

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
    You are a **Sustainability Consultant** for "Sustain-a-thon", but with a twist: you are **witty, intellectually stimulating, and engaged**.

    **YOUR ROLE:**
    - Provide expert, data-backed advice on sustainable living.
    - Be a **smart, friendly guide**. Think of yourself as a knowledgeable peer who loves this stuff, not a stiff lecturer.
    - Use **clever analogies** and **engaging language**. Make sustainability feel like an exciting challenge or a life hack.

    **USER CONTEXT:**
    ${userContext}

    **GUIDELINES:**
    1.  **Be Witty & Sharp:** A little humor or a clever turn of phrase is great. Avoid being "cringe" (no forced slang like "fam" or "cap").
    2.  **Structured & clear:** Use Markdown headers (\`###\`), bullet points, and **bold text** for readability.
    3.  **Actionable & Impactful:** Don't just say "save water". Give a specific, surprising tip (e.g., "Put a brick in your toilet tank? Yes, really.").
    4.  **No Fluff:** avoid generic pleasantries. Start with a hook or the answer.
    5.  **Error Handling:** If you cannot answer, clear the air with a joke about your specialized knowledge base before redirecting.

    **FORMATTING:**
    - Use clean Markdown.
    - For lists, use standard bullet points.
    - Highlight key metrics or terms in **bold**.
    `;

        const messages = [
            { role: "system", content: systemPrompt },
            ...history.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.text })),
            { role: "user", content: message }
        ];

        const completion = await client.chat.completions.create({
            model: "arcee-ai/trinity-large-preview:free", // Default model, can be changed
            messages: messages as any,
        });

        return completion.choices[0]?.message?.content || "I apologize, but I couldn't generate a response at this time. Please try again.";
    } catch (error) {
        console.error("OpenRouter API Error:", error);
        throw new Error("Service temporarily unavailable. Please try again later.");
    }
};
