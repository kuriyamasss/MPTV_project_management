from __future__ import annotations

from datetime import datetime, time
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, File, Query, Request, UploadFile, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, or_, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload
from starlette.exceptions import HTTPException as StarletteHTTPException

from .auth import authenticate_user, create_access_token, get_current_user, get_password_hash
from .database import SessionLocal, get_db
from .errors import (
    AppException,
    app_exception_handler,
    http_exception_handler,
    integrity_exception_handler,
    unexpected_exception_handler,
    validation_exception_handler,
)
from .metrics import metrics_payload
from .middleware import RequestContextMiddleware, configure_logging
from .models import Project, ProjectColumn, Task, TaskAttachment, User
from .pagination import PaginationParams, pagination_params
from .rate_limit import SlidingWindowRateLimiter
from .schemas import (
    AttachmentOut,
    DownloadUrlOut,
    MessageOut,
    PageResponse,
    ProjectCreate,
    ProjectFileItem,
    ProjectOut,
    ProjectSummary,
    ProjectUpdate,
    TaskCreate,
    TaskOut,
    TaskUpdate,
    Token,
    UserCreate,
    UserOut,
    UserUpdate,
    WeeklyProjectSummary,
    WeeklyReportRequest,
    WeeklyReportResponse,
    WeeklyTaskItem,
)
from .settings import get_settings
from .storage import S3Storage

settings = get_settings()
configure_logging()

app = FastAPI(title=settings.APP_NAME, version=settings.APP_VERSION)
app.add_middleware(RequestContextMiddleware, settings=settings)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)

app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(IntegrityError, integrity_exception_handler)
app.add_exception_handler(Exception, unexpected_exception_handler)

storage = S3Storage(settings)
login_rate_limiter = SlidingWindowRateLimiter(
    max_attempts=settings.LOGIN_RATE_LIMIT_ATTEMPTS,
    window_seconds=settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS,
)
PROJECT_SHARED_FILES_MARKER = "__system_project_shared_files__"


@app.on_event("startup")
def startup() -> None:
    storage.ensure_bucket()


def _create_default_columns(db: Session, project_id: int) -> None:
    names = ["To Do", "In Progress", "Done", "Won't Do"]
    for idx, name in enumerate(names):
        db.add(ProjectColumn(project_id=project_id, name=name, order_index=idx))


def _get_project_or_error(
    db: Session,
    project_id: int,
    owner_id: int,
    *,
    with_details: bool = False,
) -> Project:
    stmt = select(Project).where(Project.id == project_id, Project.owner_id == owner_id)
    if with_details:
        stmt = stmt.options(
            selectinload(Project.columns)
            .selectinload(ProjectColumn.tasks)
            .selectinload(Task.attachments)
        )
    project = db.scalar(stmt)
    if project is None:
        raise AppException(status_code=404, code="project_not_found", message="Project not found")
    return project


def _get_task_or_error(db: Session, task_id: int, owner_id: int) -> Task:
    stmt = (
        select(Task)
        .join(Project, Task.project_id == Project.id)
        .where(Task.id == task_id, Project.owner_id == owner_id)
        .options(selectinload(Task.attachments))
    )
    task = db.scalar(stmt)
    if task is None:
        raise AppException(status_code=404, code="task_not_found", message="Task not found")
    return task


def _get_or_create_project_shared_task(db: Session, project: Project) -> Task:
    task = db.scalar(
        select(Task).where(
            Task.project_id == project.id,
            Task.remarks == PROJECT_SHARED_FILES_MARKER,
        )
    )
    if task is not None:
        return task

    first_column = db.scalar(
        select(ProjectColumn)
        .where(ProjectColumn.project_id == project.id)
        .order_by(ProjectColumn.order_index.asc(), ProjectColumn.id.asc())
    )
    if first_column is None:
        raise AppException(
            status_code=500,
            code="project_column_missing",
            message="Project has no valid column for file storage",
        )

    task = Task(
        project_id=project.id,
        column_id=first_column.id,
        title="Project Shared Files",
        description="System-managed task for files uploaded without explicit task assignment",
        priority="low",
        progress=0,
        remarks=PROJECT_SHARED_FILES_MARKER,
    )
    db.add(task)
    db.flush()
    return task


def _get_attachment_or_error(db: Session, attachment_id: int, owner_id: int) -> TaskAttachment:
    stmt = (
        select(TaskAttachment)
        .join(Task, TaskAttachment.task_id == Task.id)
        .join(Project, Task.project_id == Project.id)
        .where(TaskAttachment.id == attachment_id, Project.owner_id == owner_id)
    )
    attachment = db.scalar(stmt)
    if attachment is None:
        raise AppException(status_code=404, code="attachment_not_found", message="Attachment not found")
    return attachment


def _validate_links(
    db: Session,
    project_id: int,
    *,
    parent_id: int | None,
    related_task_id: int | None,
    current_task_id: int | None = None,
) -> None:
    ids_to_validate = [task_id for task_id in [parent_id, related_task_id] if task_id is not None]
    if not ids_to_validate:
        return

    rows = db.scalars(
        select(Task.id).where(Task.project_id == project_id, Task.id.in_(ids_to_validate))
    ).all()
    valid_ids = set(rows)
    for task_id in ids_to_validate:
        if task_id not in valid_ids:
            raise AppException(
                status_code=400,
                code="invalid_task_link",
                message="Task link target must be in the same project",
            )
        if current_task_id is not None and task_id == current_task_id:
            raise AppException(
                status_code=400,
                code="self_reference_not_allowed",
                message="Task cannot reference itself",
            )


def _attachment_to_out(attachment: TaskAttachment) -> AttachmentOut:
    return AttachmentOut(
        id=attachment.id,
        task_id=attachment.task_id,
        file_name=attachment.file_name,
        content_type=attachment.content_type,
        size=attachment.size,
        uploaded_at=attachment.uploaded_at,
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready")
def ready(response: Response) -> dict:
    db_ok = False
    with SessionLocal() as db:
        try:
            db.execute(text("SELECT 1"))
            db_ok = True
        except Exception:
            db_ok = False
    storage_ok = storage.ready()
    status_text = "ready" if db_ok and storage_ok else "not_ready"
    if status_text != "ready":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {"status": status_text, "checks": {"database": db_ok, "storage": storage_ok}}


@app.get("/metrics")
def metrics() -> Response:
    return Response(content=metrics_payload(), media_type="text/plain; version=0.0.4")


@app.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register_user(payload: UserCreate, db: Session = Depends(get_db)) -> User:
    exists = db.scalar(
        select(User.id).where(or_(User.username == payload.username, User.email == payload.email))
    )
    if exists:
        raise AppException(
            status_code=409,
            code="user_already_exists",
            message="Username or email already exists",
        )

    user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.post("/token", response_model=Token)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> Token:
    ip = request.client.host if request.client else "unknown"
    rate_key = f"{ip}:{form_data.username}"
    if not login_rate_limiter.allow(rate_key):
        raise AppException(
            status_code=429,
            code="login_rate_limited",
            message="Too many login attempts, please try again later",
        )

    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise AppException(
            status_code=401,
            code="invalid_credentials",
            message="Incorrect username or password",
        )
    return Token(access_token=create_access_token(subject=user.username), token_type="bearer")


@app.get("/users/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@app.put("/users/me", response_model=UserOut)
def update_me(
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    if payload.username and payload.username != current_user.username:
        if db.scalar(select(User.id).where(User.username == payload.username)):
            raise AppException(status_code=409, code="username_exists", message="Username already exists")
        current_user.username = payload.username

    if payload.email and payload.email != current_user.email:
        if db.scalar(select(User.id).where(User.email == payload.email)):
            raise AppException(status_code=409, code="email_exists", message="Email already exists")
        current_user.email = payload.email

    if payload.new_password:
        current_user.hashed_password = get_password_hash(payload.new_password)

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@app.get("/projects", response_model=PageResponse[ProjectSummary])
def list_projects(
    status_filter: Literal["active", "inactive"] | None = Query(default=None, alias="status"),
    paging: PaginationParams = Depends(pagination_params),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PageResponse[ProjectSummary]:
    base_stmt = select(Project).where(Project.owner_id == current_user.id)
    if status_filter:
        base_stmt = base_stmt.where(Project.status == status_filter)

    total = db.scalar(select(func.count()).select_from(base_stmt.subquery())) or 0
    items = db.scalars(
        base_stmt.order_by(Project.created_at.desc()).offset(paging.offset).limit(paging.page_size)
    ).all()
    return PageResponse(items=list(items), total=total, page=paging.page, page_size=paging.page_size)


@app.post("/projects", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Project:
    project = Project(
        name=payload.name,
        description=payload.description or "",
        owner_id=current_user.id,
        status="active",
    )
    db.add(project)
    db.flush()
    _create_default_columns(db, project.id)
    db.commit()
    return _get_project_or_error(db, project.id, current_user.id, with_details=True)


@app.get("/projects/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Project:
    return _get_project_or_error(db, project_id, current_user.id, with_details=True)


@app.put("/projects/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Project:
    project = _get_project_or_error(db, project_id, current_user.id)
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)
    db.add(project)
    db.commit()
    return _get_project_or_error(db, project_id, current_user.id, with_details=True)


@app.post("/projects/{project_id}/tasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(
    project_id: int,
    payload: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Task:
    project = _get_project_or_error(db, project_id, current_user.id)
    column = db.scalar(
        select(ProjectColumn).where(
            ProjectColumn.id == payload.column_id, ProjectColumn.project_id == project.id
        )
    )
    if column is None:
        raise AppException(
            status_code=400,
            code="column_not_found",
            message="Column not found in this project",
        )

    _validate_links(
        db,
        project_id=project.id,
        parent_id=payload.parent_id,
        related_task_id=payload.related_task_id,
    )

    task = Task(project_id=project.id, **payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@app.patch("/tasks/{task_id}", response_model=TaskOut)
def patch_task(
    task_id: int,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Task:
    task = _get_task_or_error(db, task_id, current_user.id)
    update_data = payload.model_dump(exclude_unset=True)

    if "column_id" in update_data and update_data["column_id"] is not None:
        valid_column = db.scalar(
            select(ProjectColumn.id).where(
                ProjectColumn.id == update_data["column_id"],
                ProjectColumn.project_id == task.project_id,
            )
        )
        if valid_column is None:
            raise AppException(
                status_code=400,
                code="column_not_found",
                message="Column not found in this project",
            )

    parent_id = update_data.get("parent_id", task.parent_id)
    related_task_id = update_data.get("related_task_id", task.related_task_id)
    _validate_links(
        db,
        project_id=task.project_id,
        parent_id=parent_id,
        related_task_id=related_task_id,
        current_task_id=task.id,
    )

    for key, value in update_data.items():
        setattr(task, key, value)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@app.delete("/tasks/{task_id}", response_model=MessageOut)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageOut:
    task = _get_task_or_error(db, task_id, current_user.id)

    siblings = db.scalars(select(Task).where(Task.project_id == task.project_id)).all()
    for sibling in siblings:
        changed = False
        if sibling.parent_id == task.id:
            sibling.parent_id = None
            changed = True
        if sibling.related_task_id == task.id:
            sibling.related_task_id = None
            changed = True
        if changed:
            db.add(sibling)

    for attachment in task.attachments:
        storage.delete(bucket=attachment.storage_bucket, object_key=attachment.object_key)

    db.delete(task)
    db.commit()
    return MessageOut(message="Task deleted")


@app.post("/tasks/{task_id}/attachments", response_model=AttachmentOut, status_code=201)
async def upload_attachment(
    task_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttachmentOut:
    task = _get_task_or_error(db, task_id, current_user.id)
    safe_name = Path(file.filename or "file.bin").name
    content = await file.read()
    if len(content) > settings.max_upload_bytes:
        raise AppException(
            status_code=413,
            code="file_too_large",
            message=f"File exceeds {settings.MAX_UPLOAD_SIZE_MB}MB upload limit",
        )

    bucket, object_key = storage.upload(
        file_name=safe_name,
        content=content,
        content_type=file.content_type,
    )

    attachment = TaskAttachment(
        task_id=task.id,
        file_name=safe_name,
        storage_bucket=bucket,
        object_key=object_key,
        content_type=file.content_type,
        size=len(content),
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return _attachment_to_out(attachment)


@app.post("/projects/{project_id}/attachments", response_model=AttachmentOut, status_code=201)
async def upload_project_attachment(
    project_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttachmentOut:
    project = _get_project_or_error(db, project_id, current_user.id)
    shared_task = _get_or_create_project_shared_task(db, project)

    safe_name = Path(file.filename or "file.bin").name
    content = await file.read()
    if len(content) > settings.max_upload_bytes:
        raise AppException(
            status_code=413,
            code="file_too_large",
            message=f"File exceeds {settings.MAX_UPLOAD_SIZE_MB}MB upload limit",
        )

    bucket, object_key = storage.upload(
        file_name=safe_name,
        content=content,
        content_type=file.content_type,
    )

    attachment = TaskAttachment(
        task_id=shared_task.id,
        file_name=safe_name,
        storage_bucket=bucket,
        object_key=object_key,
        content_type=file.content_type,
        size=len(content),
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return _attachment_to_out(attachment)


@app.delete("/tasks/{task_id}/attachments/{attachment_id}", response_model=MessageOut)
def delete_attachment(
    task_id: int,
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageOut:
    task = _get_task_or_error(db, task_id, current_user.id)
    attachment = db.scalar(
        select(TaskAttachment).where(
            TaskAttachment.id == attachment_id, TaskAttachment.task_id == task.id
        )
    )
    if attachment is None:
        raise AppException(status_code=404, code="attachment_not_found", message="Attachment not found")

    storage.delete(bucket=attachment.storage_bucket, object_key=attachment.object_key)
    db.delete(attachment)
    db.commit()
    return MessageOut(message="Attachment deleted")


@app.get("/projects/{project_id}/files", response_model=PageResponse[ProjectFileItem])
def list_project_files(
    project_id: int,
    paging: PaginationParams = Depends(pagination_params),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PageResponse[ProjectFileItem]:
    _get_project_or_error(db, project_id, current_user.id)
    base_stmt = (
        select(TaskAttachment, Task)
        .join(Task, TaskAttachment.task_id == Task.id)
        .where(Task.project_id == project_id)
    )
    total = db.scalar(select(func.count()).select_from(base_stmt.subquery())) or 0
    rows = (
        db.execute(
            base_stmt.order_by(TaskAttachment.uploaded_at.desc())
            .offset(paging.offset)
            .limit(paging.page_size)
        )
        .all()
    )
    items = [
        ProjectFileItem(
            id=attachment.id,
            task_id=task.id,
            task_title=task.title,
            file_name=attachment.file_name,
            content_type=attachment.content_type,
            size=attachment.size,
            uploaded_at=attachment.uploaded_at,
            task_date=task.start_date,
        )
        for attachment, task in rows
    ]
    return PageResponse(items=items, total=total, page=paging.page, page_size=paging.page_size)


@app.get("/files/{attachment_id}/download-url", response_model=DownloadUrlOut)
def get_download_url(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DownloadUrlOut:
    attachment = _get_attachment_or_error(db, attachment_id, current_user.id)
    url, expires_at = storage.presign_download(
        bucket=attachment.storage_bucket,
        object_key=attachment.object_key,
        file_name=attachment.file_name,
    )
    return DownloadUrlOut(url=url, expires_at=expires_at)


@app.post("/reports/weekly", response_model=WeeklyReportResponse)
def generate_weekly_report(
    request: Request,
    payload: WeeklyReportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WeeklyReportResponse:
    start_dt = datetime.combine(payload.start_date, time.min)
    end_dt = datetime.combine(payload.end_date, time.max)

    project_stmt = select(Project).where(Project.owner_id == current_user.id)
    if payload.project_ids:
        project_stmt = project_stmt.where(Project.id.in_(payload.project_ids))
    projects = list(db.scalars(project_stmt).all())

    if payload.project_ids and len(projects) != len(set(payload.project_ids)):
        raise AppException(
            status_code=400,
            code="invalid_project_selection",
            message="One or more selected projects are invalid",
        )

    summaries: list[WeeklyProjectSummary] = []
    now = datetime.utcnow()

    for project in projects:
        tasks = list(db.scalars(select(Task).where(Task.project_id == project.id)).all())

        def touched_in_window(task: Task) -> bool:
            stamps = [
                task.start_date,
                task.end_date,
                task.actual_start_date,
                task.actual_end_date,
                task.updated_at,
            ]
            return any(stamp and start_dt <= stamp <= end_dt for stamp in stamps)

        report_tasks = [task for task in tasks if touched_in_window(task)]
        completed = [task for task in tasks if task.progress >= 100]
        in_progress = [task for task in tasks if 0 < task.progress < 100]
        overdue = [
            task
            for task in tasks
            if task.end_date and task.end_date < now and task.progress < 100
        ]

        summaries.append(
            WeeklyProjectSummary(
                project_id=project.id,
                project_name=project.name,
                total_tasks=len(tasks),
                completed_tasks=len(completed),
                in_progress_tasks=len(in_progress),
                overdue_tasks=len(overdue),
                tasks=[
                    WeeklyTaskItem(
                        task_id=task.id,
                        title=task.title,
                        priority=task.priority,
                        progress=task.progress,
                        assignee=task.assignee,
                        start_date=task.start_date,
                        end_date=task.end_date,
                        actual_start_date=task.actual_start_date,
                        actual_end_date=task.actual_end_date,
                    )
                    for task in report_tasks
                ],
            )
        )

    return WeeklyReportResponse(
        start_date=payload.start_date,
        end_date=payload.end_date,
        generated_at=datetime.utcnow(),
        request_id=getattr(request.state, "request_id", "unknown"),
        projects=summaries,
    )
