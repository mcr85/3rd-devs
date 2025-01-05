/**
 *  1. Zapamiętuj w dowolnej formie linki już odwiedzone, aby uniknąć zapętlenia mechanizmu
    2. Na stronie mogą pojawić się 2-3 linki, które potencjalnie wyglądają, jakby mogły zawierać wartościowe dane. Nie wchodź w każdy z nich, a jedynie w ten najbardziej prawdopodobny.
    3. Możesz (ale nie musisz!) sporządzić mapę odwiedzonych stron i ich zawartości. Szukając odpowiedzi na pytanie nr 01, prawdopodobnie odwiedzisz kilka stron. Czy szukając odpowiedzi na pytanie 02 i 03 naprawdę musisz odwiedzać je ponownie i znów wysyłać ich treść do LLM-a?
 */
import chalk from 'chalk';
import { readFile, writeFile } from 'fs/promises';
import FirecrawlApp, { type ScrapeResponse } from '@mendable/firecrawl-js';
import { OpenAIService } from '../mcr_lib/OpenAIService';
import { VectorService } from '../mcr_lib/VectorService';
import { write } from 'console';
import path from 'path';

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

// const pagesFile: { pages: Page[] } = await import('./pages.json');

const mainPageUrl = 'https://softo.ag3nts.org/';
const contactPageUrl = 'https://softo.ag3nts.org/kontakt';
const portfolioBanan = 'https://softo.ag3nts.org/portfolio_1_c4ca4238a0b923820dcc509a6f75849b';
const questionsUrl = `https://centrala.ag3nts.org/data/${apiKey}/softo.json`

// TODO: get main section links
// discovered links won't have descriptions/summary yet. You can always updated data about them later

async function getPage(url: string): Promise<Page> {
    // const pagesFile: { pages: Page[] } = await import('./pages.json');
    // const page = pagesFile.pages.find((page) => page.url === url);

    // if (page) {
    //     console.log(chalk.yellow('📚 Got page from cache', page));
    //     return page;
    // }

    console.log(chalk.green('🔍 Scraping page...'));
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

    // TODO: add summary?

    // TODO: add embedding

    // pagesFile.pages.push({
    //     url,
    //     title,
    //     description,
    //     content,
    //     links
    // });

    // TODO: write to qdrant instead
    // await writeFile(path.join(__dirname, 'pages.json'), JSON.stringify(pagesFile, null, 2));

    return {
        url,
        title,
        description,
        text,
        links
    } as Page;
}

function extractLinks(text: string) {
    const baseUrl = 'https://softo.ag3nts.org';
    const links = [];

    // const re = /\[(.+)\]\((\/\w+)\s"(.+)"/g
    const re = /\[(.*?)\]\((.*?)\s?(?:"(.*?)")?\)/gm
    let match;

    while ((match = re.exec(text))) {
        const [_, linkText, url, title] = match;
        const link = {
            url: baseUrl + url,
            linkText,
            title
        }

        links.push(link);

        console.log(chalk.blueBright('🔗 Got link', link))
    }

    return links;
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
    );


    // TODO: add openai chat completion for above prompt

    // ask OpenAI for to extract keywords of what is being asked, like email address, company name, etc.
    // first try to search by keywords in database (vector db?)
    // if can't find it in database, then search on the web

    // 1. get most probable page
    // plan: get page where you can find the answer and find it

    // extract links with firecrawl: url, title, keywords, description
    // const page = await getPage(mainPageUrl);
    // const page = await getPage(contactPageUrl);
    // const page = await getPage(portfolioBanan);

    // console.log('page:', page);

        // .then((result) => {
        //     const url = result.metadata?.url;
        //     const title = result.metadata?.title;
        //     const description = result.metadata?.description;
        //     const content = result.markdown;
        //     const links = extractLinks(result.markdown);
        //     console.log('result:', result);
        //     console.log('result markdown', result.markdown);
        //     console.log('result links', links);

        //     return {
        //         url,
        //         title,
        //         description,
        //         content,
        //         links
        //     } as Page;

        //     // links:
        //     // url,
        //     // title,
        //     // description,
        // });
}

async function pickMostProbableLink(openAIService: OpenAIService, links: Link[], question: string) {
    const prompt = `You are about to be asked a question by the user. Pick most probable page link to follow to get an answer to asked question. Use links from json containing links.
<thinking>
Consider link url and linkText and title which are in Polish language.
</thinking>

<json>
${links}
</json>

Return most probable link in json format:
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
            temperature: 1.0,
            jsonMode: true
        }
    );
}


// loop through questions
// determine page to get from database

// check in qdrant if you can find a page for given question

// if no candidate, determine page to get from web
// check if answer is in page content

async function main() {
    const openAIService = new OpenAIService();
    const vectorService = new VectorService(openAIService);

    await vectorService.ensureCollection(COLLECTION_NAME);

    const questions = await getQuestions();
    const question = questions['01'];
    let link = mainPageUrl;
    let answer;

    const pagesChecked = new Set();

    // TODO: potential answer
    while (!answer) {
        const searchResults = await vectorService.performSearch(COLLECTION_NAME, question, {}, 1);
        let page;

        console.log('Got page from database, search results:', searchResults);

        // GET page either from database or from web
        if (searchResults!.length === 0) {
            console.log('no page for question in database');

            // while (!answer) {
                // getting page
                page = await getPage(link);

                // adding it to db
                const metadata = { ...page };
                delete metadata.text;

                vectorService.addPoints(COLLECTION_NAME, [{
                    text: page.text ?? '',
                    metadata
                }]);

                // page = {
                //     text: page.text,
                //     ...metadata
                // } as Page;

            // }

        } else {
            console.log('got page for question from database');
            page = searchResults[0].payload;
        }

        // GET answer from page
        console.log('page links', page.links);
        const answerResponse = await getAnswer(openAIService, question, page.text);

        if (!answerResponse.answer) {
            // TODO: no answer, set new link to go through and advance loop
            pagesChecked.add(page.url);
            console.log('No answer found in page content. Searching for most probable link...');
            const links = page.links.filter((link) => !pagesChecked.has(link.url));
            const mostProbableLink = await pickMostProbableLink(openAIService, links, question);
            console.log('most probable link:', mostProbableLink);
            link = mostProbableLink.url;
        } else {
            // TODO: got answer, break the loop
            console.log(chalk.greenBright('🎉 Got answer to question:', answer));
            answer = answerResponse.answer;
        }
    }

    // const answer = await getAnswer(questions['01']);
}


// console.log('mcr pagesFile', pagesFile.pages);




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


// console.log('questions:', questions);
// console.log('answers:', '01', answer);

main();
