import type { ChatCompletionMessageParam } from 'ai/prompts';
import { OpenAIService } from '../mcr_lib/OpenAIService';

interface DbApiResponse {
    reply: Record<string, string>[];
    error: string;
}

const apiKey = process.env.CENTRALA;

const SQLQueryPrompt = `You are assistant which returns SQL query for given User question.
User will send you messages with table names and example table row data in json format.
List json data keys for given table and use them as table field names for table schema. Save table schema for particular table.

1. Await User messages with table name and example row data in json format - derive table schema's out of example data
2. Await for command from the User to answer given question.
- Command: Give SQL query for question: <question>
3. Make SQL query
- Use saved table schemas from previous steps to make SQL query
- Ensure used table fields are exactly the ones from saved table schema's
4. Validate that SQL query only contains table fields mentioned as keys in provided example json data 

Only answer when the User asks for it by sending command. Respond with just single line SQL query
Answer only with SQL query as a simple string, all in lower case, without additional text or markdown formatting.

THERE'S NO manager_id table field - forget about it`;

async function sendDbQuery(query: string): Promise<DbApiResponse> {
    const url = 'https://centrala.ag3nts.org/apidb';
    const body = {
        task: "database",
        apikey: "dc5e3acb-5664-424d-a99b-34ed44a87f9d",
        query
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        throw new Error(`Error fetching datacenter: ${error}`);
    }
}

async function getEntryFromTable(table: string) {
    return sendDbQuery(`select * from ${table} limit 1`);
}

async function getDatacenter() {
    return getEntryFromTable('datacenters')
        .then((dbResponse) => dbResponse.reply[0]);
}

async function getUser() {
    return getEntryFromTable('users')
        .then((dbResponse) => dbResponse.reply[0]);
}

async function sendAnswer(payload: unknown): Promise<Response> {
    const body = {
        task: 'database',
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

    const exampleDataCenter = await getDatacenter();
    const exampleUser = await getUser();

    console.log(exampleDataCenter);
    console.log(exampleUser);

    const messages: ChatCompletionMessageParam[] = [
        {
            role: 'system',
            content: SQLQueryPrompt
        },
        {
            role: 'user',
            content: `table: datacenters
            json:
            ${exampleDataCenter}`
        },
        {
            role: 'user',
            content: `table: users
            json:
            ${exampleUser}`
            
        }
    ];

    const userCommand = `Give SQL query for question: "które aktywne datacenter (DC_ID) są zarządzane przez pracowników, którzy są na urlopie (is_active=0)"`;

    const answerSQLquery = await openAIService.send(
        userCommand,
        messages,
        {
            model: 'gpt-4o-mini',
            temperature: 0
        }
    )

    const answer = await sendDbQuery(answerSQLquery);

    console.log(answerSQLquery);
    console.log(answer);
    
    // const centralaResponse = await sendAnswer(searchResults[0].payload!.date);
    // const centralaResponseJson = await centralaResponse.json(); 
}

main();
