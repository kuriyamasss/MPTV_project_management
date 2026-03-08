from __future__ import annotations

import argparse
import logging

from sqlalchemy.orm import Session

from .database import SessionLocal
from .seed import seed_demo_data
from .settings import get_settings
from .storage import S3Storage


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed demo data")
    parser.add_argument("--with-storage", action="store_true", help="Upload demo attachments to S3")
    args = parser.parse_args()

    settings = get_settings()
    if settings.production:
        raise SystemExit("Seeding is disabled when APP_ENV=prod")

    storage = S3Storage(settings) if args.with_storage else None
    if storage:
        storage.ensure_bucket()

    with SessionLocal() as db:
        seed_demo_data(db, storage)
    logging.info("Seed completed")


if __name__ == "__main__":
    main()
