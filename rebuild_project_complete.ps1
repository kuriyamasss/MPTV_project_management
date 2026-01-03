# ==========================================
# MPTV 项目管理系统 - 终极全量重构脚本
# ==========================================

# 1. 路径配置
$root = "pms_system";
$backend = "$root/backend";
$frontend = "$root/frontend";
$src = "$frontend/src";

# 2. 清理旧目录 (如果存在) - 可选，为了安全起见，这里只负责新建
# 如果 pms_system 已手动删除，这里会自动创建
New-Item -ItemType Directory -Force -Path $root | Out-Null
New-Item -ItemType Directory -Force -Path "$backend/app/routers" | Out-Null
New-Item -ItemType Directory -Force -Path "$src/components" | Out-Null
New-Item -ItemType Directory -Force -Path "$src/pages" | Out-Null
New-Item -ItemType Directory -Force -Path "$src/types" | Out-Null
New-Item -ItemType Directory -Force -Path "$src/lib" | Out-Null
New-Item -ItemType Directory -Force -Path "$src/store" | Out-Null

Write-Host "STARTING FULL PROJECT REBUILD..." -ForegroundColor Cyan;

# ==========================================
# PART 1: ROOT FILES (Docker & Env)
# ==========================================

# .env
@'
POSTGRES_USER=pms_user
POSTGRES_PASSWORD=pms_password_secure_123
POSTGRES_DB=pms_database
SECRET_KEY=generate_a_long_random_secret_string_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
'@ | Set-Content -Path "$root/.env" -Encoding UTF8;

# docker-compose.yml
@'
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    container_name: pms_db
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    networks:
      - pms_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: 
      context: ./backend
      dockerfile: Dockerfile
    container_name: pms_backend
    restart: always
    volumes:
      - ./backend/app:/app/app
    ports:
      - "8000:8000"
    environment:
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=${POSTGRES_DB}
      - DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
    depends_on:
      db:
        condition: service_healthy
    networks:
      - pms_network

  adminer:
    image: adminer
    container_name: pms_adminer
    restart: always
    ports:
      - "8080:8080"
    environment:
      ADMINER_DEFAULT_SERVER: db
    depends_on:
      - db
    networks:
      - pms_network

networks:
  pms_network:
    driver: bridge
'@ | Set-Content -Path "$root/docker-compose.yml" -Encoding UTF8;

Write-Host "[1/5] Root config files created." -ForegroundColor Cyan;

# ==========================================
# PART 2: BACKEND (FastAPI)
# ==========================================

# requirements.txt
@'
fastapi==0.109.0
uvicorn==0.27.0
sqlalchemy==2.0.25
psycopg2-binary==2.9.9
python-dotenv==1.0.0
pydantic==2.5.3
email-validator==2.1.0.post1
passlib[bcrypt]==1.7.4
python-jose[cryptography]==3.3.0
python-multipart==0.0.6
'@ | Set-Content -Path "$backend/requirements.txt" -Encoding UTF8;

# Dockerfile
@'
FROM python:3.10-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY ./app ./app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
'@ | Set-Content -Path "$backend/Dockerfile" -Encoding UTF8;

# app/__init__.py
"" | Set-Content -Path "$backend/app/__init__.py" -Encoding UTF8;

# app/database.py
@'
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    f"postgresql://{os.getenv('POSTGRES_USER')}:{os.getenv('POSTGRES_PASSWORD')}@db:5432/{os.getenv('POSTGRES_DB')}"
)

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
'@ | Set-Content -Path "$backend/app/database.py" -Encoding UTF8;

# app/models.py (UPDATED)
@'
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class User(Base):
    __tablename__ = 'users'
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
    __tablename__ = 'projects'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    owner_id = Column(Integer, ForeignKey('users.id'))
    created_at = Column(DateTime, default=datetime.utcnow)
    owner = relationship("User", back_populates="projects_owned")
    columns = relationship("ProjectColumn", back_populates="project", cascade="all, delete-orphan", order_by="ProjectColumn.order_index")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")

class ProjectColumn(Base):
    __tablename__ = 'project_columns'
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id'), nullable=False)
    name = Column(String(50), nullable=False)
    order_index = Column(Integer, default=0)
    project = relationship("Project", back_populates="columns")
    tasks = relationship("Task", back_populates="column")

class Task(Base):
    __tablename__ = 'tasks'
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id'), nullable=False)
    column_id = Column(Integer, ForeignKey('project_columns.id'), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(String(20), default="medium")
    
    # 计划时间
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    
    # 实际时间 (新增)
    actual_start_date = Column(DateTime, nullable=True)
    actual_end_date = Column(DateTime, nullable=True)
    
    progress = Column(Float, default=0.0)
    parent_id = Column(Integer, ForeignKey('tasks.id'), nullable=True)
    
    # 备注 (新增)
    remarks = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="tasks")
    column = relationship("ProjectColumn", back_populates="tasks")
    children = relationship("Task", backref='parent', remote_side=[id])
    assignments = relationship("TaskAssignment", back_populates="task", cascade="all, delete-orphan")
    attachments = relationship("FileAttachment", back_populates="task", cascade="all, delete-orphan")
    comments = relationship("TaskComment", back_populates="task", cascade="all, delete-orphan")

class TaskAssignment(Base):
    __tablename__ = 'task_assignments'
    user_id = Column(Integer, ForeignKey('users.id'), primary_key=True)
    task_id = Column(Integer, ForeignKey('tasks.id'), primary_key=True)
    user = relationship("User", back_populates="tasks_assigned")
    task = relationship("Task", back_populates="assignments")

class TaskComment(Base):
    __tablename__ = 'task_comments'
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey('tasks.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    task = relationship("Task", back_populates="comments")
    author = relationship("User", back_populates="comments")

class FileAttachment(Base):
    __tablename__ = 'file_attachments'
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey('tasks.id'), nullable=False)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    task = relationship("Task", back_populates="attachments")
'@ | Set-Content -Path "$backend/app/models.py" -Encoding UTF8;

# app/schemas.py (UPDATED)
@'
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
    # 新增字段支持
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
'@ | Set-Content -Path "$backend/app/schemas.py" -Encoding UTF8;

# app/auth.py
@'
from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import Optional
from jose import jwt
import os

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.getenv("SECRET_KEY", "fallback_secret_key_for_dev")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
'@ | Set-Content -Path "$backend/app/auth.py" -Encoding UTF8;

# app/crud.py
@'
from sqlalchemy.orm import Session
from . import models, schemas, auth

def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = auth.get_password_hash(user.password)
    db_user = models.User(username=user.username, email=user.email, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_projects(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.Project).filter(models.Project.owner_id == user_id).offset(skip).limit(limit).all()

def create_project(db: Session, project: schemas.ProjectCreate, user_id: int):
    db_project = models.Project(**project.model_dump(), owner_id=user_id)
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    
    default_columns = ["待办 (To Do)", "进行中 (In Progress)", "已完成 (Done)"]
    for index, name in enumerate(default_columns):
        db_col = models.ProjectColumn(project_id=db_project.id, name=name, order_index=index)
        db.add(db_col)
    
    db.commit()
    db.refresh(db_project)
    return db_project

def get_project_by_id(db: Session, project_id: int):
    return db.query(models.Project).filter(models.Project.id == project_id).first()

def create_task(db: Session, task: schemas.TaskCreate, project_id: int):
    db_task = models.Task(**task.model_dump(), project_id=project_id)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

def update_task(db: Session, task_id: int, task_update: schemas.TaskUpdate):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        return None
    
    update_data = task_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_task, key, value)
        
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task
'@ | Set-Content -Path "$backend/app/crud.py" -Encoding UTF8;

# app/routers/users.py
@'
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import Annotated
from .. import crud, models, schemas, auth, database
from jose import JWTError, jwt

router = APIRouter(tags=["users"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)], db: Session = Depends(database.get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        username: str = payload.get("sub")
        if username is None: raise credentials_exception
    except JWTError: raise credentials_exception
    user = crud.get_user_by_username(db, username=username)
    if user is None: raise credentials_exception
    return user

@router.post("/users/", response_model=schemas.UserResponse)
def register_user(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    db_user = crud.get_user_by_username(db, username=user.username)
    if db_user: raise HTTPException(status_code=400, detail="Username already registered")
    return crud.create_user(db=db, user=user)

@router.post("/token", response_model=schemas.Token)
def login_for_access_token(form_data: Annotated[OAuth2PasswordRequestForm, Depends()], db: Session = Depends(database.get_db)):
    user = crud.get_user_by_username(db, username=form_data.username)
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = auth.create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/users/me", response_model=schemas.UserResponse)
def read_users_me(current_user: Annotated[models.User, Depends(get_current_user)]):
    return current_user
'@ | Set-Content -Path "$backend/app/routers/users.py" -Encoding UTF8;

# app/routers/projects.py
@'
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import crud, schemas, database, models
from .users import get_current_user

router = APIRouter(prefix="/projects", tags=["projects"])

@router.post("/", response_model=schemas.ProjectResponse)
def create_project(project: schemas.ProjectCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    return crud.create_project(db=db, project=project, user_id=current_user.id)

@router.get("/", response_model=List[schemas.ProjectResponse])
def read_projects(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    return crud.get_projects(db, user_id=current_user.id, skip=skip, limit=limit)

@router.get("/{project_id}", response_model=schemas.ProjectResponse)
def read_project(project_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_project = crud.get_project_by_id(db, project_id=project_id)
    if db_project is None: raise HTTPException(status_code=404, detail="Project not found")
    return db_project

@router.post("/{project_id}/tasks/", response_model=schemas.TaskResponse)
def create_task_for_project(project_id: int, task: schemas.TaskCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    return crud.create_task(db=db, task=task, project_id=project_id)

@router.put("/tasks/{task_id}", response_model=schemas.TaskResponse)
def update_task_status(task_id: int, task_update: schemas.TaskUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    updated_task = crud.update_task(db=db, task_id=task_id, task_update=task_update)
    if not updated_task: raise HTTPException(status_code=404, detail="Task not found")
    return updated_task
'@ | Set-Content -Path "$backend/app/routers/projects.py" -Encoding UTF8;

# app/main.py
@'
from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from .database import engine, get_db
from . import models
from .routers import users, projects
import time
from sqlalchemy.exc import OperationalError
from fastapi.middleware.cors import CORSMiddleware

def wait_for_db():
    retries = 5
    while retries > 0:
        try:
            models.Base.metadata.create_all(bind=engine)
            print("Database connected and tables created!")
            return
        except OperationalError:
            print(f"Database not ready... retrying in 2 seconds ({retries} left)")
            retries -= 1
            time.sleep(2)
    print("Could not connect to database.")

wait_for_db()

app = FastAPI(title="Project Management System", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(projects.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to PMS Backend!", "status": "running"}

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(models.Base.metadata.tables['users'].select().limit(1))
        return {"db_status": "connected", "app_status": "healthy"}
    except Exception as e:
        return {"db_status": "error", "error": str(e)}
'@ | Set-Content -Path "$backend/app/main.py" -Encoding UTF8;

Write-Host "[2/5] Backend files created." -ForegroundColor Cyan;

# ==========================================
# PART 3: FRONTEND (Config & Lib)
# ==========================================

# package.json
@'
{
  "name": "pms-frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.1",
    "axios": "^1.6.5",
    "zustand": "^4.4.7",
    "antd": "^5.12.5",
    "@ant-design/icons": "^5.2.6",
    "@hello-pangea/dnd": "^16.5.0",
    "dayjs": "^1.11.10",
    "lucide-react": "^0.309.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.2.2",
    "vite": "^5.0.8"
  }
}
'@ | Set-Content -Path "$frontend/package.json" -Encoding UTF8;

# vite.config.ts
@'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
'@ | Set-Content -Path "$frontend/vite.config.ts" -Encoding UTF8;

# index.html
@'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MPTV PMS System</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
'@ | Set-Content -Path "$frontend/index.html" -Encoding UTF8;

# src/main.tsx
@'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import 'antd/dist/reset.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
'@ | Set-Content -Path "$src/main.tsx" -Encoding UTF8;

# src/types/index.ts
@'
export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
}

export interface FileAttachment {
  id: number;
  filename: string;
}

export interface Task {
  id: number;
  project_id: number;
  column_id: number;
  title: string;
  description?: string;
  priority: 'high' | 'medium' | 'low';
  start_date?: string;
  end_date?: string;
  progress: number;
  parent_id?: number;
  actual_start_date?: string;
  actual_end_date?: string;
  remarks?: string;
  attachments?: FileAttachment[];
  assignee_id?: number; 
}

export interface Column {
  id: number;
  name: string;
  order_index: number;
  tasks: Task[];
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  owner_id: number;
  created_at: string;
  columns: Column[];
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}
'@ | Set-Content -Path "$src/types/index.ts" -Encoding UTF8;

# src/lib/api.ts
@'
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export default api;
'@ | Set-Content -Path "$src/lib/api.ts" -Encoding UTF8;

# src/store/useAuthStore.ts
@'
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';

interface AuthState {
  token: string | null;
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      login: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: 'pms-auth-storage',
    }
  )
);
'@ | Set-Content -Path "$src/store/useAuthStore.ts" -Encoding UTF8;

Write-Host "[3/5] Frontend config & core libs created." -ForegroundColor Cyan;

# ==========================================
# PART 4: FRONTEND COMPONENTS & PAGES
# ==========================================

# src/components/TaskCard.tsx (Required by Kanban)
@'
import React from 'react';
import { Card, Tag, Typography, Avatar, Tooltip } from 'antd';
import { Draggable } from '@hello-pangea/dnd';
import { Task } from '../types';
import { UserOutlined, ClockCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;

interface TaskCardProps {
  task: Task;
  index: number;
}

const getPriorityColor = (p: string) => {
  switch (p) {
    case 'high': return 'red';
    case 'medium': return 'orange';
    case 'low': return 'green';
    default: return 'blue';
  }
};

const TaskCard: React.FC<TaskCardProps> = ({ task, index }) => {
  return (
    <Draggable draggableId={task.id.toString()} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={{
            marginBottom: 8,
            ...provided.draggableProps.style,
          }}
        >
          <Card 
            size="small" 
            hoverable
            style={{ 
              boxShadow: snapshot.isDragging ? '0 5px 10px rgba(0,0,0,0.2)' : '0 1px 2px rgba(0,0,0,0.1)',
              background: snapshot.isDragging ? '#e6f7ff' : '#fff'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Tag color={getPriorityColor(task.priority)} style={{ marginRight: 0 }}>
                {task.priority}
              </Tag>
              {task.end_date && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <ClockCircleOutlined /> {dayjs(task.end_date).format('MM-DD')}
                </Text>
              )}
            </div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              {task.title}
            </Text>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>ID: #{task.id}</Text>
              <Avatar.Group size="small" maxCount={2}>
                 <Tooltip title="Assigned User"><Avatar icon={<UserOutlined />} /></Tooltip>
              </Avatar.Group>
            </div>
          </Card>
        </div>
      )}
    </Draggable>
  );
};
export default TaskCard;
'@ | Set-Content -Path "$src/components/TaskCard.tsx" -Encoding UTF8;

# src/components/KanbanBoard.tsx
@'
import React from 'react';
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';
import { Project } from '../types';
import TaskCard from './TaskCard';
import api from '../lib/api';
import { message } from 'antd';

interface KanbanBoardProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project | null>>;
  onTaskMove?: (taskId: string, targetColId: string) => void; // Optional for generic use
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ project, setProject }) => {
  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newProject = { ...project };
    const sourceColIndex = newProject.columns.findIndex(c => c.id.toString() === source.droppableId);
    const destColIndex = newProject.columns.findIndex(c => c.id.toString() === destination.droppableId);
    
    const sourceCol = newProject.columns[sourceColIndex];
    const destCol = newProject.columns[destColIndex];
    const sourceTasks = [...sourceCol.tasks];
    const destTasks = source.droppableId === destination.droppableId ? sourceTasks : [...destCol.tasks];

    const [movedTask] = sourceTasks.splice(source.index, 1);
    destTasks.splice(destination.index, 0, movedTask);

    newProject.columns[sourceColIndex] = { ...sourceCol, tasks: sourceTasks };
    if (source.droppableId !== destination.droppableId) {
       newProject.columns[destColIndex] = { ...destCol, tasks: destTasks };
       movedTask.column_id = parseInt(destination.droppableId);
    }
    setProject(newProject);

    try {
      await api.put(`/projects/tasks/${draggableId}`, {
        column_id: parseInt(destination.droppableId),
      });
    } catch (error) {
      message.error('移动任务失败');
      console.error(error);
    }
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16, height: '100%' }}>
        {project.columns.map((column) => (
          <div key={column.id} style={{ minWidth: 280, width: 280, display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: '#f4f5f7', padding: '10px 12px', borderRadius: '8px 8px 0 0', fontWeight: 600, borderBottom: '2px solid #e0e0e0' }}>
              {column.name} <span style={{color: '#888', fontWeight: 400}}>({column.tasks.length})</span>
            </div>
            <Droppable droppableId={column.id.toString()}>
              {(provided, snapshot) => (
                <div {...provided.droppableProps} ref={provided.innerRef} style={{ background: snapshot.isDraggingOver ? '#e6f7ff' : '#f4f5f7', padding: 8, flexGrow: 1, minHeight: 100, borderRadius: '0 0 8px 8px' }}>
                  {column.tasks.map((task, index) => (
                    <TaskCard key={task.id} task={task} index={index} />
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
};
export default KanbanBoard;
'@ | Set-Content -Path "$src/components/KanbanBoard.tsx" -Encoding UTF8;

# src/components/GanttView.tsx
@'
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, User, Clock } from 'lucide-react';
import { Project, Task } from '../types';
import api from '../lib/api';
import { message, Empty } from 'antd';

interface GanttViewProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project | null>>;
}

const buildTaskTree = (tasks: Task[]) => {
  const taskMap = new Map<number, Task & { children: any[], level: number }>();
  const roots: any[] = [];
  tasks.forEach(t => taskMap.set(t.id, { ...t, children: [], level: 0 }));
  tasks.forEach(t => {
    const node = taskMap.get(t.id)!;
    if (t.parent_id && taskMap.has(t.parent_id)) {
      const parent = taskMap.get(t.parent_id)!;
      node.level = parent.level + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const flattened: any[] = [];
  const traverse = (nodes: any[]) => {
    nodes.forEach(node => {
      flattened.push(node);
      if (node.children.length > 0) traverse(node.children);
    });
  };
  traverse(roots);
  return flattened;
};

const GanttView: React.FC<GanttViewProps> = ({ project, setProject }) => {
  const [zoomLevel, setZoomLevel] = useState<'day' | 'week' | 'month'>('day');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [dragState, setDragState] = useState<{
    taskId: number;
    type: 'move' | 'resize-left' | 'resize-right';
    startX: number;
    originalStart: string;
    originalEnd: string;
  } | null>(null);

  useEffect(() => {
    const allTasks = project.columns.flatMap(c => c.tasks);
    const parents = new Set(allTasks.filter(t => t.parent_id).map(t => t.parent_id!));
    setExpandedIds(parents);
  }, [project.id]);

  const toggleExpand = (id: number) => { 
    const newSet = new Set(expandedIds); 
    newSet.has(id) ? newSet.delete(id) : newSet.add(id); 
    setExpandedIds(newSet); 
  };

  const tasks = useMemo(() => {
    const rawTasks = project.columns.flatMap(c => c.tasks)
      .filter(t => t.start_date && t.end_date);
    return buildTaskTree(rawTasks);
  }, [project]);

  const visibleTasks = tasks.filter((t: any) => !t.parent_id || expandedIds.has(t.parent_id));

  const minDateStr = tasks.length > 0 
    ? tasks.reduce((min: string, t: any) => t.start_date < min ? t.start_date : min, tasks[0].start_date || '') 
    : new Date().toISOString().split('T')[0];
  const minDate = new Date(minDateStr); 
  minDate.setDate(minDate.getDate() - 5);

  const config = useMemo(() => {
    switch(zoomLevel) {
      case 'week': return { colWidth: 20, cols: 90, dayStep: 1, labelStep: 7 }; 
      case 'month': return { colWidth: 10, cols: 120, dayStep: 1, labelStep: 30 }; 
      case 'day': default: return { colWidth: 40, cols: 45, dayStep: 1, labelStep: 1 };
    }
  }, [zoomLevel]);

  const days = Array.from({ length: config.cols }, (_, i) => { 
    const d = new Date(minDate); 
    d.setDate(d.getDate() + i * config.dayStep); 
    return d; 
  });

  const getOffsetPixels = (dateStr: string) => { 
    const d = new Date(dateStr); 
    const diffDays = (d.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24); 
    return diffDays * config.colWidth; 
  };
  const getWidthPixels = (startStr: string, endStr: string) => { 
    const start = new Date(startStr); 
    const end = new Date(endStr); 
    const diffDays = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24) + 1); 
    return diffDays * config.colWidth; 
  };
  const addDays = (dateStr: string, days: number) => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString();
  };

  const updateTaskData = async (taskId: number, updates: Partial<Task>) => {
    const newProject = { ...project };
    let taskFound = false;
    newProject.columns.forEach(col => {
      const t = col.tasks.find(t => t.id === taskId);
      if (t) {
        Object.assign(t, updates);
        taskFound = true;
      }
    });
    if (taskFound) setProject(newProject);
    try {
        await api.put(`/projects/tasks/${taskId}`, updates);
    } catch (e) {
        console.error(e);
        message.error('保存失败');
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState) return;
      e.preventDefault();
      const deltaX = e.clientX - dragState.startX;
      const deltaDays = Math.round(deltaX / config.colWidth);
      if (deltaDays === 0) return;

      if (dragState.type === 'move') {
        updateTaskData(dragState.taskId, {
            actual_start_date: addDays(dragState.originalStart, deltaDays),
            actual_end_date: addDays(dragState.originalEnd, deltaDays)
        });
      } else if (dragState.type === 'resize-left') {
        const newStart = addDays(dragState.originalStart, deltaDays);
        if (new Date(newStart) < new Date(dragState.originalEnd)) {
            updateTaskData(dragState.taskId, { actual_start_date: newStart });
        }
      } else if (dragState.type === 'resize-right') {
        const newEnd = addDays(dragState.originalEnd, deltaDays);
        if (new Date(newEnd) > new Date(dragState.originalStart)) {
            updateTaskData(dragState.taskId, { actual_end_date: newEnd });
        }
      }
    };
    const handleMouseUp = () => setDragState(null);

    if (dragState) {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, config]);

  const handleDragStart = (e: React.MouseEvent, task: Task, type: 'move' | 'resize-left' | 'resize-right') => {
    e.stopPropagation(); e.preventDefault();
    if (!task.actual_start_date || !task.actual_end_date) return;
    setDragState({
      taskId: task.id,
      type,
      startX: e.clientX,
      originalStart: task.actual_start_date,
      originalEnd: task.actual_end_date
    });
  };

  if (tasks.length === 0) return <Empty description="暂无带时间的任务" style={{marginTop: 50}} />;

  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb' }}>
        <div style={{ display: 'flex', gap: 16, fontSize: 14, color: '#4b5563' }}>
            <div style={{display:'flex', alignItems:'center', gap:4}}><span style={{width:12, height:12, background:'#e5e7eb', border:'1px solid #d1d5db', borderRadius:2}}></span> 计划时间</div>
            <div style={{display:'flex', alignItems:'center', gap:4}}><span style={{width:12, height:12, background:'#3b82f6', borderRadius:2}}></span> 实际进度 (可拖拽)</div>
        </div>
        <div style={{ display: 'flex', border: '1px solid #d1d5db', borderRadius: 6, overflow: 'hidden' }}>
            {['day', 'week', 'month'].map(mode => (
                <button key={mode} onClick={() => setZoomLevel(mode as any)} 
                    style={{ padding: '4px 12px', fontSize: 12, cursor: 'pointer', background: zoomLevel===mode ? '#eff6ff' : '#fff', color: zoomLevel===mode ? '#2563eb' : '#6b7280', border: 'none', borderRight: '1px solid #d1d5db' }}>
                    {mode === 'day' ? '日' : mode === 'week' ? '周' : '月'}
                </button>
            ))}
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: 250, borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ height: 40, borderBottom: '1px solid #e5e7eb', background: '#f9fafb', display: 'flex', alignItems: 'center', padding: '0 16px', fontWeight: 'bold', fontSize: 12, color: '#6b7280' }}>任务名称</div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
                {visibleTasks.map((task: any) => (
                    <div key={task.id} style={{ height: 48, display: 'flex', alignItems: 'center', padding: '0 16px', paddingLeft: 16 + task.level * 16, fontSize: 14, borderBottom: '1px solid transparent', cursor: 'pointer' }}
                         className="hover:bg-gray-50">
                        <button onClick={(e) => { e.stopPropagation(); toggleExpand(task.id); }} 
                            style={{ marginRight: 4, border: 'none', background: 'transparent', cursor: 'pointer', visibility: task.children.length ? 'visible' : 'hidden' }}>
                            {expandedIds.has(task.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</span>
                    </div>
                ))}
            </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
            <div style={{ height: 40, display: 'flex', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', position: 'sticky', top: 0, zIndex: 10, width: 'max-content' }}>
                {days.map((day, i) => (
                    <div key={i} style={{ width: config.colWidth, flexShrink: 0, textAlign: 'center', borderRight: '1px solid #e5e7eb', paddingTop: 8, fontSize: 12, color: '#6b7280' }}>
                        {i % config.labelStep === 0 && (zoomLevel === 'month' ? `${day.getMonth()+1}月` : day.getDate())}
                    </div>
                ))}
            </div>
            <div style={{ width: 'max-content', paddingTop: 8 }}>
                {visibleTasks.map((task: any) => {
                    const planLeft = getOffsetPixels(task.start_date);
                    const planWidth = getWidthPixels(task.start_date, task.end_date);
                    let actLeft = 0, actWidth = 0;
                    if (task.actual_start_date) {
                        actLeft = getOffsetPixels(task.actual_start_date);
                        actWidth = getWidthPixels(task.actual_start_date, task.actual_end_date || new Date().toISOString());
                    }
                    return (
                        <div key={task.id} style={{ height: 48, position: 'relative', borderBottom: '1px solid #f3f4f6', width: '100%' }}>
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none' }}>
                                {days.map((_, i) => <div key={i} style={{ width: config.colWidth, borderRight: '1px solid #f3f4f6', height: '100%' }}></div>)}
                            </div>
                            <div style={{ position: 'absolute', top: 8, height: 32, background: 'rgba(229, 231, 235, 0.5)', border: '1px solid #d1d5db', borderRadius: 4, left: planLeft, width: planWidth }}></div>
                            {task.actual_start_date && (
                                <div onMouseDown={(e) => handleDragStart(e, task, 'move')}
                                     style={{ 
                                        position: 'absolute', top: 16, height: 16, 
                                        left: actLeft, width: Math.max(actWidth, 4), 
                                        background: task.progress === 100 ? '#22c55e' : '#3b82f6', 
                                        borderRadius: 2, cursor: 'grab', zIndex: 5,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff'
                                     }}>
                                    {actWidth > 30 && `${task.progress}%`}
                                    <div style={{ position: 'absolute', left: 0, width: 4, height: '100%', cursor: 'ew-resize' }} 
                                         onMouseDown={(e) => handleDragStart(e, task, 'resize-left')}></div>
                                    <div style={{ position: 'absolute', right: 0, width: 4, height: '100%', cursor: 'ew-resize' }} 
                                         onMouseDown={(e) => handleDragStart(e, task, 'resize-right')}></div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
      </div>
    </div>
  );
};
export default GanttView;
'@ | Set-Content -Path "$src/components/GanttView.tsx" -Encoding UTF8;

# src/components/TableView.tsx
@'
import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Project, Task } from '../types';
import api from '../lib/api';
import { message } from 'antd';

interface TableViewProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project | null>>;
}

const buildTaskTree = (tasks: Task[]) => {
  const taskMap = new Map<number, Task & { children: any[], level: number }>();
  const roots: any[] = [];
  tasks.forEach(t => taskMap.set(t.id, { ...t, children: [], level: 0 }));
  tasks.forEach(t => {
    const node = taskMap.get(t.id)!;
    if (t.parent_id && taskMap.has(t.parent_id)) {
      const parent = taskMap.get(t.parent_id)!;
      node.level = parent.level + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const flattened: any[] = [];
  const traverse = (nodes: any[]) => {
    nodes.forEach(node => {
      flattened.push(node);
      if (node.children.length > 0) traverse(node.children);
    });
  };
  traverse(roots);
  return flattened;
};

const TableView: React.FC<TableViewProps> = ({ project, setProject }) => {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const tasks = useMemo(() => {
    const allTasks = project.columns.flatMap(c => c.tasks);
    return buildTaskTree(allTasks);
  }, [project]);
  const toggleExpand = (id: number) => { 
    const newSet = new Set(expandedIds); 
    newSet.has(id) ? newSet.delete(id) : newSet.add(id); 
    setExpandedIds(newSet); 
  };
  const updateTask = async (id: number, field: keyof Task, value: any) => {
    const newProject = { ...project };
    newProject.columns.forEach(col => {
        const t = col.tasks.find(t => t.id === id);
        if (t) (t as any)[field] = value;
    });
    setProject(newProject);
    try {
        await api.put(`/projects/tasks/${id}`, { [field]: value });
    } catch {
        message.error('保存失败');
    }
  };
  const isRowVisible = (task: any) => !task.parent_id || expandedIds.has(task.parent_id);

  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ overflow: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead style={{ background: '#f9fafb', position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', minWidth: 200 }}>任务名称</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', width: 130 }}>预计开始</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', width: 130 }}>预计结束</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', width: 130, color: '#2563eb' }}>实际开始</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', width: 130, color: '#2563eb' }}>实际结束</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', width: 200 }}>备注</th>
                </tr>
            </thead>
            <tbody>
                {tasks.map((task: any) => {
                    if (!isRowVisible(task)) return null;
                    return (
                        <tr key={task.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '8px 12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', paddingLeft: task.level * 20 }}>
                                    <button onClick={() => toggleExpand(task.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', marginRight: 4, visibility: task.children.length ? 'visible' : 'hidden' }}>
                                        {expandedIds.has(task.id) ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                                    </button>
                                    {task.title}
                                </div>
                            </td>
                            <td style={{ padding: 8 }}><input type="date" value={task.start_date ? task.start_date.split('T')[0] : ''} onChange={(e) => updateTask(task.id, 'start_date', e.target.value ? new Date(e.target.value).toISOString() : null)} style={{ border: '1px solid #e5e7eb', borderRadius: 4, padding: '4px 8px', width: '100%' }} /></td>
                            <td style={{ padding: 8 }}><input type="date" value={task.end_date ? task.end_date.split('T')[0] : ''} onChange={(e) => updateTask(task.id, 'end_date', e.target.value ? new Date(e.target.value).toISOString() : null)} style={{ border: '1px solid #e5e7eb', borderRadius: 4, padding: '4px 8px', width: '100%' }} /></td>
                            <td style={{ padding: 8, background: '#eff6ff' }}><input type="date" value={task.actual_start_date ? task.actual_start_date.split('T')[0] : ''} onChange={(e) => updateTask(task.id, 'actual_start_date', e.target.value ? new Date(e.target.value).toISOString() : null)} style={{ border: '1px solid #bfdbfe', borderRadius: 4, padding: '4px 8px', width: '100%' }} /></td>
                            <td style={{ padding: 8, background: '#eff6ff' }}><input type="date" value={task.actual_end_date ? task.actual_end_date.split('T')[0] : ''} onChange={(e) => updateTask(task.id, 'actual_end_date', e.target.value ? new Date(e.target.value).toISOString() : null)} style={{ border: '1px solid #bfdbfe', borderRadius: 4, padding: '4px 8px', width: '100%' }} /></td>
                            <td style={{ padding: 8 }}><input type="text" value={task.remarks || ''} onChange={(e) => updateTask(task.id, 'remarks', e.target.value)} placeholder="..." style={{ border: 'none', width: '100%', background: 'transparent' }} /></td>
                        </tr>
                    )
                })}
            </tbody>
        </table>
      </div>
    </div>
  );
};
export default TableView;
'@ | Set-Content -Path "$src/components/TableView.tsx" -Encoding UTF8;

# src/pages/ProjectBoard.tsx
@'
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout, Button, Spin, Breadcrumb, message, Modal, Form, Input, Select, DatePicker, Segmented } from 'antd';
import { ArrowLeftOutlined, PlusOutlined, AppstoreOutlined, BarsOutlined, TableOutlined } from '@ant-design/icons';
import api from '../lib/api';
import { Project } from '../types';
import KanbanBoard from '../components/KanbanBoard';
import GanttView from '../components/GanttView';
import TableView from '../components/TableView';

const { Content, Header } = Layout;
const { Option } = Select;

const ProjectBoard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'gantt' | 'table'>('kanban');
  const [form] = Form.useForm();

  const fetchProject = async () => {
    try {
      const res = await api.get(`/projects/${id}`);
      setProject(res.data);
    } catch (error) {
      message.error('获取项目详情失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProject();
  }, [id]);

  const handleCreateTask = async (values: any) => {
    if (!project) return;
    try {
      const firstColumnId = project.columns[0].id;
      await api.post(`/projects/${project.id}/tasks/`, {
        ...values,
        column_id: firstColumnId,
        start_date: values.start_date ? values.start_date.toISOString() : null,
        end_date: values.end_date ? values.end_date.toISOString() : null,
      });
      message.success('任务创建成功');
      setIsModalOpen(false);
      form.resetFields();
      fetchProject();
    } catch (error) {
      message.error('创建失败');
    }
  };

  if (loading) return <div style={{textAlign: 'center', marginTop: 50}}><Spin size="large" /></div>;
  if (!project) return <div>项目不存在</div>;

  return (
    <Layout style={{ height: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} />
          <Breadcrumb items={[{ title: 'Dashboard' }, { title: project.name }]} />
        </div>
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          <Segmented
            options={[
              { label: '看板', value: 'kanban', icon: <AppstoreOutlined /> },
              { label: '甘特图', value: 'gantt', icon: <BarsOutlined /> },
              { label: '表格', value: 'table', icon: <TableOutlined /> },
            ]}
            value={viewMode}
            onChange={(value) => setViewMode(value as any)}
          />
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
          新建任务
        </Button>
      </Header>
      <Content style={{ padding: '24px', overflow: 'hidden' }}>
        {viewMode === 'kanban' && <KanbanBoard project={project} setProject={setProject} />}
        {viewMode === 'gantt' && <GanttView project={project} setProject={setProject} />}
        {viewMode === 'table' && <TableView project={project} setProject={setProject} />}
      </Content>
      <Modal title="新建任务" open={isModalOpen} onCancel={() => setIsModalOpen(false)} onOk={form.submit}>
        <Form form={form} layout="vertical" onFinish={handleCreateTask}>
          <Form.Item name="title" label="任务标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea />
          </Form.Item>
          <Form.Item name="priority" label="优先级" initialValue="medium">
            <Select>
              <Option value="high">High</Option>
              <Option value="medium">Medium</Option>
              <Option value="low">Low</Option>
            </Select>
          </Form.Item>
          <Form.Item name="start_date" label="计划开始">
             <DatePicker showTime style={{width: '100%'}} />
          </Form.Item>
          <Form.Item name="end_date" label="计划截止">
             <DatePicker showTime style={{width: '100%'}} />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};
export default ProjectBoard;
'@ | Set-Content -Path "$src/pages/ProjectBoard.tsx" -Encoding UTF8;

# src/pages/Dashboard.tsx
@'
import React, { useEffect, useState } from 'react';
import { Layout, Card, Button, Row, Col, Typography, Modal, Form, Input, message, Empty, Segmented } from 'antd';
import { PlusOutlined, ProjectOutlined, LogoutOutlined, AppstoreOutlined, BarsOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { Project } from '../types';

const { Header, Content } = Layout;
const { Title, Paragraph } = Typography;

const Dashboard: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [form] = Form.useForm();

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects/');
      setProjects(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async (values: any) => {
    try {
      await api.post('/projects/', values);
      message.success('项目创建成功');
      setIsModalOpen(false);
      form.resetFields();
      fetchProjects();
    } catch (error) {
      message.error('创建失败');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px #f0f1f2' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ProjectOutlined style={{ fontSize: 24, color: '#1890ff' }} />
          <Title level={4} style={{ margin: 0 }}>PMS Console</Title>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span>欢迎, {user?.username}</span>
          <Button icon={<LogoutOutlined />} onClick={handleLogout} danger type="text">退出</Button>
        </div>
      </Header>
      
      <Content style={{ padding: '24px 50px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginBottom: 24 }}>
          <div>
            <Title level={3}>我的项目</Title>
            <Segmented 
              options={[
                { label: '卡片', value: 'grid', icon: <AppstoreOutlined /> },
                { label: '列表', value: 'list', icon: <BarsOutlined /> }
              ]}
              value={viewMode}
              onChange={(v) => setViewMode(v as 'grid'|'list')}
            />
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
            新建项目
          </Button>
        </div>

        {projects.length === 0 ? (
          <Empty description="暂无项目，快去创建一个吧！" />
        ) : (
          viewMode === 'grid' ? (
            <Row gutter={[16, 16]}>
              {projects.map(project => (
                <Col xs={24} sm={12} md={8} lg={6} key={project.id}>
                  <Card 
                    hoverable 
                    title={project.name}
                    extra={<Button type="link" size="small" onClick={() => navigate(`/project/${project.id}`)}>进入</Button>}
                    onClick={() => navigate(`/project/${project.id}`)}
                  >
                    <Paragraph ellipsis={{ rows: 2 }}>{project.description || '暂无描述'}</Paragraph>
                    <div style={{ marginTop: 12, color: '#888', fontSize: 12 }}>
                      创建于: {new Date(project.created_at).toLocaleDateString()}
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          ) : (
            <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #f0f0f0' }}>
               {projects.map(project => (
                 <div key={project.id} 
                      onClick={() => navigate(`/project/${project.id}`)}
                      style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                      className="hover:bg-gray-50"
                 >
                    <div>
                        <div style={{ fontWeight: 'bold', fontSize: 16 }}>{project.name}</div>
                        <div style={{ color: '#666', fontSize: 14 }}>{project.description || '无描述'}</div>
                    </div>
                    <div style={{ color: '#999', fontSize: 12 }}>
                        更新于 {new Date(project.created_at).toLocaleDateString()}
                    </div>
                 </div>
               ))}
            </div>
          )
        )}
      </Content>

      <Modal title="创建新项目" open={isModalOpen} onCancel={() => setIsModalOpen(false)} onOk={form.submit}>
        <Form form={form} layout="vertical" onFinish={handleCreateProject}>
          <Form.Item name="name" label="项目名称" rules={[{ required: true }]}>
            <Input placeholder="例如: 2024年度计划" />
          </Form.Item>
          <Form.Item name="description" label="项目描述">
            <Input.TextArea placeholder="简单描述一下项目的目标..." />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};

export default Dashboard;
'@ | Set-Content -Path "$src/pages/Dashboard.tsx" -Encoding UTF8;

# src/pages/Login.tsx
@'
import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import api from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append('username', values.username);
      formData.append('password', values.password);

      const tokenRes = await api.post('/token', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      const token = tokenRes.data.access_token;
      const userRes = await api.get('/users/me', {
        headers: { Authorization: `Bearer ${token}` }
      });

      login(token, userRes.data);
      message.success('登录成功');
      navigate('/');
      
    } catch (error: any) {
      console.error(error);
      message.error(error.response?.data?.detail || '登录失败，请检查用户名或密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f0f2f5' }}>
      <Card style={{ width: 350, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3}>MPTV 项目管理系统</Title>
        </div>
        <Form name="login" onFinish={onFinish}>
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名!' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" size="large" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码!' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              登录
            </Button>
          </Form.Item>
          <div style={{ textAlign: 'center' }}>
             <Button type="link" onClick={() => message.info('注册功能请联系管理员')}>还没有账号？</Button>
          </div>
        </Form>
      </Card>
    </div>
  );
};
export default Login;
'@ | Set-Content -Path "$src/pages/Login.tsx" -Encoding UTF8;

# src/App.tsx
@'
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ProjectBoard from './pages/ProjectBoard';

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const token = useAuthStore((state) => state.token);
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        
        <Route path="/project/:id" element={
          <ProtectedRoute>
            <ProjectBoard />
          </ProtectedRoute>
        } />

      </Routes>
    </BrowserRouter>
  );
};

export default App;
'@ | Set-Content -Path "$src/App.tsx" -Encoding UTF8;

Write-Host "[4/5] Frontend components & pages created." -ForegroundColor Cyan;

Write-Host "--------------------------------------------------------" -ForegroundColor Green;
Write-Host "SUCCESS! Project has been fully regenerated." -ForegroundColor Green;
Write-Host "NEXT STEPS:" -ForegroundColor Yellow;
Write-Host "1. cd pms_system" -ForegroundColor Yellow;
Write-Host "2. docker-compose up -d --build" -ForegroundColor Yellow;
Write-Host "--------------------------------------------------------" -ForegroundColor Green;