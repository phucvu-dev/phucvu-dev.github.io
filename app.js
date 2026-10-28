/**
 * WebLinks Directory — Fluent UI 2 DataGrid & API Connector
 * Kết nối GET /api/webs (Cách 2) kèm Hướng dẫn CORS & Phân trang 12, 36, 120, ALL.
 * Tuân thủ quy tắc STRICT PURPLE BAN (không dùng purple/violet/indigo).
 */

const API_BASE = 'https://ap002-google-tasks-clone.onrender.com';
const WEBS_ENDPOINT = '/api/webs';

/**
 * Trạng thái trung tâm của ứng dụng (State Management)
 */
const state = {
  cards: [],
  rows: [],
  isLoading: false,
  error: null,
  lastUpdatedAt: null,
  searchQuery: '',
  selectedColor: 'ALL',
  selectedTag: 'ALL',
  pageSize: 12, // 12 | 36 | 120 | 'ALL'
  currentPage: 1
};

/**
 * Bộ nhớ cache các phần tử DOM
 */
const elements = {};

function cacheElements() {
  elements.linkCount = document.getElementById('linkCount');
  elements.filteredCountNote = document.getElementById('filteredCountNote');
  elements.cardCount = document.getElementById('cardCount');
  elements.tagCount = document.getElementById('tagCount');
  elements.connectionCard = document.getElementById('connectionCard');
  elements.connectionText = document.getElementById('connectionText');
  elements.updatedNote = document.getElementById('updatedNote');
  elements.noticeArea = document.getElementById('noticeArea');
  elements.sourceBadge = document.getElementById('sourceBadge');
  elements.searchInput = document.getElementById('searchInput');
  elements.colorFilter = document.getElementById('colorFilter');
  elements.tagFilter = document.getElementById('tagFilter');
  elements.pageSizeSelect = document.getElementById('pageSizeSelect');
  elements.clearFiltersButton = document.getElementById('clearFiltersButton');
  elements.refreshButton = document.getElementById('refreshButton');
  elements.webTableBody = document.getElementById('webTableBody');
  elements.filterForm = document.getElementById('filterForm');
  elements.paginationSummary = document.getElementById('paginationSummary');
  elements.firstPageBtn = document.getElementById('firstPageBtn');
  elements.prevPageBtn = document.getElementById('prevPageBtn');
  elements.pageIndicator = document.getElementById('pageIndicator');
  elements.nextPageBtn = document.getElementById('nextPageBtn');
  elements.lastPageBtn = document.getElementById('lastPageBtn');

  // Tabs navigation elements
  elements.tabButtons = Array.from(document.querySelectorAll('.f-tabs-nav .f-tab'));
  elements.tabPanels = Array.from(document.querySelectorAll('.f-main .f-tabpanel'));
}

/**
 * Bảo vệ XSS an toàn khi chèn văn bản vào DOM
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Xác thực và chuẩn hóa URL hợp lệ
 */
function sanitizeHttpUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
    return '';
  } catch {
    return '';
  }
}

/**
 * Ánh xạ màu an toàn theo chuẩn Fluent 2 (Strict Purple Ban)
 * Tuyệt đối không tạo mã màu purple, violet, hoặc indigo.
 */
function mapColorToFluent(rawColor) {
  const normalized = String(rawColor || 'neutral').trim().toLowerCase();
  switch (normalized) {
    case 'blue':
      return { dot: '#0f6cbd', name: 'Xanh Microsoft' };
    case 'green':
    case 'emerald':
      return { dot: '#0e703c', name: 'Lục Fluent' };
    case 'amber':
    case 'yellow':
    case 'orange':
      return { dot: '#835b01', name: 'Hổ phách' };
    case 'teal':
    case 'cyan':
      return { dot: '#036666', name: 'Xanh mòng két' };
    case 'red':
    case 'rose':
    case 'coral':
    case 'terracotta':
      return { dot: '#a83818', name: 'Đỏ cam' };
    case 'indigo':
    case 'purple':
    case 'violet':
      // STRICT PURPLE BAN: Chuyển hướng màu bị cấm về màu xanh Microsoft Blue
      return { dot: '#0f6cbd', name: 'Xanh Microsoft' };
    default:
      return { dot: '#616161', name: normalized || 'Mặc định' };
  }
}

/**
 * Định dạng ngày giờ thân thiện theo chuẩn Việt Nam
 */
function formatDateTime(value) {
  if (value === null || value === undefined || value === '') return '—';
  const date = typeof value === 'number' ? new Date(value) : new Date(String(value));
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

/**
 * Biến đổi mảng WebCard[] từ GET /api/webs sang mảng phẳng (Option A: 1 dòng = 1 link)
 */
function flattenWebCards(cards) {
  if (!Array.isArray(cards)) return [];
  let counter = 0;

  return cards.flatMap((card) => {
    const safeCard = card && typeof card === 'object' ? card : {};
    const cardId = safeCard.id || '—';
    const cardTitle = safeCard.title || 'Nhóm không tên';
    const color = safeCard.color ? String(safeCard.color).toLowerCase() : 'neutral';
    const tags = Array.isArray(safeCard.tags)
      ? safeCard.tags.map((tag) => String(tag).trim()).filter(Boolean)
      : [];
    const createdAt = safeCard.createdAt ?? null;
    const links = Array.isArray(safeCard.links) ? safeCard.links : [];

    if (links.length === 0) {
      counter += 1;
      return [
        {
          rowIndex: counter,
          cardId,
          cardTitle,
          color,
          tags,
          createdAt,
          linkTitle: '(Chưa có liên kết con)',
          url: '',
          description: 'Nhóm thẻ này hiện chưa có mục liên kết con',
          thumbnail: '',
          isEmptyGroup: true
        }
      ];
    }

    return links.map((linkItem) => {
      const safeLink = linkItem && typeof linkItem === 'object' ? linkItem : {};
      counter += 1;
      return {
        rowIndex: counter,
        cardId,
        cardTitle,
        color,
        tags,
        createdAt,
        linkTitle: safeLink.title || '—',
        url: safeLink.url || '',
        description: safeLink.description || '—',
        thumbnail: safeLink.thumbnail || '',
        isEmptyGroup: false
      };
    });
  });
}

/**
 * Lọc danh sách dòng theo từ khóa tìm kiếm, màu sắc và thẻ nhãn
 */
function computeFilteredRows() {
  const query = state.searchQuery.trim().toLowerCase();

  return state.rows.filter((row) => {
    const matchesColor =
      state.selectedColor === 'ALL' || row.color === state.selectedColor;
    const matchesTag =
      state.selectedTag === 'ALL' || row.tags.includes(state.selectedTag);

    if (!matchesColor || !matchesTag) return false;
    if (!query) return true;

    const searchableText = [
      row.cardTitle,
      row.cardId,
      row.linkTitle,
      row.url,
      row.description,
      row.color,
      row.tags.join(' ')
    ]
      .join(' ')
      .toLowerCase();

    return searchableText.includes(query);
  });
}

/**
 * Cập nhật danh sách tùy chọn cho dropdown lọc Màu sắc và Thẻ nhãn
 */
function populateFilterOptions() {
  const uniqueColors = Array.from(
    new Set(state.rows.map((r) => r.color).filter(Boolean))
  ).sort();

  const allTags = state.rows.flatMap((r) => r.tags);
  const uniqueTags = Array.from(new Set(allTags)).sort();

  const currentColor = state.selectedColor;
  elements.colorFilter.innerHTML = [
    '<option value="ALL">Tất cả màu</option>',
    ...uniqueColors.map((color) => {
      const info = mapColorToFluent(color);
      return `<option value="${escapeHtml(color)}">${escapeHtml(color)} (${escapeHtml(info.name)})</option>`;
    })
  ].join('');
  elements.colorFilter.value = uniqueColors.includes(currentColor) ? currentColor : 'ALL';
  state.selectedColor = elements.colorFilter.value;

  const currentTag = state.selectedTag;
  elements.tagFilter.innerHTML = [
    '<option value="ALL">Tất cả tags</option>',
    ...uniqueTags.map(
      (tag) => `<option value="${escapeHtml(tag)}">#${escapeHtml(tag)}</option>`
    )
  ].join('');
  elements.tagFilter.value = uniqueTags.includes(currentTag) ? currentTag : 'ALL';
  state.selectedTag = elements.tagFilter.value;
}

/**
 * Hiển thị thẻ thống kê Fluent Stat Cards
 */
function renderStats(filteredRows) {
  const uniqueTags = new Set(state.rows.flatMap((r) => r.tags));
  elements.linkCount.textContent = String(state.rows.length);
  elements.cardCount.textContent = String(state.cards.length);
  elements.tagCount.textContent = String(uniqueTags.size);

  if (filteredRows.length !== state.rows.length) {
    elements.filteredCountNote.textContent = `Khớp ${filteredRows.length} / ${state.rows.length} liên kết`;
  } else {
    elements.filteredCountNote.textContent = '1 dòng = 1 liên kết web';
  }

  elements.sourceBadge.textContent = 'Nguồn: Live GET /api/webs';
  elements.sourceBadge.className = 'f-badge f-badge-brand';
}

/**
 * Hiển thị trạng thái kết nối lên Card trạng thái
 */
function renderConnectionCard() {
  if (state.isLoading) {
    elements.connectionCard.setAttribute('data-status', 'warn');
    elements.connectionText.textContent = 'Đang gọi API…';
    elements.updatedNote.textContent = 'Đang kết nối tới máy chủ Render';
    return;
  }

  if (state.error) {
    elements.connectionCard.setAttribute('data-status', 'error');
    elements.connectionText.textContent = 'Lỗi kết nối';
    elements.updatedNote.textContent = state.lastUpdatedAt
      ? `Lỗi lúc ${state.lastUpdatedAt}`
      : 'Không thể nhận phản hồi';
    return;
  }

  elements.connectionCard.setAttribute('data-status', 'ok');
  elements.connectionText.textContent = '200 OK — Trực tiếp';
  elements.updatedNote.textContent = state.lastUpdatedAt
    ? `Cập nhật lúc ${state.lastUpdatedAt}`
    : 'Dữ liệu trực tiếp từ máy chủ';
}

/**
 * Hiển thị Fluent InfoBar: Hướng dẫn Cách 2 & CORS khi xảy ra lỗi
 */
function renderNoticeBar() {
  if (state.isLoading) {
    elements.noticeArea.innerHTML = '';
    return;
  }

  // Khi gọi Live API gặp lỗi (chặn CORS hoặc lỗi mạng)
  if (state.error) {
    elements.noticeArea.innerHTML = `
      <div class="f-infobar f-infobar-warning" role="alert">
        <div class="f-infobar-body">
          <p class="f-infobar-title">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
            Cách 2 — Kết nối API trực tiếp: Trình duyệt chặn CORS
          </p>
          <p class="f-infobar-desc">
            Bạn đang chạy <strong>Cách 2</strong> (gọi trực tiếp <code>${escapeHtml(API_BASE + WEBS_ENDPOINT)}</code> từ trình duyệt). Máy chủ Render hiện chưa trả về header <code>Access-Control-Allow-Origin: *</code>.
            <br />
            <strong>Khắc phục:</strong> Vui lòng bật extension CORS (như <em>Allow CORS: Access-Control-Allow-Origin</em>) trên trình duyệt rồi bấm nút <strong>"↻ Thử lại kết nối"</strong> bên cạnh.
          </p>
        </div>
        <div class="f-infobar-actions">
          <button type="button" class="f-btn f-btn-primary" data-action="retry-live">
            ↻ Thử lại kết nối
          </button>
        </div>
      </div>
    `;
    return;
  }

  // Khi tải thành công
  elements.noticeArea.innerHTML = '';
}

/**
 * Hiệu ứng Skeleton Loading cho DataGrid
 */
function renderSkeletonRows() {
  const rows = Array.from({ length: 6 })
    .map(
      (_, i) => `
      <tr>
        <td class="td-index">${i + 1}</td>
        <td><span class="f-skeleton" style="width: 80%"></span></td>
        <td><span class="f-skeleton" style="width: 50px; height: 32px"></span></td>
        <td><span class="f-skeleton" style="width: 90%"></span></td>
        <td><span class="f-skeleton" style="width: 75%"></span></td>
        <td><span class="f-skeleton" style="width: 95%"></span></td>
        <td><span class="f-skeleton" style="width: 70%"></span></td>
        <td><span class="f-skeleton" style="width: 60%"></span></td>
      </tr>
    `
    )
    .join('');

  elements.webTableBody.innerHTML = rows;
}

/**
 * Hiển thị các dòng dữ liệu DataGrid kèm Phân trang (12, 36, 120, ALL)
 */
function renderTableAndPagination(filteredRows) {
  if (state.isLoading) {
    renderSkeletonRows();
    elements.paginationSummary.textContent = 'Đang tải dữ liệu…';
    elements.firstPageBtn.disabled = true;
    elements.prevPageBtn.disabled = true;
    elements.nextPageBtn.disabled = true;
    elements.lastPageBtn.disabled = true;
    elements.pageIndicator.textContent = 'Trang 1 / 1';
    return;
  }

  // Trường hợp gặp lỗi Live API
  if (state.error) {
    elements.webTableBody.innerHTML = `
      <tr class="f-state-row">
        <td colspan="8">
          <div class="f-state-box">
            <p class="f-state-title">Chưa kết nối được với GET /api/webs</p>
            <p class="f-state-sub">
              Trình duyệt đang chặn CORS khi gọi từ origin hiện tại. Vui lòng bật extension CORS trên trình duyệt và bấm thử lại.
            </p>
            <div class="f-state-actions">
              <button type="button" class="f-btn f-btn-primary" data-action="retry-live">
                ↻ Thử gọi lại API
              </button>
            </div>
          </div>
        </td>
      </tr>
    `;
    elements.paginationSummary.textContent = 'Hiển thị 0 trong tổng số 0 liên kết';
    elements.firstPageBtn.disabled = true;
    elements.prevPageBtn.disabled = true;
    elements.nextPageBtn.disabled = true;
    elements.lastPageBtn.disabled = true;
    elements.pageIndicator.textContent = 'Trang 1 / 1';
    return;
  }

  // Trường hợp dữ liệu gốc rỗng
  if (state.rows.length === 0) {
    elements.webTableBody.innerHTML = `
      <tr class="f-state-row">
        <td colspan="8">
          <div class="f-state-box">
            <p class="f-state-title">Chưa có liên kết web nào</p>
            <p class="f-state-sub">Endpoint GET /api/webs trả về danh sách rỗng [].</p>
            <div class="f-state-actions">
              <button type="button" class="f-btn f-btn-primary" data-action="retry-live">
                ↻ Làm mới dữ liệu
              </button>
            </div>
          </div>
        </td>
      </tr>
    `;
    elements.paginationSummary.textContent = 'Hiển thị 0 trong tổng số 0 liên kết';
    elements.firstPageBtn.disabled = true;
    elements.prevPageBtn.disabled = true;
    elements.nextPageBtn.disabled = true;
    elements.lastPageBtn.disabled = true;
    elements.pageIndicator.textContent = 'Trang 1 / 1';
    return;
  }

  // Trường hợp bộ lọc không tìm thấy kết quả
  if (filteredRows.length === 0) {
    elements.webTableBody.innerHTML = `
      <tr class="f-state-row">
        <td colspan="8">
          <div class="f-state-box">
            <p class="f-state-title">Không tìm thấy liên kết phù hợp</p>
            <p class="f-state-sub">Không có liên kết nào khớp với từ khóa tìm kiếm hoặc bộ lọc được chọn.</p>
            <div class="f-state-actions">
              <button type="button" class="f-btn f-btn-secondary" data-action="clear-filters">
                Xóa bộ lọc để xem toàn bộ
              </button>
            </div>
          </div>
        </td>
      </tr>
    `;
    elements.paginationSummary.textContent = `Hiển thị 0 trong tổng số ${state.rows.length} liên kết`;
    elements.firstPageBtn.disabled = true;
    elements.prevPageBtn.disabled = true;
    elements.nextPageBtn.disabled = true;
    elements.lastPageBtn.disabled = true;
    elements.pageIndicator.textContent = 'Trang 1 / 1';
    return;
  }

  // ==========================================
  // Xử lý Phân trang (Pagination Logic)
  // ==========================================
  const totalItems = filteredRows.length;
  const isAll = state.pageSize === 'ALL';
  const size = isAll ? totalItems : Number(state.pageSize);
  const totalPages = isAll ? 1 : Math.max(1, Math.ceil(totalItems / size));

  // Giữ currentPage luôn trong giới hạn hợp lệ
  if (state.currentPage > totalPages) {
    state.currentPage = totalPages;
  }
  if (state.currentPage < 1) {
    state.currentPage = 1;
  }

  const startIndex = isAll ? 0 : (state.currentPage - 1) * size;
  const endIndex = isAll ? totalItems : Math.min(startIndex + size, totalItems);
  const displayedRows = filteredRows.slice(startIndex, endIndex);

  // Hiển thị các hàng của trang hiện tại
  elements.webTableBody.innerHTML = displayedRows
    .map((row, index) => {
      const globalIndex = startIndex + index + 1;
      const colorInfo = mapColorToFluent(row.color);
      const safeThumbUrl = sanitizeHttpUrl(row.thumbnail);
      const safeLinkUrl = sanitizeHttpUrl(row.url);

      const thumbCellHtml = safeThumbUrl
        ? `
          <div class="f-thumb-box">
            <img
              class="f-thumb-img"
              src="${escapeHtml(safeThumbUrl)}"
              alt="Thumbnail cho ${escapeHtml(row.linkTitle)}"
              loading="lazy"
              referrerpolicy="no-referrer"
            />
          </div>
        `
        : `<div class="f-thumb-box" aria-label="Không có ảnh thumbnail">No img</div>`;

      const titleCellHtml = row.isEmptyGroup
        ? `<span class="f-link-title f-link-title-empty">${escapeHtml(row.linkTitle)}</span>`
        : `<span class="f-link-title">${escapeHtml(row.linkTitle)}</span>`;

      const urlCellHtml = safeLinkUrl
        ? `
          <a
            class="f-link-url"
            href="${escapeHtml(safeLinkUrl)}"
            target="_blank"
            rel="noopener noreferrer"
            title="Mở liên kết trong tab mới"
          >
            <span>${escapeHtml(safeLinkUrl)}</span>
            <span class="f-link-external-icon" aria-hidden="true">↗</span>
          </a>
        `
        : `<span class="f-cell-date">—</span>`;

      const tagsCellHtml =
        row.tags.length > 0
          ? `<div class="f-tag-list">${row.tags
              .map((tag) => `<span class="f-tag-chip">#${escapeHtml(tag)}</span>`)
              .join('')}</div>`
          : `<span class="f-cell-date">—</span>`;

      return `
        <tr>
          <td class="td-index">${globalIndex}</td>
          <td>
            <div class="f-group-cell">
              <span class="f-group-title">
                <span class="f-color-dot" style="background-color: ${escapeHtml(colorInfo.dot)}" aria-hidden="true"></span>
                <span>${escapeHtml(row.cardTitle)}</span>
              </span>
              <span class="f-group-meta">${escapeHtml(row.cardId)} · ${escapeHtml(colorInfo.name)}</span>
            </div>
          </td>
          <td>${thumbCellHtml}</td>
          <td>${titleCellHtml}</td>
          <td>${urlCellHtml}</td>
          <td class="f-cell-desc">${escapeHtml(row.description)}</td>
          <td>${tagsCellHtml}</td>
          <td class="f-cell-date">${escapeHtml(formatDateTime(row.createdAt))}</td>
        </tr>
      `;
    })
    .join('');

  // Fallback an toàn nếu ảnh thumbnail bị chặn tải
  elements.webTableBody.querySelectorAll('.f-thumb-img').forEach((imgEl) => {
    imgEl.addEventListener(
      'error',
      () => {
        const parent = imgEl.closest('.f-thumb-box');
        if (parent) {
          parent.textContent = 'No img';
        }
      },
      { once: true }
    );
  });

  // Cập nhật dòng tóm tắt phân trang
  elements.paginationSummary.textContent = `Hiển thị ${startIndex + 1} - ${endIndex} trong tổng số ${totalItems} liên kết`;

  // Cập nhật trạng thái các nút điều hướng phân trang
  if (isAll) {
    elements.firstPageBtn.disabled = true;
    elements.prevPageBtn.disabled = true;
    elements.nextPageBtn.disabled = true;
    elements.lastPageBtn.disabled = true;
    elements.pageIndicator.textContent = `Tất cả (${totalItems})`;
  } else {
    elements.firstPageBtn.disabled = state.currentPage <= 1;
    elements.prevPageBtn.disabled = state.currentPage <= 1;
    elements.nextPageBtn.disabled = state.currentPage >= totalPages;
    elements.lastPageBtn.disabled = state.currentPage >= totalPages;
    elements.pageIndicator.textContent = `Trang ${state.currentPage} / ${totalPages}`;
  }
}

/**
 * Tổng hợp quá trình render toàn bộ giao diện
 */
function renderAll() {
  const filteredRows = computeFilteredRows();
  renderStats(filteredRows);
  renderConnectionCard();
  renderNoticeBar();
  renderTableAndPagination(filteredRows);
}

/**
 * Gọi trực tiếp API theo yêu cầu Cách 2:
 * GET https://ap002-google-tasks-clone.onrender.com/api/webs
 */
async function fetchWebLinksFromApi() {
  state.isLoading = true;
  state.error = null;
  elements.refreshButton.disabled = true;
  renderAll();

  try {
    const response = await fetch(`${API_BASE}${WEBS_ENDPOINT}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const serverMessage =
        errorBody && typeof errorBody.error === 'string'
          ? errorBody.error
          : response.statusText || 'Lỗi HTTP';
      throw new Error(`HTTP ${response.status}: ${serverMessage}`);
    }

    const payload = await response.json();
    if (!Array.isArray(payload)) {
      throw new Error('Phản hồi từ /api/webs không phải mảng JSON hợp lệ.');
    }

    state.cards = payload;
    state.rows = flattenWebCards(payload);
    state.error = null;
    state.lastUpdatedAt = new Date().toLocaleTimeString('vi-VN');
    state.currentPage = 1;
    populateFilterOptions();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi kết nối mạng';
    state.error = message;
    state.cards = [];
    state.rows = [];
    state.lastUpdatedAt = new Date().toLocaleTimeString('vi-VN');
    populateFilterOptions();
  } finally {
    state.isLoading = false;
    elements.refreshButton.disabled = false;
    renderAll();
  }
}

/**
 * Xóa sạch các bộ lọc tìm kiếm về trạng thái mặc định
 */
function resetFilters() {
  state.searchQuery = '';
  state.selectedColor = 'ALL';
  state.selectedTag = 'ALL';
  state.currentPage = 1;
  elements.searchInput.value = '';
  elements.colorFilter.value = 'ALL';
  elements.tagFilter.value = 'ALL';
  renderAll();
}

/**
 * Khởi tạo điều khiển Tabs Navigation (MS365 Apps, Google Apps, Check Tools, ...)
 * Hỗ trợ chuyển đổi tab linh hoạt và điều hướng bàn phím chuẩn WAI-ARIA
 */
function initTabs() {
  const tabs = elements.tabButtons && elements.tabButtons.length > 0
    ? elements.tabButtons
    : Array.from(document.querySelectorAll('.f-tabs-nav .f-tab'));
  const panels = elements.tabPanels && elements.tabPanels.length > 0
    ? elements.tabPanels
    : Array.from(document.querySelectorAll('.f-main .f-tabpanel'));

  if (!tabs.length || !panels.length) {
    return;
  }

  function switchTab(selectedTab, shouldFocus = false) {
    const targetPanelId = selectedTab.getAttribute('aria-controls');

    tabs.forEach((tab) => {
      const isSelected = tab === selectedTab;
      tab.classList.toggle('active', isSelected);
      tab.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      tab.setAttribute('tabindex', isSelected ? '0' : '-1');
      if (isSelected && shouldFocus) {
        tab.focus();
      }
    });

    panels.forEach((panel) => {
      if (panel.id === targetPanelId) {
        panel.removeAttribute('hidden');
      } else {
        panel.setAttribute('hidden', '');
      }
    });
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      switchTab(tab);
    });

    tab.addEventListener('keydown', (e) => {
      let targetIndex = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        targetIndex = (index + 1) % tabs.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        targetIndex = (index - 1 + tabs.length) % tabs.length;
      } else if (e.key === 'Home') {
        targetIndex = 0;
      } else if (e.key === 'End') {
        targetIndex = tabs.length - 1;
      }

      if (targetIndex !== null) {
        e.preventDefault();
        switchTab(tabs[targetIndex], true);
      }
    });
  });
}

/**
 * Lắng nghe tất cả các sự kiện tương tác người dùng
 */
function bindEvents() {
  initTabs();

  // Đảm bảo click vào nút bọc cũng kích hoạt thẻ liên kết bên trong
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.f-btn-empty');
    if (btn && !e.target.closest('a')) {
      const link = btn.querySelector('a');
      if (link) {
        link.click();
      }
    }
  });

  elements.filterForm.addEventListener('submit', (e) => {
    e.preventDefault();
  });

  // Tìm kiếm từ khóa: tự động đặt lại trang 1
  elements.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value || '';
    state.currentPage = 1;
    renderAll();
  });

  // Lọc theo màu sắc: tự động đặt lại trang 1
  elements.colorFilter.addEventListener('change', (e) => {
    state.selectedColor = e.target.value || 'ALL';
    state.currentPage = 1;
    renderAll();
  });

  // Lọc theo tag: tự động đặt lại trang 1
  elements.tagFilter.addEventListener('change', (e) => {
    state.selectedTag = e.target.value || 'ALL';
    state.currentPage = 1;
    renderAll();
  });

  // Thay đổi số mục hiển thị trên mỗi trang (12, 36, 120, ALL): tự động về trang 1
  elements.pageSizeSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    state.pageSize = val === 'ALL' ? 'ALL' : Number(val);
    state.currentPage = 1;
    renderAll();
  });

  // Xóa bộ lọc
  elements.clearFiltersButton.addEventListener('click', () => {
    resetFilters();
  });

  // Làm mới API từ header
  elements.refreshButton.addEventListener('click', () => {
    fetchWebLinksFromApi();
  });

  // Điều hướng phân trang (Pagination Controls)
  elements.firstPageBtn.addEventListener('click', () => {
    if (state.pageSize === 'ALL') return;
    if (state.currentPage > 1) {
      state.currentPage = 1;
      renderAll();
    }
  });

  elements.prevPageBtn.addEventListener('click', () => {
    if (state.pageSize === 'ALL') return;
    if (state.currentPage > 1) {
      state.currentPage -= 1;
      renderAll();
    }
  });

  elements.nextPageBtn.addEventListener('click', () => {
    if (state.pageSize === 'ALL') return;
    const filteredRows = computeFilteredRows();
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / Number(state.pageSize)));
    if (state.currentPage < totalPages) {
      state.currentPage += 1;
      renderAll();
    }
  });

  elements.lastPageBtn.addEventListener('click', () => {
    if (state.pageSize === 'ALL') return;
    const filteredRows = computeFilteredRows();
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / Number(state.pageSize)));
    if (state.currentPage < totalPages) {
      state.currentPage = totalPages;
      renderAll();
    }
  });

  // Xử lý các nút tác vụ được chèn động (qua data-action)
  document.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;

    const action = actionBtn.getAttribute('data-action');
    if (action === 'retry-live') {
      fetchWebLinksFromApi();
    } else if (action === 'clear-filters') {
      resetFilters();
    }
  });
}

/**
 * Khởi động ứng dụng khi DOM đã sẵn sàng
 */
document.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  bindEvents();
  fetchWebLinksFromApi();
});
