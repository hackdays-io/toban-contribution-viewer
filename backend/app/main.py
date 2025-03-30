from fastapi import FastAPI

from app.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    description=settings.PROJECT_DESCRIPTION,
    version=settings.PROJECT_VERSION,
)


@app.get("/")
async def root():
    return {"message": "Welcome to Toban Contribution Viewer API"}