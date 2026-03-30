"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const diamondsStory = {
    id: "5bcadc84-3635-4608-9dd2-ae15f6715f5e",
    title: "Diamonds in the Dark",
    summary: "Amidst the glitz and glamour of Old Hollywood, a starlet's illustrious life is cut short, leaving behind a tangled web of secrets and stolen diamonds.",
    plot: "As the cast and crew gather for a lavish dinner party to celebrate the premiere of the new blockbuster film, the festivities take a dark turn when the lead actress is discovered lifeless on set, her prized royal diamonds missing.",
    setting: "old hollywood",
    period: "1920s",
    tone: "campy fun",
    rating: "PG13",
    victim: "Vivian LaRue, the glamorous starlet",
    murder: "poisoned champagne",
    treasure: "missing royal diamonds",
    acts: {
        act1: "The scene is set at a lavish avante-garde mansion, where the elite of Old Hollywood gather to celebrate the premiere of 'Diamonds in the Dark'.",
        act2: "Dinner is served, and the atmosphere thickens with anticipation and hidden agendas.",
        act3: "The celebration takes a sinister turn when Vivian collapses, her champagne glass shattering on the floor.",
        act4: "In the wake of the tragedy, the remaining guests gather in the dimly lit parlor, tensions rising.",
        act5: "As the night draws to a close, the detective arrives to piece together the fragments of the night."
    },
    solution: {
        who: "Arthur Blake, the jealous co-star",
        how: "He tampered with Vivian's champagne, slipping in a deadly poison during a toast.",
        why: "Driven by resentment over Vivian's rising fame and his own fading career."
    },
    speeches: {
        introduction: "Ladies and gentlemen, welcome to a night of glitz and glamour, where the stars shine bright and the shadows whisper secrets.",
        dinner: "As the evening unfolds, let us toast to friendship, ambition, and the pursuit of dreams.",
        ending: "And so, as the final curtain falls on this tragic tale, let us reflect on the cost of ambition and the price of greed."
    },
    mysteries: [
        { question: "Who had access to Vivian's champagne before the toast?", answer: "Arthur Blake, as he was seated closest to her during dinner.", track: "who", notes: "His proximity allowed him the opportunity." },
        { question: "How did Arthur manage to conceal the poison in the champagne?", answer: "He used a hidden flask that he brought with him.", track: "how", notes: "His acting experience aided him." },
        { question: "Why did Arthur feel compelled to act against Vivian?", answer: "He believed that her death would elevate his own status.", track: "why", notes: "His jealousy drove him." },
        { question: "Who else might have had a motive to harm Vivian?", answer: "Clara Winslow, driven by her ambition to expose Hollywood secrets.", track: "who", notes: "Adds complexity." },
        { question: "How could Margaret have acted to prevent Vivian's death?", answer: "She could have monitored Arthur's behavior more closely.", track: "how", notes: "Her loyalty could have prompted vigilance." },
        { question: "Why did Vincent Moreau choose to frame Arthur rather than help him?", answer: "He sought to protect his own reputation.", track: "why", notes: "Vincent's ambition led him." }
    ],
    puzzles: [
        { type: "map", title: "The Unseen Paths of the Party", question: "Which locations allowed access to Vivian's champagne?", answer: "The Kitchen and the Dining Room.", track: "who", act: 1, content: { locations: ["Dining Room", "Kitchen", "Living Room", "Library", "Ballroom", "Garden"], legend: "A map of the party's main areas.", keyDetail: "A small bottle of champagne is left on the counter in the Kitchen.", misdirection: "The Garden appears likely but is too far.", deduction: "Only Arthur had immediate access." }, hint: "Consider proximity." },
        { type: "crossref", title: "The Veil of Deceit", question: "What connections exist between Arthur's alibi and Vivian's death?", answer: "Arthur's alibi breaks down when compared to witness statements.", track: "how", act: 2, content: { documentA: { title: "Evening Production Notes", source: "Vincent Moreau's files", summary: "Timeline of events.", details: ["Vivian was last seen at 8:15 PM.", "Toast at 8:30 PM.", "Arthur reportedly in Kitchen at 8:20 PM."] }, documentB: { title: "Witness Testimony", source: "Clara Winslow's notes", summary: "Guest statements.", details: ["Toast at 8:30 PM.", "Arthur returning at 8:25 PM.", "Arthur appeared anxious."] }, overlap: "Arthur could not have been in the Kitchen without arousing suspicion.", misdirection: "Clara was in the Living Room.", deduction: "Discrepancies suggest he had opportunity." }, hint: "Look for inconsistencies." },
        { type: "riddle", title: "A Toast to the Fickle Stars", question: "What does this note reveal?", answer: "Jealousy masked as celebration.", track: "why", act: 3, content: { artifactType: "Note found in the Dining Room", text: "To toast the star, we raise our glass. But in shadows, even bright lights may fade away.", surfaceMeaning: "Celebrating Vivian's success.", trueMeaning: "Reflects the writer's envy.", confirmation: "Arthur's jealousy aligns with the ominous tone." }, hint: "Consider who feels overshadowed." }
    ],
    characters: [
        { id: "1", name: "Arthur Blake", archetype: "Jealous Co-Star", style: "Brooding and intense", description: "A once-promising leading man overshadowed by the dazzling Vivian.", biography: "Arthur rose quickly in the early days of Hollywood but has watched his star fade.", motive: "To eliminate Vivian and reclaim his spotlight.", goal: "Distract others while searching for the missing diamonds.", secrets: ["He has been embezzling money from the film's budget.", "He is secretly in love with Vivian."], relationships: ["Tense rivalry with Vivian, mixed with unrequited love.", "Long-standing friendship with the director."], traits: ["Manipulative", "Evasive", "Charming", "Resentful", "Desperate"], items: ["A vintage locket containing a photo of Vivian", "A hidden flask of poison"] },
        { id: "2", name: "Clara Winslow", archetype: "Overzealous Journalist", style: "Cynical and sharp-tongued", description: "With a keen eye for scandal, Clara thrives on the secrets of Old Hollywood.", biography: "Having clawed her way up from small-town obscurity, Clara is determined to be first.", motive: "To uncover a scandal for a career-defining expose.", goal: "Gather enough information to solidify her reputation.", secrets: ["She has blackmail material on several guests.", "Her career was built on falsehoods."], relationships: ["Distrustful of Arthur.", "Old rivalry with a fellow journalist."], traits: ["Inquisitive", "Cynical", "Tenacious", "Deceitful", "Resilient"], items: ["A notepad filled with scandalous notes", "A camera for capturing hidden moments"] },
        { id: "3", name: "Margaret Delaney", archetype: "Doting Assistant", style: "Nurturing yet observant", description: "Margaret is devoted to Vivian, often overlooked but keenly aware of undercurrents.", biography: "Having worked for Vivian for years, Margaret knows the starlet's life intimately.", motive: "To protect Vivian's legacy and ensure her secrets remain buried.", goal: "Discover who killed Vivian and retrieve the diamonds.", secrets: ["She was in a secret relationship with Vivian.", "She is aware of Arthur's embezzlement."], relationships: ["Loyal to Vivian.", "Tense friendship with Clara."], traits: ["Observant", "Loyal", "Protective", "Intuitive"], items: ["Vivian's diary, filled with personal thoughts", "A unique brooch that belonged to Vivian"] },
        { id: "4", name: "Vincent Moreau", archetype: "Mysterious Director", style: "Smooth and enigmatic", description: "The visionary behind the film, Vincent is charming but conceals layers of ambition.", biography: "A celebrated director whose reputation is on the line.", motive: "To protect his career by ensuring the film is a hit.", goal: "Maintain control and manipulate the narrative.", secrets: ["He has been involved in an illicit affair with a producer.", "He has orchestrated a scheme to frame Arthur."], relationships: ["Complicated friendship with Clara.", "A mentor figure to Arthur."], traits: ["Charismatic", "Calculating", "Deceptive", "Ambitious"], items: ["A script with annotations revealing his intentions", "A hidden stash of the royal diamonds"] },
        { id: "5", name: "Louise Grant", archetype: "Wealthy Socialite", style: "Elegantly aloof", description: "Louise exudes sophistication but hides insecurities beneath her polished exterior.", biography: "Born into wealth, she is used to getting what she wants.", motive: "To regain her status as the center of attention.", goal: "Stir gossip and create drama.", secrets: ["She loaned money to Vivian that she now regrets.", "She has been spreading rumors."], relationships: ["Jealousy towards Vivian.", "Complicated friendship with Margaret."], traits: ["Egotistical", "Manipulative", "Elegant", "Cunning"], items: ["A diamond-encrusted cigarette holder", "A letter revealing her financial troubles"] }
    ],
    cards: [
        { id: "1", characterId: "1", scope: "story", type: "performance", target: null, text: "Deliver a toast in Vivian's memory, but let slip a hint of your jealousy.", notes: "Reveals inner conflict.", act: 1, order: 1 },
        { id: "2", characterId: "2", scope: "story", type: "investigate", target: "Arthur Blake", text: "Question Arthur about his alibi during the toast.", notes: "Probe for inconsistencies.", act: 1, order: 2 },
        { id: "3", characterId: "3", scope: "story", type: "conversation", target: "Clara Winslow", text: "Confront Clara about rumors regarding Vivian's past.", notes: "Highlights tension.", act: 2, order: 3 },
        { id: "4", characterId: "4", scope: "story", type: "performance", target: null, text: "Share a personal anecdote about Vivian that weaves in a subtle accusation.", notes: "Vincent manipulates mood.", act: 2, order: 4 },
        { id: "5", characterId: "5", scope: "story", type: "investigate", target: "Margaret Delaney", text: "Inquire about the financial support provided to Vivian.", notes: "Exposes secret relationship.", act: 3, order: 5 },
        { id: "6", characterId: null, scope: "universal", type: "conversation", target: null, text: "Discuss the significance of the royal diamonds.", notes: "Surfaces motivations.", act: 1, order: 6 },
        { id: "7", characterId: null, scope: "universal", type: "performance", target: null, text: "Invoke a dramatic scene by pretending to find a clue.", notes: "Creates tension.", act: 2, order: 7 }
    ],
    items: [],
    media: [],
    count: 5
};
async function main() {
    console.log('Seeding database...');
    await prisma.story.upsert({
        where: { id: diamondsStory.id },
        update: { title: diamondsStory.title, summary: diamondsStory.summary, dataJson: diamondsStory },
        create: {
            id: diamondsStory.id,
            title: diamondsStory.title,
            summary: diamondsStory.summary,
            dataJson: diamondsStory,
        }
    });
    console.log('✓ Seeded: Diamonds in the Dark');
    console.log('\nDone! Run: npm run dev');
}
main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=seed.js.map