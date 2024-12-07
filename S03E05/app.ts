import { Neo4jService } from './Neo4jService';

const apiKey = process.env.CENTRALA;
const usersFile = await import('./users');
const connectionsFile = await import('./connections');

if (!process.env.NEO4J_URI || !process.env.NEO4J_USER || !process.env.NEO4J_PASSWORD) {
  throw new Error("NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD must be set");
}

const neo4jService = new Neo4jService(
  process.env.NEO4J_URI,
  process.env.NEO4J_USER,
  process.env.NEO4J_PASSWORD
);

// create nodes
// for (const user of usersFile.users) {
//     await neo4jService.addNode('User', user);
// }

// create index
// CREATE INDEX FOR (n:User) ON (n.id) - in neo4j browser

// create connections
// for (const connection of connectionsFile.connections) {
//     // get nodes
//     const user1node = await neo4jService.findNodeByProperty('User', 'id', connection.user1_id);
//     const user2node = await neo4jService.findNodeByProperty('User', 'id', connection.user2_id);
//     if (user1node && user2node) {
//         await neo4jService.connectNodes(user1node.id, user2node.id, 'KNOWS', connection.properties);
//     }
// }

async function sendAnswer(payload: string): Promise<Response> {
    const body = {
        task: 'connections',
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
    // run query
    const query = `MATCH (usr1:User {username: 'Rafał'}), (usr2:User {username: 'Barbara'})
    MATCH path = shortestPath((usr1)-[:KNOWS*]-(usr2))
    RETURN [node IN nodes(path) | node.username] AS usernames`;
    const result = await neo4jService.runQuery(query);
    await neo4jService.close();
    const usernames = result.records[0].get('usernames').join(', ');

    console.log('mcr result', usernames);

    const centralaResponse = await sendAnswer(usernames);
    const centralaResponseJson = await centralaResponse.json(); 

    console.log('mcr', centralaResponseJson)
}

main();