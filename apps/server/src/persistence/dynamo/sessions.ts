import {
  BatchWriteCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import type { Session, SessionStore } from "../../auth/stores.js";

/** Sessions table keyed by token hash, with a by-user index for revoking all sessions. */
export class DynamoSessionStore implements SessionStore {
  constructor(
    private readonly db: DynamoDBDocumentClient,
    private readonly table: string,
  ) {}

  async put(session: Session): Promise<void> {
    await this.db.send(
      new PutCommand({
        TableName: this.table,
        // `ttl` lets DynamoDB delete expired sessions automatically.
        Item: { ...session, ttl: Math.ceil(session.expiresAt / 1000) },
      }),
    );
  }

  async get(tokenHash: string): Promise<Session | undefined> {
    const res = await this.db.send(new GetCommand({ TableName: this.table, Key: { tokenHash } }));
    if (!res.Item) return undefined;
    const { userId, expiresAt, renewedAt } = res.Item;
    return {
      tokenHash,
      userId: String(userId),
      expiresAt: Number(expiresAt),
      renewedAt: Number(renewedAt),
    };
  }

  async delete(tokenHash: string): Promise<void> {
    await this.db.send(new DeleteCommand({ TableName: this.table, Key: { tokenHash } }));
  }

  async deleteAllForUser(userId: string): Promise<void> {
    const res = await this.db.send(
      new QueryCommand({
        TableName: this.table,
        IndexName: "byUser",
        KeyConditionExpression: "userId = :u",
        ExpressionAttributeValues: { ":u": userId },
      }),
    );
    const keys = (res.Items ?? []).map((i) => ({ tokenHash: String(i.tokenHash) }));
    for (let i = 0; i < keys.length; i += 25) {
      await this.db.send(
        new BatchWriteCommand({
          RequestItems: {
            [this.table]: keys.slice(i, i + 25).map((Key) => ({ DeleteRequest: { Key } })),
          },
        }),
      );
    }
  }
}
