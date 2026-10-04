<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { Activity, Award, Bell, BookOpen, CalendarDays, ChartNoAxesCombined, Check, ChevronRight, CircleHelp, HeartPulse, LayoutDashboard, Menu, PawPrint, Pencil, Pill, Plus, RotateCcw, Settings, ShieldCheck, Sparkles, Trash2, Utensils, X } from 'lucide-vue-next'
import PetModal from './components/PetModal.vue'
import RecordModal from './components/RecordModal.vue'
import ConfirmModal from './components/ConfirmModal.vue'
import UndoToast from './components/UndoToast.vue'
import TrendChart from './components/TrendChart.vue'
import { calculateAge, collectionMeta, daysFromToday, formatDate, normalRanges, todayISO } from './data'
import { usePetStore } from './composables/usePetStore'

const { state, petById, petName, totalActivity, pendingVaccines, feedingTasks, achievements, healthCompleteness, add, addPet, update, remove, restore, destroy, emptyTrash } = usePetStore()
const activeNav = ref('overview')
const showPetModal = ref(false)
const recordType = ref('')
const modalRecord = ref(null)
const selectedPetId = ref('pet-momo')
const selectedMetric = ref('weight')
const mobileMenu = ref(false)
const navItems = [
  { id: 'overview', label: '总览', icon: LayoutDashboard },
  { id: 'health', label: '健康档案', icon: HeartPulse },
  { id: 'schedule', label: '日程提醒', icon: CalendarDays },
  { id: 'activity', label: '活动记录', icon: Activity },
  { id: 'achievements', label: '成就徽章', icon: Award },
]
const currentPet = computed(() => petById(selectedPetId.value) || state.pets[0])
const recentHealthRecords = computed(() => state.healthRecords.filter((item) => item.petId === selectedPetId.value && item.type === selectedMetric.value).sort((a, b) => a.date.localeCompare(b.date)).slice(-7))
const healthStatus = computed(() => {
  const value = Number(recentHealthRecords.value.at(-1)?.value || currentPet.value?.weight || 0)
  const range = normalRanges[selectedMetric.value]
  if (!value) return { label: '等待记录', className: 'neutral' }
  return value >= range.min && value <= range.max
    ? { label: '处于正常范围', className: 'good' }
    : { label: '建议重点关注', className: 'attention' }
})
const activeAchievements = computed(() => achievements.value.filter((item) => item.unlocked))
const upcomingVaccines = computed(() => state.vaccines.map((item) => ({ ...item, days: daysFromToday(item.nextDate) })).sort((a, b) => a.days - b.days))
const medicationPlans = computed(() => state.medications.map((item) => {
  const today = todayISO()
  const status = item.endDate < today ? '已结束' : item.startDate > today ? '未开始' : '进行中'
  const tone = status === '进行中' ? 'success' : status === '未开始' ? 'warning' : 'neutral'
  return { ...item, status, tone }
}))
const agenda = computed(() => {
  const feedingItems = state.feedings.flatMap((item) => Array.from(
    { length: Number(item.times || 1) },
    (_, index) => ({
      id: `${item.id}-${index}`,
      kind: 'feeding',
      icon: Utensils,
      title: `${petName(item.petId)} · ${item.food}`,
      detail: `${item.portion || '按计划'} · 第 ${index + 1} 餐`,
      time: index === 0 ? '08:00' : index === 1 ? '18:00' : '21:00',
    }),
  ))
  const medicationItems = state.medications
    .filter((item) => item.startDate <= todayISO() && item.endDate >= todayISO())
    .map((item) => ({
      id: item.id,
      kind: 'medication',
      icon: Pill,
      title: `${petName(item.petId)} · ${item.name}`,
      detail: `${item.dose} · ${item.frequency}`,
      time: '09:00',
    }))
  const vaccineItems = upcomingVaccines.value
    .filter((item) => item.days <= 7)
    .map((item) => ({
      id: item.id,
      kind: 'vaccine',
      icon: ShieldCheck,
      title: `${petName(item.petId)} · ${item.name}`,
      detail: item.days < 0 ? '已逾期，请尽快安排' : item.days === 0 ? '今天需要接种' : `${item.days} 天后到期`,
      time: '提醒',
    }))
  return [...feedingItems, ...medicationItems, ...vaccineItems]
})
const averageWeightChange = computed(() => {
  const records = state.healthRecords.filter((item) => item.type === 'weight')
  if (records.length < 2) return '0.0 kg'
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date))
  return `${(Number(sorted[sorted.length - 1].value) - Number(sorted[0].value)).toFixed(1)} kg`
})
const leaderboard = computed(() => state.pets.map((pet) => ({ ...pet, completeness: healthCompleteness(pet.id), activity: state.activities.filter((item) => item.petId === pet.id).reduce((sum, item) => sum + Number(item.duration || 0), 0) })).sort((a, b) => b.completeness - a.completeness))
const trashEntries = computed(() => state.trash)

// ---------- 新增 / 编辑 ----------
function openRecord(type) { modalRecord.value = null; recordType.value = type }
function editRecord(type, record) { modalRecord.value = record; recordType.value = type }
function closeRecordModal() { recordType.value = ''; modalRecord.value = null }
function saveRecord({ collection, payload, id }) {
  // 有 id 走编辑（id 不可变），否则新增；趋势图/状态/榜单/徽章均为 computed，自动刷新
  if (id) update(collection, id, payload)
  else add(collection, payload)
  closeRecordModal()
}
function metricLabel(type) { return normalRanges[type]?.label || type }
function vaccineTone(days) { return days < 0 ? 'danger' : days <= 7 ? 'warning' : 'success' }

// ---------- 删除确认 ----------
const confirmTarget = ref(null)
// kind: 'record' 普通删除（进回收站）| 'trash' 彻底删除单条 | 'empty' 清空回收站
function requestDelete(collection, record) { confirmTarget.value = { kind: 'record', collection, record } }
function requestDestroy(entry) { confirmTarget.value = { kind: 'trash', entry } }
function requestEmptyTrash() { if (state.trash.length) confirmTarget.value = { kind: 'empty' } }
function cancelConfirm() { confirmTarget.value = null }

const confirmView = computed(() => {
  const target = confirmTarget.value
  if (!target) return { visible: false }
  if (target.kind === 'record') {
    return {
      visible: true,
      title: `删除${collectionMeta[target.collection].label}？`,
      message: `将删除「${recordSummary(target.collection, target.record)}」，趋势图、健康状态、榜单完整度和成就徽章会同步重新计算。`,
      note: '记录会先移入回收站，30 天内可随时恢复；删除后也可以立刻点击「撤销」。',
      confirmText: '确认删除',
    }
  }
  if (target.kind === 'trash') {
    return { visible: true, title: '彻底删除这条记录？', message: `「${recordSummary(target.entry.collection, target.entry.record)}」将被永久删除，无法恢复。`, note: '', confirmText: '彻底删除' }
  }
  return { visible: true, title: '清空回收站？', message: `回收站中的 ${state.trash.length} 条记录将被永久删除，无法恢复。`, note: '', confirmText: '全部清空' }
})

function confirmDelete() {
  const target = confirmTarget.value
  if (!target) return
  if (target.kind === 'record') {
    const trashId = remove(target.collection, target.record.id)
    if (trashId) showUndo(trashId, target.collection)
  } else if (target.kind === 'trash') {
    destroy(target.entry.id)
  } else {
    emptyTrash()
  }
  confirmTarget.value = null
}

// ---------- 删除后撤销（8 秒）与回收站恢复 ----------
const undoState = ref({ visible: false, trashId: null, message: '' })
let undoTimer = null
function showUndo(trashId, collection) {
  if (undoTimer) clearTimeout(undoTimer)
  undoState.value = { visible: true, trashId, message: `${collectionMeta[collection].undoText}已删除，已移入回收站` }
  undoTimer = setTimeout(dismissUndo, 8000)
}
function undoDelete() {
  if (undoState.value.trashId) restore(undoState.value.trashId)
  dismissUndo()
}
function restoreEntry(id) { restore(id) }
function dismissUndo() {
  if (undoTimer) { clearTimeout(undoTimer); undoTimer = null }
  undoState.value = { visible: false, trashId: null, message: '' }
}
onUnmounted(dismissUndo)

// ---------- 文案辅助 ----------
function recordSummary(collection, record) {
  switch (collection) {
    case 'healthRecords': return `${petName(record.petId)} · ${metricLabel(record.type)} ${record.value}${normalRanges[record.type].unit}`
    case 'vaccines': return `${petName(record.petId)} · ${record.category || '疫苗'} · ${record.name}`
    case 'medications': return `${petName(record.petId)} · ${record.name}${record.dose ? ` ${record.dose}` : ''}`
    case 'feedings': return `${petName(record.petId)} · ${record.food}${record.brand ? ` ${record.brand}` : ''}`
    case 'activities': return `${petName(record.petId)} · ${record.type} ${record.duration} 分钟`
    default: return '一条记录'
  }
}
function formatDeletedAt(iso) {
  return new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar" :class="{ 'is-open': mobileMenu }">
      <div class="brand"><div class="brand-mark"><PawPrint :size="20" /></div><div><strong>宠物家</strong><span>Petcare Home</span></div><button class="icon-btn mobile-close" @click="mobileMenu = false"><X :size="18" /></button></div>
      <div class="household"><div class="household-avatar">林</div><div><strong>林家宠物屋</strong><span>2 位家庭成员</span></div><ChevronRight :size="16" /></div>
      <nav class="nav-list"><button v-for="item in navItems" :key="item.id" :class="{ active: activeNav === item.id }" @click="activeNav = item.id; mobileMenu = false"><component :is="item.icon" :size="18" /><span>{{ item.label }}</span><span v-if="item.id === 'schedule' && agenda.length" class="nav-count">{{ agenda.length }}</span></button></nav>
      <div class="sidebar-bottom"><button><BookOpen :size="18" />知识库</button><button><Settings :size="18" />设置</button><div class="help-box"><CircleHelp :size="17" /><span>需要帮助？<b>查看使用指南</b></span></div></div>
    </aside>
    <main class="main-content">
      <header class="topbar"><button class="icon-btn menu-toggle" @click="mobileMenu = true"><Menu :size="21" /></button><div><span class="eyebrow">{{ activeNav === 'overview' ? '家庭健康空间' : navItems.find((item) => item.id === activeNav)?.label }}</span><h1>{{ activeNav === 'overview' ? '早上好，林家。' : navItems.find((item) => item.id === activeNav)?.label }}</h1></div><div class="top-actions"><button class="icon-btn notification"><Bell :size="19" /><i></i></button><button class="user-chip"><span>林</span><strong>Lin</strong></button></div></header>
      <div v-if="activeNav === 'overview'" class="page">
        <section class="welcome-row"><div><p class="section-kicker">星期三，2026年9月16日</p><h2>今天也要好好照顾它们。</h2><p class="muted">这里是你和 Momo、Nori 的小小健康空间。</p></div><button class="btn btn-primary" @click="showPetModal = true"><Plus :size="17" />添加宠物</button></section>
        <section class="stat-grid"><article class="stat-card"><div class="stat-icon green"><PawPrint :size="19" /></div><div><span>我的宠物</span><strong>{{ state.pets.length }}<small> 位</small></strong><em>档案都很完整</em></div></article><article class="stat-card"><div class="stat-icon peach"><Utensils :size="19" /></div><div><span>今日待喂食</span><strong>{{ feedingTasks }}<small> 餐</small></strong><em>按计划进行中</em></div></article><article class="stat-card"><div class="stat-icon lavender"><ShieldCheck :size="19" /></div><div><span>待接种疫苗</span><strong>{{ pendingVaccines }}<small> 项</small></strong><em :class="{ 'text-warning': pendingVaccines }">{{ pendingVaccines ? '有一项即将到期' : '暂无临期提醒' }}</em></div></article><article class="stat-card"><div class="stat-icon blue"><Activity :size="19" /></div><div><span>本周活动</span><strong>{{ totalActivity }}<small> 分钟</small></strong><em>平均体重变化 {{ averageWeightChange }}</em></div></article></section>
        <section class="content-grid">
          <article class="panel pets-panel"><div class="panel-heading"><div><span class="eyebrow">成员档案</span><h3>我的宠物</h3></div><button class="text-btn" @click="activeNav = 'health'">查看档案 <ChevronRight :size="15" /></button></div><div class="pet-list"><button v-for="pet in state.pets" :key="pet.id" class="pet-card" :class="{ selected: selectedPetId === pet.id }" @click="selectedPetId = pet.id"><div class="pet-avatar" :class="pet.species === '狗' ? 'dog' : 'cat'"><img v-if="pet.photo" :src="pet.photo" :alt="pet.name" /><span v-else>{{ pet.species === '狗' ? '🐕' : pet.species === '猫' ? '🐈' : '🐾' }}</span></div><div class="pet-info"><strong>{{ pet.name }}</strong><span>{{ pet.breed || pet.species }} · {{ pet.gender }}</span><span>{{ calculateAge(pet.birthDate) }} · {{ pet.weight || '--' }} kg</span></div><div class="pet-status"><span class="status-dot"></span>健康</div><ChevronRight class="pet-arrow" :size="17" /></button><button class="add-pet-card" @click="showPetModal = true"><span><Plus :size="18" /></span><strong>添加新宠物</strong><small>建立专属健康档案</small></button></div></article>
          <article class="panel agenda-panel"><div class="panel-heading"><div><span class="eyebrow">今天 · 9月16日</span><h3>日程提醒</h3></div><button class="icon-btn subtle"><CalendarDays :size="18" /></button></div><div class="agenda-list"><div v-for="item in agenda.slice(0, 5)" :key="item.id" class="agenda-item"><div class="agenda-time">{{ item.time }}</div><div class="agenda-icon" :class="item.kind"><component :is="item.icon" :size="17" /></div><div class="agenda-copy"><strong>{{ item.title }}</strong><span>{{ item.detail }}</span></div><button class="check-circle"><Check :size="14" /></button></div><div v-if="!agenda.length" class="empty-state">今天没有待办，享受轻松的一天吧。</div></div><button class="full-btn" @click="activeNav = 'schedule'">查看全部日程 <ChevronRight :size="15" /></button></article>
        </section>
        <section class="content-grid lower-grid">
          <article class="panel trend-panel"><div class="panel-heading"><div><span class="eyebrow">健康趋势</span><h3>{{ currentPet?.name }} 的{{ metricLabel(selectedMetric) }}变化</h3></div><div class="segmented"><button v-for="metric in ['weight', 'temperature', 'heartRate']" :key="metric" :class="{ active: selectedMetric === metric }" @click="selectedMetric = metric">{{ metricLabel(metric) }}</button></div></div><div class="trend-summary"><div><strong>{{ recentHealthRecords.at(-1)?.value || currentPet?.weight || '--' }} <small>{{ normalRanges[selectedMetric].unit }}</small></strong><span>最近记录 · {{ recentHealthRecords.at(-1)?.date ? formatDate(recentHealthRecords.at(-1).date) : '暂无' }}</span></div><span class="health-status" :class="healthStatus.className"><i></i>{{ healthStatus.label }}</span><span class="range-tag"><span></span>正常范围 {{ normalRanges[selectedMetric].min }} - {{ normalRanges[selectedMetric].max }} {{ normalRanges[selectedMetric].unit }}</span></div><TrendChart :records="recentHealthRecords" :type="selectedMetric" /><button class="full-btn" @click="openRecord('health')">记录健康指标 <Plus :size="15" /></button></article>
          <article class="panel quick-panel"><div class="panel-heading"><div><span class="eyebrow">快速记录</span><h3>把日常变成习惯</h3></div><Sparkles :size="18" class="heading-spark" /></div><div class="quick-actions"><button @click="openRecord('health')"><span class="quick-icon health"><HeartPulse :size="19" /></span><span><strong>健康指标</strong><small>体重、体温、心率</small></span><ChevronRight :size="16" /></button><button @click="openRecord('vaccine')"><span class="quick-icon vaccine"><ShieldCheck :size="19" /></span><span><strong>疫苗与驱虫</strong><small>守护免疫计划</small></span><ChevronRight :size="16" /></button><button @click="openRecord('medication')"><span class="quick-icon medication"><Pill :size="19" /></span><span><strong>用药计划</strong><small>记录药品与疗程</small></span><ChevronRight :size="16" /></button><button @click="openRecord('activity')"><span class="quick-icon activity"><Activity :size="19" /></span><span><strong>活动记录</strong><small>记录每一次活力</small></span><ChevronRight :size="16" /></button><button @click="openRecord('feeding')"><span class="quick-icon feeding"><Utensils :size="19" /></span><span><strong>喂食计划</strong><small>安排每日饮食</small></span><ChevronRight :size="16" /></button></div></article>
        </section>
        <section class="content-grid bottom-grid"><article class="panel vaccine-panel"><div class="panel-heading"><div><span class="eyebrow">免疫计划</span><h3>疫苗与驱虫</h3></div><button class="text-btn" @click="openRecord('vaccine')">添加 <Plus :size="15" /></button></div><div class="vaccine-list"><div v-for="item in upcomingVaccines.slice(0, 3)" :key="item.id" class="vaccine-item"><div class="vaccine-mark"><ShieldCheck :size="17" /></div><div><strong>{{ item.category || '疫苗' }} · {{ item.name }}</strong><span>{{ petName(item.petId) }} · {{ item.hospital || '未填写医院' }}</span></div><span class="date-badge" :class="vaccineTone(item.days)">{{ item.days < 0 ? '已逾期' : item.days === 0 ? '今天' : `${item.days} 天后` }}</span></div></div></article><article class="panel achievement-panel"><div class="panel-heading"><div><span class="eyebrow">成长足迹</span><h3>成就徽章 <small>{{ activeAchievements.length }}/12</small></h3></div><button class="text-btn" @click="activeNav = 'achievements'">全部 <ChevronRight :size="15" /></button></div><div class="badge-row"><div v-for="item in achievements.slice(0, 6)" :key="item.id" class="badge-item" :class="{ locked: !item.unlocked }"><div><Award v-if="item.unlocked" :size="21" /><span v-else>?</span></div><small>{{ item.title }}</small></div></div></article></section>
      </div>
      <div v-else class="page placeholder-page">
        <section class="welcome-row"><div><p class="section-kicker">家庭健康空间</p><h2>{{ navItems.find((item) => item.id === activeNav)?.label }}</h2><p class="muted">所有记录都会自动保存在当前设备，删除后可在日程页回收站恢复。</p></div><button class="btn btn-primary" @click="openRecord(activeNav === 'health' ? 'health' : activeNav === 'activity' ? 'activity' : 'vaccine')"><Plus :size="17" />添加记录</button></section>
        <section class="content-grid"><article class="panel wide-panel"><div class="panel-heading"><div><span class="eyebrow">数据概览</span><h3>{{ activeNav === 'achievements' ? '我的成就' : activeNav === 'schedule' ? '全部日程' : activeNav === 'activity' ? '活动历史' : '健康档案' }}</h3></div></div><div v-if="activeNav === 'achievements'" class="all-badges"><div v-for="item in achievements" :key="item.id" class="achievement-row" :class="{ unlocked: item.unlocked }"><div class="badge-large"><Award v-if="item.unlocked" :size="22" /><span v-else>?</span></div><div><strong>{{ item.title }}</strong><span>{{ item.desc }}</span></div><b>{{ item.unlocked ? '已解锁' : '未解锁' }}</b></div></div><div v-else-if="activeNav === 'schedule'" class="agenda-list large-list"><div v-for="item in agenda" :key="item.id" class="agenda-item"><div class="agenda-time">{{ item.time }}</div><div class="agenda-icon" :class="item.kind"><component :is="item.icon" :size="17" /></div><div class="agenda-copy"><strong>{{ item.title }}</strong><span>{{ item.detail }}</span></div><button class="check-circle"><Check :size="14" /></button></div><div v-if="!agenda.length" class="empty-state">今天没有待办，享受轻松的一天吧。</div></div><div v-else-if="activeNav === 'activity'" class="table-list"><div v-for="item in state.activities" :key="item.id" class="table-row"><strong>{{ petName(item.petId) }}</strong><span>{{ formatDate(item.date, true) }}</span><span>{{ item.type }} · {{ item.duration }} 分钟</span><span>{{ item.location || '未填写地点' }}</span><div class="row-actions"><button title="编辑" @click="editRecord('activity', item)"><Pencil :size="13" /></button><button title="删除" class="danger" @click="requestDelete('activities', item)"><Trash2 :size="13" /></button></div></div><div v-if="!state.activities.length" class="empty-state">还没有活动记录，点击上方按钮添加第一条吧。</div></div><div v-else class="table-list"><div v-for="item in state.healthRecords" :key="item.id" class="table-row"><strong>{{ petName(item.petId) }}</strong><span>{{ formatDate(item.date, true) }}</span><span>{{ metricLabel(item.type) }}</span><span>{{ item.value }} {{ normalRanges[item.type].unit }}</span><div class="row-actions"><button title="编辑" @click="editRecord('health', item)"><Pencil :size="13" /></button><button title="删除" class="danger" @click="requestDelete('healthRecords', item)"><Trash2 :size="13" /></button></div></div><div v-if="!state.healthRecords.length" class="empty-state">还没有健康记录，点击上方按钮添加第一条吧。</div></div></article><article class="panel leaderboard-panel"><div class="panel-heading"><div><span class="eyebrow">家庭榜单</span><h3>健康榜</h3></div><ChartNoAxesCombined :size="19" /></div><div v-for="(pet, index) in leaderboard" :key="pet.id" class="rank-row"><span class="rank-number">{{ String(index + 1).padStart(2, '0') }}</span><div class="mini-avatar">{{ pet.species === '狗' ? '🐕' : '🐈' }}</div><div><strong>{{ pet.name }}</strong><span>档案完整度 {{ pet.completeness }}%</span></div><b>{{ pet.completeness }}</b></div></article></section>
        <section v-if="activeNav === 'schedule'" class="manage-grid">
          <article class="panel manage-panel"><div class="panel-heading"><div><span class="eyebrow">免疫计划</span><h3>疫苗与驱虫</h3></div><button class="text-btn" @click="openRecord('vaccine')">添加 <Plus :size="14" /></button></div><div class="manage-list"><div v-for="item in upcomingVaccines" :key="item.id" class="manage-item"><div class="manage-icon vaccine"><ShieldCheck :size="15" /></div><div class="manage-copy"><strong>{{ item.category || '疫苗' }} · {{ item.name }}</strong><span>{{ petName(item.petId) }} · {{ formatDate(item.nextDate, true) }} · {{ item.hospital || '未填写医院' }}</span></div><span class="date-badge" :class="vaccineTone(item.days)">{{ item.days < 0 ? '已逾期' : item.days === 0 ? '今天' : `${item.days} 天后` }}</span><div class="row-actions"><button title="编辑" @click="editRecord('vaccine', item)"><Pencil :size="13" /></button><button title="删除" class="danger" @click="requestDelete('vaccines', item)"><Trash2 :size="13" /></button></div></div><div v-if="!state.vaccines.length" class="empty-state">还没有疫苗或驱虫计划。</div></div></article>
          <article class="panel manage-panel"><div class="panel-heading"><div><span class="eyebrow">疗程管理</span><h3>用药计划</h3></div><button class="text-btn" @click="openRecord('medication')">添加 <Plus :size="14" /></button></div><div class="manage-list"><div v-for="item in medicationPlans" :key="item.id" class="manage-item"><div class="manage-icon medication"><Pill :size="15" /></div><div class="manage-copy"><strong>{{ petName(item.petId) }} · {{ item.name }}</strong><span>{{ item.dose || '剂量未填' }} · {{ item.frequency }} · {{ formatDate(item.startDate) }} 至 {{ formatDate(item.endDate) }}</span></div><span class="date-badge" :class="item.tone">{{ item.status }}</span><div class="row-actions"><button title="编辑" @click="editRecord('medication', item)"><Pencil :size="13" /></button><button title="删除" class="danger" @click="requestDelete('medications', item)"><Trash2 :size="13" /></button></div></div><div v-if="!state.medications.length" class="empty-state">还没有用药计划。</div></div></article>
          <article class="panel manage-panel"><div class="panel-heading"><div><span class="eyebrow">每日饮食</span><h3>喂食计划</h3></div><button class="text-btn" @click="openRecord('feeding')">添加 <Plus :size="14" /></button></div><div class="manage-list"><div v-for="item in state.feedings" :key="item.id" class="manage-item"><div class="manage-icon feeding"><Utensils :size="15" /></div><div class="manage-copy"><strong>{{ petName(item.petId) }} · {{ item.food }}</strong><span>{{ item.brand || '未填写品牌' }} · 每日 {{ item.times }} 次 · {{ item.portion || '份量未填' }}</span></div><div class="row-actions"><button title="编辑" @click="editRecord('feeding', item)"><Pencil :size="13" /></button><button title="删除" class="danger" @click="requestDelete('feedings', item)"><Trash2 :size="13" /></button></div></div><div v-if="!state.feedings.length" class="empty-state">还没有喂食计划。</div></div></article>
        </section>
        <section v-if="activeNav === 'schedule'" class="panel trash-panel"><div class="panel-heading"><div><span class="eyebrow">误删补救</span><h3>回收站 <small>{{ trashEntries.length }} 条 · 自动保留 30 天</small></h3></div><button v-if="trashEntries.length" class="text-btn danger-text" @click="requestEmptyTrash"><Trash2 :size="14" />清空回收站</button></div><div v-if="trashEntries.length" class="trash-list"><div v-for="entry in trashEntries" :key="entry.id" class="trash-item"><div class="trash-type-tag">{{ collectionMeta[entry.collection].label }}</div><div class="trash-copy"><strong>{{ recordSummary(entry.collection, entry.record) }}</strong><span>删除于 {{ formatDeletedAt(entry.deletedAt) }}</span></div><div class="row-actions"><button class="restore" title="恢复" @click="restoreEntry(entry.id)"><RotateCcw :size="13" />恢复</button><button class="danger" title="彻底删除" @click="requestDestroy(entry)"><Trash2 :size="13" /></button></div></div><p class="trash-hint">记录删除后会在回收站保留 30 天，恢复后趋势图、榜单与成就徽章会重新计算；点击「彻底删除」或清空回收站后将无法找回。</p></div></section>
      </div>
    </main>
    <PetModal :visible="showPetModal" @close="showPetModal = false" @submit="(payload) => { addPet(payload); showPetModal = false }" />
    <RecordModal :visible="!!recordType" :type="recordType || 'health'" :pets="state.pets" :record="modalRecord" @close="closeRecordModal" @submit="saveRecord" />
    <ConfirmModal :visible="confirmView.visible" :title="confirmView.title" :message="confirmView.message" :note="confirmView.note" :confirm-text="confirmView.confirmText" @confirm="confirmDelete" @cancel="cancelConfirm" />
    <UndoToast :visible="undoState.visible" :message="undoState.message" @undo="undoDelete" @dismiss="dismissUndo" />
  </div>
</template>
