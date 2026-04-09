# Privacy Policy Archive（FastAPI + Vue3/Vite）

## 目录
- `backend/`：后端 API（FastAPI + SQLAlchemy）
- `frontend/`：前端站点与 Admin（Vue3 + Vite + Tailwind）

## 启动

### 1) 启动后端
```powershell
cd backend
.\.venv\Scripts\activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 2) 初始化样例数据（可重复执行）
```powershell
cd backend
$env:PYTHONPATH='.'
.\.venv\Scripts\python.exe scripts\seed_sample_data.py
```

### 3) 启动前端
```powershell
cd frontend
npm install
npm run dev
```

前端默认运行在 `http://127.0.0.1:3000`，并将 `/api` 代理到 `http://127.0.0.1:8000`。
