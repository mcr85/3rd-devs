
import * as fs from 'fs/promises';
import path from 'path';
import { OpenAIService } from '../mcr_lib/OpenAIService';
import type { ChatCompletion, ChatCompletionTool } from 'openai/resources/chat/completions';

const apiKey = process.env.CENTRALA;

async function getNote() {
    const filePath = path.join(__dirname, 'barbara.txt');
    const fileExists = await fs.exists(filePath)

    if (fileExists) {
        return await fs.readFile(filePath, 'utf8');
    }
    else {
        const note = await fetch('https://centrala.ag3nts.org/dane/barbara.txt');
        const noteContent = await note.text();
        await fs.writeFile(filePath, noteContent, 'utf8');
        return noteContent
    }
}

async function sendAnswer(payload: unknown): Promise<Response> {
    const body = {
        task: 'loop',
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

const functions = {
    getPlaces: async (firstName: string) => {
        const place = await fetch('https://centrala.ag3nts.org/people', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ apikey: apiKey, query: firstName })
        });
        return place.json();
    },

    getPeople: async (place: string) => {
        const names = await fetch('https://centrala.ag3nts.org/places', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ apikey: apiKey, query: place })
        });
        return names.json();
    }
}

interface LocationMap {
    string: Set<string>
}

interface InitialData {
    people: string[];
    places: string[];
}

async function getAnswer(
    openAIService: OpenAIService,
    note: string,
    initialData: InitialData
) {
    const prompt = `You are an agent who needs to track down location of person named "BARBARA".
    Using provided tools get people first names (getPeople) by providing city name.
    For each person first name, store cities in which that person appeared.
    You can also get city names (getPlaces) by providing person first name to expand your search.
    You can start with provided data: ${JSON.stringify(initialData)}`;

    const messages = [
        {
            role: 'system',
            content: prompt
        },
        {
            role: 'user',
            content: note
        }
    ];

    const tools: ChatCompletionTool[] = [
        {
            type: 'function',
            function: {
                name: 'getPeople',
                description: 'Get people names for a given city',
                parameters: {
                    type: 'object',
                    properties: {
                        place: {
                            type: 'string',
                            description: 'City name'
                        }
                    },
                    required: ['place']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'getPlaces',
                description: 'Get city names for a given person first name',
                parameters: {
                    type: 'object',
                    properties: {
                        firstName: {
                            type: 'string',
                            description: 'Person first name'
                        }
                    },
                    required: ['firstName']
                }
            }
        }
    ];

    return openAIService.send(
        `Get most likely place of BARBARA.
        Use provided tools to get people names and places`,
        [
            {
                role: 'system',
                content: prompt
            },
            {
                role: 'user',
                content: `Here is some additional context about Barbara's whereabouts: ${note}`
            }
        ],
        {
            model: 'gpt-4o',
            temperature: 0.3,
            tools
        }
    )
}

async function main() {
    const note = await getNote();

    const prompt = `You are an agent who needs to track down location of person named "BARBARA".
    You are going to be given a note about her whereabouts. Analyze this note and extract polish city names and polish people names.
    Save them in denominated for, e.g. save name ALEKSANDRA as ALEKSANDER, place KRAKOWA as KRAKOW, do not use polish characters.
    For people's name, save only their names, without surnames.`

    const question = 'Get me people names and places from the note in json format without any additional formatting.';

    const openAIService = new OpenAIService();

    // ask openAI for the answer
    const initialData = await openAIService.send(
        question,
        [
            {
                role: 'system',
                content: prompt
            },
            {
                role: 'user',
                content: note
            }
        ],
        {
            model: 'gpt-4o',
            temperature: 0.3
        }
    );

    console.log('mcr initialData', initialData);

    const response = await getAnswer(openAIService, note, JSON.parse(initialData as string)) as ChatCompletion.Choice;

    if (response.finish_reason === 'tool_calls') {
        if (response.message.tool_calls) {
            const fnName = response.message.tool_calls[0].function.name as keyof typeof functions;
            const fnArgs = JSON.parse(response.message.tool_calls[0].function.arguments);
            let result;
            const fnToCall = functions[fnName];
            if (fnName === 'getPeople') {
                result = await fnToCall(fnArgs.place);
            }
            console.log('mcr result', fnName, fnArgs, result.message);
        }
    }

    console.log(response);

    // const centralaResponse = await sendAnswer();
    // const centralaResponseJson = await centralaResponse.json(); 
}

main();
