/**
 *  1. Zapamiętuj w dowolnej formie linki już odwiedzone, aby uniknąć zapętlenia mechanizmu
    2. Na stronie mogą pojawić się 2-3 linki, które potencjalnie wyglądają, jakby mogły zawierać wartościowe dane. Nie wchodź w każdy z nich, a jedynie w ten najbardziej prawdopodobny.
    3. Możesz (ale nie musisz!) sporządzić mapę odwiedzonych stron i ich zawartości. Szukając odpowiedzi na pytanie nr 01, prawdopodobnie odwiedzisz kilka stron. Czy szukając odpowiedzi na pytanie 02 i 03 naprawdę musisz odwiedzać je ponownie i znów wysyłać ich treść do LLM-a?
 */
import chalk from "chalk";
import FirecrawlApp, { type ScrapeResponse } from '@mendable/firecrawl-js';

const apiKey = process.env.CENTRALA;
const fireCrawlApiKey = process.env.FIRECRAWL_API_KEY;

const mainPageUrl = 'https://softo.ag3nts.org/';
const questionsUrl = `https://centrala.ag3nts.org/data/${apiKey}/softo.json`

// TODO: get main section links
// discovered links won't have descriptions/summary yet. You can always updated data about them later

async function getPageText(url: string) {
    const firecrawl = new FirecrawlApp({ apiKey: fireCrawlApiKey });
    const result = await firecrawl.scrapeUrl(url, {
        formats: ['markdown', 'links'],
        onlyMainContent: false
    }) as ScrapeResponse;
    
    return result;
}

async function getQuestions() {
    console.log(chalk.green(' Fetching questions...'));
    let questions: Record<string, string>;

    try {
        const questionsResponse = await fetch(questionsUrl);
        questions = await questionsResponse.json() as Record<string, string>;
    } catch (error) {
        console.error('Error fetching questions:', error);
        questions = {};
    }

    return questions;
}

async function getAnswer(question: string) {
    // ask OpenAI for to extract keywords of what is being asked, like email address, company name, etc.
    // first try to search by keywords in database (vector db?)
    // if can't find it in database, then search on the web

    // extract links with firecrawl: url, title, keywords, description
    getPageText(mainPageUrl).then((result) => {
        console.log('result:', result);

        // url,
        // title,
        // description,
        // content: markdown
    });
}

const questions = await getQuestions();

const answer = await getAnswer(questions['01']);


/**
You're a robot which gets some questions
You need to search for answers on SoftoAI website
Your entry point is `pageMainUrl`. Scrape it for content and links. Store content and page metadata in visitedPages array in this format:
{
    url: pageUrl,
    content: pageContent,
    summary: pageSummary
    links: array of pageLinks, where pageLink: { url: linkUrl, keywords: string[], title: string, description: string }
}

Store data about page

Try to find answer in page content. If you can't find it, follow the most probable link and repeat the process.

*/


// question 01: "Podaj adres mailowy do firmy SoftoAI"
// 


console.log('questions:', questions);
console.log('answers:', '01', answer);