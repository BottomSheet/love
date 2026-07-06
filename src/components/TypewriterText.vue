<template>
  <span class="font-mono">{{ currentText }}</span>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  text: { type: String, required: true },
  delay: { type: Number, default: 50 },
})
const emit = defineEmits(['complete'])

const currentText = ref('')
let index = 0
let timeoutId = null

function tick() {
  if (index < props.text.length) {
    currentText.value += props.text[index]
    index += 1
    timeoutId = setTimeout(tick, props.delay)
  } else {
    emit('complete')
  }
}

onMounted(() => {
  timeoutId = setTimeout(tick, props.delay)
})

onBeforeUnmount(() => {
  clearTimeout(timeoutId)
})
</script>
