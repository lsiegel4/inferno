import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { UpdateCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Clock } from "../../clock.js";

export const LEASE_KEY = { id: "leader" };

/**
 * Leader lease (ADR-0001): one server holds it at a time. Each acquisition bumps the epoch;
 * turn writes check the epoch, so a server that lost the lease can never write again.
 */
export class Lease {
  epoch = 0;

  constructor(
    private readonly db: DynamoDBDocumentClient,
    private readonly table: string,
    readonly holder: string,
    private readonly clock: Clock,
    readonly ttlMs = 30_000,
  ) {}

  /** Take the lease if it is free, expired, or already ours. */
  async tryAcquire(): Promise<boolean> {
    const now = this.clock.now();
    try {
      const res = await this.db.send(
        new UpdateCommand({
          TableName: this.table,
          Key: LEASE_KEY,
          UpdateExpression:
            "SET epoch = if_not_exists(epoch, :zero) + :one, holder = :me, expiresAt = :exp",
          ConditionExpression: "attribute_not_exists(id) OR expiresAt < :now OR holder = :me",
          ExpressionAttributeValues: {
            ":zero": 0,
            ":one": 1,
            ":me": this.holder,
            ":exp": now + this.ttlMs,
            ":now": now,
          },
          ReturnValues: "ALL_NEW",
        }),
      );
      this.epoch = Number(res.Attributes?.epoch);
      return true;
    } catch (e) {
      if (e instanceof ConditionalCheckFailedException) return false;
      throw e;
    }
  }

  /** Extend the lease. False means another server took over. */
  async renew(): Promise<boolean> {
    return this.update("SET expiresAt = :exp", this.clock.now() + this.ttlMs);
  }

  /** Give the lease up immediately (graceful shutdown), so a successor can start at once. */
  async release(): Promise<void> {
    await this.update("SET expiresAt = :exp", 0);
  }

  private async update(expression: string, exp: number): Promise<boolean> {
    try {
      await this.db.send(
        new UpdateCommand({
          TableName: this.table,
          Key: LEASE_KEY,
          UpdateExpression: expression,
          ConditionExpression: "holder = :me AND epoch = :epoch",
          ExpressionAttributeValues: { ":me": this.holder, ":epoch": this.epoch, ":exp": exp },
        }),
      );
      return true;
    } catch (e) {
      if (e instanceof ConditionalCheckFailedException) return false;
      throw e;
    }
  }
}
