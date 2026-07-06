<template>
  <canvas ref="canvasRef" class="fixed inset-0 w-full h-full pointer-events-none"></canvas>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

// Текст, из которого «сплетено» сердце (в оригинале было "i love you").
// Поменяйте здесь, если захотите другую надпись.
const HEART_TEXT = 'Я люблю тебя'

const canvasRef = ref(null)
let animationFrameId = null
let onResize = null

onMounted(() => {
  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const fontSize = 14
  const text = HEART_TEXT
  let points = []

  function initPoints() {
    points = []
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const scale = Math.min(canvas.width, canvas.height) / 45

    // Параметрическое уравнение сердца:
    // x = 16 sin^3(t)
    // y = -(13 cos(t) - 5 cos(2t) - 2 cos(3t) - cos(4t))
    for (let t = 0; t < Math.PI * 2; t += 0.05) {
      const x = 16 * Math.pow(Math.sin(t), 3)
      const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))

      points.push({
        x: centerX + x * scale,
        y: centerY + y * scale,
        alpha: 0,
        targetAlpha: 0.8 + Math.random() * 0.2,
        delay: Math.random() * 2000,
      })
    }

    // внутренние слои
    for (let s = 0.2; s < 1; s += 0.2) {
      for (let t = 0; t < Math.PI * 2; t += 0.1) {
        const x = 16 * Math.pow(Math.sin(t), 3)
        const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))

        points.push({
          x: centerX + x * scale * s,
          y: centerY + y * scale * s,
          alpha: 0,
          targetAlpha: 0.4 + Math.random() * 0.4,
          delay: Math.random() * 3000,
        })
      }
    }
  }

  function resize() {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    initPoints()
  }

  let start = null
  function draw(time) {
    if (!start) start = time
    const elapsed = time - start

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.font = `${fontSize}px "Fira Code", monospace`

    points.forEach((p) => {
      if (elapsed > p.delay) {
        p.alpha += (p.targetAlpha - p.alpha) * 0.02
      }
      ctx.fillStyle = `rgba(255, 77, 109, ${p.alpha})`
      ctx.fillText(text, p.x - ctx.measureText(text).width / 2, p.y)
    })

    animationFrameId = requestAnimationFrame(draw)
  }

  onResize = resize
  window.addEventListener('resize', onResize)
  resize()
  animationFrameId = requestAnimationFrame(draw)
})

onBeforeUnmount(() => {
  if (onResize) window.removeEventListener('resize', onResize)
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
})
</script>
