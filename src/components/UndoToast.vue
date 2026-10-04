<script setup>
import { Undo2, X } from 'lucide-vue-next'

defineProps({ visible: Boolean, message: { type: String, default: '' } })
const emit = defineEmits(['undo', 'dismiss'])
</script>

<template>
  <Transition name="toast">
    <div v-if="visible" class="undo-toast">
      <span class="undo-toast-msg">{{ message }}</span>
      <button class="undo-btn" @click="emit('undo')"><Undo2 :size="14" />撤销</button>
      <button class="undo-close" @click="emit('dismiss')"><X :size="14" /></button>
    </div>
  </Transition>
</template>
