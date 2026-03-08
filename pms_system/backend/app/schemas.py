from __future__ import annotations

from datetime import date, datetime
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class Token(BaseModel):
    access_token: str
    token_type: str


class ErrorPayload(BaseModel):
    code: str
    message: str
    details: dict | list | str | None = None


class ErrorEnvelope(BaseModel):
    error: ErrorPayload
    request_id: str


class MessageOut(BaseModel):
    ok: bool = True
    message: str


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class UserUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=64)
    email: EmailStr | None = None
    new_password: str | None = Field(default=None, min_length=6, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: EmailStr
    is_active: bool
    created_at: datetime


ProjectStatus = Literal["active", "inactive"]
TaskPriority = Literal["high", "medium", "low"]


class AttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    file_name: str
    content_type: str | None = None
    size: int
    uploaded_at: datetime


class TaskBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = ""
    priority: TaskPriority = "medium"
    start_date: datetime | None = None
    end_date: datetime | None = None
    actual_start_date: datetime | None = None
    actual_end_date: datetime | None = None
    progress: int = Field(default=0, ge=0, le=100)
    parent_id: int | None = None
    related_task_id: int | None = None
    remarks: str = ""
    assignee: str | None = None


class TaskCreate(TaskBase):
    column_id: int


class TaskUpdate(BaseModel):
    column_id: int | None = None
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    priority: TaskPriority | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    actual_start_date: datetime | None = None
    actual_end_date: datetime | None = None
    progress: int | None = Field(default=None, ge=0, le=100)
    parent_id: int | None = None
    related_task_id: int | None = None
    remarks: str | None = None
    assignee: str | None = None


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    column_id: int
    title: str
    description: str
    priority: TaskPriority
    start_date: datetime | None
    end_date: datetime | None
    actual_start_date: datetime | None
    actual_end_date: datetime | None
    progress: int
    parent_id: int | None
    related_task_id: int | None
    remarks: str
    assignee: str | None
    attachments: list[AttachmentOut] = []
    created_at: datetime
    updated_at: datetime


class ColumnOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    order_index: int
    tasks: list[TaskOut] = []


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = ""


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    status: ProjectStatus | None = None


class ProjectSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str
    status: ProjectStatus
    owner_id: int
    created_at: datetime


class ProjectOut(ProjectSummary):
    columns: list[ColumnOut] = []


class ProjectFileItem(BaseModel):
    id: int
    task_id: int
    task_title: str
    file_name: str
    content_type: str | None = None
    size: int
    uploaded_at: datetime
    task_date: datetime | None = None


class WeeklyReportRequest(BaseModel):
    start_date: date
    end_date: date
    project_ids: list[int] = Field(default_factory=list)


class WeeklyTaskItem(BaseModel):
    task_id: int
    title: str
    priority: str
    progress: int
    assignee: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    actual_start_date: datetime | None = None
    actual_end_date: datetime | None = None


class WeeklyProjectSummary(BaseModel):
    project_id: int
    project_name: str
    total_tasks: int
    completed_tasks: int
    in_progress_tasks: int
    overdue_tasks: int
    tasks: list[WeeklyTaskItem]


class WeeklyReportResponse(BaseModel):
    start_date: date
    end_date: date
    generated_at: datetime
    request_id: str
    projects: list[WeeklyProjectSummary]


class DownloadUrlOut(BaseModel):
    url: str
    expires_at: datetime


T = TypeVar("T")


class PageResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
