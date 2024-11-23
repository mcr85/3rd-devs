import OpenAI from 'openai';
import FirecrawlApp, { type ScrapeResponse } from '@mendable/firecrawl-js';
import type { ChatCompletionMessageParam } from 'ai/prompts';

async function getPageText(url: string): Promise<string> {
    const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
    const scrapeResult = await firecrawl.scrapeUrl(url, { formats: ['markdown'] }) as ScrapeResponse;
    return scrapeResult.markdown as string;
}

function getQuestion(pageText: string) {
    let question = '';
    const lines = pageText.split('\n').filter(Boolean);
    const questionLabelIndex = lines.findIndex(item => item === 'Question:');
    question = lines[questionLabelIndex + 1];
    return question;
}

async function getAnswer(question: string): Promise<string> {
    const openai = new OpenAI();
    const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: 'You are going to be asked a question for which you need to answer with a year (number). Respond only with year number.' },
        { role: 'user', content: question }
    ];

    try {
        const chatCompletion = await openai.chat.completions.create({
            messages,
            model: 'gpt-4o-mini',
            max_tokens: 5,
            temperature: 0.5
        })

        const response = chatCompletion.choices[0].message.content?.trim() as string;

        return response;
    } catch (error) {
        console.error('Error in OpenAI completion:', error);
        return '';
    }
}

async function makeAnswerRequest(answer: string) {
    const formData = new FormData();

    formData.append('username', 'tester');
    formData.append('password', '574e112a');
    formData.append('answer', answer);

    return await fetch('https://xyz.ag3nts.org/', {
        method: 'POST',
        body: formData,
        redirect: 'follow'
    });
}

async function main() {
    const pageText = await getPageText('https://xyz.ag3nts.org/')
    const question = getQuestion(pageText);
    const answer = await getAnswer(question);

    try {
        const response = await makeAnswerRequest(answer);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const responseText = await response.text();

        console.log('mcr', responseText);
    } catch(error) {
        console.error('error in making POST request:',  error);

    }

    console.log('mcr answer:', answer);
}

await main();

