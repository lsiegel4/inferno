import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "../App.js";
import { ServicesProvider, type Services } from "../services.js";

const services: Services = {
  transport: (_onMessage, onStatus) => ({
    connect: () => onStatus("open"),
    send: () => {},
    reconnect: () => {},
    close: () => {},
  }),
  api: {
    me: () => Promise.resolve(null),
    signIn: () => Promise.reject(new Error("no")),
    logout: () => Promise.resolve(),
    setHandle: (handle: string) => Promise.resolve({ handle }),
  },
  googleClientId: "",
};

describe("the floor map button", () => {
  it("opens the explored map and closes it again from the same place", async () => {
    sessionStorage.setItem("inferno.entered", "1");
    render(
      <ServicesProvider value={services}>
        <App />
      </ServicesProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Floor map" }));
    expect(screen.getByRole("dialog", { name: "Explored floor map" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Close floor map" }));
    expect(screen.queryByRole("dialog", { name: "Explored floor map" })).toBeNull();
  });
});
