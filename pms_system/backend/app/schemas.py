from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class UserBase(BaseModel):
    username: str
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool
    role: str
    class Config:
        from_attributes = True

class FileAttachmentSchema(BaseModel):
    id: int
    filename: str
    class Config:
        from_attributes = True

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    priority: Optional[str] = "medium"
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    progress: Optional[float] = 0.0
    parent_id: Optional[int] = None
    actual_start_date: Optional[datetime] = None
    actual_end_date: Optional[datetime] = None
    remarks: Optional[str] = None

class TaskCreate(TaskBase):
    column_id: int

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    column_id: Optional[int] = None
    priority: Optional[str] = None
    progress: Optional[float] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    parent_id: Optional[int] = None
    actual_start_date: Optional[datetime] = None
    actual_end_date: Optional[datetime] = None
    remarks: Optional[str] = None

class TaskResponse(TaskBase):
    id: int
    project_id: int
    column_id: int
    created_at: datetime
    attachments: List[FileAttachmentSchema] = []
    class Config:
        from_attributes = True

class ColumnBase(BaseModel):
    name: str
    order_index: int

class ColumnCreate(ColumnBase):
    pass

class ColumnResponse(ColumnBase):
    id: int
    tasks: List[TaskResponse] = []
    class Config:
        from_attributes = True

class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None

class ProjectCreate(ProjectBase):
    pass

class ProjectResponse(ProjectBase):
    id: int
    owner_id: int
    created_at: datetime
    columns: List[ColumnResponse] = []
    class Config:
        from_attributes = True