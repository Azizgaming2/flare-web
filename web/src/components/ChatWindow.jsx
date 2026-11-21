import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";
import LoadingIndicator from "./LoadingIndicator";

export default function ChatWindow({
  messages,
  isLoading,
  isHistoryLoading,
  lang,
  emptyText,
  userAvatarUrl,
  onRegenerate,
  onLogIn,
  onFeedback,
  t,
}) {
  const bottomRef = useRef(null);

  const last = messages[messages.length - 1];
  const isWaiting = isLoading && last?.role === "assistant" && !last.content;
  const visibleMessages = isWaiting ? messages.slice(0, -1) : messages;
  const streamingIndex = isLoading ? visibleMessages.length - 1 : -1;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  if (isHistoryLoading) {
    return <div className="chat-window" />;
  }

  if (messages.length === 0) {
    return (
      <div className="empty-state-wrapper">
        <div className="gradient-orb" />
        <div className="empty-state">{emptyText}</div>
      </div>
    );
  }

  return (
    <div className="chat-window">
      {visibleMessages.map((msg, idx) => (
        <MessageBubble
          key={idx}
          role={msg.role}
          content={msg.content}
          avatarUrl={msg.role === "user" ? userAvatarUrl : null}
          showCopy={idx !== streamingIndex && !msg.error}
          thinkingMs={msg.thinkingMs}
          memoryUpdated={msg.memoryUpdated}
          storageFull={msg.storageFull}
          showRegenerate={idx === visibleMessages.length - 1 && msg.role === "assistant" && !isLoading && !msg.error}
          onRegenerate={onRegenerate}
          loginRequired={msg.loginRequired}
          attachments={msg.attachments}
          index={idx}
          onFeedback={onFeedback}
          onLogIn={onLogIn}
          t={t}
        />
      ))}
      {isWaiting && (
        <div className="message-row assistant">
          <LoadingIndicator lang={lang} startedAt={last.startedAt || Date.now()} />
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
