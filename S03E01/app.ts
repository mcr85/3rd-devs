import * as fs from 'fs/promises';
import * as path from 'path';
import { OpenAIService } from '../mcr_lib/OpenAIService';

interface FileMetadata {
    fileName: string;
    date: string;
    reportName: string;
    sector: string;
}

const apiKey = process.env.CENTRALA;
const openAIService = new OpenAIService();
const dataPath = path.join(__dirname, '../', 'dane');

async function makeFacts() {
    const files = await fs.readdir(dataPath);
    
    let concatenatedContent = '';

    files.forEach(async (file) => {
        if (path.extname(file) === '.txt') {
            const filePath = path.join(dataPath, 'facts', file);
            const fileContent = await fs.readFile(filePath, 'utf8');
            if (!fileContent.includes('entry deleted')) {
                concatenatedContent += fileContent + '\n';
            }
        }
    });

    fs.writeFile(path.join(__dirname, 'facts.txt'), concatenatedContent);

    return concatenatedContent;
}

function getMetadataFromFileName(fileName: string): FileMetadata {
    const [date, reportName, sector] = fileName.split('_');
    const reportNumber = reportName.match(/\d\d/)

    return {
        fileName,
        date,
        reportName: 'Raport ' + reportNumber,
        sector: 'Sektor ' + sector
    }
}

async function getKeywords(fileContent: string, facts: string) {
    const systemPrompt = `Extract keywords from provided patrol report.
Every report starts with time. Be sure to extract it as separate keyword.
Focus on the most important information like:
- if there was any activity
- location
- what was detected
    - keywords regarding detected object or person
- sensors are used
- last step done

Consider below context when extracting keywords:
<context>
${facts}
</context>

If report mentions a person was detected add keywords regarding that person.
Use provided context to extract more information.
Focus on these things:
- person profession
- traits and skills
- known programming languages

Return comma separated list of keywords in single string.`;

    const response = await openAIService.send(
        fileContent,
        [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: fileContent }
        ],
        { model: 'gpt-4o', temperature: 0.5 }
    );

    return response;
}

async function getReportsWithMetadata(facts: string) {
    const files = await fs.readdir(dataPath)

    return Promise.all(files
        .filter((file) => path.extname(file) === '.txt')
        .map(async (file) => {
            const metadata = getMetadataFromFileName(file)
            const fileContent = await fs.readFile(path.join(dataPath, file), 'utf8');
            const keywords = await getKeywords(fileContent, facts);

            return {
                fileContent,
                keywords,
                ...metadata
            }
        }));
}

async function sendAnswer(payload: unknown): Promise<Response> {
    const body = {
        task: 'dokumenty',
        apikey: apiKey,
        answer: payload
    };

    return fetch('https://centrala.ag3nts.org/report', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
    });
}

async function main() {
    let facts: string;
    const factsExist = await fs.exists(path.join(__dirname, 'facts.txt'))

    if (!factsExist) {
        facts = await makeFacts();
    } else {
        facts = await fs.readFile(path.join(__dirname, 'facts.txt'), 'utf8');
    }

    const reports = await getReportsWithMetadata(facts);

    const payload: Record<string, string> = {}

    reports.forEach((report) => {
        const { fileName, reportName, sector, date, keywords } = report;
        payload[fileName] = `${reportName}, ${sector}, ${date}, ${keywords}`;
    });

    const centralaResponse = await sendAnswer(payload);
    const centralaResponseJson = await centralaResponse.json(); 

    console.log('mcr answer:', centralaResponseJson);
}

main();