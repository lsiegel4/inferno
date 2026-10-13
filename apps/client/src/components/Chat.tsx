import { CHAT_MAX_LENGTH, type ChatMessage } from "@inferno/shared";
import { useState, type FormEvent } from "react";

export interface ChatProps {
  messages: ChatMessage[];
  canChat: boolean;
  onSend: (text: string) => void;
}

export function Chat({ messages, canChat, onSend }: ChatProps) {
  const [text, setText] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  };
  return (
    <div className="chat">
      {messages.length === 0 ? (
        <p className="empty">Chat is how the crowd agrees on a plan.</p>
      ) : (
        <ul className="chat-list">
          {messages.map((m) => (
            <li key={m.id}>
              <b>{m.handle}</b> {m.text}
            </li>
          ))}
        </ul>
      )}
      <form className="chat-form" onSubmit={submit}>
        <label className="sr-only" htmlFor="chat-input">
          Message
        </label>
        <input
          id="chat-input"
          value={text}
          maxLength={CHAT_MAX_LENGTH}
          disabled={!canChat}
          placeholder={canChat ? "Say something to the crowd" : "Sign in to chat"}
          onChange={(e) => setText(e.target.value)}
          autoComplete="off"
        />
        <button type="submit" className="key" disabled={!canChat || !text.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
