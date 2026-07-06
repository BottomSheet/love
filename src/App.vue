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

        <div class="z-20 text-center decrypted-block" :class="{ show: showDecrypted }">
          <h2 class="text-pink-deep font-mono text-xl tracking-[0.3em] uppercase glow-text mb-2">
            Decrypted
          </h2>
          <div class="w-12 h-px bg-pink-deep/30 mx-auto mb-8" />

          <button
            class="text-white/20 hover:text-white/60 transition-colors uppercase text-[10px] tracking-widest font-mono"
            @click="backToConsole"
          >
            Re-encrypt
          </button>
        </div>

        <p class="drag-hint" :class="{ show: showHint }">Проведите пальцем по сердцу — оно вращается</p>

        <div
          class="absolute top-8 left-8 text-[10px] font-mono text-white/10 uppercase tracking-widest space-y-1"
        >
          <div>ln: 420</div>
          <div>id: 0xDEADBEEF</div>
          <div>type: organic_emotion</div>
        </div>

        <div
          class="absolute bottom-8 right-8 text-[10px] font-mono text-white/10 uppercase tracking-widest"
        >
          heart_reveal // success
        </div>
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

const audioRef = ref(null)
const muted = ref(false)
const showDecrypted = ref(false)
const showHint = ref(false)
let decryptedTimer = null
let hintTimer = null

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

onMounted(() => {
  const a = audioRef.value
  if (a) {
    a.addEventListener('timeupdate', () => {
      const { start, end } = clampedChorus(a.duration)
      if (end > 0 && a.currentTime >= end) {
        a.currentTime = start
      }
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
    a.play().catch(() => {
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

  clearTimeout(decryptedTimer)
  clearTimeout(hintTimer)
  showDecrypted.value = false
  showHint.value = false
  decryptedTimer = setTimeout(() => {
    showDecrypted.value = true
    hintTimer = setTimeout(() => {
      showHint.value = true
      setTimeout(() => {
        showHint.value = false
      }, 4000)
    }, 600)
  }, 3000)
}

function backToConsole(e) {
  e.stopPropagation()
  stage.value = 'console'
  if (audioRef.value) audioRef.value.pause() // добавлено
  clearTimeout(decryptedTimer)
  clearTimeout(hintTimer)
  showDecrypted.value = false
  showHint.value = false
}
</script>

<style scoped>
.decrypted-block {
  opacity: 0;
  transform: scale(0.8);
  transition: opacity 1.2s ease, transform 1.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.decrypted-block.show {
  opacity: 1;
  transform: scale(1);
}

.drag-hint {
  position: fixed;
  left: 50%;
  bottom: max(64px, calc(env(safe-area-inset-bottom) + 56px));
  transform: translateX(-50%);
  color: rgba(255, 255, 255, 0.35);
  font-size: 11px;
  letter-spacing: 0.04em;
  text-align: center;
  z-index: 25;
  opacity: 0;
  transition: opacity 0.8s ease;
  pointer-events: none;
  white-space: nowrap;
}
.drag-hint.show {
  opacity: 1;
}

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
