const apiKey = process.env.CENTRALA;

async function getPhoto(payload: string): Promise<Response> {
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

async function getInitialPhotos(): Promise<Response> {
    return getPhoto('START');
}

interface ImageMetadata {
    url: string;
    smallUrl: string;
    filename: string;
}

function extractSmallImages(message: string): ImageMetadata[] {
    const filenames = message.match(/IMG_\d+\.PNG/g)

    if (!filenames) {
        throw new Error('No images found');
    }

    return filenames.map((filename) => {
        const url = `https://centrala.ag3nts.org/dane/barbara/${filename}`
        const smallUrl = `https://centrala.ag3nts.org/dane/barbara/${filename.replace(/\.PNG/g, '-small.PNG')}`;

        return {
            url,
            smallUrl, 
            filename
        } as ImageMetadata;
    });
}

async function main() {
    const response = await getInitialPhotos();
    const responseObject = await response.json() as { code: number; message: string };
    const smallImages = extractSmallImages(responseObject.message);

    console.log(smallImages);

    // for each image do:
    // 1. decide what do do with it
    // - if it's too dark, brighten it
    // - if it's too bright, darken it
    // - if it's damaged, repair it; image is damaged if it's not a photo of a person or it shows glitches
    // - do nothing if image doesn't show face of a person

    // available actions
    // REPAIR
    // DARKEN
    // BRIGHTEN
    // NONE
}

main();