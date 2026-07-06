<template>
  <div @click="handleBackgroundClick" :class="rootClasses">
    <div class="scanline" />

    <Transition name="stage" mode="out-in">
      <!-- ЭКРАН 1: терминал -->
      <div
        v-if="stage === 'console'"
        key="console"
        class="w-full max-w-2xl p-8 font-mono text-sm md:text-base text-white/80"
      >
        <div class="space-y-2">
          <div class="flex gap-2 text-pink-soft/60">
            <span>[system]</span>
            <TypewriterText
              text="Initializing heart.PROTOCOL_v2.0..."
              :delay="30"
              @complete="consoleFinished = true"
            />
          </div>

          <div class="flex gap-2 h-6">
            <span>[status]</span>
            <Transition name="fade">
              <span v-if="consoleFinished" class="text-green-400">READY</span>
            </Transition>
          </div>

          <Transition name="fade-up">
            <div v-if="consoleFinished" class="pt-8 flex flex-col items-start gap-6">
              <p class="text-white/40 italic">&gt; One encrypted package found for you.</p>

              <button
                id="decrypt-button"
                class="group flex items-center gap-3 px-6 py-3 border border-pink-deep/30 bg-pink-deep/5 hover:bg-pink-deep/10 text-pink-soft transition-all duration-300 pointer-events-auto"
                @click="enterReveal"
              >
                <Lock :size="16" class="group-hover:rotate-12 transition-transform" />
                <span class="font-mono tracking-widest uppercase text-xs">Decrypt Message</span>
                <span class="terminal-cursor" />
              </button>

              <p class="text-[10px] text-white/20 animate-pulse">(or just click anywhere)</p>
            </div>
          </Transition>
        </div>
      </div>

      <!-- ЭКРАН 2: раскрытие -->
      <div
        v-else
        key="reveal"
        class="relative w-full h-screen flex items-center justify-center overflow-hidden"
      >
        <TextHeart3D />
      </div>
    </Transition>

    <!-- === ДОБАВЛЕНО СВЕРХ ОРИГИНАЛА: музыка на момент раскрытия === -->
    <button
      v-if="stage === 'reveal'"
      class="mute-btn"
      type="button"
      @click.stop="toggleMute"
      :aria-label="muted ? 'Включить звук' : 'Выключить звук'"
    >
      <svg v-if="!muted" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3z" />
        <path fill="currentColor" d="M16.5 12c0-1.77-.77-3.29-2-4.35v8.7c1.23-1.06 2-2.58 2-4.35z" />
      </svg>
      <svg v-else viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3z" />
        <line x1="16" y1="9" x2="22" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        <line x1="22" y1="9" x2="16" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
    </button>

    <audio ref="audioRef" :src="AUDIO_SRC" preload="auto"></audio>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Lock } from 'lucide-vue-next'
import TypewriterText from './components/TypewriterText.vue'
import TextHeart3D from './components/TextHeart3D.vue'

/* ======================================================================
   ДОБАВЛЕНО СВЕРХ ОРИГИНАЛА — настройки музыки.
   В самом репозитории музыки не было, это отдельная надстройка по вашей
   изначальной просьбе. Если она не нужна — просто не кладите файл в
   public/angel.mp3, и весь этот блок останется без последствий.
   ====================================================================== */
const AUDIO_SRC = `${import.meta.env.BASE_URL}angel.mp3`
// Желаемый тайм-код припева в СЕКУНДАХ — если ваш файл это полная песня.
// Если же файл — уже готовый короткий отрывок (как ваш нынешний angel.mp3,
// 10.8 сек), эти значения автоматически "обрежутся" под реальную длину
// файла в clampedChorus() ниже, так что играть будет весь ваш отрывок целиком.
const CHORUS_START = 258 // ориентировочно ~4:18 в полной версии песни
const CHORUS_END = 340 // ориентировочно ~5:40

// Отрывок короткий и зацикливается — чтобы это не резало слух:
// 1) на стыке цикла громкость на миг гаснет и снова нарастает (без щелчка)
// 2) с каждым повтором звук становится немного громче, до предела MAX_VOLUME
const BASE_VOLUME = 0.28 // громкость первого проигрывания
const VOLUME_STEP = 0.16 // насколько прибавляем с каждым повтором
const MAX_VOLUME = 1
const FADE_MS = 260 // длительность затухания/нарастания на стыке цикла

const audioRef = ref(null)
const muted = ref(false)
let currentTargetVolume = BASE_VOLUME
let isLooping = false

// подстраиваем желаемый диапазон под реальную длину файла:
// если файл короче, чем CHORUS_START, просто играем его с начала до конца
function clampedChorus(duration) {
  if (!duration || !isFinite(duration) || duration <= 0) {
    return { start: 0, end: 0 }
  }
  if (CHORUS_START >= duration) {
    return { start: 0, end: duration }
  }
  return { start: CHORUS_START, end: Math.min(CHORUS_END, duration) }
}

// плавно меняет громкость audio-элемента от from до to за duration мс
function fadeVolume(audio, from, to, duration) {
  return new Promise((resolve) => {
    const start = performance.now()
    function step(now) {
      const t = Math.min(1, (now - start) / duration)
      audio.volume = from + (to - from) * t
      if (t < 1) requestAnimationFrame(step)
      else resolve()
    }
    requestAnimationFrame(step)
  })
}

async function handleLoopPoint(a, start) {
  if (isLooping) return
  isLooping = true
  try {
    await fadeVolume(a, a.volume, 0, FADE_MS)
    a.currentTime = start
    currentTargetVolume = Math.min(MAX_VOLUME, currentTargetVolume + VOLUME_STEP)
    await fadeVolume(a, 0, currentTargetVolume, FADE_MS)
  } finally {
    isLooping = false
  }
}

onMounted(() => {
  const a = audioRef.value
  if (a) {
    a.addEventListener('timeupdate', () => {
      const { start, end } = clampedChorus(a.duration)
      // запас побольше самого FADE_MS — короткие клипы иначе успевают
      // доиграть до конца между двумя событиями timeupdate, и момент
      // зацикливания просто проскакивает
      const buffer = Math.max(FADE_MS / 1000, 0.5)
      if (end > 0 && !isLooping && a.currentTime >= end - buffer) {
        handleLoopPoint(a, start)
      }
    })
    // страховка: если всё же доиграло до конца (например, вкладка была
    // в фоне и timeupdate не успел сработать) — зацикливаем немедленно,
    // без изящного fade, лишь бы не наступила тишина
    a.addEventListener('ended', () => {
      if (isLooping) return
      const { start } = clampedChorus(a.duration)
      a.currentTime = start
      a.volume = currentTargetVolume
      a.play().catch(() => {})
    })
    // диагностика: если аудио не играет, откройте консоль браузера (F12 /
    // на iPhone — через Safari "Настройки → Safari → Дополнения → Веб-
    // инспектор" и подключение к Mac) — здесь будет видна точная причина
    a.addEventListener('error', () => {
      const codes = { 1: 'ABORTED', 2: 'ОШИБКА СЕТИ (файл не найден?)', 3: 'ОШИБКА ДЕКОДИРОВАНИЯ', 4: 'ФОРМАТ НЕ ПОДДЕРЖИВАЕТСЯ' }
      const code = a.error && a.error.code
      console.error('[angel.mp3] Не удалось загрузить аудио:', codes[code] || code, '— проверьте путь', AUDIO_SRC)
    })
  }
})

function playChorus() {
  const a = audioRef.value
  if (!a) return
  const seekAndPlay = () => {
    const { start } = clampedChorus(a.duration)
    try {
      a.currentTime = start
    } catch (e) {
      /* метаданные ещё не готовы — сработает через loadedmetadata ниже */
    }
    a.muted = muted.value
    currentTargetVolume = BASE_VOLUME
    a.volume = 0
    a
      .play()
      .then(() => {
        fadeVolume(a, 0, currentTargetVolume, FADE_MS)
      })
      .catch(() => {
        console.info('Аудио пока недоступно — проверьте, что файл public/angel.mp3 добавлен.')
      })
  }
  if (a.readyState >= 1) seekAndPlay()
  else a.addEventListener('loadedmetadata', seekAndPlay, { once: true })
}

function toggleMute() {
  muted.value = !muted.value
  if (audioRef.value) audioRef.value.muted = muted.value
}

// разрешение на гироскоп для параллакса — обязательно запрашивать
// синхронно внутри клика пользователя (требование iOS Safari)
function requestMotionPermission() {
  if (
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function'
  ) {
    DeviceOrientationEvent.requestPermission().catch(() => {})
  }
}
/* ================== конец добавленного блока про музыку ================== */

/* ======================================================================
   Дальше — 1:1 перенос логики оригинального App.tsx
   ====================================================================== */

const stage = ref('console') // 'console' | 'reveal'
const consoleFinished = ref(false)

const rootClasses = computed(() => [
  'relative min-h-screen w-full flex items-center justify-center bg-[#050505] selection:bg-brand-red/30',
  stage.value === 'console' && consoleFinished.value ? 'cursor-pointer' : '',
])

function handleBackgroundClick() {
  if (stage.value === 'console' && consoleFinished.value) {
    enterReveal()
  }
}

function enterReveal(e) {
  if (e) e.stopPropagation()
  if (stage.value === 'reveal') return
  stage.value = 'reveal'
  playChorus() // добавлено: включаем музыку в момент раскрытия
  requestMotionPermission() // добавлено: разрешение на гироскоп для параллакса
}
</script>

<style scoped>
.mute-btn {
  position: fixed;
  right: max(16px, env(safe-area-inset-right));
  bottom: max(16px, env(safe-area-inset-bottom));
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  z-index: 30;
}
.mute-btn svg {
  width: 18px;
  height: 18px;
}
</style>
