const apiKey = process.env.CENTRALA;

async function getNote() {
    const note = await fetch('https://centrala.ag3nts.org/dane/barbara.txt');
    return note.text();
}

async function sendAnswer(payload: unknown): Promise<Response> {
    const body = {
        task: 'loop',
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
    const note = await getNote();
    
    const centralaResponse = await sendAnswer();
    const centralaResponseJson = await centralaResponse.json(); 
}

main();
