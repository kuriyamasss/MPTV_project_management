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
