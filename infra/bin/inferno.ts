import { App } from "aws-cdk-lib";
import { InfernoStack } from "../lib/inferno-stack.js";

const app = new App();
new InfernoStack(app, "Inferno");
