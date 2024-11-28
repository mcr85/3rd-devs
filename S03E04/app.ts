import { OpenAIService } from '../mcr_lib/OpenAIService';

const apiKey = process.env.CENTRALA;

async function getNote() {
    const note = await fetch('https://centrala.ag3nts.org/dane/barbara.txt');
    return note.text();
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

async function getPlaces(name: string) {
    const place = await fetch('https://centrala.ag3nts.org/people', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey, query: name })
    });
    return place.json();
}

async function getPeople(place: string) {
    const names = await fetch('https://centrala.ag3nts.org/places', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey, query: place })
    });
    return names.json();
}

async function main() {
    const note = await getNote();

    const prompt = `You are an agent who needs to track down location of person named "BARBARA".
    You are going to be given a note about her whereabouts. Analyze this note and extract polish city names and polish people names.
    Save them in denominated for, e.g. save name ALEKSANDRA as ALEKSANDER, place KRAKOWA as KRAKOW, do not use polish characters.
    For people's name, save only their names, without surnames.`
    
    const openAIService = new OpenAIService();

    // const centralaResponse = await sendAnswer();
    // const centralaResponseJson = await centralaResponse.json(); 
}

main();
