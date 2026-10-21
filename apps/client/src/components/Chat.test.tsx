import { CHAT_MAX_LENGTH } from "@inferno/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Chat } from "./Chat.js";

describe("Chat", () => {
  it("shows messages and sends trimmed text", async () => {
    const onSend = vi.fn();
    render(
      <Chat
        messages={[{ id: "1", handle: "bo", text: "lever first", at: "t" }]}
        canChat
        onSend={onSend}
      />,
    );
    expect(screen.getByText("lever first")).toBeTruthy();
    const input = screen.getByLabelText("Message");
    expect(input.getAttribute("maxlength")).toBe(String(CHAT_MAX_LENGTH));
    await userEvent.type(input, "  go left  {enter}");
    expect(onSend).toHaveBeenCalledWith("go left");
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("is read-only for spectators", () => {
    render(<Chat messages={[]} canChat={false} onSend={vi.fn()} />);
    expect((screen.getByLabelText("Message") as HTMLInputElement).disabled).toBe(true);
  });
});
