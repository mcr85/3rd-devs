import * as fs from 'fs';
import * as path from 'path';
import { OpenAIService } from '../mcr_lib/OpenAIService';
import type { ChatCompletionMessageParam } from 'ai/prompts';

// TODO: automate transcribing audio files
// check how to run whisper locally (link: https://medium.com/@vndee.huynh/build-your-own-voice-assistant-and-run-it-locally-whisper-ollama-bark-c80e6f815cba)

const apiKey = process.env.CENTRALA;

const prompt = `Jesteś systemem wyszukującym dokładny adres uczelni, na której pracuje Profesor Andrzej Maj. Twoim zadaniem jest przetwarzanie informacji od ludzi, którzy znają Profesora Maja i dzielą się szczegółami, które mogą być przydatne w ustaleniu adresu uczelni. Przeanalizuj przekazane wypowiedzi, aby określić:

Miasto, w którym znajduje się uczelnia lub instytut zatrudniający Profesora Andrzeja Maja.
Ulicę, przy której zlokalizowany jest ten obiekt.

Wytyczne:
- Skup się na wyłapywaniu nazw miast, ulic oraz nazw uczelni lub instytutów.
- Jeśli w treści wypowiedzi pojawią się nazwy związane z uczelniami (np. "Uniwersytet", "Instytut", "Akademia"), to określ ich lokalizację oraz przybliżony adres.
Jeśli znajdziesz kilka możliwości, porównaj je i podaj najbardziej prawdopodobną.

Przykład:
Osoba mówi: "Widziałem Andrzeja Maja, mówił, że pracuje w Poznaniu, chyba na jakiejś uczelni przy ulicy Mickiewicza."
Twoim zadaniem jest rozpoznanie nazwy miasta (Poznań) i ulicy (Mickiewicza), aby wywnioskować, że to adres uczelni, na której pracuje Profesor Maj.

Cel: Na podstawie przeanalizowanych wypowiedzi zwróć nazwę ulicy oraz miasta, gdzie znajduje się instytucja zatrudniająca Profesora Andrzeja Maja.`;

const question = `Na jakiej ulicy znajduje się uczelnia na której pracuje Profesor Andrzej Maj? Zwróć jedynie nazwę ulicy bez dodatkowych znaków interpunkcyjnych.`;

function getTranscribes(): string[] {
    const transcribesDir = path.join(__dirname, 'transcribes');
    const txtFiles = fs.readdirSync(transcribesDir).filter(file => path.extname(file) === '.txt');
    const transcribes = txtFiles.map(file => {
        return fs.readFileSync(path.join(transcribesDir, file), 'utf-8')
    });

    return transcribes;
}

async function sendReport(data: string): Promise<Response> {
    const url = `https://centrala.ag3nts.org/report`;

    const body = {
        task: 'mp3',
        apikey: apiKey,
        answer: data
    };

    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
    });
}

async function main() {
    const transcribes = getTranscribes();
    const transcribeUserMessages = transcribes.map(transcribe => ({ role: 'user', content: transcribe }));

    const openaiService = new OpenAIService();
    const context = [
        { role: 'system', content: prompt },
        ...transcribeUserMessages
    ] as ChatCompletionMessageParam[];
    const answer = await openaiService.send(question, context, { model: 'gpt-4o', max_tokens: 2048 });

    const centralaResponse = await sendReport(answer);
    const centralaResponseJson = await centralaResponse.json(); 

    console.log('mcr answer:', centralaResponseJson);
}

main();