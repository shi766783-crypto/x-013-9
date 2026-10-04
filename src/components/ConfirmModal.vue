<script setup>
import { AlertTriangle } from 'lucide-vue-next'

defineProps({
  visible: Boolean,
  title: { type: String, default: '确认删除' },
  message: { type: String, default: '' },
  confirmText: { type: String, default: '删除' },
  cancelText: { type: String, default: '再想想' },
  note: { type: String, default: '' },
})
const emit = defineEmits(['confirm', 'cancel'])
</script>

<template>
  <div v-if="visible" class="modal-backdrop confirm-backdrop" @click.self="emit('cancel')">
    <section class="modal confirm-modal">
      <div class="confirm-icon"><AlertTriangle :size="22" /></div>
      <h2>{{ title }}</h2>
      <p>{{ message }}</p>
      <p v-if="note" class="confirm-note">{{ note }}</p>
      <footer class="modal-actions confirm-actions">
        <button type="button" class="btn btn-quiet" @click="emit('cancel')">{{ cancelText }}</button>
        <button type="button" class="btn btn-danger" @click="emit('confirm')">{{ confirmText }}</button>
      </footer>
    </section>
  </div>
</template>
