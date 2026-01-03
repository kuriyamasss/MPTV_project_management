from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    role = Column(String(20), default="member")
    created_at = Column(DateTime, default=datetime.utcnow)
    projects_owned = relationship("Project", back_populates="owner")
    tasks_assigned = relationship("TaskAssignment", back_populates="user")
    comments = relationship("TaskComment", back_populates="author")

class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    owner = relationship("User", back_populates="projects_owned")
    columns = relationship("ProjectColumn", back_populates="project", cascade="all, delete-orphan", order_by="ProjectColumn.order_index")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")

class ProjectColumn(Base):
    __tablename__ = "project_columns"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(50), nullable=False)
    order_index = Column(Integer, default=0)
    project = relationship("Project", back_populates="columns")
    tasks = relationship("Task", back_populates="column")

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    column_id = Column(Integer, ForeignKey("project_columns.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(String(20), default="medium")
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    actual_start_date = Column(DateTime, nullable=True)
    actual_end_date = Column(DateTime, nullable=True)
    progress = Column(Float, default=0.0)
    parent_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    project = relationship("Project", back_populates="tasks")
    column = relationship("ProjectColumn", back_populates="tasks")
    children = relationship("Task", backref="parent", remote_side=[id])
    assignments = relationship("TaskAssignment", back_populates="task", cascade="all, delete-orphan")
    attachments = relationship("FileAttachment", back_populates="task", cascade="all, delete-orphan")
    comments = relationship("TaskComment", back_populates="task", cascade="all, delete-orphan")

class TaskAssignment(Base):
    __tablename__ = "task_assignments"
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), primary_key=True)
    user = relationship("User", back_populates="tasks_assigned")
    task = relationship("Task", back_populates="assignments")

class TaskComment(Base):
    __tablename__ = "task_comments"
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    task = relationship("Task", back_populates="comments")
    author = relationship("User", back_populates="comments")

class FileAttachment(Base):
    __tablename__ = "file_attachments"
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    task = relationship("Task", back_populates="attachments")