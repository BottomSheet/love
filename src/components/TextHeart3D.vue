<template>
  <canvas ref="canvasRef" class="heart-canvas"></canvas>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'

// Текст, из которого «сплетено» сердце
const HEART_TEXT = 'Я люблю тебя'
const PARTICLE_COUNT = 340

const canvasRef = ref(null)

let renderer = null
let scene = null
let camera = null
let heartGroup = null
let starsPoints = null
let animationFrameId = null
let texture = null
let spriteMaterial = null
let sharedGeometry = null

// --- состояние вращения (драг пальцем/мышью) ---
let dragging = false
let lastX = 0
let lastY = 0
let velocityX = 0
let velocityY = 0
let userRotX = 0
let userRotY = 0

// --- параллакс от наклона телефона ---
let tiltX = 0
let tiltY = 0

function createTextTexture(text) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const fontSize = 54
  ctx.font = `500 ${fontSize}px "Fira Code", monospace`
  const width = Math.ceil(ctx.measureText(text).width) + 40
  const height = Math.ceil(fontSize * 1.8)
  canvas.width = width
  canvas.height = height
  // после ресайза канваса контекст сбрасывается — настраиваем заново
  ctx.font = `500 ${fontSize}px "Fira Code", monospace`
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(255, 111, 145, 1)'
  ctx.shadowColor = 'rgba(255, 77, 109, 0.9)'
  ctx.shadowBlur = 14
  ctx.fillText(text, 20, height / 2)

  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return { texture: tex, aspect: width / height }
}

function buildHeart() {
  const { texture: tex, aspect } = createTextTexture(HEART_TEXT)
  texture = tex
  spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    opacity: 0.92,
  })

  heartGroup = new THREE.Group()
  const scale = 0.09
  // Пропорция как в оригинальном HeartScene.tsx (fontSize≈scale) —
  // в прошлой версии было слишком мелко (сердце казалось пустым и
  // надпись не читалась), чуть крупнее прошлого варианта для
  // уверенной читаемости на маленьком экране телефона.
  const baseSize = 0.1

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const t = Math.random() * Math.PI * 2
    const phi = Math.random() * Math.PI

    const x = 16 * Math.pow(Math.sin(t), 3) * Math.sin(phi)
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    const z = 16 * Math.pow(Math.sin(t), 3) * Math.cos(phi)

    const sprite = new THREE.Sprite(spriteMaterial)
    sprite.position.set(x * scale, y * scale, z * scale)
    const s = baseSize * (0.85 + Math.random() * 0.35)
    sprite.scale.set(s * aspect, s, 1)
    heartGroup.add(sprite)
  }

  scene.add(heartGroup)
}

function buildStars() {
  const count = 800
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 30
    positions[i * 3 + 1] = (Math.random() - 0.5) * 30
    positions[i * 3 + 2] = (Math.random() - 0.5) * 30 - 5
  }
  sharedGeometry = new THREE.BufferGeometry()
  sharedGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.03,
    transparent: true,
    opacity: 0.5,
    sizeAttenuation: true,
  })
  starsPoints = new THREE.Points(sharedGeometry, material)
  scene.add(starsPoints)
}

function onPointerDown(e) {
  dragging = true
  lastX = e.clientX
  lastY = e.clientY
  velocityX = 0
  velocityY = 0
}

function onPointerMove(e) {
  if (!dragging) return
  const dx = e.clientX - lastX
  const dy = e.clientY - lastY
  lastX = e.clientX
  lastY = e.clientY
  velocityX = dx * 0.005
  velocityY = dy * 0.005
  userRotY += velocityX
  userRotX = Math.max(-0.9, Math.min(0.9, userRotX + velocityY))
}

function onPointerUp() {
  dragging = false
}

function onDeviceOrientation(e) {
  // gamma: наклон влево-вправо (-90..90), beta: вперёд-назад (-180..180)
  if (e.gamma === null || e.beta === null) return
  tiltX = Math.max(-1, Math.min(1, e.gamma / 35))
  tiltY = Math.max(-1, Math.min(1, (e.beta - 45) / 35))
}

function resize() {
  const canvas = canvasRef.value
  if (!canvas || !renderer || !camera) return
  const w = window.innerWidth
  const h = window.innerHeight
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}

function animate(time) {
  const elapsed = time * 0.001

  if (!dragging) {
    // плавное затухание инерции после отпускания
    userRotY += velocityX
    userRotX += velocityY
    velocityX *= 0.94
    velocityY *= 0.94
    // и медленное автовращение, когда почти остановились
    if (Math.abs(velocityX) < 0.0005) {
      userRotY += 0.0025
    }
  }

  if (heartGroup) {
    heartGroup.rotation.y = userRotY
    heartGroup.rotation.x = userRotX
    heartGroup.position.y = Math.sin(elapsed * 1.1) * 0.06
  }

  if (starsPoints) {
    starsPoints.rotation.y = elapsed * 0.01
  }

  if (camera) {
    // лёгкий параллакс от наклона телефона / мыши
    const targetX = tiltX * 0.6
    const targetY = -tiltY * 0.4
    camera.position.x += (targetX - camera.position.x) * 0.05
    camera.position.y += (targetY - camera.position.y) * 0.05
    camera.lookAt(0, 0, 0)
  }

  renderer.render(scene, camera)
  animationFrameId = requestAnimationFrame(animate)
}

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return

  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(window.innerWidth, window.innerHeight, false)

    scene = new THREE.Scene()
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100)
    camera.position.set(0, 0, 3.2)

    buildStars()
    buildHeart()

    canvas.style.touchAction = 'none'
    canvas.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    window.addEventListener('resize', resize)
    window.addEventListener('orientationchange', resize)
    window.addEventListener('deviceorientation', onDeviceOrientation)

    animationFrameId = requestAnimationFrame(animate)
  } catch (e) {
    // WebGL недоступен — тихо оставляем пустой канвас,
    // остальная страница (текст, терминал) продолжает работать
    console.info('3D-сцена недоступна на этом устройстве:', e)
  }
})

onBeforeUnmount(() => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
  const canvas = canvasRef.value
  if (canvas) canvas.removeEventListener('pointerdown', onPointerDown)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
  window.removeEventListener('resize', resize)
  window.removeEventListener('orientationchange', resize)
  window.removeEventListener('deviceorientation', onDeviceOrientation)

  if (spriteMaterial) spriteMaterial.dispose()
  if (texture) texture.dispose()
  if (sharedGeometry) sharedGeometry.dispose()
  if (renderer) renderer.dispose()
})
</script>

<style scoped>
.heart-canvas {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  touch-action: none;
}
</style>
