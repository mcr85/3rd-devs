import * as fs from 'fs';
import path from 'path';
import * as readline from 'readline';

async function testResultsToJsonL(file: string, classification: string) {
    const readFileStream = fs.createReadStream(path.join(__dirname, 'data', `${file}.txt`));
    const writeFileStream = fs.createWriteStream(path.join(__dirname, 'data', `badania.jsonl`), { flags: 'a' });

    const rl = readline.createInterface({
        input: readFileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        const jsonLine =  {
            messages: [
                {
                    role: 'system',
                    content: 'Classify lab tests with "1" or "0"'
                },
                {
                    role: 'user',
                    content: line
                },
                {
                    role: 'assistant',
                    content: classification
                }
            ]
        };

        writeFileStream.write(JSON.stringify(jsonLine) + '\n');
    }

    writeFileStream.end();
}

(async () => {
    testResultsToJsonL('correct', '1');
    testResultsToJsonL('incorrect', '0');
})();
