import neo4j, { Driver, Result, Session } from "neo4j-driver";

export class Neo4jService {
    private driver: Driver;

    constructor(uri: string, username: string, password: string) {
        this.driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
    }

    async runQuery(cypher: string, params: Record<string, any> = {}): Promise<Result> {
        const session: Session = this.driver.session();
        try {
            return await session.run(cypher, params);
        } finally {
            await session.close();
        }
    }

    async addNode(label: string, properties: Record<string, any>): Promise<{ id: number, properties: Record<string, any> }> {
        const cypher = `
            CREATE (n:${label} $properties)
            RETURN id(n) AS id, n
        `;
        const result = await this.runQuery(cypher, { properties });
        return {
            id: (result.records[0].get('id') as neo4j.Integer).toNumber(),
            properties: result.records[0].get('n').properties
        }
    }

    async connectNodes(fromNodeId: number, toNodeId: number, relationshipType: string, properties: Record<string, any> = {}): Promise<void> {
        const cypher = `
        MATCH (a), (b)
        WHERE id(a) = $fromNodeId AND id(b) = $toNodeId
        CREATE (a)-[r:${relationshipType} $properties]->(b)
        RETURN r
        `;
        await this.runQuery(cypher, {
            fromNodeId: neo4j.int(fromNodeId),
            toNodeId: neo4j.int(toNodeId),
            properties
        });
    }

    async findNodeByProperty(label: string, propertyName: string, propertyValue: any): Promise<{ id: number, properties: Record<string, any> } | null> {
        const cypher = `
        MATCH (n:${label} {${propertyName}: $propertyValue})
        RETURN id(n) AS id, n
        `;
        const result = await this.runQuery(cypher, { propertyValue });
        if (result.records.length === 0) {
            return null;
        }
        const record = result.records[0];
        return {
            id: (record.get('id') as neo4j.Integer).toNumber(),
            properties: record.get('n').properties
        };
    }

    async close() {
        this.driver.close();
    }
}
