from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import get_password_hash
from .models import Project, ProjectColumn, Task, TaskAttachment, User
from .storage import S3Storage


def _dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value)


def seed_demo_data(db: Session, storage: S3Storage | None = None) -> None:
    if db.scalar(select(User.id).limit(1)) is not None:
        return

    admin = User(
        username="admin",
        email="admin@example.com",
        hashed_password=get_password_hash("123456"),
        is_active=True,
    )
    db.add(admin)
    db.flush()

    project = Project(
        name="ERP System Refactor",
        description="Migration of core business processes and performance optimization.",
        owner_id=admin.id,
        status="active",
    )
    db.add(project)
    db.flush()

    columns = [
        ProjectColumn(project_id=project.id, name="To Do", order_index=0),
        ProjectColumn(project_id=project.id, name="In Progress", order_index=1),
        ProjectColumn(project_id=project.id, name="Done", order_index=2),
        ProjectColumn(project_id=project.id, name="Won't Do", order_index=3),
    ]
    db.add_all(columns)
    db.flush()

    task_1 = Task(
        project_id=project.id,
        column_id=columns[0].id,
        title="Database Migration Plan",
        description="Design and validate new schema",
        priority="high",
        start_date=_dt("2024-01-05T00:00:00"),
        end_date=_dt("2024-01-10T00:00:00"),
        actual_start_date=_dt("2024-01-06T00:00:00"),
        actual_end_date=_dt("2024-01-09T00:00:00"),
        progress=100,
        assignee="Alice",
        remarks="Need server access",
    )
    db.add(task_1)
    db.flush()

    task_2 = Task(
        project_id=project.id,
        column_id=columns[1].id,
        title="Docker Environment",
        description="Setup development containers",
        priority="medium",
        start_date=_dt("2024-01-13T00:00:00"),
        end_date=_dt("2024-01-20T00:00:00"),
        actual_start_date=_dt("2024-01-12T00:00:00"),
        progress=60,
        assignee="Dave",
        remarks="Redis image is slow",
    )
    db.add(task_2)
    db.flush()

    task_3 = Task(
        project_id=project.id,
        column_id=columns[0].id,
        title="Backup Legacy Data",
        description="Full backup before migration",
        priority="high",
        start_date=_dt("2024-01-11T00:00:00"),
        end_date=_dt("2024-01-12T00:00:00"),
        actual_start_date=_dt("2024-01-10T00:00:00"),
        actual_end_date=_dt("2024-01-11T00:00:00"),
        progress=100,
        assignee="Bob",
        parent_id=task_1.id,
        remarks="500GB archived",
    )
    db.add(task_3)
    db.flush()

    task_1.related_task_id = task_3.id

    second = Project(
        name="Company Website Redesign",
        description="Modernize the brand look and feel.",
        owner_id=admin.id,
        status="active",
    )
    db.add(second)
    db.flush()

    second_columns = [
        ProjectColumn(project_id=second.id, name="Backlog", order_index=0),
        ProjectColumn(project_id=second.id, name="Design", order_index=1),
        ProjectColumn(project_id=second.id, name="Done", order_index=2),
        ProjectColumn(project_id=second.id, name="Won't Do", order_index=3),
    ]
    db.add_all(second_columns)
    db.flush()

    db.add(
        Task(
            project_id=second.id,
            column_id=second_columns[1].id,
            title="Homepage Hero",
            description="Landing page hero section visual update",
            priority="high",
            start_date=_dt("2024-01-10T00:00:00"),
            end_date=_dt("2024-01-15T00:00:00"),
            progress=10,
            assignee="Sophie",
        )
    )
    db.flush()

    if storage:
        examples = [
            (
                task_1.id,
                "schema_v1.sql",
                "-- Example SQL schema from demo data",
                "text/plain",
            ),
            (
                task_3.id,
                "backup_logs.txt",
                "Backup completed successfully at 2024-01-11T00:00:00Z",
                "text/plain",
            ),
        ]
        for task_id, name, content, content_type in examples:
            bucket, object_key = storage.upload(
                file_name=name,
                content=content.encode("utf-8"),
                content_type=content_type,
            )
            db.add(
                TaskAttachment(
                    task_id=task_id,
                    file_name=name,
                    storage_bucket=bucket,
                    object_key=object_key,
                    content_type=content_type,
                    size=len(content),
                )
            )

    db.commit()
