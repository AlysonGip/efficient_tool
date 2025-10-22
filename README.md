# AlysonG的行研究工具（实习版）

基于 FastAPI + Tailwind 的财务数据查询网页。前端提供 Token、股票代码、时间区间输入，并支持下载 Excel 与 GPT 总结。

## 环境准备

1. 安装依赖：
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
2. 配置环境变量：
   ```bash
   export OPENAI_API_KEY=你的OpenAI密钥
   # 可选：更换模型
   export OPENAI_MODEL=gpt-4o-2024-05-13
   ```

## 启动

```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

前端静态页面已通过 FastAPI 挂载，访问 `http://localhost:8000/` 即可。

## 使用说明

- 在页面上输入个人的 Tushare Token（测试 Token：`11db2c7ff5a19c651cc46112995b51a346ac99748f31f824a75a120a`）。
- 股票代码以逗号分隔，最多 10 个。
- 支持按年份或按季度查询；按季度时需指定起止季度。
- 查询完成后，可查看 GPT 总结、指标表格，并下载 Excel 文件。

## 目录结构

```
backend/
  main.py
  schemas.py
  services/
    exporter.py
    finance_metrics.py
    summary.py
    tushare_client.py
frontend/
  index.html
  assets/
    main.js
requirements.txt
README.md
```

## 注意事项

- Excel 导出默认保存至 `tmp_exports/`，下载链接来自该目录。
- 若未配置 `OPENAI_API_KEY` 会在页面显示 GPT 总结失败的提示，但数据表仍可正常返回。
- 使用时请遵循 Tushare 数据使用规范及 OpenAI 的使用条款。
