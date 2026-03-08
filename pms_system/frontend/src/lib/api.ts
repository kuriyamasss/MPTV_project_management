import axios from "axios";
import { useAuthStore } from "../store/useAuthStore";
import type { ApiErrorEnvelope, DownloadUrlResponse } from "../types";

type UiLang = "zh" | "vi";

const getLang = (): UiLang => {
  if (typeof window === "undefined") return "zh";
  const lang = localStorage.getItem("mptv-lang");
  return lang === "vi" ? "vi" : "zh";
};

const ERROR_MESSAGES: Record<UiLang, Record<string, string>> = {
  zh: {
    validation_error: "请求参数无效。",
    invalid_credentials: "用户名或密码错误。",
    login_rate_limited: "登录尝试过多，请稍后再试。",
    http_error: "请求失败。",
    project_not_found: "未找到项目。",
    task_not_found: "未找到任务。",
    attachment_not_found: "未找到附件。",
    invalid_task_link: "任务关联必须在同一项目内。",
    self_reference_not_allowed: "任务不能关联自身。",
    column_not_found: "未找到目标列。",
    file_too_large: "文件过大。",
    storage_upload_failed: "文件上传失败。",
    storage_delete_failed: "文件删除失败。",
    storage_presign_failed: "生成下载链接失败。",
    user_already_exists: "用户名或邮箱已存在。",
    username_exists: "用户名已存在。",
    email_exists: "邮箱已存在。",
    request_timeout: "请求超时，请重试。",
    internal_error: "服务器错误，请重试。"
  },
  vi: {
    validation_error: "Du lieu gui len khong hop le.",
    invalid_credentials: "Sai ten dang nhap hoac mat khau.",
    login_rate_limited: "Dang nhap qua nhieu lan. Thu lai sau.",
    http_error: "Yeu cau that bai.",
    project_not_found: "Khong tim thay du an.",
    task_not_found: "Khong tim thay nhiem vu.",
    attachment_not_found: "Khong tim thay tep dinh kem.",
    invalid_task_link: "Lien ket nhiem vu phai trong cung du an.",
    self_reference_not_allowed: "Nhiem vu khong the lien ket chinh no.",
    column_not_found: "Khong tim thay cot muc tieu.",
    file_too_large: "Tep qua lon.",
    storage_upload_failed: "Tai tep len that bai.",
    storage_delete_failed: "Xoa tep that bai.",
    storage_presign_failed: "Tao lien ket tai xuong that bai.",
    user_already_exists: "Ten dang nhap hoac email da ton tai.",
    username_exists: "Ten dang nhap da ton tai.",
    email_exists: "Email da ton tai.",
    request_timeout: "Het thoi gian cho. Thu lai.",
    internal_error: "Loi may chu. Thu lai."
  }
};

const fallbackByStatus: Record<UiLang, Record<number, string>> = {
  zh: {
    400: "请求失败。",
    401: "需要登录。",
    403: "没有权限。",
    404: "资源不存在。",
    409: "资源冲突。",
    413: "文件过大。",
    422: "请求参数校验失败。",
    429: "请求过于频繁。",
    500: "服务器错误。",
    502: "服务不可用。",
    503: "服务不可用。",
    504: "请求超时。"
  },
  vi: {
    400: "Yeu cau that bai.",
    401: "Can dang nhap.",
    403: "Khong co quyen truy cap.",
    404: "Khong tim thay tai nguyen.",
    409: "Xung dot du lieu.",
    413: "Tep qua lon.",
    422: "Du lieu gui len khong hop le.",
    429: "Qua nhieu yeu cau.",
    500: "Loi may chu.",
    502: "Dich vu tam thoi khong kha dung.",
    503: "Dich vu tam thoi khong kha dung.",
    504: "Het thoi gian cho."
  }
};

export class ApiError extends Error {
  code: string;
  status?: number;
  requestId?: string;
  details?: unknown;

  constructor({
    message,
    code,
    status,
    requestId,
    details
  }: {
    message: string;
    code: string;
    status?: number;
    requestId?: string;
    details?: unknown;
  }) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.details = details;
  }
}

const resolveErrorMessage = (
  code: string,
  status?: number,
  serverMessage?: string
): string => {
  const lang = getLang();
  if (ERROR_MESSAGES[lang][code]) return ERROR_MESSAGES[lang][code];
  if (serverMessage) return serverMessage;
  if (status && fallbackByStatus[lang][status]) return fallbackByStatus[lang][status];
  return lang === "zh" ? "请求失败。" : "Yeu cau that bai.";
};

const randomRequestId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json"
  },
  timeout: 30000
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (!config.headers["X-Request-ID"]) {
    config.headers["X-Request-ID"] = randomRequestId();
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status as number | undefined;
    const envelope = error?.response?.data as ApiErrorEnvelope | undefined;
    const code = envelope?.error?.code ?? (status === 401 ? "unauthorized" : "request_failed");
    const message = resolveErrorMessage(code, status, envelope?.error?.message);

    if (status === 401) {
      useAuthStore.getState().logout();
    }

    return Promise.reject(
      new ApiError({
        code,
        status,
        requestId: envelope?.request_id,
        details: envelope?.error?.details,
        message
      })
    );
  }
);

export const getErrorMessage = (error: unknown, fallback?: string): string => {
  const defaultFallback = getLang() === "zh" ? "请求失败。" : "Yeu cau that bai.";
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback ?? defaultFallback;
};

export const getDownloadUrl = async (
  attachmentId: number
): Promise<DownloadUrlResponse> => {
  const { data } = await api.get<DownloadUrlResponse>(
    `/files/${attachmentId}/download-url`
  );
  return data;
};

export const triggerAttachmentDownload = async (
  attachmentId: number
): Promise<void> => {
  const popup = window.open("about:blank", "_blank", "noopener,noreferrer");
  try {
    const data = await getDownloadUrl(attachmentId);
    if (popup) {
      popup.location.href = data.url;
      return;
    }
    window.location.assign(data.url);
  } catch (error) {
    if (popup) popup.close();
    throw error;
  }
};

export default api;
