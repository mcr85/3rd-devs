import express from 'express';
import { OpenAIService } from '../mcr_lib/OpenAIService';
import chalk from 'chalk';

const app = express();
const port = 3000;
app.use(express.json());
app.listen(port, () => console.log(`Server running at http://localhost:${port}. Listening for POST /api/chat requests`));

const prompt = `You are drone pilot assistant which needs to return description of location arrived at after performing given flight directions.
You are about to get drone pilot flight directions in polish language.
Drone pilot can move in 4 directions: LEFT, RIGHT, UP, DOWN on 4x4 grid."
Extract from description actual directions pilot went to and store them in array as LEFT, RIGHT, UP, DOWN.
Below 4x4 grid contains y,x coordinates.
<grid>
[
    [ 1.1, 1.2, 1.3, 1.4 ]
    [ 2.1, 2.2, 2.3, 2.4 ],
    [ 3.1, 3.2, 3.3, 3.4 ],
    [ 4.1, 4.2, 4.3, 4.4 ]
]
</grid>

Here are location descriptions for given coordinates:
<locationDescriptions>
    <location coordinate="1.1">Punkt startowy</location>
    <location coordinate="1.2">trawa</location>
    <location coordinate="1.3">drzewo</location>
    <location coordinate="1.4">budynek</location>
    <location coordinate="2.1">trawa</location>
    <location coordinate="2.2">wiatrak</location>
    <location coordinate="2.3">trawa</location>
    <location coordinate="2.4">trawa</location>
    <location coordinate="3.1">trawa</location>
    <location coordinate="3.2">trawa</location>
    <location coordinate="3.3">skały</location>
    <location coordinate="3.4">drzewa</location>
    <location coordinate="4.1">Szczyty gór</location>
    <location coordinate="4.2">Piętrzące się góry</location>
    <location coordinate="4.3">samochód</location>
    <location coordinate="4.4">Jaskinia</location>
</locationDescriptions>

Drone starting position is at 1.1 (y=1, x=1)
Move RIGHT adds 1 to x coordinate.
Move LEFT subtracts 1 from x coordinate.
Move DOWN adds 1 to y coordinate.
Move UP subtracts 1 from y coordinate.
Apply movement directions one by one from given array of movement directions to starting position and return description of location - <location> text content for given coordinate attribute.

<thinking>
Go step by step:
1. Extract directions from given instructions to directions array.
2. Apply directions from starting positions and remember last coordinate.
3. Use last coordinate to find <location> element.
4. Return text of found <location> element.
</thinking>

Return answer in following json format:
{
    "directions": directions array,
    "thinking": your thinking process to get to the answer,
    "description": location description for final extracted coordinate
}`;

app.post('/webhook', async (req, res) => {
    console.log('mcr req.body', req.body);

    const { instruction } = req.body;

    const description = await describeLocation(instruction)

    console.log(chalk.cyan('Sending this description: ', description?.description));
    res.status(200).json(description);
});

async function describeLocation(instruction: string) {
    const openAIService = new OpenAIService();

    const { description } = await openAIService.send(
        instruction,
        [
            {
                role: 'system',
                content: prompt
            }
        ],
        {
            model: 'gpt-4o',
            temperature: 0.6,
            jsonMode: true
        }
    )
        .then((response) => {
            console.log('mcr response', response);
            const answerData = JSON.parse(response);
            console.log(chalk.greenBright('🎉 Got answer to question:'), answerData.description);
            return answerData;
        });

    return {
        description
    };
}