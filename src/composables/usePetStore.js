import { computed, reactive, watch } from 'vue'
import { achievementDefinitions, collectionMeta, createDemoState, daysFromToday, isThisWeek, normalRanges, todayISO, uid } from '../data'

const STORAGE_KEY = 'petcare-home-state'
const TRASH_TTL_DAYS = 30
const saved = localStorage.getItem(STORAGE_KEY)
const state = reactive(saved ? JSON.parse(saved) : createDemoState())
if (!Array.isArray(state.trash)) state.trash = []

// 清理回收站中超过 30 天的记录，永久删除
function purgeExpiredTrash() {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - TRASH_TTL_DAYS)
  state.trash = state.trash.filter((item) => new Date(item.deletedAt) > cutoff)
}
purgeExpiredTrash()

watch(state, (value) => localStorage.setItem(STORAGE_KEY, JSON.stringify(value)), { deep: true })

export function usePetStore() {
  const petById = (id) => state.pets.find((pet) => pet.id === id)
  const petName = (id) => petById(id)?.name || '未命名宠物'
  const totalActivity = computed(() => state.activities.filter((item) => isThisWeek(item.date)).reduce((sum, item) => sum + Number(item.duration || 0), 0))
  const pendingVaccines = computed(() => state.vaccines.filter((item) => daysFromToday(item.nextDate) <= 7).length)
  const feedingTasks = computed(() => state.feedings.reduce((sum, item) => sum + Number(item.times || 0), 0))
  const medicationsToday = computed(() => state.medications.filter((item) => item.startDate <= todayISO() && item.endDate >= todayISO()).length)
  const achievements = computed(() => achievementDefinitions.map((item) => ({ ...item, unlocked: item.condition(state) })))
  const healthCompleteness = (petId) => {
    const fields = ['weight', 'temperature', 'heartRate']
    const count = fields.filter((type) => state.healthRecords.some((item) => item.petId === petId && item.type === type)).length
    return Math.round((count / fields.length) * 100)
  }
  const weightCompliance = (petId) => {
    const records = state.healthRecords.filter((item) => item.petId === petId && item.type === 'weight')
    if (!records.length) return 0
    return Math.round((records.filter((item) => item.value >= normalRanges.weight.min && item.value <= normalRanges.weight.max).length / records.length) * 100)
  }

  function add(itemType, payload) {
    state[itemType].unshift({ id: uid(itemType.slice(0, -1)), ...payload })
  }
  function addPet(payload) {
    add('pets', payload)
  }

  // 编辑已有记录（就地替换，id 保持不变）
  function update(itemType, id, payload) {
    const list = state[itemType]
    const index = list.findIndex((item) => item.id === id)
    if (index === -1) return
    list.splice(index, 1, { ...list[index], ...payload, id: list[index].id })
  }

  // 软删除：记录移入回收站，30 天内可恢复
  function remove(itemType, id) {
    const list = state[itemType]
    const index = list.findIndex((item) => item.id === id)
    if (index === -1) return null
    const [record] = list.splice(index, 1)
    const entry = { id: uid('trash'), collection: itemType, record, deletedAt: new Date().toISOString() }
    state.trash.unshift(entry)
    return entry.id
  }

  // 从回收站恢复
  function restore(trashId) {
    const index = state.trash.findIndex((item) => item.id === trashId)
    if (index === -1) return false
    const [entry] = state.trash.splice(index, 1)
    if (!state[entry.collection]?.some((item) => item.id === entry.record.id)) {
      state[entry.collection].unshift(entry.record)
    }
    return true
  }

  // 彻底删除单条回收站记录
  function destroy(trashId) {
    const index = state.trash.findIndex((item) => item.id === trashId)
    if (index !== -1) state.trash.splice(index, 1)
  }

  // 清空回收站
  function emptyTrash() {
    state.trash.splice(0, state.trash.length)
  }

  function resetDemo() {
    const fresh = createDemoState()
    Object.keys(state).forEach((key) => { state[key].splice(0, state[key].length, ...(fresh[key] || [])) })
  }

  return { state, petById, petName, totalActivity, pendingVaccines, feedingTasks, medicationsToday, achievements, healthCompleteness, weightCompliance, add, addPet, update, remove, restore, destroy, emptyTrash, resetDemo, collectionMeta }
}
