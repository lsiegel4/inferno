import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import {
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import { HandleTakenError, type User, type UserStore } from "../../auth/stores.js";

const userKey = (id: string) => ({ pk: `USER#${id}` });
const handleKey = (handle: string) => ({ pk: `HANDLE#${handle.toLowerCase()}` });

/**
 * Users table: `USER#<id>` items, plus a `HANDLE#<lowercase handle>` item per user so handle
 * uniqueness is enforced by a conditional write in the same transaction.
 */
export class DynamoUserStore implements UserStore {
  constructor(
    private readonly db: DynamoDBDocumentClient,
    private readonly table: string,
  ) {}

  async findBySub(sub: string): Promise<User | undefined> {
    const res = await this.db.send(
      new QueryCommand({
        TableName: this.table,
        IndexName: "bySub",
        KeyConditionExpression: "googleSub = :s",
        ExpressionAttributeValues: { ":s": sub },
        Limit: 1,
      }),
    );
    const item = res.Items?.[0];
    return item ? toUser(item) : undefined;
  }

  async get(id: string): Promise<User | undefined> {
    const res = await this.db.send(new GetCommand({ TableName: this.table, Key: userKey(id) }));
    return res.Item ? toUser(res.Item) : undefined;
  }

  async create(user: User): Promise<void> {
    await this.transact(
      [
        {
          Put: {
            TableName: this.table,
            Item: {
              ...userKey(user.id),
              id: user.id,
              googleSub: user.googleSub,
              handle: user.handle,
            },
            ConditionExpression: "attribute_not_exists(pk)",
          },
        },
        {
          Put: {
            TableName: this.table,
            Item: { ...handleKey(user.handle), userId: user.id },
            ConditionExpression: "attribute_not_exists(pk)",
          },
        },
      ],
      user.handle,
    );
  }

  async setHandle(id: string, handle: string): Promise<void> {
    const user = await this.get(id);
    if (!user) throw new Error(`unknown user ${id}`);
    const sameKey = user.handle.toLowerCase() === handle.toLowerCase();
    await this.transact(
      [
        {
          Update: {
            TableName: this.table,
            Key: userKey(id),
            UpdateExpression: "SET handle = :h",
            ConditionExpression: "handle = :old",
            ExpressionAttributeValues: { ":h": handle, ":old": user.handle },
          },
        },
        ...(sameKey
          ? []
          : [
              {
                Put: {
                  TableName: this.table,
                  Item: { ...handleKey(handle), userId: id },
                  ConditionExpression: "attribute_not_exists(pk)",
                },
              },
              { Delete: { TableName: this.table, Key: handleKey(user.handle) } },
            ]),
      ],
      handle,
    );
  }

  async isHandleTaken(handle: string): Promise<boolean> {
    const res = await this.db.send(
      new GetCommand({ TableName: this.table, Key: handleKey(handle) }),
    );
    return res.Item !== undefined;
  }

  private async transact(
    items: NonNullable<ConstructorParameters<typeof TransactWriteCommand>[0]["TransactItems"]>,
    handle: string,
  ): Promise<void> {
    try {
      await this.db.send(new TransactWriteCommand({ TransactItems: items }));
    } catch (e) {
      if (e instanceof TransactionCanceledException) throw new HandleTakenError(handle);
      throw e;
    }
  }
}

function toUser(item: Record<string, unknown>): User {
  return { id: String(item.id), googleSub: String(item.googleSub), handle: String(item.handle) };
}
