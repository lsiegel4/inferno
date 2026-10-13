import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import type { ChatMessage, GameSnapshot, TurnRecord } from "@inferno/shared";
import type { Clock } from "../../clock.js";
import { StaleLeaderError, type GameLog, type TurnWrite } from "../types.js";
import { LEASE_KEY, type Lease } from "./lease.js";
import { GAME_ID, type TableNames } from "./tables.js";

const SNAPSHOTS_KEPT = 3;
const CHAT_TTL_S = 3 * 24 * 60 * 60;

/** DynamoDB game log with leader fencing (ADR-0009). */
export class DynamoGameLog implements GameLog {
  constructor(
    private readonly db: DynamoDBDocumentClient,
    private readonly tables: TableNames,
    private readonly lease: Lease,
    private readonly clock: Clock,
  ) {}

  /**
   * One transaction: the turn (only if that turn number is new), its votes, and a check that we
   * still hold the lease at our epoch. Any failed condition means a stale leader.
   */
  async appendTurn({ record, votes }: TurnWrite): Promise<void> {
    try {
      await this.db.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.tables.turns,
                Item: { game: GAME_ID, ...record, epoch: this.lease.epoch },
                ConditionExpression: "attribute_not_exists(turn)",
              },
            },
            {
              Put: {
                TableName: this.tables.votes,
                Item: { game: GAME_ID, turn: record.turn, votes },
              },
            },
            {
              ConditionCheck: {
                TableName: this.tables.lease,
                Key: LEASE_KEY,
                ConditionExpression: "holder = :me AND epoch = :epoch",
                ExpressionAttributeValues: { ":me": this.lease.holder, ":epoch": this.lease.epoch },
              },
            },
          ],
        }),
      );
    } catch (e) {
      if (e instanceof TransactionCanceledException) {
        throw new StaleLeaderError(`turn ${record.turn} rejected: ${e.message}`);
      }
      throw e;
    }
  }

  async saveSnapshot(snapshot: GameSnapshot): Promise<void> {
    await this.db.send(
      new PutCommand({
        TableName: this.tables.snapshots,
        Item: { game: GAME_ID, turn: snapshot.turn, data: JSON.stringify(snapshot) },
      }),
    );
    const res = await this.db.send(
      new QueryCommand({
        TableName: this.tables.snapshots,
        KeyConditionExpression: "game = :g",
        ExpressionAttributeValues: { ":g": GAME_ID },
        ProjectionExpression: "turn",
        ScanIndexForward: false,
      }),
    );
    const old = (res.Items ?? []).slice(SNAPSHOTS_KEPT);
    if (old.length) {
      await this.db.send(
        new BatchWriteCommand({
          RequestItems: {
            [this.tables.snapshots]: old.map((i) => ({
              DeleteRequest: { Key: { game: GAME_ID, turn: i.turn } },
            })),
          },
        }),
      );
    }
  }

  async latestSnapshot(): Promise<GameSnapshot | undefined> {
    const res = await this.db.send(
      new QueryCommand({
        TableName: this.tables.snapshots,
        KeyConditionExpression: "game = :g",
        ExpressionAttributeValues: { ":g": GAME_ID },
        ScanIndexForward: false,
        Limit: 1,
      }),
    );
    const item = res.Items?.[0];
    return item ? (JSON.parse(String(item.data)) as GameSnapshot) : undefined;
  }

  async turnsAfter(after: number, limit = Infinity): Promise<TurnRecord[]> {
    const out: TurnRecord[] = [];
    let start: Record<string, unknown> | undefined;
    do {
      const res = await this.db.send(
        new QueryCommand({
          TableName: this.tables.turns,
          KeyConditionExpression: "game = :g AND turn > :after",
          ExpressionAttributeValues: { ":g": GAME_ID, ":after": after },
          ...(Number.isFinite(limit) ? { Limit: limit - out.length } : {}),
          ...(start ? { ExclusiveStartKey: start } : {}),
        }),
      );
      for (const item of res.Items ?? []) {
        const { turn, floorId, action, at, outcome } = item;
        out.push({ turn, floorId, action, at, ...(outcome ? { outcome } : {}) } as TurnRecord);
      }
      start = res.LastEvaluatedKey;
    } while (start && out.length < limit);
    return out;
  }

  async appendChat(msg: ChatMessage): Promise<void> {
    await this.db.send(
      new PutCommand({
        TableName: this.tables.chat,
        Item: {
          game: GAME_ID,
          sk: `${msg.at}#${msg.id}`,
          ...msg,
          ttl: Math.floor(this.clock.now() / 1000) + CHAT_TTL_S,
        },
      }),
    );
  }

  async recentChat(limit: number): Promise<ChatMessage[]> {
    const nowS = Math.floor(this.clock.now() / 1000);
    const res = await this.db.send(
      new QueryCommand({
        TableName: this.tables.chat,
        KeyConditionExpression: "game = :g",
        ExpressionAttributeValues: { ":g": GAME_ID },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    // DynamoDB deletes expired items lazily, so filter them out here too.
    return (res.Items ?? [])
      .filter((i) => Number(i.ttl) > nowS)
      .map(({ id, handle, text, at }) => ({ id, handle, text, at }) as ChatMessage)
      .reverse();
  }
}
