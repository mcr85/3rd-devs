import chalk from 'chalk';
import { Jimp } from 'jimp';
import * as fs from 'fs/promises';
import path from 'path';
import { OpenAIService } from '../mcr_lib/OpenAIService';
import type { ChatCompletionMessageParam } from 'ai/prompts';

const apiKey = process.env.CENTRALA;
const filesPath = path.join(__dirname, 'files');
const textFilesPath = path.join(filesPath, 'text');

function getQuestions(): Promise<Response> {
    const url = `https://centrala.ag3nts.org/data/${apiKey}/notes.json`;
    return fetch(url);
}

async function prepareImageForOCR(fileName: string): Jimp {
    const filePath = path.join(__dirname, 'files', fileName);
    console.log(chalk.greenBright('Preparing file for OCR:'), fileName);
    const image = await Jimp.read(filePath);

    image.greyscale();
    image.contrast(0.3);

    const savePath = path.join(__dirname, 'files', 'processed', fileName);

    await image.write(savePath);
}

async function combineTextFiles(): Promise<void> {
    try {
        const textFiles = await fs.readdir(textFilesPath);
        let combinedText = '';

        for (const file of textFiles.sort()) {
            if (file.endsWith('.txt')) {
                const filePath = path.join(textFilesPath, file);
                const fileContent = await fs.readFile(filePath, 'utf-8');
                combinedText += fileContent + '\n\n\n'; // Separate by double empty lines
            }
        }

        const combinedFilePath = path.join(filesPath, 'combined.txt');
        await fs.writeFile(combinedFilePath, combinedText);
        console.log(chalk.greenBright(`Combined text files into: ${combinedFilePath}`));
    } catch (error) {
        console.error(chalk.red('Error combining text files:'), error);
    }
}

async function doOCR(openAIService: OpenAIService, fileName: string): Promise<string> {
    const filePath = path.join(__dirname, 'files', 'processed', fileName);
    const imageFile = await fs.readFile(filePath);

    const message = {
        role: 'user',
        content: [
            {
                type: 'image_url',
                image_url: {
                    url: `data:image/jpg;base64,${imageFile.toString('base64')}`,
                    detail: 'high'
                }
            }
        ]
    } as ChatCompletionMessageParam;

    console.log(chalk.greenBright('OCR dla pliku:'), filePath);

    return openAIService.send(
        'Przekonwertuj obraz pisma odręcznego po polsku na tekst. Zwróć jedynie przekonwertowany tekst.',
        [message],
        {
            model: 'gpt-4o',
            temperature: 0.3
        }
    ) as Promise<string>;
}

async function getAnswer(openAIService: OpenAIService, question: string, content?: string) {
    const answerQuestionPrompt = `Używając poniższego kontekstu odpowiedz na pytania przychodządze w następnych wiadomościach Użytkownika.

<context>
${content}
</context>

<think>
- uwzględnij wszystkie fakty podane w tekście, w szczególności odwołania do wydarzeń.
- zwróć uwagę na odwołania do podanych dat, jak np. "dziś", "jutro", "wczoraj" przy datach.
</think>

Na pytanie dotyczące schronienia odpowiedz "jaskinia".
Odpowiadaj krótko i konkretnie, bez zbędnych informacji.

Zwróć odpowiedź w poniższym formacie json:
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
            temperature: 0.7,
            jsonMode: true
        }
    )
        .then((response) => {
            const answerData = JSON.parse(response);
            console.log(chalk.greenBright('🎉 Got answer to question:'), question);
            console.log(answerData.answer);
            return answerData;
        });
}

async function sendAnswers(payload: unknown): Promise<Response> {
    const body = {
        task: 'notes',
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
    const pageImageFiles = await fs.readdir(filesPath);

    // uncomment to prepare images for OCR
    // for (const file of pageImageFiles) {
    //     if (file.endsWith('.png')) {
    //         await prepareImageForOCR(file);
    //     }
    // }

    // uncomment to do OCR on images
    // const optimizedPageImageFiles = await fs.readdir(path.join(filesPath, 'processed'));
    // for (const file of optimizedPageImageFiles.sort()) {
    //     if (file.endsWith('.png')) {
    //         const pageText = await doOCR(openAIService, file);
    //         fs.writeFile(path.join(filesPath, 'text', file.replace('png', 'txt')), pageText);
    //     }
    // }

    // uncomment to combine text files
    // await combineTextFiles();

    const questionsResponse = await getQuestions();
    const questions = await questionsResponse.json();
    const context = await fs.readFile(path.join(filesPath, 'combined.txt'), 'utf-8');

    let answers: Record<string, string> = {};

    for (const id in questions) {
        const answerResponse = await getAnswer(openAIService, questions[id], context);
        answers[id] = answerResponse.answer;
    }

    const centralaResponse = await sendAnswers(answers);
    const centralaResponseJson = await centralaResponse.json(); 

    console.log('Centrala response:', centralaResponseJson);
}

main();
