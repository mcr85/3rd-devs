import { chunk, fromPairs } from 'lodash';
import { exists } from 'fs/promises';
import FirecrawlApp, { type ScrapeResponse } from '@mendable/firecrawl-js';
import { join } from 'path';
import { writeFile } from 'fs/promises';
import { readFile } from 'fs/promises';
import { OpenAIService } from '../mcr_lib/OpenAIService';
import type { ChatCompletionContentPartImage, ChatCompletionContentPartText, ChatCompletionMessageParam, ChatCompletionSystemMessageParam } from 'ai/prompts';

interface AudioMetadata {
    buffer: Buffer;
    caption: string;
    description: string;
    fileName: string;
    url: string;
    wholeLine: string;
}

interface ImageMetadata {
    base64: string;
    caption: string;
    description: string;
    name: string;
    wholeLine: string;
}

const apiKey = process.env.CENTRALA;

// TODO: make a function which returns imageContextPrompt with transcription
const recordingTranscription = `No i co teraz? No to teraz mnie już nie powstrzymacie jesteśmy tutaj sami i trzeba tylko wykonać plan jak ja się do tego w ogóle zmieszczę w sumie dobrze zaplanowałem poproszerzenie Adam miał rację jedna informacja poniesie nam w czasie jedna informacja dwa lata wcześniej posunie całe badania do przodu i wtedy już będzie z górki czekaj na odwagę z truskawką, mowa nie wychło ale z ludźmi, no to znaczy jedna myfa, mowa tewnie wywoła ale Adam mówi, że to jest stabilne, że to się wszystko uda trzeba tylko cofnąć je w czasie jeden, jedyny raz, do Grudziądza znaleźć hotel, ile mogą być hoteli w Grudziądzu, ja nie wiem, ale na pewno znajdę jeden i potem czekać spokojnie, czekać dwa lata tyle jestem w stanie zrobić wciąż to mam zapisane na kartce no to co? no to siup wpisujemy czekaj niech prze... koordynaty są grudziąc dobra Batman nie wchodzi a jest w menu człowiek jeszcze grzik a, wezmę ze sobą trochę Jestem gotowy. Jeszcze jedno na odwagę. Tak na cześć odbędnie przednie. Dobra. Naciskamy. Czekamy. To licz szybciej, ile można czekać. Jestem gotowy. No to biorę.`;

const imageContextPrompt = `Return description of given image.
Use provided caption as context to describe the image.
Use audio recording transcription <audio_report_transcription> as additional context which may help to describe the image.
Try to find any links between words in caption and <report_transcription>. They may help you to describe the image.

<think>
Try to find answers to below questions:
- who took the image?
- where was he at the time of taking the image?
- what image shows?
- where it was taken?
- what connection does it have to provided caption or content?

Aid yourself with <audio_report_transcription>
</think>

<audio_report_transcription>
${recordingTranscription}
</audio_report_transcription>`;

async function getPageText(url: string): Promise<string> {
    const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
    const scrapeResult = await firecrawl.scrapeUrl(url, { formats: ['markdown', 'links'] }) as ScrapeResponse;
    return scrapeResult.markdown as string;
}


async function getMarkdown(): Promise<string> {
    const markdownPath = join(__dirname, 'markdown.md');
    let markdown: string;

    const markdownFileExists = await exists(markdownPath);

    if (!markdownFileExists) {
        markdown = await getPageText('https://centrala.ag3nts.org/dane/arxiv-draft.html')
        writeFile(markdownPath, markdown, 'utf-8');
    } else {
        markdown = await readFile(markdownPath, 'utf-8');
    }

    return markdown;
}

// const markdown = readFileSync(join(__dirname, 'S02E05', 'markdown.md'), 'utf8');

async function extractMp3s(article: string, baseUrl = ''): Promise<AudioMetadata[]> {
    const mp3Regex = /[^!]\[(.+)\]\((.+)\)/g;
    const matches = [...article.matchAll(mp3Regex)];

    return Promise.all(matches.map(async ([wholeLine, caption, url]) => {
        const fileName = url.split('/').pop() || '';
        const fullUrl = baseUrl + url;
        const response = await fetch(fullUrl);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        return {
            buffer,
            caption,
            description: '',
            fileName,
            url: fullUrl,
            wholeLine
        } as AudioMetadata;
    }));
}

async function extractImages(article: string, baseUrl = ''): Promise<ImageMetadata[]> {
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)(.*)/g;
    const matches = [...article.matchAll(imageRegex)];

    const imagePromises = matches.map(async ([wholeLine, alt, url, caption]) => {
        try {
            const name = url.split('/').pop() || '';
            const fullUrl = baseUrl + url;
            // console.log(fullUrl)
            const response = await fetch(fullUrl);
            if (!response.ok) throw new Error(`Failed to fetch ${fullUrl}: ${response.statusText}`);
            const arrayBuffer = await response.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString('base64');

            return {
                base64,
                caption,
                description: '',
                name,
                wholeLine
            };
        } catch (error) {
            console.error(`Error processing image ${url}:`, error);
            return null;
        }
    });

    const results = await Promise.all(imagePromises);
    return results.filter((link) => link !== null);
}

async function getImageDescriptions(openAIService: OpenAIService, images: ImageMetadata[]): Promise<ImageMetadata[]> {
    return Promise.all(images.map(async (image) => {
        const messages: ChatCompletionMessageParam[] = [
            {
                role: 'system',
                content: imageContextPrompt
            },
            {
                role: 'user',
                content: [
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:image/png;base64,${image.base64}`,
                            detail: "high"
                        }
                    } as ChatCompletionContentPartImage,
                    {
                        type: "text",
                        text: `Image caption: ${image.caption}`
                    } as ChatCompletionContentPartText
                ]
            }
        ]

        const response = await openAIService.send('describe', messages, {
            model: 'gpt-4o',
            temperature: 1.0
        });

        return {
            ...image,
            description: response
        }
    }));
}

async function getImagesWithDescriptions(openAIService: OpenAIService, markdown: string) {
    const describedImagesFilePath = join(__dirname, 'images.json');
    const fileExists = await exists(describedImagesFilePath);

    if (!fileExists) {
        let images = await extractImages(markdown, 'https://centrala.ag3nts.org/dane/');
        images = await getImageDescriptions(openAIService, images);

        if (images.length === 0) {
            return [];
        }

        const describedImages = images.map(({ wholeLine, caption, description }) => {
            return {
                wholeLine,
                caption,
                description
            };
        })


        writeFile(describedImagesFilePath, JSON.stringify(describedImages), 'utf-8');

        return describedImages;
    } else {
        return JSON.parse(await readFile(describedImagesFilePath, 'utf-8'));
    }
}

async function getTranscriptions(openAIService: OpenAIService, mp3s: AudioMetadata[]): Promise<AudioMetadata[]> {
    return Promise.all(mp3s.map(async (mp3) => {
        const transcription = await openAIService.transcribe(mp3.buffer, mp3.caption);

        return {
            ...mp3,
            description: transcription
        };
    }));
}

async function getMp3sWithTranscriptions(openAIService: OpenAIService, markdown: string): Promise<{ wholeLine: string; caption: string; description: string; }[]> {
    const transcriptionsFilePath = join(__dirname, 'transcriptions.json');
    const fileExists = await exists(transcriptionsFilePath);

    if (!fileExists) {
        let mp3s = await extractMp3s(markdown, 'https://centrala.ag3nts.org/dane/');
        mp3s = await getTranscriptions(openAIService, mp3s);

        if (mp3s.length === 0) {
            return [];
        }

        const transcriptions = mp3s.map(({ wholeLine, caption, description }) => {
            return {
                wholeLine,
                caption,
                description
            };
        })


        writeFile(transcriptionsFilePath, JSON.stringify(transcriptions), 'utf-8');

        return transcriptions;
    } else {
        return JSON.parse(await readFile(transcriptionsFilePath, 'utf-8'));
    }
}

function addContextToDocument(markdown: string, transcriptions: { wholeLine: string; caption: string; description: string; }[], tag: string) {
    transcriptions.forEach((transcription) => {
        // console.log('mcr wholeLine', transcription.wholeLine);
        markdown = markdown.replace(transcription.wholeLine, `<${tag}>
${transcription.wholeLine}

caption:${transcription.caption}
description:${transcription.description}
</${tag}>`);
    })

    return markdown;
};

async function getQuestions() {
    const url = `https://centrala.ag3nts.org/data/${apiKey}/arxiv.txt`;
    const response = await fetch(url);
    return await response.text()
}

async function asnwerQuestions(openAIService: OpenAIService, questions: string, markdown: string) {
    const messages: ChatCompletionMessageParam[] = [
        {
            role: 'system',
            content: `Read the article and answer the following questions.
Use <image> and <audio> data embedded in article to provide additional context to your answers.
<article>
${markdown}
</article>

Additionally use this recording transcription as context about people and whereabouts of experiment described in the article:
<audio_transcription>
${recordingTranscription}
</audio_transcription>

<think>
Do not rush with answers. Take your time to answer each question. Pay special attention to image file descriptions and provided audio recording transcription.
</think>

Do not add empty new lines in response.
`
        }
    ];

    return openAIService.send(questions, messages, {
        model: 'gpt-4o',
        temperature: 1.0
    });
}

async function sendAnswers(payload: unknown): Promise<Response> {
    const body = {
        task: 'arxiv',
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
    const markdown = await getMarkdown();
    const transcriptions = await getMp3sWithTranscriptions(openAIService, markdown);
    let augmentedMarkdown = addContextToDocument(markdown, transcriptions, 'audio');
    const describedImages = await getImagesWithDescriptions(openAIService, augmentedMarkdown)
    augmentedMarkdown = addContextToDocument(augmentedMarkdown, describedImages, 'image');
    writeFile(join(__dirname, 'augmented.md'), augmentedMarkdown, 'utf-8');

    const questions = await getQuestions();
    const answers = await asnwerQuestions(openAIService, questions, augmentedMarkdown);

    answers.split('=')

    let answersArr = answers.split('\n').map(e => e.split('=')).flat()
    const payload = fromPairs(chunk(answersArr, 2))

    const centralaResponse = await sendAnswers(payload);
    const centralaResponseJson = await centralaResponse.json(); 

    console.log(questions);
    console.log(answers);
    console.log('mcr answer:', centralaResponseJson);
}

main();
