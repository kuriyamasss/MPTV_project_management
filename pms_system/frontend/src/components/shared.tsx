import React from "react";
import { Download, File, FileText, User, X } from "lucide-react";
import type { Priority } from "../types";
import { getErrorMessage, triggerAttachmentDownload } from "../lib/api";
import { useNotifier } from "./notifications";
import { useConfig } from "../config";

export type PreviewFile = {
  id: number;
  name: string;
};

export const cn = (...parts: Array<string | undefined | false | null>): string =>
  parts.filter(Boolean).join(" ");

export const formatDate = (value?: string | null): string => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString();
};

export const formatSize = (size: number): string => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

export const toDateInput = (value?: string | null): string => (value ? value.slice(0, 10) : "");
export const toDateTimeInput = (value?: string | null): string => (value ? value.slice(0, 16) : "");

export const toISOOrNull = (value?: string): string | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const priorityStyles: Record<string, string> = {
  high: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
  medium:
    "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800",
  low: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800"
};

export const PriorityTag = ({ value }: { value: Priority }) => {
  const { t } = useConfig();
  const labels: Record<Priority, string> = {
    high: t.priorityHigh,
    medium: t.priorityMedium,
    low: t.priorityLow
  };
  return (
    <span
      className={cn(
        "text-[10px] uppercase font-bold px-2 py-0.5 rounded border",
        priorityStyles[value] ?? priorityStyles.medium
      )}
    >
      {labels[value] ?? labels.medium}
    </span>
  );
};

export const Avatar = ({ name }: { name?: string | null }) => (
  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200 flex items-center justify-center text-[10px] font-bold">
    {name ? name[0]?.toUpperCase() : <User size={12} />}
  </div>
);

export const FilePreviewModal = ({
  file,
  onClose
}: {
  file: PreviewFile | null;
  onClose: () => void;
}) => {
  const { t } = useConfig();
  const notify = useNotifier();
  if (!file) return null;
  const isPdf = file.name.toLowerCase().endsWith(".pdf");
  return (
    <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4">
      <div className="w-full max-w-4xl h-[82vh] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-blue-600" />
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">{file.name}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 text-sm rounded-md border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1"
              onClick={async () => {
                try {
                  await triggerAttachmentDownload(file.id);
                } catch (error) {
                  notify.error(getErrorMessage(error, t.downloadFailed));
                }
              }}
            >
              <Download size={14} /> {t.download}
            </button>
            <button className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="flex-1 bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-6">
          {isPdf ? (
            <div className="w-full h-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg flex flex-col items-center justify-center text-slate-500">
              <FileText size={64} className="mb-3 text-slate-300 dark:text-slate-600" />
              <p className="font-medium">{t.previewPlaceholderPdf}</p>
              <p className="text-sm mt-1">{file.name}</p>
            </div>
          ) : (
            <div className="text-center text-slate-500">
              <File size={56} className="mx-auto mb-2 text-slate-400" />
              <p>{t.previewNotAvailable}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
