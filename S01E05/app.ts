interface LocalModelResponse {
    model: string;
    response: string;
}

const apiKey = process.env.CENTRALA;

function getData() {
    const url = `https://centrala.ag3nts.org/data/${apiKey}/cenzura.txt`;
    return fetch(url);
}

async function getAnonymizedData(data: string): Promise<LocalModelResponse> {
    // make request to local llm
    const system = `In given text replace person's name (name and surname - 2 words) with single word "CENZURA".
    Replace person's address (city, street, building number) with words "CENZURA" but keep word "ul."
    Replace person's age (two digit number) with word "CENZURA".
    Keep polish language. Keep beginning the same as in given input text. Keep order of the words words the same, keep punctuation marks. Do not change anything else.
    <EXAMPLE>
    input: "Dane personalne podejrzanego: Wojciech Górski. Przebywa w Lublinie, ul. Akacjowa 7. Wiek: 27 lat."
    output: "Dane personalne podejrzanego: CENZURA. Przebywa w CENZURA, ul. CENZURA. Wiek: CENZURA lat."

    input: "Podejrzany: Krzysztof Kwiatkowski. Mieszka w Szczecinie przy ul. Różanej 12. Ma 31 lat."
    output: "Podejrzany: CENZURA. Mieszka w CENZURA przy ul. CENZURA. Ma CENZURA lat."

    input: "Tożsamość osoby podejrzanej: Piotr Lewandowski. Zamieszkały w Łodzi przy ul. Wspólnej 22. Ma 34 lata."
    output: "Tożsamość osoby podejrzanej: CENZURA. Zamieszkały w CENZURA przy ul. CENZURA. Ma CENZURA lata."

    input: "Dane podejrzanego: Jakub Woźniak. Adres: Rzeszów, ul. Miła 4. Wiek: 33 lata."
    output: "Dane podejrzanego: CENZURA. Adres: CENZURA, ul. CENZURA. Wiek: CENZURA lata."
    </EXAMPLE>
    
    Return only output without additional text or formatting.`;

    const prompt = data;

    const config = {
        // model: 'llama2:7b',
        model: 'gemma:2b',
        system,
        prompt,
        temperature: 0.8,
        stream: false,
    }

    console.log('mcr config', config);

    const port = 11434;
    const url = `http://localhost:${port}/api/generate`;

    const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(config)
    });

    if (!response.ok) {
        throw new Error('Error in local model response');
    }

    const apiResponseData: LocalModelResponse = await response.json();

    return apiResponseData;
}

async function sendAnonymizedData(data: string): Promise<Response> {
    const url = `https://centrala.ag3nts.org/report`;

    const body = {
        task: 'CENZURA',
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
    const response = await getData();
    const data = await response.text();
    const anonymizedDataResponse = await getAnonymizedData(data);
    const anonymizedData = anonymizedDataResponse.response;
    const centralaResponse = await sendAnonymizedData(anonymizedData);
    // console.log('mcr annonymizedData', anonymizedDataResponse, data, anonymizedData);
    const centralaResponseJson = await centralaResponse.json(); 
    // console.log('mcr anonymizedData', data, anonymizedData);
    console.log('mcr', data, anonymizedData, centralaResponseJson);
}

main();
