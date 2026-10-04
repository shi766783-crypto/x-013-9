<script setup>
import { TriangleAlert, X } from 'lucide-vue-next'

defineProps({
  visible: Boolean,
  title: { type: String, default: '确认删除这条记录？' },
  description: { type: String, default: '' },
})
const emit = defineEmits(['close', 'confirm'])
</script>

<template>
  <div v-if="visible" class="modal-backdrop" @click.self="emit('close')">
    <section class="modal confirm-modal">
      <header class="modal-header confirm-header">
        <div class="confirm-title"><span class="confirm-icon"><TriangleAlert :size="18" /></span><div><h2>{{ title }}</h2><p v-if="description" class="confirm-desc">{{ description }}</p></div></div>
        <button class="icon-btn" @click="emit('close')"><X :size="18" /></button>
      </header>
      <p class="confirm-tip">删除后可通过底部提示立即撤销，记录会恢复到原位置。</p>
      <footer class="modal-actions confirm-actions">
        <button type="button" class="btn btn-quiet" @click="emit('close')">取消</button>
        <button type="button" class="btn btn-danger" @click="emit('confirm')">确认删除</button>
      </footer>
    </section>
  </div>
</template>
