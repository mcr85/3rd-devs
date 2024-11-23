// Write a program using below instructions
// 1. Read `json.text` file and save it to `json` variable
// 2. Map `json['test-data']` array by looping through it
// 2.1. If array element is an object with `test` property, read question from it under `test.q` property and save it under `question` variable
// 2.2. Get answer to the `question` using `OpenAIService.send(question)` method, which you can import from `./mcr_lib/OpenAIService`;
// 2.3. Assign `answerText` to `test.a` property of the `test` object.
// 3. Write updated `json` object to `json_with_answers.text` file

import fs from 'fs/promises';
import { OpenAIService } from '../mcr_lib/OpenAIService';
import path from 'path';

const context = 'Be concise and answer with one word.';

interface TestData {
    question: string;
    answer: string;
    test?: {
        q: string;
        a: string;
    }
}

function hasTest(item: TestData): boolean {
    return !!item.test;
}

function verifyMaths(mathQuestion: string): string {
    const components = mathQuestion.split('+');
    const result = components.reduce((acc, curr) => acc + parseInt(curr), 0);
    return result.toString();
}

async function main() {
  // Step 1: Read `json.text` file and save it to `json` variable
  const jsonFilePath = path.join(__dirname, 'json.json');
  const jsonData = await fs.readFile(jsonFilePath, 'utf-8');
  const json = JSON.parse(jsonData);

  // Step 2: Map `json['test-data']` array by looping through it
  const openaiService = new OpenAIService();
  const testData = json['test-data'] as TestData[];

  for (const item of testData) {
    // Step 2.1: If array element is an object with `test` property
    if (hasTest(item)) {
      const question = item.test!.q;

      // Step 2.2: Get answer to the `question` using `OpenAIService.send(question)` method
      const answer = await openaiService.send(question, [{ role: 'system', content: context }]);

      console.log('mcr question:', question);
      console.log('mcr answer:', answer);

      // Step 2.3: Assign `answerText` to `test.a` property of the `test` object
      item.test!.a = answer;
    } else {
        item.answer = verifyMaths(item.question);
    }
  }

  json.testData = testData;

  // Step 3: Write updated `json` object to `json_with_answers.text` file
  const jsonAnswersFilePath = path.join(__dirname, 'json_with_answers.json');
  await fs.writeFile(jsonAnswersFilePath, JSON.stringify(json, null, 2));
}

main().catch(console.error);