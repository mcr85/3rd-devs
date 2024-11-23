import * as fs from 'fs';
import * as path from 'path';
import { OpenAIService } from '../mcr_lib/OpenAIService';
import type { ChatCompletionMessageParam } from 'ai/prompts';

const imagesPath = path.join(__dirname, 'images');

// const cityPrompt = `Get the name of rather big Polish city from attached image of a map.
// Map can contain contain:
// - streets and their names
// - land marks, like park or cemetery
// - rail roads
// - buildings with business names
// - bus stations
// - tram stations

// Do these steps for each map:
// - List streets which are on the map
// - Look for cities having all these streets in close proximity

// Consider other features like found landmarks, buildings, roads, tracks.

// List all cities you found for each map.`;

const cityPrompt = `Identify name of polish city from this map.
Identify streets first and list them.
- try to focus on correctly reading street names. Improve font recognition if needed.
Identify public place or landmark names.
List all possible polish cities having all of these streets in close proximity.
You can consider depicted on the map landmarks, buildings, roads, tracks, public place names.`;

const prompt = 'Return just city name.';

function getImages() {
    const imagesDir = path.join(__dirname, 'images');
    const images = fs.readdirSync(imagesDir);
    return images;
}

function imageToBase64(imagePath: string) {
    const imageFile = fs.readFileSync(imagePath);
    const imageFileBase64 = imageFile.toString('base64');
    return imageFileBase64;
}

function imagesBase64ToMessages(imagesBase64: string[]): ChatCompletionMessageParam[] {
    return imagesBase64.map((imageBase64) => {
        return {
            role: 'user',
            content: [
                {
                    type: 'image_url',
                    image_url: {
                        url: `data:image/jpg;base64,${imageBase64}`,
                        detail: 'high'
                    }
                },
                {
                    type: 'text',
                    text: cityPrompt
                }
            ]
        } as ChatCompletionMessageParam;
    });
}

async function main() {
    const openaiService = new OpenAIService();

    // get image file names
    const images = getImages();

    // load images and convert to base64
    const imagesBase64 = images.map((image) => {
        return imageToBase64(path.join(imagesPath, image));
    });

    // prepare messages for openai
    const messages = imagesBase64ToMessages(imagesBase64);

    const answer = await openaiService.send(prompt, messages, { model: 'gpt-4o', temperature: 0 });

    console.log(answer);
}

main();
