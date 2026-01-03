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
