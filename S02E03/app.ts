import type { ChatCompletionMessageParam } from 'ai/prompts';
import { OpenAIService } from '../mcr_lib/OpenAIService';
interface RobotReportResponse {
    description: string;
}

const apiKey = process.env.CENTRALA;

// 1. get description from centrala
async function getRobotReport(): Promise<RobotReportResponse> {
    const url = `https://centrala.ag3nts.org/data/${apiKey}/robotid.json`;
    const response = await fetch(url);
    console.log('mcr fetch', response)
    return await response.json() as RobotReportResponse;
}

// 2. send request for prompt from openai
async function requestRobotFeatures(openaiService: OpenAIService, robotReport: string): Promise<string> {
    const systemContext = `Read report of someone describing a robot in polish.
    Extract most important features of this robot. Focus on its body, head, how it moves, how it sees and what kind of emotion it evokes.
Return succinct description. Use few words to describe features instead of whole sentences. Make it in english.`

    const question = `What are the features of the robot described as: ${robotReport}`;

    const context = [
        { role: 'system', content: systemContext }
    ] as ChatCompletionMessageParam[];

    return openaiService.send(question, context, { model: 'gpt-4o-mini' });
}

// 3. send openai request for robot image, given robotFeaturesDescription
async function getRobotImageUrl(openaiService: OpenAIService, robotFeaturesDescription: string): Promise<string> {
    const prompt = `Create an image of a robot with features:
    ${robotFeaturesDescription}`;

    return openaiService.generateImage(prompt);
}

// 4. send image to centrala
async function sendRobotImage(url: string): Promise<Response> {
    const body = {
        task: 'robotid',
        apikey: apiKey,
        answer: url
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
    const openaiService = new OpenAIService();

    const robotReportResponse = await getRobotReport();
    const robotReport = robotReportResponse.description;
    const robotFeaturesDescription = await requestRobotFeatures(openaiService, robotReport);
    const robotImageUrl = await getRobotImageUrl(openaiService, robotFeaturesDescription);
    console.log('mcr robot image url:', robotImageUrl);

    if (!robotImageUrl) {
        throw new Error('Failed to generate robot image');
    }
    
    const centralaResponse = await sendRobotImage(robotImageUrl);
    const centralaResponseJson = await centralaResponse.json(); 

    console.log('mcr answer:', centralaResponseJson);
}

main();
