@echo off
setlocal
uv run python manage.py migrate
endlocal

