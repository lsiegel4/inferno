import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { InfernoStack } from "../lib/inferno-stack.js";

describe("InfernoStack", () => {
  it("synthesizes", () => {
    const template = Template.fromStack(new InfernoStack(new App(), "Test"));
    expect(template.toJSON()).toBeDefined();
  });
});
