import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  Check,
  ChevronRight,
  Download,
  FileImage,
  FolderClock,
  ImagePlus,
  LoaderCircle,
  Menu,
  RefreshCcw,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  WandSparkles,
  X,
} from 'lucide-react'
import { fetchImageTask, healthCheck, submitImage } from './api.js'
import { clearHistory, loadHistory, saveHistory } from './storage.js'
import {
  SIZE_OPTIONS,
  WORKFLOWS,
  getWorkflow,
  modulesFor,
} from './workflows.js'

const DEFAULT_SELECTED = {
  base: ['home', 'minimal'],
  detail: ['hero', 'feature'],
  overseas: ['main', 'infographic'],
  poster: ['launch'],
  fun: ['figure'],
}

const TERMINAL_STATES = new Set(['completed', 'failed'])
const STATIC_HOSTING = __STATIC_HOSTING__

function mergeTerminalHistory(history, tasks) {
  const terminal = tasks.filter((task) => TERMINAL_STATES.has(task.status))
  if (!terminal.length) return history
  const byId = new Map(history.map((item) => [item.localId, item]))
  terminal.forEach((item) => byId.set(item.localId, item))
  return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, 80)
}

function makeLocalId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('图片读取失败，请重新选择'))
    reader.readAsDataURL(file)
  })
}

function promptFor({ workflow, module, productInfo, features, extra, platform, region, language, posterPrompt }) {
  const quality = '超清商业摄影，画面结构完整，物理光影真实，无水印，无错乱文字，无多余物体。'
  const preserve = '严格保留参考图中产品的造型、比例、材质、颜色与品牌特征，不改变产品设计。'
  const optional = extra ? `额外要求：${extra}。` : ''

  if (workflow === 'poster') {
    return `${module.prompt}。海报内容：${posterPrompt || '围绕参考图产品完成高级商业设计'}。${preserve}${optional}${quality}`
  }
  if (workflow === 'fun') {
    return `${module.prompt}。不添加无关人物，不改变主体身份特征。${optional}${quality}`
  }
  if (workflow === 'detail') {
    return `${module.prompt}。商品信息：${productInfo}。核心卖点：${features || '根据商品信息提炼，不虚构参数'}。${preserve}${optional}${quality}`
  }
  if (workflow === 'overseas') {
    return `${module.prompt}。目标平台：${platform}，地区：${region}，主语言：${language}。符合目标平台的主图审美与合规规范。${preserve}${optional}${quality}`
  }
  return `${module.prompt}。${preserve}${optional}${quality}`
}

function Brand() {
  return (
    <div className="brand" aria-label="AI 做图工作台">
      <span className="brand-mark"><WandSparkles size={19} /></span>
      <span className="brand-copy"><b>AI 做图</b><small>IMAGE STUDIO</small></span>
    </div>
  )
}

function Sidebar({ active, onChange, open, onClose }) {
  const activeImageCount = WORKFLOWS.filter((item) => item.enabled).length
  return (
    <>
      <button className={`sidebar-scrim ${open ? 'show' : ''}`} onClick={onClose} aria-label="关闭菜单" />
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-mobile-head"><Brand /><button className="icon-button" onClick={onClose}><X size={18} /></button></div>
        <div className="sidebar-scroll">
          <p className="nav-caption">创作工作台</p>
          <nav className="nav-list" aria-label="创作工具">
            {WORKFLOWS.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  className={`nav-item ${active === item.id ? 'active' : ''}`}
                  onClick={() => {
                    if (!item.enabled) return
                    onChange(item.id)
                    onClose()
                  }}
                  disabled={!item.enabled}
                  title={!item.enabled ? '需要补充对应接口后才能启用' : undefined}
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                  {item.badge && <em className={item.enabled ? 'badge-new' : 'badge-soon'}>{item.badge}</em>}
                </button>
              )
            })}
          </nav>
          <p className="nav-caption account-caption">账号</p>
          <div className="account-card">
            <div className="account-avatar">AI</div>
            <div><b>本地工作台</b><small>{activeImageCount} 个做图流程已接入</small></div>
          </div>
        </div>
        <div className="sidebar-foot">
          <span className="status-dot" />
          <span>密钥仅保存在服务端</span>
        </div>
      </aside>
    </>
  )
}

function Topbar({ onMenu, onHistory, historyCount }) {
  return (
    <header className="topbar">
      <div className="topbar-left"><button className="icon-button menu-button" onClick={onMenu}><Menu size={21} /></button><Brand /></div>
      <div className="topbar-actions">
        <button className="top-action" onClick={onHistory}><FolderClock size={16} />本地草稿 <span>{historyCount}</span></button>
      </div>
    </header>
  )
}

function SectionTitle({ children, hint }) {
  return <div className="section-title"><span>{children}</span>{hint && <small>{hint}</small>}</div>
}

function UploadBox({ image, onChange, required = true }) {
  const inputRef = useRef(null)
  async function pick(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      onChange(null, '仅支持 PNG、JPEG 或 WEBP 图片')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      onChange(null, '图片不能超过 10MB')
      return
    }
    try {
      onChange({ name: file.name, dataUrl: await fileToDataUrl(file) })
    } catch (error) {
      onChange(null, error.message)
    }
  }

  return (
    <>
      <SectionTitle hint={required ? '建议白底 / 透明底，仅 1 张' : '可选，仅 1 张'}>{required ? '产品图（白底最佳）' : '参考图（可选）'}</SectionTitle>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={pick} />
      {image ? (
        <div className="upload-preview">
          <img src={image.dataUrl} alt="已上传的参考图" />
          <div><b>{image.name}</b><small>已读取，提交时会通过服务端传给生图接口</small></div>
          <button className="text-button danger" onClick={() => onChange(null)}><Trash2 size={15} />移除</button>
        </div>
      ) : (
        <button className="upload-box" onClick={() => inputRef.current?.click()}>
          <span className="upload-icon"><Upload size={20} /></span>
          <b>上传图片</b>
          <small>PNG / JPEG / WEBP，最大 10MB</small>
        </button>
      )}
    </>
  )
}

function SizePicker({ value, onChange }) {
  return (
    <div className="form-block">
      <SectionTitle>输出尺寸</SectionTitle>
      <div className="size-grid">
        {SIZE_OPTIONS.slice(0, 3).map((item) => (
          <button key={item.value} className={`size-option ${value === item.value ? 'selected' : ''}`} onClick={() => onChange(item.value)}>
            <b>{item.label}</b><small>{item.ratio}</small>{value === item.value && <Check size={14} />}
          </button>
        ))}
      </div>
    </div>
  )
}

function ModuleGrid({ modules, selected, onToggle, single = false }) {
  return (
    <div className="module-grid">
      {modules.map((item) => {
        const checked = selected.includes(item.id)
        return (
          <button
            key={item.id}
            className={`module-card ${checked ? 'selected' : ''}`}
            onClick={() => onToggle(item.id, single)}
          >
            <span><b>{item.label}</b><small>{item.note}</small></span>
            <i>{checked && <Check size={13} />}</i>
          </button>
        )
      })}
    </div>
  )
}

function WorkflowFields({ workflow, state, setters }) {
  const { image, size, selected, extra, productInfo, features, platform, region, language, posterPrompt } = state
  const { setImage, setSize, toggleModule, setExtra, setProductInfo, setFeatures, setPlatform, setRegion, setLanguage, setPosterPrompt } = setters
  const needsImage = workflow !== 'poster'

  return (
    <>
      <UploadBox image={image} required={needsImage} onChange={setImage} />
      <SizePicker value={size} onChange={setSize} />

      {workflow === 'detail' && (
        <div className="two-column-fields">
          <label><span>商品信息 <em>*</em></span><textarea value={productInfo} onChange={(event) => setProductInfo(event.target.value)} placeholder="例如：真无线降噪耳机，轻量化设计，适合通勤与运动" maxLength={1000} /></label>
          <label><span>核心卖点</span><textarea value={features} onChange={(event) => setFeatures(event.target.value)} placeholder="例如：40dB 降噪、36 小时续航、IPX5 防水" maxLength={1000} /></label>
        </div>
      )}

      {workflow === 'overseas' && (
        <div className="select-row">
          <label><span>目标平台</span><select value={platform} onChange={(event) => setPlatform(event.target.value)}><option>Amazon</option><option>Shopify</option><option>TikTok Shop</option><option>Shopee</option></select></label>
          <label><span>目标地区</span><select value={region} onChange={(event) => setRegion(event.target.value)}><option>美国</option><option>欧洲</option><option>东南亚</option><option>日本</option></select></label>
          <label><span>主语言</span><select value={language} onChange={(event) => setLanguage(event.target.value)}><option>英文</option><option>德文</option><option>日文</option><option>泰文</option></select></label>
        </div>
      )}

      {workflow === 'poster' && (
        <label className="full-field"><span>海报内容 <em>*</em></span><textarea value={posterPrompt} onChange={(event) => setPosterPrompt(event.target.value)} placeholder="例如：为秋季护肤新品做一张竖版发布海报，主标题“润入秋光”，米白与琉璃金配色" maxLength={4000} /></label>
      )}

      <label className="full-field"><span>额外要求（可选） <small><Sparkles size={13} />用自然语言描述</small></span><textarea value={extra} onChange={(event) => setExtra(event.target.value)} placeholder={'例如：\n· 暖色调\n· 强调高级感\n· 不要有人物'} maxLength={1500} /></label>

      <div className="form-block">
        <SectionTitle hint={workflow === 'poster' || workflow === 'fun' ? '单选' : '多选'}>
          {workflow === 'base' ? '场景预设' : workflow === 'detail' ? '详情页模块' : workflow === 'overseas' ? '电商图类型' : workflow === 'poster' ? '海报模板起点' : '挑一种玩法'}
        </SectionTitle>
        <ModuleGrid modules={modulesFor(workflow)} selected={selected} onToggle={toggleModule} single={workflow === 'poster' || workflow === 'fun'} />
      </div>
    </>
  )
}

function TaskCard({ task, onRetry }) {
  const active = task.status === 'queued' || task.status === 'processing'
  return (
    <article className={`result-card ${task.status}`}>
      <div className="result-media">
        {task.imageUrl ? <img src={task.imageUrl} alt={task.label || 'AI 生成结果'} /> : active ? (
          <div className="generating"><LoaderCircle className="spin" size={28} /><b>{task.status === 'queued' ? '已提交，等待生成' : `AI 生成中 ${task.progress || 0}%`}</b><small>页面会自动查询结果</small></div>
        ) : (
          <div className="generating failed-state"><AlertCircle size={28} /><b>生成失败</b><small>{task.error || '请调整参数后重试'}</small></div>
        )}
      </div>
      <div className="result-info">
        <div><b>{task.label}</b><small>{new Date(task.createdAt).toLocaleString('zh-CN', { hour12: false })}</small></div>
        {task.imageUrl ? <a className="result-action" href={task.imageUrl} target="_blank" rel="noreferrer"><Download size={15} />下载 / 原图</a> : !active && onRetry && <button className="result-action" onClick={() => onRetry(task)}><RefreshCcw size={15} />重试</button>}
      </div>
    </article>
  )
}

function Results({ tasks, onRetry }) {
  if (!tasks.length) return null
  return (
    <section className="results-section">
      <div className="results-head"><div><Sparkles size={18} /><span>生成结果</span></div><small>结果链接可能有时效，生成后请及时下载</small></div>
      <div className="results-grid">{tasks.map((task) => <TaskCard key={task.localId} task={task} onRetry={onRetry} />)}</div>
    </section>
  )
}

function HistoryDrawer({ open, history, onClose, onClear }) {
  return (
    <div className={`drawer-shell ${open ? 'open' : ''}`} aria-hidden={!open}>
      <button className="drawer-scrim" onClick={onClose} aria-label="关闭草稿箱" />
      <aside className="history-drawer">
        <div className="drawer-head"><div><FolderClock size={19} /><b>本地草稿</b><span>{history.length}</span></div><button className="icon-button" onClick={onClose}><X size={18} /></button></div>
        <p className="drawer-note">只保存生成参数与结果链接，不保存你上传的原图。</p>
        <div className="history-list">
          {!history.length && <div className="empty-history"><FileImage size={30} /><b>还没有生成记录</b><small>完成或失败的任务会出现在这里</small></div>}
          {history.map((item) => <TaskCard key={item.localId} task={item} onRetry={null} />)}
        </div>
        {history.length > 0 && <button className="clear-history" onClick={onClear}><Trash2 size={15} />清空本地记录</button>}
      </aside>
    </div>
  )
}

function SettingsBar({ model, setModel, configured, staticHosting }) {
  return (
    <div className="settings-bar">
      <div className={`api-state ${configured ? 'ready' : 'warning'}`}><span />{configured ? '做图接口已配置' : staticHosting ? '静态演示版 · 服务端待部署' : '做图接口未配置'}</div>
      <label><Settings2 size={15} /><span>图像模型</span><select value={model} onChange={(event) => setModel(event.target.value)}><option value="gpt-image-2.5">GPT Image 2.5</option><option value="gpt-image-2">GPT Image 2</option><option value="nano_banana_2">Nano Banana 2</option></select></label>
    </div>
  )
}

export default function App() {
  const [active, setActive] = useState(() => {
    const route = window.location.hash.replace('#/', '')
    return WORKFLOWS.some((item) => item.id === route && item.enabled) ? route : 'base'
  })
  const [mobileMenu, setMobileMenu] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [model, setModel] = useState('gpt-image-2.5')
  const [image, setImageState] = useState(null)
  const [uploadError, setUploadError] = useState('')
  const [size, setSize] = useState('1024x1024')
  const [selectedByWorkflow, setSelectedByWorkflow] = useState(DEFAULT_SELECTED)
  const [extra, setExtra] = useState('')
  const [productInfo, setProductInfo] = useState('')
  const [features, setFeatures] = useState('')
  const [platform, setPlatform] = useState('Amazon')
  const [region, setRegion] = useState('美国')
  const [language, setLanguage] = useState('英文')
  const [posterPrompt, setPosterPrompt] = useState('')
  const [tasks, setTasks] = useState([])
  const [history, setHistory] = useState(loadHistory)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const polling = useRef(false)

  const workflow = getWorkflow(active)
  const selected = selectedByWorkflow[active] || []
  const pageTasks = useMemo(() => tasks.filter((task) => task.workflow === active), [tasks, active])

  useEffect(() => {
    if (STATIC_HOSTING) return
    healthCheck().then((result) => setConfigured(Boolean(result.configured))).catch(() => setConfigured(false))
  }, [])

  useEffect(() => {
    window.location.hash = `/${active}`
    setFormError('')
    setUploadError('')
  }, [active])

  useEffect(() => {
    const next = mergeTerminalHistory(history, tasks)
    if (next !== history && JSON.stringify(next) !== JSON.stringify(history)) {
      setHistory(next)
      saveHistory(next)
    }
  }, [tasks, history])

  const activeTaskIds = tasks.filter((task) => !TERMINAL_STATES.has(task.status) && !task.id.startsWith('local-')).map((task) => task.id).join('|')
  useEffect(() => {
    if (!activeTaskIds) return undefined
    const poll = async () => {
      if (polling.current) return
      polling.current = true
      try {
        const ids = activeTaskIds.split('|')
        const updates = await Promise.all(ids.map(async (id) => {
          try {
            const response = await fetchImageTask(id)
            return response.task
          } catch (error) {
            return { id, pollError: error.message }
          }
        }))
        const byId = new Map(updates.map((item) => [item.id, item]))
        setTasks((current) => current.map((task) => {
          const update = byId.get(task.id)
          if (!update) return task
          if (update.pollError) {
            return Date.now() - task.createdAt > 15 * 60 * 1000
              ? { ...task, status: 'failed', error: '查询生成结果超时，请重试' }
              : task
          }
          return { ...task, ...update }
        }))
      } finally {
        polling.current = false
      }
    }
    poll()
    const timer = window.setInterval(poll, 3500)
    return () => window.clearInterval(timer)
  }, [activeTaskIds])

  function setImage(next, error = '') {
    setImageState(next)
    setUploadError(error)
  }

  function toggleModule(id, single) {
    setSelectedByWorkflow((current) => {
      const existing = current[active] || []
      const next = single ? [id] : existing.includes(id) ? existing.filter((item) => item !== id) : [...existing, id]
      return { ...current, [active]: next }
    })
  }

  function validateForm() {
    if (active !== 'poster' && !image) return '请先上传一张参考图'
    if (!selected.length) return '至少选择一个生成场景或模块'
    if (active === 'detail' && !productInfo.trim()) return '请填写商品信息'
    if (active === 'poster' && !posterPrompt.trim() && !image) return '请填写海报内容或上传参考图'
    if (!configured) return STATIC_HOSTING
      ? 'GitHub Pages 只能托管静态前端，需要另行部署 Node 服务端才能生图'
      : '服务器未配置做图接口密钥'
    return ''
  }

  function buildJobs() {
    const modules = modulesFor(active).filter((item) => selected.includes(item.id))
    return modules.map((module) => ({
      label: module.label,
      prompt: promptFor({ workflow: active, module, productInfo, features, extra, platform, region, language, posterPrompt }),
    }))
  }

  async function runJobs(jobs, retryImage = image) {
    setSubmitting(true)
    setFormError('')
    for (const job of jobs) {
      const createdAt = Date.now()
      try {
        const response = await submitImage({
          model,
          prompt: job.prompt,
          n: 1,
          size,
          aspectRatio: SIZE_OPTIONS.find((item) => item.value === size)?.ratio || '1:1',
          referenceImages: retryImage ? [retryImage.dataUrl] : [],
        })
        setTasks((current) => [
          ...response.tasks.map((task) => ({ ...task, localId: makeLocalId(), workflow: active, workflowLabel: workflow.label, label: job.label, prompt: job.prompt, createdAt })),
          ...current,
        ])
      } catch (error) {
        setTasks((current) => [{
          id: `local-${makeLocalId()}`,
          localId: makeLocalId(),
          workflow: active,
          workflowLabel: workflow.label,
          label: job.label,
          prompt: job.prompt,
          createdAt,
          status: 'failed',
          progress: 0,
          imageUrl: null,
          error: error.message,
        }, ...current])
      }
    }
    setSubmitting(false)
  }

  async function generate() {
    const error = validateForm()
    if (error) {
      setFormError(error)
      return
    }
    await runJobs(buildJobs())
  }

  async function retry(task) {
    if (!image && active !== 'poster') {
      setFormError('重试前请重新上传参考图（本地草稿不保存原图）')
      return
    }
    await runJobs([{ label: `${task.label}·重试`, prompt: task.prompt }])
  }

  function clearSavedHistory() {
    clearHistory()
    setHistory([])
  }

  const heroCopy = active === 'base'
    ? ['1 张产品图 · N 种场景', '一张产品图，快速生成多种场景化底图']
    : active === 'detail'
      ? ['一套电商视觉', '用同一产品图生成统一风格的详情页模块']
      : active === 'overseas'
        ? ['跨境电商素材', '按平台、地区与语言生成本地化商品图']
        : active === 'poster'
          ? ['专业海报生成', '从模板出发，用自然语言完成商业海报']
          : ['一张图玩出新风格', '保留主体特征，一键转换高质感视觉风格']

  return (
    <div className="app-shell">
      <Topbar onMenu={() => setMobileMenu(true)} onHistory={() => setHistoryOpen(true)} historyCount={history.length} />
      <div className="workspace">
        <Sidebar active={active} onChange={setActive} open={mobileMenu} onClose={() => setMobileMenu(false)} />
        <main className="main-content">
          <div className="page-wrap">
            <div className="page-heading">
              <div><span className="eyebrow"><Sparkles size={13} />AI IMAGE WORKFLOW</span><h1>{workflow.label}</h1><p>{heroCopy[1]}</p></div>
              <div className="step-pill"><span>1</span>上传 <ChevronRight size={13} /><span>2</span>配置 <ChevronRight size={13} /><span>3</span>生成</div>
            </div>

            <SettingsBar model={model} setModel={setModel} configured={configured} staticHosting={STATIC_HOSTING} />

            <section className="creator-card">
              <WorkflowFields
                workflow={active}
                state={{ image, size, selected, extra, productInfo, features, platform, region, language, posterPrompt }}
                setters={{ setImage, setSize, toggleModule, setExtra, setProductInfo, setFeatures, setPlatform, setRegion, setLanguage, setPosterPrompt }}
              />
              {uploadError && <div className="inline-error"><AlertCircle size={16} />{uploadError}</div>}
              {formError && <div className="inline-error"><AlertCircle size={16} />{formError}</div>}
              <div className="generate-row">
                <div><b>{heroCopy[0]}</b><small>将提交 {selected.length || 0} 个独立生图任务</small></div>
                <button className="generate-button" onClick={generate} disabled={submitting}>
                  {submitting ? <><LoaderCircle className="spin" size={18} />正在提交…</> : <><ImagePlus size={18} />开始生成（{selected.length} 张）</>}
                </button>
              </div>
            </section>

            <Results tasks={pageTasks} onRetry={retry} />
          </div>
        </main>
      </div>
      <HistoryDrawer open={historyOpen} history={history} onClose={() => setHistoryOpen(false)} onClear={clearSavedHistory} />
    </div>
  )
}
