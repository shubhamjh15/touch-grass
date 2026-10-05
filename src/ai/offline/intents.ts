/**
 * Intent matching for the built-in coach. Deterministic: the same text always
 * scores the same, with no network and no model. Each intent has weighted
 * patterns; the best score wins, ties go to the earlier intent, and anything
 * below the threshold is an honest "unknown".
 */

export type IntentId =
  | 'crisis'
  | 'greeting'
  | 'thanks'
  | 'goodbye'
  | 'how_are_you'
  | 'who_are_you'
  | 'joke'
  | 'easy_win'
  | 'biggest_lever'
  | 'explain_numbers'
  | 'what_is_co2e'
  | 'streak'
  | 'tree_status'
  | 'food'
  | 'food_waste'
  | 'transport'
  | 'flying'
  | 'home_energy'
  | 'stuff_waste'
  | 'recycling_worth'
  | 'money_swap'
  | 'quests'
  | 'anxiety'
  | 'how_it_works'
  | 'enable_live'
  | 'off_topic'
  | 'unknown';

interface Pattern {
  re: RegExp;
  weight: number;
}

const p = (re: RegExp, weight: number): Pattern => ({ re, weight });

/** Order is the tie-break: safety first, then specific before general. */
const INTENTS: readonly { id: Exclude<IntentId, 'unknown'>; patterns: Pattern[] }[] = [
  {
    id: 'crisis',
    patterns: [
      p(
        /\b(kill myself|killing myself|suicid\w*|end my life|ending my life|want to die|wanna die|self harm|selfharm|hurt myself|harm myself|no reason to live|better off dead|cant go on|can not go on)\b/,
        20,
      ),
    ],
  },
  {
    id: 'off_topic',
    patterns: [
      p(
        /\b(weather forecast|stock market|stocks|bitcoin|crypto|homework|python|javascript|typescript|write (me )?(a )?(poem|essay|song|code|script)|translate|diagnos\w*|prescri\w*|medication|lawsuit|sue |tax return|invest\w*|who (should|do) i vote|which party)\b/,
        8,
      ),
    ],
  },
  {
    id: 'who_are_you',
    patterns: [
      p(
        /\b(who are you|what are you|are you (a |an )?(bot|ai|human|real|person|robot|llm|chatgpt)|your name|who is moss|who made you|who built you|are you moss)\b/,
        6,
      ),
    ],
  },
  {
    id: 'enable_live',
    patterns: [
      p(
        /\b(api key|live (coach|ai)|real ai|turn on (the )?ai|enable (the )?ai|connect (the )?ai|ai mode|smarter|chatgpt|gpt|llm|language model)\b/,
        6,
      ),
    ],
  },
  {
    id: 'greeting',
    patterns: [
      p(
        /^(hi|hey|hello|yo|hiya|howdy|sup|hola|good (morning|afternoon|evening))( there| moss| coach)?$/,
        8,
      ),
    ],
  },
  { id: 'thanks', patterns: [p(/\b(thanks|thank you|thx|cheers|appreciate (it|that|you))\b/, 6)] },
  {
    id: 'goodbye',
    patterns: [p(/\b(bye|goodbye|see you|see ya|cya|good night|gotta go|talk later)\b/, 6)],
  },
  {
    id: 'how_are_you',
    patterns: [p(/\b(how are you|how are u|hows it going|how do you feel|whats up)\b/, 6)],
  },
  { id: 'joke', patterns: [p(/\b(joke|make me laugh|something funny|tell me a pun)\b/, 6)] },
  {
    id: 'anxiety',
    patterns: [
      p(
        /\b(anxious|anxiety|hopeless|doom\w*|scared|afraid|worried|worry|overwhelm\w*|despair|depress\w*|pointless|too late|give up|ecoanxi\w*|eco anxi\w*|helpless|panic\w*)\b/,
        6,
      ),
    ],
  },
  {
    id: 'what_is_co2e',
    patterns: [
      p(/\bwhat('?s| is| does)\b.*\b(co2e?|carbon dioxide|greenhouse|footprint)\b/, 7),
      p(/\bco2e?\b.*\b(mean|stand for|short for)\b/, 7),
      p(/\b(carbon dioxide equivalent|greenhouse gas(es)?)\b/, 4),
    ],
  },
  {
    id: 'explain_numbers',
    patterns: [
      p(/\bexplain (my )?numbers?\b/, 8),
      p(
        /\b(how accurate|how reliable|where do (the )?numbers come from|how do you (calculate|work out|estimate)|how is (this|that|it) calculated|can i trust)\b/,
        7,
      ),
      p(/\b(kg|co2e?|numbers?|figures?|estimates?|approximately|impact so far)\b/, 3),
    ],
  },
  {
    id: 'biggest_lever',
    patterns: [
      p(/\b(biggest|largest|best|top) (lever|impact|win|difference|thing|change|swap)\b/, 7),
      p(
        /\b(what matters( most)?|matters most|most impact\w*|highest impact|move the needle|lever)\b/,
        5,
      ),
    ],
  },
  {
    id: 'easy_win',
    patterns: [
      p(/\b(easy|quick|simple) (win|one|thing|start|idea)\b/, 7),
      p(
        /\b(what should i do|what can i do|where (do|should) i start|something (small )?to do|give me (an )?idea|any ideas|one idea|next step)\b/,
        6,
      ),
      p(/\b(idea|ideas|suggest\w*|recommend\w*)\b/, 2),
    ],
  },
  {
    id: 'streak',
    patterns: [
      p(
        /\b(streaks?|rain ?clouds?|rain|missed a day|miss a day|missed yesterday|broke my streak|lose my streak|lost my streak)\b/,
        6,
      ),
    ],
  },
  {
    id: 'tree_status',
    patterns: [
      p(
        /\b(thirsty|dormant|wilt\w*|droop\w*|why is my tree|my tree|tree (is|looks|seems)|resting|asleep|sad tree|grow(ing)? (slow|slowly)|why isnt my tree)\b/,
        6,
      ),
    ],
  },
  {
    id: 'quests',
    patterns: [p(/\b(quests?|weekly|dailies|daily goals?|challenges?|missions?)\b/, 6)],
  },
  {
    id: 'recycling_worth',
    patterns: [
      p(/\brecycl\w*\b/, 5),
      p(/\b(worth it|worth the|actually (work|help)|does it (work|help|matter))\b/, 2),
    ],
  },
  {
    id: 'money_swap',
    patterns: [
      p(
        /\b(save money|saves money|saving money|cheap\w*|budget|afford\w*|frugal|money|cost\w*)\b/,
        5,
      ),
      p(/\bswap\b/, 2),
    ],
  },
  {
    id: 'flying',
    patterns: [
      p(
        /\b(fly|flying|flight|flights|plane|airplane|airport|long haul|holiday abroad|aviation)\b/,
        7,
      ),
    ],
  },
  {
    id: 'food_waste',
    patterns: [
      p(
        /\b(leftovers?|food waste|wasting food|waste food|throw(ing)? (away )?food|bin(ning)? food|expired food|use up)\b/,
        7,
      ),
    ],
  },
  {
    id: 'food',
    patterns: [
      p(
        /\b(dinner|lunch|breakfast|supper|meals?|recipes?|vegan|vegetarian|plant based|flexitarian|meat|beef|lamb|chicken|dairy|cheese|milk|diet|cook\w*|food|eat\w*|groceries|grocery)\b/,
        4,
      ),
      p(/\b(low carbon|lowcarbon)\b.*\b(dinner|meal|lunch|recipe)\b/, 3),
    ],
  },
  {
    id: 'transport',
    patterns: [
      p(
        /\b(commut\w*|car|cars|bus|bike|biking|bicycle|cycl\w*|walk\w*|train|tram|metro|subway|drive|driving|transport\w*|travel\w*|scooter|carpool\w*|electric car|ev|petrol|diesel|school run)\b/,
        4,
      ),
    ],
  },
  {
    id: 'home_energy',
    patterns: [
      p(
        /\b(heating|heat|heater|thermostat|boiler|electric\w*|energy|bill|insulat\w*|air con|aircon|ac|solar|laundry|washing|dryer|appliances?|lights?|standby|home|house|flat|apartment)\b/,
        4,
      ),
    ],
  },
  {
    id: 'stuff_waste',
    patterns: [
      p(
        /\b(clothes|clothing|fashion|plastics?|packaging|shopping|buy\w*|second hand|secondhand|thrift\w*|repair\w*|waste|stuff|gadgets?|phones?|laptops?|electronics?|trash|rubbish|compost\w*|declutter\w*)\b/,
        4,
      ),
    ],
  },
  {
    id: 'how_it_works',
    patterns: [
      p(
        /\b(how (does|do) (this|it|the app|touch grass) work|how do i (use|log|earn|level|get started|play)|how to use|what is touch grass|how it works|what is (xp|a ring|the point))\b/,
        6,
      ),
      p(/\b(xp|levels?|points|rings?|badges?|help)\b/, 3),
    ],
  },
];

const THRESHOLD = 3;

/** Lowercase, drop accents and punctuation, turn hyphens and dashes into spaces. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/\p{Pf}|\p{Pi}|'/gu, '')
    .replace(/[\p{Pd}_/]+/gu, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface IntentMatch {
  intent: IntentId;
  score: number;
}

export function matchIntent(message: string): IntentMatch {
  const text = normalise(message);
  if (text === '') return { intent: 'unknown', score: 0 };
  let best: IntentMatch = { intent: 'unknown', score: 0 };
  for (const { id, patterns } of INTENTS) {
    let score = 0;
    for (const { re, weight } of patterns) if (re.test(text)) score += weight;
    if (score > best.score) best = { intent: id, score };
  }
  return best.score >= THRESHOLD ? best : { intent: 'unknown', score: best.score };
}
