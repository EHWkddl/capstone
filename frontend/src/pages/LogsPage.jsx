import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchLogs, fetchLogDetail } from '../api/client'

const PAGE_SIZE = 10

const DECISION_META = {
  Block: { label: 'Block', tone: 'block', color: '#ff5566' },
  Warning: { label: 'Warning', tone: 'warning', color: '#ffb84a' },
  Allow: { label: 'Allow', tone: 'allow', color: '#4ade80' },
}

const ATTACK_TYPE_OPTIONS = [
  '전체 유형',
  '프롬프트 인젝션',
  '민감정보 요구',
  '안전 정책 우회',
  '지시 무시',
  '탈옥',
  '역할 변경',
  '정상',
]

const PIE_COLORS = [
  '#ff5566',
  '#ffb84a',
  '#4a9eff',
  '#a78bfa',
  '#2dd4bf',
  '#4ade80',
  '#f472b6',
  '#94a3b8',
]

/* ============= Utilities ============= */

function relativeTime(iso) {
  if (!iso) return '-'
  const now = Date.now()
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '-'
  const diff = now - t
  if (diff < 0) return '방금'
  const min = Math.floor(diff / 60000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  return `${day}일 전`
}

function formatTime(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function riskTone(score) {
  const s = Number(score) || 0
  if (s >= 70) return 'block'
  if (s >= 30) return 'warning'
  return 'allow'
}

function dateInputToIsoStart(d) {
  return d ? `${d}T00:00:00` : null
}

function dateInputToIsoEnd(d) {
  return d ? `${d}T23:59:59` : null
}

function truncate(text, max = 80) {
  if (!text) return ''
  if (text.length <= max) return text
  return text.slice(0, max - 1) + '…'
}

/* ============= Main ============= */

function LogsPage() {
  const [stats, setStats] = useState({
    total: 0,
    block: 0,
    warning: 0,
    latest: null,
  })

  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [filters, setFilters] = useState({
    search: '',
    decision: null,
    attackType: '전체 유형',
    fromDate: '',
    toDate: '',
  })

  const [selectedId, setSelectedId] = useState(null)
  const [selectedDetail, setSelectedDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // ---- Effects ----

  // Stats (mount + after filters change to keep totals in sync)
  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetchLogs({ limit: 1 }),
      fetchLogs({ limit: 1, decision: 'Block' }),
      fetchLogs({ limit: 1, decision: 'Warning' }),
      fetchLogs({ limit: 1 }),
    ])
      .then(([t, b, w, l]) => {
        if (cancelled) return
        setStats({
          total: t.total,
          block: b.total,
          warning: w.total,
          latest: l.items?.[0] || null,
        })
      })
      .catch((e) => {
        // stats error is non-fatal — log to console but don't block UI
        // eslint-disable-next-line no-console
        console.error('[LogsPage] stats load failed:', e)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Logs list — refetch when server-side filters or page change
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetchLogs({
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      decision: filters.decision,
      fromDate: dateInputToIsoStart(filters.fromDate),
      toDate: dateInputToIsoEnd(filters.toDate),
    })
      .then((data) => {
        if (cancelled) return
        setLogs(Array.isArray(data.items) ? data.items : [])
        setTotal(Number(data.total) || 0)
      })
      .catch((e) => {
        if (cancelled) return
        setError(String(e))
        setLogs([])
        setTotal(0)
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [page, filters.decision, filters.fromDate, filters.toDate])

  // Detail
  useEffect(() => {
    if (!selectedId) {
      setSelectedDetail(null)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    fetchLogDetail(selectedId)
      .then((d) => {
        if (!cancelled) setSelectedDetail(d)
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error('[LogsPage] detail load failed:', e)
        if (!cancelled) setSelectedDetail(null)
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedId])

  // ---- Client-side filtering (search + attackType) ----

  const filteredLogs = useMemo(() => {
    const s = filters.search.trim().toLowerCase()
    const t = filters.attackType
    return logs.filter((log) => {
      if (s) {
        const hay = `${log.content || ''} ${log.conversation_id || ''}`
        if (!hay.toLowerCase().includes(s)) return false
      }
      if (t && t !== '전체 유형' && log.attack_type !== t) return false
      return true
    })
  }, [logs, filters.search, filters.attackType])

  // ---- Handlers ----

  const handleFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }, [])

  const handleReset = useCallback(() => {
    setFilters({
      search: '',
      decision: null,
      attackType: '전체 유형',
      fromDate: '',
      toDate: '',
    })
    setPage(1)
  }, [])

  return (
    <div className="logs-page">
      <PageHeader />
      <StatsCards stats={stats} />
      <FilterBar
        filters={filters}
        onChange={handleFilter}
        onReset={handleReset}
      />
      <div className="logs-main">
        <div className="logs-table-area">
          <LogsTable
            logs={filteredLogs}
            loading={loading}
            error={error}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <Pagination
            page={page}
            total={total}
            pageSize={PAGE_SIZE}
            visibleCount={filteredLogs.length}
            onPageChange={setPage}
          />
        </div>
        <DetailPanel
          detail={selectedDetail}
          loading={detailLoading}
          isOpen={selectedId != null}
          onClose={() => setSelectedId(null)}
        />
      </div>
      <AnalyticsWidgets items={logs} />
    </div>
  )
}

/* ============= Page Header ============= */

function PageHeader() {
  return (
    <header className="logs-header">
      <div className="logs-header-icon">
        <IconShield size={28} />
      </div>
      <div>
        <h1>탐지 로그</h1>
        <p>
          시스템이 탐지한 위험 및 경고 이벤트를 확인하고 분석할 수 있습니다.
        </p>
      </div>
    </header>
  )
}

/* ============= Stats Cards ============= */

function StatsCards({ stats }) {
  const cards = [
    {
      key: 'total',
      label: '전체 로그',
      value: stats.total.toLocaleString(),
      sub: 'security_engine 이벤트',
      tone: 'blue',
      Icon: IconDoc,
    },
    {
      key: 'block',
      label: '차단',
      value: stats.block.toLocaleString(),
      sub: 'decision = Block',
      tone: 'red',
      Icon: IconShieldX,
    },
    {
      key: 'warning',
      label: '경고',
      value: stats.warning.toLocaleString(),
      sub: 'decision = Warning',
      tone: 'yellow',
      Icon: IconAlertTriangle,
    },
    {
      key: 'latest',
      label: '최근 탐지',
      value: stats.latest ? relativeTime(stats.latest.created_at) : '-',
      sub: stats.latest ? '마지막 이벤트' : '데이터 없음',
      tone: 'blue',
      Icon: IconClock,
    },
  ]
  return (
    <section className="logs-stats-grid">
      {cards.map((c) => (
        <article key={c.key} className={`logs-stat-card tone-${c.tone}`}>
          <span className={`logs-stat-icon tone-${c.tone}`}>
            <c.Icon size={22} />
          </span>
          <div className="logs-stat-body">
            <span className="logs-stat-label">{c.label}</span>
            <strong className="logs-stat-value">{c.value}</strong>
            <span className="logs-stat-sub">{c.sub}</span>
          </div>
        </article>
      ))}
    </section>
  )
}

/* ============= Filter Bar ============= */

function FilterBar({ filters, onChange, onReset }) {
  const decisionButtons = [
    { label: '전체', value: null },
    { label: 'Allow', value: 'Allow' },
    { label: 'Warning', value: 'Warning' },
    { label: 'Block', value: 'Block' },
  ]
  return (
    <section className="logs-filter-bar">
      <div className="logs-filter-search">
        <IconSearch size={16} />
        <input
          type="search"
          value={filters.search}
          onChange={(e) => onChange('search', e.target.value)}
          placeholder="검색어를 입력하세요 (프롬프트, 대화 ID 등)"
        />
      </div>

      <div className="logs-filter-group">
        <span className="logs-filter-label">결정</span>
        <div className="logs-filter-pills">
          {decisionButtons.map((b) => {
            const active = filters.decision === b.value
            const tone = b.value ? DECISION_META[b.value]?.tone : 'all'
            return (
              <button
                key={b.label}
                type="button"
                onClick={() => onChange('decision', b.value)}
                className={`logs-pill tone-${tone}${active ? ' active' : ''}`}
              >
                {b.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="logs-filter-group">
        <label className="logs-filter-label" htmlFor="logs-attack-type">
          공격 유형
        </label>
        <select
          id="logs-attack-type"
          className="logs-filter-select"
          value={filters.attackType}
          onChange={(e) => onChange('attackType', e.target.value)}
        >
          {ATTACK_TYPE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      <div className="logs-filter-group">
        <span className="logs-filter-label">기간</span>
        <div className="logs-filter-date-range">
          <input
            type="date"
            className="logs-filter-date"
            value={filters.fromDate}
            onChange={(e) => onChange('fromDate', e.target.value)}
          />
          <span className="logs-filter-date-sep">~</span>
          <input
            type="date"
            className="logs-filter-date"
            value={filters.toDate}
            onChange={(e) => onChange('toDate', e.target.value)}
          />
        </div>
      </div>

      <button type="button" className="logs-filter-reset" onClick={onReset}>
        <IconRefresh size={14} />
        초기화
      </button>
    </section>
  )
}

/* ============= Logs Table ============= */

function LogsTable({ logs, loading, error, selectedId, onSelect }) {
  return (
    <div className="logs-table-wrap">
      <table className="logs-table">
        <thead>
          <tr>
            <th className="th-time">시간</th>
            <th>입력 프롬프트</th>
            <th>공격 유형</th>
            <th className="th-risk">위험도</th>
            <th className="th-decision">결정</th>
            <th className="th-action">작업</th>
          </tr>
        </thead>
        <tbody>
          {error && (
            <tr>
              <td colSpan={6} className="logs-table-state logs-table-error">
                <strong>오류</strong>
                <span>{error}</span>
              </td>
            </tr>
          )}
          {!error && loading && (
            <tr>
              <td colSpan={6} className="logs-table-state">
                로그 불러오는 중...
              </td>
            </tr>
          )}
          {!error && !loading && logs.length === 0 && (
            <tr>
              <td colSpan={6} className="logs-table-state">
                조건에 맞는 로그가 없습니다.
              </td>
            </tr>
          )}
          {!error &&
            !loading &&
            logs.map((log) => {
              const meta = DECISION_META[log.decision] ?? null
              const rt = riskTone(log.final_risk_score)
              const active = selectedId === log.id
              return (
                <tr
                  key={log.id}
                  className={`logs-row${active ? ' active' : ''}`}
                  onClick={() => onSelect(log.id)}
                >
                  <td className="td-time">{formatTime(log.created_at)}</td>
                  <td className="td-content">
                    <span title={log.content || ''}>
                      {truncate(log.content || '', 80)}
                    </span>
                  </td>
                  <td className="td-attack-type">{log.attack_type || '-'}</td>
                  <td className="td-risk">
                    <div className="td-risk-inner">
                      <span className={`risk-dot tone-${rt}`} />
                      <span className="td-risk-num">
                        {Number(log.final_risk_score) || 0}
                      </span>
                    </div>
                  </td>
                  <td className="td-decision">
                    {meta ? (
                      <span className={`logs-badge tone-${meta.tone}`}>
                        {meta.label}
                      </span>
                    ) : (
                      <span className="logs-badge tone-muted">-</span>
                    )}
                  </td>
                  <td className="td-action">
                    <button
                      type="button"
                      className="logs-detail-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelect(log.id)
                      }}
                    >
                      상세 보기
                    </button>
                  </td>
                </tr>
              )
            })}
        </tbody>
      </table>
    </div>
  )
}

/* ============= Pagination ============= */

function Pagination({ page, total, pageSize, visibleCount, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = (page - 1) * pageSize + visibleCount

  const pages = buildPageList(page, totalPages)

  return (
    <div className="logs-pagination">
      <div className="logs-page-buttons">
        <button
          type="button"
          className="logs-page-btn"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label="이전 페이지"
        >
          ‹
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`gap-${i}`} className="logs-page-gap">
              ···
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className={`logs-page-btn${p === page ? ' active' : ''}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          className="logs-page-btn"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          aria-label="다음 페이지"
        >
          ›
        </button>
      </div>
      <span className="logs-page-range">
        {from.toLocaleString()}-{to.toLocaleString()} / {total.toLocaleString()}
      </span>
    </div>
  )
}

function buildPageList(current, totalPages) {
  // Shows: 1 ... (current-1) current (current+1) ... last
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  const set = new Set([1, totalPages, current])
  for (let d = -1; d <= 1; d++) {
    const p = current + d
    if (p > 1 && p < totalPages) set.add(p)
  }
  const sorted = [...set].sort((a, b) => a - b)
  const out = []
  let prev = 0
  for (const p of sorted) {
    if (prev > 0 && p > prev + 1) out.push('...')
    out.push(p)
    prev = p
  }
  return out
}

/* ============= Detail Panel ============= */

function DetailPanel({ detail, loading, isOpen, onClose }) {
  const copy = useCallback((text) => {
    if (!text) return
    try {
      navigator.clipboard?.writeText(String(text))
    } catch {
      /* ignore */
    }
  }, [])

  if (!isOpen) {
    return (
      <aside className="logs-detail-area logs-detail-empty">
        <IconShield size={28} />
        <strong>이벤트 상세</strong>
        <span>좌측 표에서 행을 선택해주세요.</span>
      </aside>
    )
  }

  if (loading) {
    return (
      <aside className="logs-detail-area">
        <DetailHeader onClose={onClose} />
        <div className="logs-detail-loading">불러오는 중...</div>
      </aside>
    )
  }

  if (!detail) {
    return (
      <aside className="logs-detail-area">
        <DetailHeader onClose={onClose} />
        <div className="logs-detail-loading">
          상세 정보를 가져올 수 없습니다.
        </div>
      </aside>
    )
  }

  const meta = DECISION_META[detail.decision] ?? null
  const score = Number(detail.final_risk_score) || 0
  const rt = riskTone(score)
  const reasonLines = parseReasonLines(detail.reason)
  const matchedRules = Array.isArray(detail.matched_rules)
    ? detail.matched_rules
    : []

  return (
    <aside className="logs-detail-area">
      <DetailHeader onClose={onClose} />

      {/* 입력 프롬프트 */}
      <section className="logs-detail-section">
        <div className="logs-detail-section-head">
          <span className="logs-detail-label">입력 프롬프트</span>
          <button
            type="button"
            className="logs-detail-copy"
            onClick={() => copy(detail.content)}
            aria-label="복사"
            title="복사"
          >
            <IconCopy size={14} />
          </button>
        </div>
        <pre className="logs-detail-prompt">{detail.content || '-'}</pre>
      </section>

      {/* 탐지 결과 */}
      <section className="logs-detail-section">
        <span className="logs-detail-label">탐지 결과</span>
        <div className="logs-detail-results">
          <div className="logs-detail-result">
            <span className="logs-detail-result-label">공격 유형</span>
            <span className="logs-badge tone-muted">
              {detail.attack_type || '-'}
            </span>
          </div>
          <div className="logs-detail-result">
            <span className="logs-detail-result-label">결정</span>
            {meta ? (
              <span className={`logs-badge tone-${meta.tone}`}>
                {meta.label}
              </span>
            ) : (
              <span className="logs-badge tone-muted">-</span>
            )}
          </div>
          <div className="logs-detail-result">
            <span className="logs-detail-result-label">위험도</span>
            <span className={`logs-detail-risk-num tone-${rt}`}>
              {score} <span className="logs-detail-unit">/ 100</span>
            </span>
          </div>
        </div>
      </section>

      {/* 탐지 근거 */}
      <section className="logs-detail-section">
        <span className="logs-detail-label">탐지 근거</span>
        {reasonLines.length > 0 ? (
          <ul className="logs-detail-reason">
            {reasonLines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="logs-detail-empty-text">
            정보 없음 (마이그레이션된 기존 로그)
          </p>
        )}
      </section>

      {/* 점수 분해 */}
      <section className="logs-detail-section">
        <span className="logs-detail-label">점수 분해</span>
        <div className="logs-detail-scores">
          <ScoreCell label="Rule Score" value={detail.rule_score} />
          <ScoreCell label="Semantic Score" value={detail.llm_score} />
          <ScoreCell label="Context Score" value={detail.context_score} />
          <ScoreCell
            label="최종 점수"
            value={detail.final_risk_score}
            tone={rt}
            emphasize
          />
        </div>
      </section>

      {/* 매칭 룰 */}
      {matchedRules.length > 0 && (
        <section className="logs-detail-section">
          <span className="logs-detail-label">매칭 룰</span>
          <div className="logs-detail-rules">
            {matchedRules.map((r, i) => (
              <span key={`${r}-${i}`} className="logs-rule-chip">
                {typeof r === 'string' ? r : JSON.stringify(r)}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* 메타 */}
      <section className="logs-detail-section">
        <span className="logs-detail-label">메타 정보</span>
        <dl className="logs-detail-meta">
          <div>
            <dt>저장 시간</dt>
            <dd>{detail.created_at || '-'}</dd>
          </div>
          <div>
            <dt>Conversation ID</dt>
            <dd className="logs-detail-meta-row">
              <span className="logs-mono">{detail.conversation_id || '-'}</span>
              <button
                type="button"
                className="logs-detail-copy small"
                onClick={() => copy(detail.conversation_id)}
                aria-label="Conversation ID 복사"
                title="복사"
              >
                <IconCopy size={12} />
              </button>
            </dd>
          </div>
          <div>
            <dt>Scoring Mode</dt>
            <dd>{detail.scoring_mode || '정보 없음'}</dd>
          </div>
          <div>
            <dt>Override</dt>
            <dd>
              {detail.override === true || detail.override === 1
                ? '예'
                : detail.override === false || detail.override === 0
                  ? '아니오'
                  : '정보 없음'}
            </dd>
          </div>
          <div>
            <dt>Confidence</dt>
            <dd>
              {detail.confidence != null && detail.confidence > 0
                ? `${(Number(detail.confidence) * 100).toFixed(0)}%`
                : '정보 없음'}
            </dd>
          </div>
          <div>
            <dt>Intent</dt>
            <dd>{detail.intent || '정보 없음'}</dd>
          </div>
        </dl>
      </section>
    </aside>
  )
}

function DetailHeader({ onClose }) {
  return (
    <header className="logs-detail-header">
      <div className="logs-detail-title">
        <IconShield size={18} />
        <strong>이벤트 상세</strong>
      </div>
      <button
        type="button"
        className="logs-detail-close"
        onClick={onClose}
        aria-label="닫기"
        title="닫기"
      >
        ×
      </button>
    </header>
  )
}

function ScoreCell({ label, value, tone, emphasize }) {
  const n = Number(value)
  const display = Number.isFinite(n) && n !== 0 ? n : value == null ? '-' : 0
  return (
    <div
      className={`logs-score-cell${emphasize ? ' emphasize' : ''}${tone ? ` tone-${tone}` : ''}`}
    >
      <span className="logs-score-label">{label}</span>
      <span className="logs-score-num">
        {display}
        {display !== '-' && <span className="logs-detail-unit"> / 100</span>}
      </span>
    </div>
  )
}

function parseReasonLines(reason) {
  if (!reason) return []
  if (typeof reason !== 'string') return [String(reason)]
  return reason
    .split(/[\n;。.](?![0-9])/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/* ============= Analytics Widgets ============= */

function AnalyticsWidgets({ items }) {
  // Distribution by attack_type
  const distribution = useMemo(() => {
    const acc = {}
    items.forEach((log) => {
      const k = log.attack_type || '정상'
      acc[k] = (acc[k] || 0) + 1
    })
    const total = items.length || 1
    return Object.entries(acc)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({
        name,
        value,
        percent: (value / total) * 100,
        color: PIE_COLORS[i % PIE_COLORS.length],
      }))
  }, [items])

  // Hourly distribution
  const hourly = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: `${String(i).padStart(2, '0')}`,
      count: 0,
    }))
    items.forEach((log) => {
      const d = new Date(log.created_at)
      if (Number.isNaN(d.getTime())) return
      buckets[d.getHours()].count++
    })
    return buckets
  }, [items])

  // Activity summary
  const summary = useMemo(() => {
    const now = Date.now()
    const oneHourAgo = now - 60 * 60 * 1000
    let recent1h = 0
    let blocks = 0
    let max = 0
    let sum = 0
    let count = 0
    items.forEach((log) => {
      const score = Number(log.final_risk_score) || 0
      const ts = new Date(log.created_at).getTime()
      if (!Number.isNaN(ts) && ts >= oneHourAgo) recent1h++
      if (log.decision === 'Block') blocks++
      if (score > max) max = score
      sum += score
      count++
    })
    return {
      recent1h,
      blockRatio: count > 0 ? (blocks / count) * 100 : 0,
      max,
      avg: count > 0 ? sum / count : 0,
    }
  }, [items])

  return (
    <section className="logs-analytics">
      <article className="logs-widget">
        <header className="logs-widget-head">
          <h3>공격 유형 분포</h3>
          <span>현재 표시 중인 {items.length}건 기준</span>
        </header>
        {distribution.length === 0 ? (
          <div className="logs-widget-empty">데이터 없음</div>
        ) : (
          <div className="logs-widget-pie">
            <div className="logs-widget-pie-chart">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={distribution}
                    dataKey="value"
                    innerRadius={38}
                    outerRadius={60}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {distribution.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="logs-widget-legend">
              {distribution.map((d) => (
                <li key={d.name}>
                  <span
                    className="logs-legend-dot"
                    style={{ background: d.color }}
                  />
                  <span className="logs-legend-name">{d.name}</span>
                  <span className="logs-legend-val">
                    {d.percent.toFixed(1)}% ({d.value})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>

      <article className="logs-widget">
        <header className="logs-widget-head">
          <h3>시간대별 탐지 추이</h3>
          <span>0–23시 (현재 표시 중인 {items.length}건)</span>
        </header>
        {items.length === 0 ? (
          <div className="logs-widget-empty">데이터 없음</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={hourly}>
              <XAxis
                dataKey="label"
                stroke="#a0a8b8"
                tick={{ fill: '#a0a8b8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval={2}
              />
              <YAxis
                stroke="#a0a8b8"
                tick={{ fill: '#a0a8b8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ fill: 'rgba(74,158,255,0.08)' }}
              />
              <Bar dataKey="count" fill="#4a9eff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </article>

      <article className="logs-widget">
        <header className="logs-widget-head">
          <h3>최근 활동 요약</h3>
          <span>현재 표시 중인 {items.length}건 분석</span>
        </header>
        <dl className="logs-widget-summary">
          <div>
            <dt>최근 1시간 이벤트</dt>
            <dd>{summary.recent1h.toLocaleString()}건</dd>
          </div>
          <div>
            <dt>차단 비율</dt>
            <dd>{summary.blockRatio.toFixed(1)}%</dd>
          </div>
          <div>
            <dt>최고 위험도</dt>
            <dd>{summary.max}점</dd>
          </div>
          <div>
            <dt>평균 위험도</dt>
            <dd>{summary.avg.toFixed(1)}점</dd>
          </div>
        </dl>
      </article>
    </section>
  )
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null
  const p = payload[0]
  return (
    <div className="logs-chart-tooltip">
      <span className="logs-chart-tooltip-name">
        {p.payload.name ?? p.payload.label}
      </span>
      <span className="logs-chart-tooltip-value">{p.value}</span>
    </div>
  )
}

/* ============= Icons ============= */

function IconShield({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3z" />
    </svg>
  )
}

function IconShieldX({ size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3z" />
      <path d="m9 9 6 6" />
      <path d="m15 9-6 6" />
    </svg>
  )
}

function IconAlertTriangle({ size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function IconClock({ size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  )
}

function IconDoc({ size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h6" />
    </svg>
  )
}

function IconSearch({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

function IconRefresh({ size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  )
}

function IconCopy({ size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

export default LogsPage
