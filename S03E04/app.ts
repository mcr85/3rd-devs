
import * as fs from 'fs/promises';
import path from 'path';
import { OpenAIService } from '../mcr_lib/OpenAIService';
import type { ChatCompletion, ChatCompletionTool } from 'openai/resources/chat/completions';
import type { ChatCompletionAssistantMessageParam, ChatCompletionFunctionMessageParam, ChatCompletionMessageParam } from 'ai/prompts';

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
    [name: string]: string[];
}

interface InitialData {
    people: string[];
    places: string[];
}

async function getAnswer(
    openAIService: OpenAIService,
    note: string,
    initialData: InitialData,
    ignoredCities: string[],
    messages?: ChatCompletionMessageParam[]
) {
    const prompt = `You are an agent who needs to track down location of person named "BARBARA".
    Using provided tools get people first names (getPeople) by providing city name.
    For each person, store cities in which that person appeared.
    You can also get city names (getPlaces) for provided person first name.
    Store data in this format: { "person": ["city1", "city2"], ... }
    For BARBARA DO NOT store city if it's one of the ignored cities.

    DO NOT use tool with same arguments more than once.
    When you run out cities to check, get more with getPlaces function.
    When you run out of cities to check, get more with getPeople function.
    
    Here's some initial data to start with: ${JSON.stringify(initialData)}.
    Here are some cities where BARBARA is not now: ${ignoredCities.join(', ')}.`;

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

    const msgs: ChatCompletionMessageParam[] = [
        {
            role: 'system',
            content: prompt
        },
        {
            role: 'user',
            content: `Here is some additional context about Barbara's whereabouts: ${note}`
        },
        ...messages ?? []
    ];

    return openAIService.send(
        `Get most likely place of BARBARA.
        Use provided tools to get people names and places.
        Finish when found BARBARA location is found unless it's one of ignored locations.
        Respond when with most likely place of BARBARA. When done respond with just the city name.`,
        msgs,
        {
            model: 'gpt-4o',
            temperature: 0.3,
            tools
        }
    )
}

function sanitize(str: string): string {
    return str.replace('[**RESTRICTED DATA**]', '')
}

async function main() {
    const locationMap: LocationMap = {
    };

    const note = await getNote();

    const prompt = `You are an agent who needs to track down location of person named "BARBARA".
    You are going to be given a note about her whereabouts. Analyze this note and extract polish city names and polish people names.
    Save them in denominated for, e.g. save name ALEKSANDRA as ALEKSANDER, place KRAKOWA as KRAKOW.
    Do not use polish characters, e.g. Ł -> L, Ó -> O, Ś -> S, Ć -> C.
    For people's name, save only their names, without surnames.`

    const question = 'Get me map of people names to array of places where they have been in json format without any additional formatting.';
    const ignoredCitiesQuestion  = `Determine from note cities where BARBARA is not now. Return those cities in json format like this:
        {
            "not_in": ["CITY1", "CITY2"]
        }
        
        Do not add any additional formatting.`;

    let messagesStep1: ChatCompletionMessageParam[] = [
        {
            role: 'system',
            content: prompt
        },
        {
            role: 'user',
            content: note
        }
    ];

    const openAIService = new OpenAIService();

    /*
        {
            "BARBARA: ["KRAKOW", "WARSZAWA"]
            ...
        }
    */
    const initialData = await openAIService.send(
        question,
        messagesStep1,
        {
            model: 'gpt-4o',
            temperature: 0.5
        }
    );

    /*
        {
            "not_in": ["KRAKOW", "WARSZAWA"]
        }
    */
    const ignoredCities = await openAIService.send(
        ignoredCitiesQuestion,
        [
            ...messagesStep1,
            {
                role: 'assistant',
                content: initialData as string
            }
        ],
        {
            model: 'gpt-4o',
            temperature: 0.3
        }
    );


    console.log('mcr initialData', initialData, ignoredCities);

    let messages: ChatCompletionMessageParam[] = [];

    // TOOD: this could be moved to getAnswer and called recursively
    for (let i = 0; i < 14; i++) {
        const response = await getAnswer(
            openAIService,
            note,
            JSON.parse(initialData as string),
            JSON.parse(ignoredCities as string).not_in,
            messages
        ) as ChatCompletion.Choice;
    
        if (response.finish_reason === 'tool_calls') {
            if (response.message.tool_calls) {
                // console.log('mcr response', response.message.tool_calls);
                for (const toolCall of response.message.tool_calls) {
                    const fnName = toolCall.function.name as keyof typeof functions;
                    const fnArgs = JSON.parse(toolCall.function.arguments);
                    const fnToCall = functions[fnName];
        
                    if (fnName === 'getPeople') {
                        let fnCallResult = await fnToCall(fnArgs.place);
                        console.log('mcr result', fnName, fnArgs.place, fnCallResult.message);
    
                        let people = sanitize(fnCallResult.message).split(' ') as string [];
                        people = people.filter(p => p.length > 0);
                        const place = fnArgs.place as string;

                        if (people.length === 0) {
                            continue;
                        }
            
                        for (const person of people) {
                            if (!locationMap[person]) {
                                locationMap[person] = [place]
                            } else {
                                locationMap[person] = Array.from(new Set([...locationMap[person], place]));
                            }
                        }

                        messages.push({
                            role: 'assistant',
                            content: null,
                            function_call: {
                                name: 'getPeople',
                                arguments: toolCall.function.arguments
                            }
                        } as ChatCompletionAssistantMessageParam);

                        messages.push({
                            role: 'function',
                            name: fnName,
                            content: JSON.stringify({ result: fnCallResult.message })
                        } as ChatCompletionFunctionMessageParam);
                    }
    
                    if (fnName === 'getPlaces') {
                        let fnCallResult = await fnToCall(fnArgs.firstName);
                        console.log('mcr result', fnName, fnArgs.firstName, fnCallResult.message);
                        
                        let places = sanitize(fnCallResult.message).split(' ') as string [];
                        places = places.filter(p => p.length > 0);
                        const person = fnArgs.firstName as string;

                        if (places.length === 0) {
                            continue;
                        }
            
                        if (!locationMap[person]) {
                            locationMap[person] = places;
                        } else {
                            locationMap[person] = Array.from(new Set([...locationMap[person], ...places]));
                        }

                        messages.push({
                            role: 'assistant',
                            content: null,
                            function_call: {
                                name: 'getPlaces',
                                arguments: toolCall.function.arguments
                            }
                        } as ChatCompletionAssistantMessageParam);

                        messages.push({
                            role: 'function',
                            name: fnName,
                            content: JSON.stringify({ result: fnCallResult.message })
                        } as ChatCompletionFunctionMessageParam);
                    }
                }
    
                console.log('mcr locationMap', locationMap);
            } else {
                console.log('tool call but not tool calls');
                return;
            }
        } else {
            console.log('finished for some other reason', response.finish_reason, response, response.message);
            const centralaResponse = await sendAnswer(response.message.content);
            const centralaResponseJson = await centralaResponse.json(); 
            console.log('centrala response', centralaResponseJson);
            return;
        }
    }

}

main();
