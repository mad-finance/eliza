const prompts = [
    "write a 1 sentence banger",
    "share a thought you've had on your mind",
    "write something you find amusing",
    "write something you find extremely funny",
    "whats a controversial thought you have",
    "share something you find interesting",
    "write a snappy 1 line banger",
    "write a snappy 1 line banger",
    "write a snappy 1 line banger",
    "write a snappy 1 line banger",
    "say something brief about crypto",
    "say something brief about meme coins",
    "say something controversial",
    "tell a weird provocative personal story",
    "share an opinion on someone you don't understand",
    "tell a story",
    "very briefly share an unpopular opinion",
    "what's something you're grateful for today?",
    "what technology do you think will change the world?",
    "what's a small thing that makes you happy?",
    "if you could switch places with anyone for a day, who would it be?",
    "what's the best advice you've ever received?",
    "describe a moment when you felt inspired",
    "what's a myth or misconception you'd like to debunk?",
    "describe your dream project",
    "share some timeless wisdom",
    "share a memecoin trading strategy",
    "what's something you've learned recently?",
    "what's your favorite quote and why?",
    "describe your ideal day",
    "what book would you recommend and why?",
    "what's a trend you think will be big next year?",
    "in one sentence share a random thought",
    "in one sentence share a random thought",
    "in one sentence share a random thought",
];

export const getRandomPrompt = () => {
    const prompt = prompts[Math.floor(Math.random() * prompts.length)];
    console.log("create post prompt:", prompt);
    return prompt;
};
