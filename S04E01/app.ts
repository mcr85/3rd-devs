import type { ChatCompletionContentPartImage, ChatCompletionMessageParam } from 'ai/prompts';
import { OpenAIService } from '../mcr_lib/OpenAIService';

const apiKey = process.env.CENTRALA;

function getPhoto(payload: string): Promise<Response> {
    const body = {
        task: 'photos',
        apikey: apiKey,
        answer: payload
    };

    console.log('mcr getPhoto', payload);
    return fetch('https://centrala.ag3nts.org/report', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
    });
}

async function getInitialPhotos(): Promise<Response> {
    return getPhoto('START');
}

interface ImageMetadata {
    url: string;
    smallUrl: string;
    filename: string;
}

function mapToImageMetadata(filename: string): ImageMetadata {
    const url = `https://centrala.ag3nts.org/dane/barbara/${filename}`
    const smallUrl = `https://centrala.ag3nts.org/dane/barbara/${filename.replace(/\.PNG/g, '-small.PNG')}`;

    return {
        url,
        smallUrl,
        filename
    } as ImageMetadata;
}

function extractImages(message: string): ImageMetadata[] {
    console.log('mcr extractImgages', message);
    const filenames = message.match(/IMG_[\w_]+\.PNG/g);

    if (!filenames) {
        throw new Error('No images found');
    }

    return filenames.map(mapToImageMetadata);
}

// determine what to do with photo
async function analyzeImage(openAIService: OpenAIService, url: string) {
    // send photo to openai
    const messages: ChatCompletionMessageParam[] = [
        {
            role: 'system',
            content: `Your role is to analyze photo for given url and determine course of action.
            Available actions are:
            - REPAIR - if image looks damaged/glitched
            - DARKEN - if image appears to be too bright
            - BRIGHTEN - if image appears to be too dark
            - DESCRIBE - only if image shows face of one person and it's a woman's face
            - NONE - if image doesn't qualify for REPAIR, DARKEN, BRIGHTEN or DESCRIBE action or doesn't show one woman face

            When not able to determine action, respond with NONE action.
            
            <output_format>
            Respond with this json structure:
            {
                "action": "REPAIR" | "DARKEN" | "BRIGHTEN" | "NONE" | "DESCRIBE"
            }
            </output_format>
            `
        },
        {
            role: 'user',
            content: [
                {
                    type: 'image_url',
                    image_url: {
                        url 
                    }
                } as ChatCompletionContentPartImage
            ]
        }
    ];
    return openAIService.send(
        'Determine action',
        messages,
        {
            model: 'gpt-4o-mini',
            temperature: 0.1,
            jsonMode: true
        }
    )
}

function getPersonDescription(openAIService: OpenAIService, images: ImageMetadata[]) {
    const messages: ChatCompletionMessageParam[] = [
        {
            role: 'system',
            content: `Dostaniesz kilka zdjęć pewnej kobiety. Na komendę użytkownika "RYSOPIS" sporządź jej rysopis.
        <thinking>
        Sporządź rysopis kobiety dla każdego zdjęcia i go zapamiętaj.
        W opisie skup się na jej karnacji, rasie, koloru włosów, koloru oczu, przybliżonym wieku, czy nosi okulary, w co jest ubrana, czy ma jakieś znaki szczególne, na przykład blizny lub tatuaże.
        Gdy sporządzisz opisy dla każdego zdjęcia, połącz je w jeden krótki rysopis zawierający się powtarzające się opisy.
        </thinking>
        Zacznij odpowiadać gdy dostanisz komendę "RYSOPIS"`
        }
    ];

    images.forEach((image) => {
        messages.push({
            role: 'user',
            content: [
                {
                    type: 'image_url',
                    image_url: {
                        url: image.smallUrl
                    }
                } as ChatCompletionContentPartImage
            ]
        })
    });

    return openAIService.send(
        'RYSOPIS',
        messages,
        {
            model: 'gpt-4o',
            temperature: 0.8
        }
    )
}

async function processImage(action: string, image: ImageMetadata): Promise<Response> {
    return getPhoto(`${action} ${image.filename}`);
}

async function actionOnImage(action: string, image: ImageMetadata) {
    if ([ 'REPAIR', 'DARKEN', 'BRIGHTEN' ].includes(action)) {
        return processImage(action, image)
            .then((response) => response.json())
            .then((text) => text.message);
    }

    return Promise.resolve(null);
}

async function getFinalImageFile(openAIService: OpenAIService, image: ImageMetadata) {
    const analyzeResponse = await analyzeImage(openAIService, image.url) as string;
    const action = JSON.parse(analyzeResponse).action;

    if (action === 'DESCRIBE') {
        return image.filename;
    }

    const processedImage = await actionOnImage(action, image);

    if (!processedImage) {
        console.log('mcr no processedImage, returning early');
        return;
    }

    const images = extractImages(processedImage);
    
    return getFinalImageFile(openAIService, images[0]);
}

async function sendAnswer(payload: unknown): Promise<Response> {
    const body = {
        task: 'photos',
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
    const openAIService = new OpenAIService();

    const response = await getInitialPhotos();
    const responseObject = await response.json() as { code: number; message: string };
    const images = extractImages(responseObject.message);

    console.log(images);

    const finalImageFiles = [];
    // const finalImageFiles = [
    //     'IMG_559_NRR7.PNG',
    //     'IMG_1443_FT12.PNG'
    // ];

    for (const image of images) {
        const finalImageFile = await getFinalImageFile(openAIService, image);
        finalImageFiles.push(finalImageFile);
    }

    const imagesToDescribe = finalImageFiles
        .filter((image) => image !== undefined)
        .map((image) => mapToImageMetadata(image));
    
    const description = await getPersonDescription(openAIService, imagesToDescribe)

    const centralaResponse = await sendAnswer(description);
    const centralaResponseJson = await centralaResponse.json(); 

    console.log('mcr finalImages', imagesToDescribe);
    console.log('mcr description', description);
    console.log('mcr answer:', centralaResponseJson);
}

main();