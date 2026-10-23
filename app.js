const API_BASE = 'https://ap013-baker-journal.onrender.com';

const state = {
  recipes: [],
  logs: [],
  activeView: 'recipes',
  selectedRecipeId: null,
  recipeSearch: '',
  category: 'all',
  difficulty: 'all',
  logSearch: '',
  result: 'all',
  loading: true,
  errors: { recipes: null, logs: null },
  lastUpdated: null,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const formatDate = (value, options = { day: '2-digit', month: 'short', year: 'numeric' }) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', options).format(date);
};

const formatShortDate = (value) => {
  if (!value) return { day: '—', month: '—', year: '' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { day: '—', month: '—', year: '' };
  return {
    day: new Intl.DateTimeFormat('vi-VN', { day: '2-digit' }).format(date),
    month: new Intl.DateTimeFormat('vi-VN', { month: 'short' }).format(date).replace('.', ''),
    year: new Intl.DateTimeFormat('vi-VN', { year: 'numeric' }).format(date),
  };
};

const formatDuration = (minutes) => {
  const value = Number(minutes);
  if (!Number.isFinite(value)) return '—';
  if (value < 60) return `${value} phút`;
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  return mins ? `${hours}g ${mins}p` : `${hours} giờ`;
};

const difficultyLabel = (difficulty) => {
  const labels = { 1: 'Dễ', 2: 'Nhẹ nhàng', 3: 'Vừa sức', 4: 'Thử thách', 5: 'Chuyên nghiệp' };
  return labels[Number(difficulty)] || 'Chưa rõ';
};

const stars = (rating = 0) => {
  const rounded = Math.min(5, Math.max(0, Number(rating) || 0));
  return `${'★'.repeat(rounded)}${'☆'.repeat(5 - rounded)}`;
};

const getRecipeName = (recipeId) => state.recipes.find((recipe) => recipe.id === recipeId)?.name || `Mẻ #${recipeId || 'không rõ'}`;

async function fetchJson(path) {
  const response = await fetch(`${API_BASE}${path}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`API trả về mã lỗi ${response.status}`);
  return response.json();
}

function showNotice(message, type = 'info') {
  $('#noticeArea').innerHTML = `<div class="notice ${type}"><span>${type === 'error' ? '!' : 'i'}</span><span>${escapeHtml(message)}</span>${type === 'error' ? '<button type="button" id="retryButton">Thử lại</button>' : ''}</div>`;
  $('#retryButton')?.addEventListener('click', loadData);
}

function updateConnection() {
  const card = $('#connectionCard');
  const text = $('#connectionText');
  const hasData = state.recipes.length > 0 || state.logs.length > 0;
  const failed = state.errors.recipes && state.errors.logs;
  card.classList.toggle('online', hasData && !failed);
  card.classList.toggle('error', Boolean(failed));
  text.textContent = state.loading ? 'Đang kiểm tra' : failed ? 'Không kết nối được' : hasData ? 'Đang hoạt động' : 'Đã phản hồi';
  $('#updatedNote').textContent = state.lastUpdated ? `Cập nhật ${formatDate(state.lastUpdated, { hour: '2-digit', minute: '2-digit' })}` : state.loading ? 'Đang kết nối API…' : 'Chưa có dữ liệu';
}

function renderStats() {
  const successfulLogs = state.logs.filter((log) => ['Tuyệt vời', 'Tốt'].includes(log.result)).length;
  const rate = state.logs.length ? `${Math.round((successfulLogs / state.logs.length) * 100)}%` : '—';
  $('#recipeCount').textContent = state.recipes.length;
  $('#logCount').textContent = state.logs.length;
  $('#successRate').textContent = rate;
  $('#recipeTabCount').textContent = state.recipes.length;
  $('#logTabCount').textContent = state.logs.length;
  updateConnection();
}

function recipeMatches(recipe) {
  const query = state.recipeSearch.trim().toLocaleLowerCase('vi');
  const haystack = [recipe.name, recipe.description, recipe.category, ...(recipe.tags || [])].join(' ').toLocaleLowerCase('vi');
  return (!query || haystack.includes(query)) && (state.category === 'all' || recipe.category === state.category) && (state.difficulty === 'all' || String(recipe.difficulty) === state.difficulty);
}

function logMatches(log) {
  const query = state.logSearch.trim().toLocaleLowerCase('vi');
  const haystack = [getRecipeName(log.recipeId), log.notes, log.result].join(' ').toLocaleLowerCase('vi');
  return (!query || haystack.includes(query)) && (state.result === 'all' || log.result === state.result);
}

function renderRecipeCard(recipe) {
  const image = recipe.imageUrl ? `<img src="${escapeHtml(recipe.imageUrl)}" alt="${escapeHtml(recipe.name)}" loading="lazy" onerror="this.closest('.recipe-visual').classList.add('no-image'); this.remove();" />` : '<span class="visual-shape"></span>';
  const tags = (recipe.tags || []).slice(0, 3).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
  const logCount = state.logs.filter((log) => log.recipeId === recipe.id).length;
  return `<article class="recipe-card">
    <div class="recipe-visual ${recipe.imageUrl ? '' : 'no-image'}">${image}<span class="category-badge">${escapeHtml(recipe.category || 'Khác')}</span></div>
    <div class="recipe-body">
      <h3>${escapeHtml(recipe.name || 'Công thức chưa đặt tên')}</h3>
      <p class="recipe-description">${escapeHtml(recipe.description || 'Chưa có mô tả cho công thức này.')}</p>
      <div class="recipe-meta"><span>★ ${escapeHtml(difficultyLabel(recipe.difficulty))}</span><span>◷ ${escapeHtml(formatDuration(recipe.prepTimeMinutes))}</span><span>↗ ${logCount} mẻ</span></div>
      <div class="recipe-foot"><div class="tag-row">${tags || '<span class="tag">chưa có nhãn</span>'}</div><button class="detail-link" type="button" data-recipe-id="${escapeHtml(recipe.id)}">Xem chi tiết →</button></div>
    </div>
  </article>`;
}

function renderRecipes() {
  const grid = $('#recipeGrid');
  if (state.loading && !state.recipes.length) {
    grid.innerHTML = '<div class="recipe-card skeleton"></div><div class="recipe-card skeleton"></div>';
    $('#resultSummary').textContent = 'Đang tải…';
    return;
  }
  const filtered = state.recipes.filter(recipeMatches);
  $('#resultSummary').textContent = `${filtered.length} / ${state.recipes.length} công thức`;
  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-mark">∅</div><h3>${state.recipes.length ? 'Không tìm thấy món phù hợp' : 'Chưa có công thức nào'}</h3><p>${state.recipes.length ? 'Thử đổi từ khóa hoặc bỏ bớt bộ lọc nhé.' : 'API chưa trả về dữ liệu công thức.'}</p></div>`;
    return;
  }
  grid.innerHTML = filtered.map(renderRecipeCard).join('');
  $$('.detail-link').forEach((button) => button.addEventListener('click', () => openRecipeDetail(button.dataset.recipeId)));
}

function renderLogs() {
  const list = $('#logList');
  if (state.loading && !state.logs.length) {
    list.innerHTML = '<div class="log-card skeleton"></div><div class="log-card skeleton"></div>';
    $('#resultSummary').textContent = 'Đang tải…';
    return;
  }
  const filtered = state.logs.filter(logMatches);
  $('#resultSummary').textContent = `${filtered.length} / ${state.logs.length} nhật ký`;
  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-mark">◌</div><h3>${state.logs.length ? 'Chưa có mẻ phù hợp' : 'Nhật ký còn trống'}</h3><p>${state.logs.length ? 'Thử một bộ lọc khác để xem thêm ghi chép.' : 'Những lần vào bếp của bạn sẽ xuất hiện ở đây.'}</p></div>`;
    return;
  }
  list.innerHTML = filtered.map((log) => {
    const date = formatShortDate(log.date);
    const isBad = log.result === 'Thất bại';
    return `<article class="log-card">
      <div class="log-date"><strong>${escapeHtml(date.day)}</strong><span>${escapeHtml(date.month)} ${escapeHtml(date.year)}</span></div>
      <div class="log-main"><h3>${escapeHtml(getRecipeName(log.recipeId))}</h3><p>${escapeHtml(log.notes || 'Không có ghi chú cho mẻ bánh này.')}</p></div>
      <div class="log-side"><span class="result-badge ${isBad ? 'bad' : ''}">${escapeHtml(log.result || 'Chưa đánh giá')}</span><span class="stars" title="${escapeHtml(log.rating || 0)} trên 5 sao">${stars(log.rating)}</span>${log.roomTemp ? `<span class="log-temperature">${escapeHtml(log.roomTemp)}°C phòng</span>` : ''}</div>
    </article>`;
  }).join('');
}

function renderCurrentView() {
  const isRecipes = state.activeView === 'recipes';
  $('#recipeGrid').classList.toggle('hidden', !isRecipes);
  $('#logList').classList.toggle('hidden', isRecipes);
  $('#recipeFilters').classList.toggle('hidden', !isRecipes);
  $('#logFilters').classList.toggle('hidden', isRecipes);
  $('#contentKicker').textContent = isRecipes ? 'THƯ VIỆN CÔNG THỨC' : 'NHỮNG LẦN VÀO BẾP';
  $('#contentTitle').textContent = isRecipes ? 'Món quen, vị mới' : 'Mỗi mẻ, một câu chuyện';
  if (state.errors[isRecipes ? 'recipes' : 'logs'] && !state[isRecipes ? 'recipes' : 'logs'].length) {
    showNotice(`Không thể tải ${isRecipes ? 'danh sách công thức' : 'nhật ký'}: ${state.errors[isRecipes ? 'recipes' : 'logs']}`, 'error');
  } else if (!state.loading) {
    $('#noticeArea').innerHTML = '';
  }
  isRecipes ? renderRecipes() : renderLogs();
}

function renderDetailIngredients(ingredients = []) {
  if (!ingredients.length) return '<p class="muted-copy">Chưa có danh sách nguyên liệu.</p>';
  let currentGroup = '';
  return `<ul class="ingredient-list">${ingredients.map((item) => {
    const group = item.group && item.group !== currentGroup ? `<li class="ingredient-group">${escapeHtml(item.group)}</li>` : '';
    currentGroup = item.group;
    return `${group}<li><span>${escapeHtml(item.name || 'Nguyên liệu')}</span><span>${escapeHtml(item.amount)} ${escapeHtml(item.unit || '')}${item.bakersPercentage ? ` · ${escapeHtml(item.bakersPercentage)}%` : ''}</span></li>`;
  }).join('')}</ul>`;
}

function openRecipeDetail(id) {
  const recipe = state.recipes.find((item) => item.id === id);
  if (!recipe) return;
  state.selectedRecipeId = id;
  const variants = (recipe.variants || []).map((variant) => `<div class="variant"><strong>${escapeHtml(variant.name || 'Biến thể')}</strong><p>${escapeHtml(variant.notes || 'Không có ghi chú.')}</p></div>`).join('');
  $('#detailContent').innerHTML = `<div class="detail-intro"><p class="section-kicker">${escapeHtml(recipe.category || 'CÔNG THỨC')}</p><h2 id="detailTitle">${escapeHtml(recipe.name || 'Công thức')}<br /><span>để dành.</span></h2><p>${escapeHtml(recipe.description || 'Chưa có mô tả cho công thức này.')}</p><div class="detail-meta"><div class="detail-meta-item"><span>ĐỘ KHÓ</span><strong>${escapeHtml(difficultyLabel(recipe.difficulty))}</strong></div><div class="detail-meta-item"><span>THỜI GIAN</span><strong>${escapeHtml(formatDuration(recipe.prepTimeMinutes))}</strong></div><div class="detail-meta-item"><span>CẬP NHẬT</span><strong>${escapeHtml(formatDate(recipe.updatedAt || recipe.createdAt, { day: '2-digit', month: '2-digit', year: 'numeric' }))}</strong></div></div></div><div class="detail-data"><div class="detail-section"><h3><small>01</small> Nguyên liệu</h3>${renderDetailIngredients(recipe.ingredients)}</div><div class="detail-section"><h3><small>02</small> Các bước thực hiện</h3>${recipe.steps?.length ? `<ol class="step-list">${recipe.steps.map((step) => `<li><span>${escapeHtml(step.description || 'Chưa có mô tả bước làm.')}${step.timeMinutes ? ` · ${escapeHtml(step.timeMinutes)} phút` : ''}${step.temperature ? ` · ${escapeHtml(step.temperature)}°C` : ''}</span></li>`).join('')}</ol>` : '<p class="muted-copy">Chưa có các bước thực hiện.</p>'}</div>${variants ? `<div class="detail-section"><h3><small>03</small> Biến thể</h3>${variants}</div>` : ''}</div>`;
  $('#recipeDetail').classList.remove('hidden');
  $('#recipeDetail').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function loadData() {
  state.loading = true;
  state.errors = { recipes: null, logs: null };
  renderStats();
  renderCurrentView();
  const [recipesResult, logsResult] = await Promise.allSettled([fetchJson('/api/recipes'), fetchJson('/api/logs')]);
  if (recipesResult.status === 'fulfilled') state.recipes = Array.isArray(recipesResult.value) ? recipesResult.value : [];
  else state.errors.recipes = recipesResult.reason?.message || 'Lỗi không xác định';
  if (logsResult.status === 'fulfilled') state.logs = Array.isArray(logsResult.value) ? logsResult.value : [];
  else state.errors.logs = logsResult.reason?.message || 'Lỗi không xác định';
  state.loading = false;
  state.lastUpdated = new Date();
  renderStats();
  renderCurrentView();
}

function bindEvents() {
  $('#refreshButton').addEventListener('click', loadData);
  $('#heroRecipesButton').addEventListener('click', () => { $('#library').scrollIntoView({ behavior: 'smooth' }); });
  $('#closeDetail').addEventListener('click', () => $('#recipeDetail').classList.add('hidden'));
  $$('.view-tab').forEach((tab) => tab.addEventListener('click', () => {
    state.activeView = tab.dataset.view;
    $$('.view-tab').forEach((item) => item.classList.toggle('active', item === tab));
    renderCurrentView();
  }));
  $('#recipeSearch').addEventListener('input', (event) => { state.recipeSearch = event.target.value; renderRecipes(); });
  $('#categoryFilter').addEventListener('change', (event) => { state.category = event.target.value; renderRecipes(); });
  $('#difficultyFilter').addEventListener('change', (event) => { state.difficulty = event.target.value; renderRecipes(); });
  $('#logSearch').addEventListener('input', (event) => { state.logSearch = event.target.value; renderLogs(); });
  $('#resultFilter').addEventListener('change', (event) => { state.result = event.target.value; renderLogs(); });
  $('#clearRecipeFilters').addEventListener('click', () => { state.recipeSearch = ''; state.category = 'all'; state.difficulty = 'all'; $('#recipeSearch').value = ''; $('#categoryFilter').value = 'all'; $('#difficultyFilter').value = 'all'; renderRecipes(); });
  $('#clearLogFilters').addEventListener('click', () => { state.logSearch = ''; state.result = 'all'; $('#logSearch').value = ''; $('#resultFilter').value = 'all'; renderLogs(); });
}

bindEvents();
loadData();
