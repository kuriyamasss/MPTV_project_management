from __future__ import annotations

from datetime import date, timedelta


def register_and_login(
    client,
    *,
    username: str,
    email: str,
    password: str = "123456",
) -> str:
    register_res = client.post(
        "/users",
        json={"username": username, "email": email, "password": password},
    )
    assert register_res.status_code == 201, register_res.text

    token_res = client.post(
        "/token",
        data={"username": username, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert token_res.status_code == 200, token_res.text
    return token_res.json()["access_token"]


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def create_project(client, token: str, name: str = "Smoke Project") -> int:
    response = client.post(
        "/projects",
        json={"name": name, "description": "Smoke project"},
        headers=auth_headers(token),
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def first_column_id(project_detail: dict) -> int:
    columns = project_detail["columns"]
    assert columns
    return columns[0]["id"]


def test_auth_flow_register_login_get_me(client) -> None:
    token = register_and_login(client, username="alice", email="alice@example.com")
    me_res = client.get("/users/me", headers=auth_headers(token))
    assert me_res.status_code == 200, me_res.text
    assert me_res.json()["username"] == "alice"


def test_project_task_crud_smoke(client) -> None:
    token = register_and_login(client, username="bob", email="bob@example.com")
    project_id = create_project(client, token, name="Task CRUD Project")

    detail_res = client.get(f"/projects/{project_id}", headers=auth_headers(token))
    assert detail_res.status_code == 200, detail_res.text
    column_id = first_column_id(detail_res.json())

    create_task_res = client.post(
        f"/projects/{project_id}/tasks",
        json={
            "column_id": column_id,
            "title": "Task A",
            "description": "Smoke task",
            "priority": "medium",
            "progress": 0,
            "remarks": "",
        },
        headers=auth_headers(token),
    )
    assert create_task_res.status_code == 201, create_task_res.text
    task_id = create_task_res.json()["id"]

    patch_res = client.patch(
        f"/tasks/{task_id}",
        json={"progress": 65, "remarks": "updated"},
        headers=auth_headers(token),
    )
    assert patch_res.status_code == 200, patch_res.text
    assert patch_res.json()["progress"] == 65

    delete_res = client.delete(f"/tasks/{task_id}", headers=auth_headers(token))
    assert delete_res.status_code == 200, delete_res.text
    assert delete_res.json()["ok"] is True


def test_attachment_upload_download_url_delete_smoke(client) -> None:
    token = register_and_login(client, username="carol", email="carol@example.com")
    project_id = create_project(client, token, name="Attachment Project")

    detail_res = client.get(f"/projects/{project_id}", headers=auth_headers(token))
    column_id = first_column_id(detail_res.json())

    create_task_res = client.post(
        f"/projects/{project_id}/tasks",
        json={
            "column_id": column_id,
            "title": "Task With File",
            "description": "",
            "priority": "low",
            "progress": 0,
            "remarks": "",
        },
        headers=auth_headers(token),
    )
    task_id = create_task_res.json()["id"]

    upload_res = client.post(
        f"/tasks/{task_id}/attachments",
        files={"file": ("demo.txt", b"hello smoke", "text/plain")},
        headers=auth_headers(token),
    )
    assert upload_res.status_code == 201, upload_res.text
    attachment_id = upload_res.json()["id"]

    url_res = client.get(
        f"/files/{attachment_id}/download-url", headers=auth_headers(token)
    )
    assert url_res.status_code == 200, url_res.text
    payload = url_res.json()
    assert payload["url"].startswith("https://files.example/")
    assert "expires_at" in payload

    delete_res = client.delete(
        f"/tasks/{task_id}/attachments/{attachment_id}",
        headers=auth_headers(token),
    )
    assert delete_res.status_code == 200, delete_res.text


def test_weekly_report_smoke(client) -> None:
    token = register_and_login(client, username="dave", email="dave@example.com")
    project_id = create_project(client, token, name="Weekly Report Project")
    detail_res = client.get(f"/projects/{project_id}", headers=auth_headers(token))
    column_id = first_column_id(detail_res.json())

    client.post(
        f"/projects/{project_id}/tasks",
        json={
            "column_id": column_id,
            "title": "Weekly Task",
            "description": "",
            "priority": "high",
            "progress": 20,
            "remarks": "",
        },
        headers=auth_headers(token),
    )

    end_date = date.today()
    start_date = end_date - timedelta(days=7)
    report_res = client.post(
        "/reports/weekly",
        json={
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "project_ids": [project_id],
        },
        headers=auth_headers(token),
    )
    assert report_res.status_code == 200, report_res.text
    report = report_res.json()
    assert "request_id" in report
    assert report["projects"][0]["project_id"] == project_id


def test_unauthorized_and_forbidden_access(client) -> None:
    no_auth_res = client.get("/projects")
    assert no_auth_res.status_code == 401
    assert "error" in no_auth_res.json()

    owner_token = register_and_login(
        client, username="owner", email="owner@example.com"
    )
    attacker_token = register_and_login(
        client, username="attacker", email="attacker@example.com"
    )

    project_id = create_project(client, owner_token, name="Private Project")
    other_access = client.get(
        f"/projects/{project_id}", headers=auth_headers(attacker_token)
    )
    assert other_access.status_code == 404
    assert other_access.json()["error"]["code"] == "project_not_found"


def test_cors_whitelist_behavior(client) -> None:
    allowed = client.options(
        "/projects",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert allowed.status_code in (200, 204)
    assert allowed.headers.get("access-control-allow-origin") == "http://localhost:5173"

    blocked = client.options(
        "/projects",
        headers={
            "Origin": "http://evil.local",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert blocked.headers.get("access-control-allow-origin") is None
