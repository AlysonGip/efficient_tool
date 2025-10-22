// === 显示/隐藏季度输入 ===
const periodYear = document.getElementById('periodYear');
const periodQuarter = document.getElementById('periodQuarter');
const quarterFields = () => document.querySelectorAll('.quarter-only');

function updateQuarterVisibility() {
  const show = periodQuarter.checked;
  quarterFields().forEach(el => el.classList.toggle('hidden', !show));
}
periodYear.addEventListener('change', updateQuarterVisibility);
periodQuarter.addEventListener('change', updateQuarterVisibility);
updateQuarterVisibility();

// === 表单提交 ===
const form = document.getElementById('query-form');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const summaryEl = document.getElementById('summary');
const headEl = document.getElementById('table-head');
const bodyEl = document.getElementById('table-body');
const downloadEl = document.getElementById('download-link');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  statusEl.textContent = '正在查询...';
  resultEl.classList.add('hidden');

  // 取输入值
  const tushare = document.getElementById('tushareToken').value.trim();
  const openai  = document.getElementById('openaiKey').value.trim();
  const filename = document.getElementById('filename').value.trim();
  const symbolsRaw = document.getElementById('symbols').value.trim();
  const symbols = symbolsRaw.split(/[,，\s]+/).filter(Boolean).slice(0, 10);

  const period_type = periodQuarter.checked ? 'quarter' : 'year';
  const start_year = Number(document.getElementById('startYear').value);
  const end_year = Number(document.getElementById('endYear').value);

  const payload = {
    symbols,
    period_type,
    start_year,
    end_year,
  };

  if (period_type === 'quarter') {
    const sq = Number(document.getElementById('startQuarter').value || 1);
    const eq = Number(document.getElementById('endQuarter').value || 4);
    payload.start_quarter = sq;
    payload.end_quarter = eq;
  }
  if (filename) payload.filename = filename;

  // 请求头：把用户的 token 放进去（没有就不传）
  const headers = { 'Content-Type': 'application/json' };
  if (tushare) headers['X-Tushare-Token'] = tushare;
  if (openai)  headers['X-OpenAI-Key']    = openai;

  try {
    const resp = await fetch('/api/financials', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `请求失败：${resp.status}`);
    }

    const data = await resp.json();

    // ====== 下面根据你的接口返回形状做展示 ======
    // 1) GPT 总结（如果后端返回 summary）
    summaryEl.textContent = data.summary || '（无摘要）';

    // 2) 表格（如果后端返回 rows/columns）
    headEl.innerHTML = '';
    bodyEl.innerHTML = '';
    if (Array.isArray(data.columns)) {
      data.columns.forEach(col => {
        const th = document.createElement('th');
        th.className = 'px-3 py-2 text-left';
        th.textContent = col;
        headEl.appendChild(th);
      });
    }
    if (Array.isArray(data.rows)) {
      data.rows.forEach(row => {
        const tr = document.createElement('tr');
        row.forEach(cell => {
          const td = document.createElement('td');
          td.className = 'px-3 py-2 border-t border-slate-700';
          td.textContent = cell;
          tr.appendChild(td);
        });
        bodyEl.appendChild(tr);
      });
    }

    // 3) 下载链接（如果后端返回 file_url）
    if (data.file_url) {
      downloadEl.href = data.file_url;
      downloadEl.download = '';
      downloadEl.textContent = '下载 Excel';
      downloadEl.classList.remove('pointer-events-none', 'opacity-50');
    } else {
      downloadEl.removeAttribute('href');
      downloadEl.classList.add('pointer-events-none', 'opacity-50');
    }

    resultEl.classList.remove('hidden');
    statusEl.textContent = '✅ 完成';
  } catch (err) {
    console.error(err);
    statusEl.textContent = `❌ ${err.message}`;
  }
});