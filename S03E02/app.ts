import * as fs from 'fs/promises';
import * as path from 'path';
import { OpenAIService } from '../mcr_lib/OpenAIService';
import { VectorService } from '../mcr_lib/VectorService';
import { content } from 'googleapis/build/src/apis/content';

const apiKey = process.env.CENTRALA;
const openAIService = new OpenAIService();
const vectorService = new VectorService(openAIService);
const dataPath = path.join(__dirname, '../', 'dane', 'do-not-share');

const COLLECTION_NAME = "aidevs";

interface WeaponReport {
    id?: string | undefined;
    text: string;
    metadata?: Record<string, string> | undefined;
    // metadata?: {
    //     date: string;
    //     weaponHeading: string;
    //     content: string;
    // }
}

async function makeReports(): Promise<WeaponReport[]> {
    const files = await fs.readdir(dataPath);

    let data: WeaponReport[] = [];

    await Promise.all(files.map(async (file) => {
        if (path.extname(file) === '.txt') {
            const filePath = path.join(dataPath, file);
            const fileContent = await fs.readFile(filePath, 'utf8');
            const weaponHeading = await fileContent.split('\n')[0];

            data.push({
                text: fileContent,
                metadata: {
                    date: file.split('.txt')[0].replace(/_/g, '-'),
                    weaponHeading,
                }
            } as WeaponReport);
        }
    }));

    // console.log(data)

    fs.writeFile(path.join(__dirname, 'weapons.json'), JSON.stringify(data));

    return data;
}

// async function initializeData(data: { id?: string | undefined; text: string; metadata: Record<string, string>; }[]) {
async function initializeData(data: WeaponReport[]) {
    await vectorService.initializeCollectionWithData(COLLECTION_NAME, data);
}

async function sendAnswer(payload: unknown): Promise<Response> {
    const body = {
        task: 'wektory',
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
    let weaponReports: WeaponReport[];
    const weaponsFileExist = await fs.exists(path.join(__dirname, 'weapons.json'));

    if (!weaponsFileExist) {
        weaponReports = await makeReports();
    } else {
        const weaponsFile = await fs.readFile(path.join(__dirname, 'weapons.json'));
        weaponReports = JSON.parse(weaponsFile.toString());
    }

    // embeddings
    try {
        initializeData(weaponReports);
    } catch (error) {
        console.error(error);
    }

    const query = "W raporcie, z którego dnia znajduje się wzmianka o kradzieży prototypu broni?";

    // const filter = authors.length > 0 ? {
    //   should: authors.map(author => ({
    //     key: "author",
    //     match: {
    //       value: author
    //     }
    //   }))
    // } : undefined;

    const searchResults = await vectorService.performSearch(COLLECTION_NAME, query, {}, 1);

    const centralaResponse = await sendAnswer(searchResults[0].payload!.date);
    const centralaResponseJson = await centralaResponse.json(); 

    console.log('mcr', centralaResponseJson)
}

main();
