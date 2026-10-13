/**
 * DynamoDB tables (ADR-0009). In AWS they are created by the CDK stack (Phase 6); createTables is
 * for DynamoDB Local in development and tests.
 */
import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  ResourceInUseException,
  type CreateTableCommandInput,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

/** The one global game's partition key value. */
export const GAME_ID = "main";

export interface TableNames {
  turns: string;
  votes: string;
  snapshots: string;
  chat: string;
  users: string;
  sessions: string;
  lease: string;
}

export function tableNames(prefix: string): TableNames {
  return {
    turns: `${prefix}turns`,
    votes: `${prefix}votes`,
    snapshots: `${prefix}snapshots`,
    chat: `${prefix}chat`,
    users: `${prefix}users`,
    sessions: `${prefix}sessions`,
    lease: `${prefix}lease`,
  };
}

export function documentClient(endpoint?: string): DynamoDBDocumentClient {
  const client = new DynamoDBClient(
    endpoint
      ? {
          endpoint,
          region: "local",
          credentials: { accessKeyId: "local", secretAccessKey: "local" },
        }
      : {},
  );
  return DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });
}

function tableDefinitions(t: TableNames): CreateTableCommandInput[] {
  const gameTurn = (TableName: string): CreateTableCommandInput => ({
    TableName,
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [
      { AttributeName: "game", AttributeType: "S" },
      { AttributeName: "turn", AttributeType: "N" },
    ],
    KeySchema: [
      { AttributeName: "game", KeyType: "HASH" },
      { AttributeName: "turn", KeyType: "RANGE" },
    ],
  });
  return [
    gameTurn(t.turns),
    gameTurn(t.votes),
    gameTurn(t.snapshots),
    {
      TableName: t.chat,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [
        { AttributeName: "game", AttributeType: "S" },
        { AttributeName: "sk", AttributeType: "S" },
      ],
      KeySchema: [
        { AttributeName: "game", KeyType: "HASH" },
        { AttributeName: "sk", KeyType: "RANGE" },
      ],
    },
    {
      TableName: t.users,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [
        { AttributeName: "pk", AttributeType: "S" },
        { AttributeName: "googleSub", AttributeType: "S" },
      ],
      KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
      GlobalSecondaryIndexes: [
        {
          IndexName: "bySub",
          KeySchema: [{ AttributeName: "googleSub", KeyType: "HASH" }],
          Projection: { ProjectionType: "ALL" },
        },
      ],
    },
    {
      TableName: t.sessions,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [
        { AttributeName: "tokenHash", AttributeType: "S" },
        { AttributeName: "userId", AttributeType: "S" },
      ],
      KeySchema: [{ AttributeName: "tokenHash", KeyType: "HASH" }],
      GlobalSecondaryIndexes: [
        {
          IndexName: "byUser",
          KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }],
          Projection: { ProjectionType: "KEYS_ONLY" },
        },
      ],
    },
    {
      TableName: t.lease,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    },
  ];
}

/** Create any missing tables (DynamoDB Local only). */
export async function createTables(db: DynamoDBDocumentClient, t: TableNames): Promise<void> {
  for (const def of tableDefinitions(t)) {
    try {
      await db.send(new CreateTableCommand(def));
    } catch (e) {
      if (!(e instanceof ResourceInUseException)) throw e;
    }
  }
}

/** Delete all tables (tests only). */
export async function deleteTables(db: DynamoDBDocumentClient, t: TableNames): Promise<void> {
  for (const name of Object.values(t)) {
    await db.send(new DeleteTableCommand({ TableName: name })).catch(() => {});
  }
}
