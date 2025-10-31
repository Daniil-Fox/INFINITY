
// Плавное проявление видео после полной загрузки и появления секции во вьюпорте
(function initDifferentVideo() {
  const section = document.querySelector('.different')
  if (!section) return

  const videoWrap = section.querySelector('.different__video')
  const video = videoWrap ? videoWrap.querySelector('video') : null
  if (!video || !videoWrap) return

  let isLoaded = false
  let isVisible = false

  const tryReveal = () => {
    if (isLoaded && isVisible) {
      videoWrap.classList.add('is-visible')
      // автозапуск, если разрешено браузером (видео уже muted)
      if (video.paused) {
        video.play().catch(() => {})
      }
    }
  }

  // Считаем видео готовым, когда доступно к проигрыванию целиком
  const onReady = () => {
    if (isLoaded) return
    isLoaded = true
    // включаем зацикливание после загрузки
    video.setAttribute('loop', '')
    video.loop = true
    // гарантируем атрибуты для автоплея
    video.setAttribute('muted', '')
    video.muted = true
    video.setAttribute('playsinline', '')
    video.setAttribute('autoplay', '')
    tryReveal()
  }

  // Любое из событий загрузки подойдёт
  video.addEventListener('canplaythrough', onReady, { once: true })
  video.addEventListener('loadeddata', onReady, { once: true })
  video.addEventListener('loadedmetadata', onReady, { once: true })

  // Отслеживаем появление секции в зоне видимости
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        isVisible = true
        // пытаемся запустить воспроизведение сразу при входе во вьюпорт
        if (video.paused) {
          video.play().catch(() => {})
        }
        tryReveal()
      } else {
        isVisible = false
      }
    })
  }, { threshold: 0.1 })

  io.observe(section)
})()


