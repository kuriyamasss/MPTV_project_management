import React, { createContext, useContext, useMemo, useState } from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";

const cn = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(" ");

type NoticeType = "success" | "error" | "info";

type NoticeItem = {
  id: number;
  type: NoticeType;
  message: string;
};

type NoticeContextValue = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const NoticeContext = createContext<NoticeContextValue>({
  success: () => undefined,
  error: () => undefined,
  info: () => undefined
});

const noticeStyle: Record<NoticeType, string> = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  error:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/40 dark:text-red-200",
  info:
    "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
};

const NoticeIcon = ({ type }: { type: NoticeType }) => {
  if (type === "success") return <CheckCircle2 size={16} />;
  if (type === "error") return <TriangleAlert size={16} />;
  return <Info size={16} />;
};

export const NotificationProvider = ({
  children
}: {
  children: React.ReactNode;
}) => {
  const [items, setItems] = useState<NoticeItem[]>([]);

  const dismiss = (id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const push = (type: NoticeType, message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 10000);
    setItems((prev) => [...prev, { id, type, message }]);
    window.setTimeout(() => {
      dismiss(id);
    }, 4500);
  };

  const value = useMemo<NoticeContextValue>(
    () => ({
      success: (message) => push("success", message),
      error: (message) => push("error", message),
      info: (message) => push("info", message)
    }),
    []
  );

  return (
    <NoticeContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[200] w-[min(360px,calc(100vw-24px))] space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "rounded-lg border shadow-lg px-3 py-2 flex items-start gap-2",
              noticeStyle[item.type]
            )}
          >
            <span className="mt-0.5">
              <NoticeIcon type={item.type} />
            </span>
            <p className="text-sm leading-5 flex-1">{item.message}</p>
            <button
              type="button"
              className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10"
              onClick={() => dismiss(item.id)}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </NoticeContext.Provider>
  );
};

export const useNotifier = (): NoticeContextValue => useContext(NoticeContext);
