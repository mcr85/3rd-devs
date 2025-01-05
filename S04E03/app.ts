import chalk from 'chalk';
import FirecrawlApp, { type ScrapeResponse } from '@mendable/firecrawl-js';
import { OpenAIService } from '../mcr_lib/OpenAIService';
import { VectorService } from '../mcr_lib/VectorService';

const apiKey = process.env.CENTRALA;
const fireCrawlApiKey = process.env.FIRECRAWL_API_KEY;

const COLLECTION_NAME = 'pages';

interface Link {
    url: string;
    linkText?: string;
    title?: string
}

interface Page {
    url: string;
    title?: string;
    description?: string;
    text?: string;
    links: Link[];
}

const mainPageUrl = 'https://softo.ag3nts.org/';
const questionsUrl = `https://centrala.ag3nts.org/data/${apiKey}/softo.json`

async function getPage(url: string): Promise<Page> {
    console.log(chalk.green('🔍 Scraping page url:'), url);
    const firecrawl = new FirecrawlApp({ apiKey: fireCrawlApiKey });
    const result = await firecrawl.scrapeUrl(url, {
        formats: ['markdown', 'links'],
        onlyMainContent: false
    }) as ScrapeResponse;

    // const url = result.metadata?.url;
    const title = result.metadata?.title;
    const description = result.metadata?.description;
    const text = result.markdown;
    const links = extractLinks(result.markdown);

    return {
        url,
        title,
        description,
        text,
        links
    } as Page;
}

async function addPageToDatabase(vectorService: VectorService, page: Page) {
    const metadata = { ...page };
    delete metadata.text;

    return vectorService.addPoints(COLLECTION_NAME, [{
        text: page.text ?? '',
        metadata
    }]);
}

function extractLinks(text: string) {
    const baseUrl = 'https://softo.ag3nts.org';
    const links = [];

    const re = /\[(.*?)\]\((.*?)\s?(?:"(.*?)")?\)/gm
    let match;

    while ((match = re.exec(text))) {
        const [_, linkText, url, title] = match;
        const hasHost = url.startsWith(baseUrl);
        const link = {
            url: hasHost ? url : baseUrl + url,
            linkText,
            title
        }

        links.push(link);

        // console.log(chalk.blueBright(`🔗 Got link ${link.url}`));
    }

    return links;
}
async function getQuestions() {
    console.log(chalk.green('Fetching questions...'));

    let questions: Record<string, string>;

    try {
        const questionsResponse = await fetch(questionsUrl);
        questions = await questionsResponse.json() as Record<string, string>;
    } catch (error) {
        console.error('Error fetching questions:', error);
        questions = {};
    }

    console.log(chalk.cyanBright('questions:'), questions);

    return questions;
}

async function getAnswer(openAIService: OpenAIService, question: string, content?: string) {
    const answerQuestionPrompt = `Read below article and answer user question in following user message.
If you can't find answer to user question in the article return "false".

<article>
${content}
</article>

Return answer in following json format:
{ "answer": answer to user question }`;

    return openAIService.send(
        question,
        [
            {
                role: 'system',
                content: answerQuestionPrompt
            }
        ],
        {
            model: 'gpt-4o',
            temperature: 1.0,
            jsonMode: true
        }
    )
        .then((response) => {
            const answerData = JSON.parse(response);
            console.log(chalk.greenBright('🎉 Got answer to question:'), answerData.answer);
            return answerData;
        });
}

async function pickMostProbableLink(openAIService: OpenAIService, links: Link[], question: string) {
    const prompt = `You are about to be asked a question by the user. Pick most probable page link to follow to get an answer to asked question. Pick one from provided links:
<json>
${JSON.stringify(links, null, 2)}
</json>

<thinking>
Consider link url and linkText and title which are in Polish language.
</thinking>

Return most probable link in the same json format as provided above json:
{
"url": url,
"linkText": linkText
"title": title
}`;

    return openAIService.send(
        question,
        [
            {
                role: 'system',
                content: prompt
            }
        ],
        {
            model: 'gpt-4o',
            temperature: 0.5,
            jsonMode: true
        }
    )
        .then((response) => {
            console.log(chalk.yellow('Most probable link:\n'), response);
            return JSON.parse(response);
        });
}

async function sendAnswers(payload: unknown): Promise<Response> {
    const body = {
        task: 'softo',
        apikey: apiKey,
        answer: payload
    };

    console.log('mcr payload', payload);

    return fetch('https://centrala.ag3nts.org/report', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
    });
}

async function main() {
    const openAIService = new OpenAIService();
    const vectorService = new VectorService(openAIService);
    await vectorService.ensureCollection(COLLECTION_NAME);

    const questions = await getQuestions();
    const answers: Record<string, string> = {};
    // const question = questions['03'];

    let link = mainPageUrl;

    const pagesChecked = new Set();

    // go through all the questions
    for (const questionNr of Object.keys(questions)) {
        const question = questions[questionNr];
        let answer;

        while (!answer) {
            const searchResults = await vectorService.performSearch(COLLECTION_NAME, question, {}, 1);
            let page;
    
            if (searchResults!.length > 0 && searchResults[0].score > 0.5) {
                page = searchResults[0].payload;
                console.log('Got page for question from database, url:', page.url);
            }
            else {
                console.log('No page for question in database or low score.');
                page = await getPage(link);
                await addPageToDatabase(vectorService, page);
            }

            if (!page) {
                throw new Error('No page found for question in database or on the web. Url: ' + link);
            }
    
            const answerResponse = await getAnswer(openAIService, question, page.text);
    
            if (!answerResponse.answer || answerResponse.answer === 'false') {
                pagesChecked.add(page.url);
                console.log('No answer found in page content. Searching for most probable link...');
                const links = page.links.filter((link) => !pagesChecked.has(link.url));
                const mostProbableLink = await pickMostProbableLink(openAIService, links, question);
                link = mostProbableLink.url;
                page = await getPage(link);
                await addPageToDatabase(vectorService, page);
            } else {
                answer = answerResponse.answer;
                answers[questionNr] = answer;
            }
        }
    }

    console.log('Answers:', answers);

    const centralaResponse = await sendAnswers(answers);
    const centralaResponseJson = await centralaResponse.json(); 

    console.log('Centrala response:', centralaResponseJson);
}

main();
