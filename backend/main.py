# backend/main.py  —— 可整份覆盖

from pathlib import Path
from uuid import uuid4
import os
from typing import Optional

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .schemas import QueryRequest, QueryResponse
from .services.tushare_client import fetch_financials
from .services.finance_metrics import build_financial_dataset
from .services.exporter import dataframe_to_excel
from .services.summary import summarize_financials

TEMP_DIR = Path("tmp_exports")
TEMP_DIR.mkdir(exist_ok=True)

app = FastAPI(title="AlysonG的行研工具（实习版）")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],  # 允许自定义请求头（X-Tushare-Token / X-OpenAI-Key）
    allow_credentials=True,
)

# 静态资源
app.mount("/assets", StaticFiles(directory="frontend/assets"), name="assets")


@app.get("/", include_in_schema=False)
async def index():
    index_path = Path("frontend/index.html")
    if not index_path.exists():
        raise HTTPException(status_code=500, detail="前端页面缺失")
    return FileResponse(index_path)


@app.post("/api/financials", response_model=QueryResponse)
async def get_financials(
    request: QueryRequest,
    # ⬇️ 新增：从 Header 读取用户自己的 token（别忘了 alias 保持大小写连字符）
    x_tushare_token: Optional[str] = Header(default=None, alias="X-Tushare-Token"),
    x_openai_key:   Optional[str] = Header(default=None, alias="X-OpenAI-Key"),
):
    # 0) 基本校验：必须要有 Tushare Token（按你业务需求调整）
    if not x_tushare_token:
        raise HTTPException(
            status_code=400, detail="请在请求头 X-Tushare-Token 中填写你的 Tushare Token")

    # 0.1) 兼容老代码：把 Header 写入环境变量，services 内部可继续用 os.getenv 读取
    os.environ["TUSHARE_TOKEN"] = x_tushare_token
    if x_openai_key:
        os.environ["OPENAI_API_KEY"] = x_openai_key

    # 1) 拉数 & 组表
    try:
        raw_frames = fetch_financials(request)
        dataframe = build_financial_dataset(raw_frames)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # 2) GPT 总结（失败也不中断）
    try:
        summary = await summarize_financials(dataframe, request)
    except Exception as exc:
        summary = f"GPT 总结失败：{exc}"

    # 3) 先写入临时文件，再按用户输入名重命名，拿到【最终文件名】
    temp_path = TEMP_DIR / f"report-{uuid4()}.xlsx"
    final_name = dataframe_to_excel(
        dataframe,
        temp_path,
        request.filename or ""   # 不带 .xlsx 也没关系，导出函数已做处理
    )

    # 4) 用最终文件名作为 download_token 回给前端
    return QueryResponse(
        summary=summary,
        table=dataframe.to_dict(orient="records"),
        columns=list(dataframe.columns),
        download_token=final_name,
    )


@app.get("/api/download/{token}")
async def download(token: str):
    # 这里 token 就是最终文件名（如 10.15.xlsx 或 10.15-1.xlsx）
    file_path = TEMP_DIR / token
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="文件不存在或已过期")

    # 直接把 token 作为浏览器保存名；如果你一定要加前缀，可以自行拼接
    return FileResponse(
        file_path,
        filename=token,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
