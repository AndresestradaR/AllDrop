'use client'

import { useEffect, useRef, useCallback } from 'react'

const ASSET_BASE = '/alldrop'
const IMAGE_BASE_URL = 'https://raw.githubusercontent.com/AndresestradaR/AllDrop/main/images/'

export default function AllDropLanding() {
  const containerRef = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)

  const initLanding = useCallback(() => {
    if (initialized.current) return
    initialized.current = true

    const rootEl = containerRef.current
    if (!rootEl) return
    const root = rootEl

    // --- Particles ---
    const pc = root.querySelector('#particles') as HTMLElement
    function mkP() {
      const p = document.createElement('div')
      p.classList.add('particle')
      const x = Math.random() * 100
      const dur = 8 + Math.random() * 12
      const del = Math.random() * 5
      const sz = 1 + Math.random() * 2
      const cols = ['var(--accent-cyan)', 'var(--accent-violet)', 'var(--accent-magenta)']
      p.style.cssText = `left:${x}%;width:${sz}px;height:${sz}px;background:${cols[Math.floor(Math.random() * 3)]};animation-duration:${dur}s;animation-delay:${del}s;`
      pc.appendChild(p)
      setTimeout(() => p.remove(), (dur + del) * 1000)
    }
    for (let i = 0; i < 20; i++) setTimeout(mkP, i * 200)
    const particleInterval = setInterval(mkP, 600)

    // --- 3D Carousel ---
    const IMAGE_COUNT = 10
    const track = root.querySelector('#carouselTrack') as HTMLElement
    for (let i = 0; i < IMAGE_COUNT; i++) {
      const div = document.createElement('div')
      div.className = 'carousel-item'
      div.dataset.i = String(i)
      const notch = document.createElement('div')
      notch.className = 'notch'
      div.appendChild(notch)
      const placeholder = document.createElement('div')
      placeholder.className = 'loading-placeholder'
      placeholder.textContent = '\u23F3'
      div.appendChild(placeholder)
      track.appendChild(div)
    }
    const items = root.querySelectorAll('.carousel-item')
    const total = items.length
    let current = 0

    // Load images from base64 text files
    async function loadImages() {
      const promises = []
      for (let i = 0; i < IMAGE_COUNT; i++) {
        promises.push(
          fetch(IMAGE_BASE_URL + i + '.txt')
            .then(r => r.text())
            .then(b64 => {
              const item = items[i] as HTMLElement
              const ph = item.querySelector('.loading-placeholder')
              const img = document.createElement('img')
              img.src = 'data:image/webp;base64,' + b64.trim()
              img.alt = 'Landing de producto ' + (i + 1)
              img.loading = i <= 2 ? 'eager' : 'lazy'
              img.onload = () => { if (ph) ph.remove() }
              item.insertBefore(img, ph)
            })
            .catch(() => {
              const item = items[i] as HTMLElement
              const ph = item.querySelector('.loading-placeholder')
              if (ph) ph.textContent = '\uD83D\uDCF1'
            })
        )
      }
      await Promise.all(promises)
    }
    loadImages()

    function updateCarousel() {
      items.forEach((item, i) => {
        item.classList.remove('active', 'prev', 'next', 'far-prev', 'far-next', 'hidden-item')
        const diff = ((i - current) % total + total) % total
        if (diff === 0) item.classList.add('active')
        else if (diff === 1) item.classList.add('next')
        else if (diff === total - 1) item.classList.add('prev')
        else if (diff === 2) item.classList.add('far-next')
        else if (diff === total - 2) item.classList.add('far-prev')
        else item.classList.add('hidden-item')
      })
    }

    function go(dir: number) {
      current = (current + dir + total) % total
      updateCarousel()
    }

    let autoTimer = setInterval(() => go(1), 3000)
    let resumeTimer: ReturnType<typeof setTimeout>
    const statusEl = root.querySelector('#carouselStatus') as HTMLElement

    function stopAuto() {
      clearInterval(autoTimer)
      clearTimeout(resumeTimer)
      if (statusEl) statusEl.textContent = 'PAUSED'
    }
    function startAuto() {
      autoTimer = setInterval(() => go(1), 3000)
      if (statusEl) statusEl.textContent = 'PLAYING'
    }
    function pauseAndResume() {
      stopAuto()
      resumeTimer = setTimeout(startAuto, 6000)
    }

    root.querySelector('#nextBtn')?.addEventListener('click', () => { go(1); pauseAndResume() })
    root.querySelector('#prevBtn')?.addEventListener('click', () => { go(-1); pauseAndResume() })

    // Touch/swipe
    let touchX = 0
    const cw = root.querySelector('.carousel-wrapper') as HTMLElement
    cw?.addEventListener('touchstart', e => { touchX = e.touches[0].clientX }, { passive: true })
    cw?.addEventListener('touchend', e => {
      const diff = e.changedTouches[0].clientX - touchX
      if (Math.abs(diff) > 50) { go(diff < 0 ? 1 : -1); pauseAndResume() }
    }, { passive: true })

    updateCarousel()

    // --- UGC Rotating Stack ---
    const ugcData = [
      { name: 'Laura M.', handle: '@laura.beauty', views: '12.4K' },
      { name: 'Carlos R.', handle: '@carlos.tech', views: '8.7K' },
      { name: 'Maria G.', handle: '@maria.fitness', views: '23.1K' },
      { name: 'Pablo S.', handle: '@pablo.lifestyle', views: '15.6K' },
      { name: 'Ana P.', handle: '@ana.skincare', views: '31.2K' },
      { name: 'Diego L.', handle: '@diego.unbox', views: '9.3K' },
      { name: 'Sofia V.', handle: '@sofia.reviews', views: '18.9K' },
      { name: 'Javier T.', handle: '@javi.drops', views: '42.5K' },
    ]
    const stack = root.querySelector('#ugcStack') as HTMLElement
    const allCards: HTMLElement[] = []

    ugcData.forEach((d, i) => {
      const card = document.createElement('div')
      card.className = 'ugc-card'

      const notchEl = document.createElement('div')
      notchEl.className = 'ugc-notch'
      card.appendChild(notchEl)

      const viewsEl = document.createElement('div')
      viewsEl.className = 'ugc-views'
      viewsEl.textContent = d.views
      card.appendChild(viewsEl)

      const platformEl = document.createElement('div')
      platformEl.className = 'ugc-platform'
      platformEl.textContent = '\uD83D\uDCF1'
      card.appendChild(platformEl)

      const video = document.createElement('video')
      video.autoplay = true
      video.muted = true
      video.loop = true
      video.playsInline = true
      video.poster = ASSET_BASE + '/videos/' + i + '.webp'
      video.preload = 'none'
      const source = document.createElement('source')
      source.src = ASSET_BASE + '/videos/' + i + '.mp4'
      source.type = 'video/mp4'
      video.appendChild(source)
      card.appendChild(video)

      const overlay = document.createElement('div')
      overlay.className = 'ugc-overlay'
      const nameEl = document.createElement('div')
      nameEl.className = 'ugc-name'
      nameEl.textContent = d.name
      overlay.appendChild(nameEl)
      const handleEl = document.createElement('div')
      handleEl.className = 'ugc-handle'
      handleEl.textContent = d.handle
      overlay.appendChild(handleEl)
      card.appendChild(overlay)

      stack.appendChild(card)
      allCards.push(card)
    })

    // State: 3 visible slots + queue
    const slots: Record<string, HTMLElement> = {
      center: allCards[0],
      left: allCards[1],
      right: allCards[2],
    }
    const queue = allCards.slice(3)
    let throwDir = 0

    function applyPositions() {
      allCards.forEach(c => {
        if (c === slots.center) c.dataset.pos = 'center'
        else if (c === slots.left) c.dataset.pos = 'left'
        else if (c === slots.right) c.dataset.pos = 'right'
        else if (c.dataset.pos !== 'exit-left' && c.dataset.pos !== 'exit-right') c.dataset.pos = 'hidden'
      })
    }
    applyPositions()

    // Lazy-load videos
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.querySelectorAll('video').forEach(v => {
            if (v.preload === 'none') { v.preload = 'auto'; v.load(); v.play().catch(() => {}) }
          })
          obs.unobserve(e.target)
        }
      })
    }, { threshold: 0.3 })
    obs.observe(stack)

    function rotate() {
      const exitDir = throwDir === 0 ? 'left' : 'right'
      const exitPos = 'exit-' + exitDir
      const exiting = slots[exitDir]
      exiting.dataset.pos = exitPos
      slots[exitDir] = slots.center
      const next = queue.shift()!
      next.dataset.pos = 'enter'
      void next.offsetWidth
      slots.center = next
      applyPositions()
      const vid = slots.center.querySelector('video')
      if (vid) { vid.currentTime = 0; vid.play().catch(() => {}) }
      setTimeout(() => {
        exiting.dataset.pos = 'hidden'
        queue.push(exiting)
      }, 800)
      throwDir = 1 - throwDir
    }

    const ugcInterval = setInterval(rotate, 3500)

    // --- Product Research Animations ---
    const searchTerms = [
      'Gafas de sol polarizadas', 'Serum facial vitamina C', 'Smartwatch deportivo',
      'Faja reductora', 'Luz LED tiktok', 'Masajeador cervical', 'Botella termica',
      'Cepillo alisador', 'Auriculares inalambricos', 'Organizador maquillaje'
    ]
    const searchEl = root.querySelector('#rmSearchText') as HTMLElement
    let termIdx = 0, charIdx = 0, deleting = false

    function typeSearch() {
      const term = searchTerms[termIdx]
      if (!deleting) {
        charIdx++
        searchEl.textContent = term.substring(0, charIdx)
        if (charIdx >= term.length) { setTimeout(() => { deleting = true; typeSearch() }, 1800); return }
        setTimeout(typeSearch, 60 + Math.random() * 40)
      } else {
        charIdx--
        searchEl.textContent = term.substring(0, charIdx)
        if (charIdx <= 0) { deleting = false; termIdx = (termIdx + 1) % searchTerms.length; setTimeout(typeSearch, 400); return }
        setTimeout(typeSearch, 30)
      }
    }

    // Build product cards using safe DOM methods
    const products = [
      { emoji: '\uD83D\uDD76\uFE0F', name: 'Gafas de sol', price: '\u20AC12.90' },
      { emoji: '\u2728', name: 'Serum facial', price: '\u20AC8.50' },
      { emoji: '\u231A', name: 'Smartwatch', price: '\u20AC24.90' },
      { emoji: '\uD83C\uDFCB\uFE0F', name: 'Faja reductora', price: '\u20AC15.40' },
      { emoji: '\uD83D\uDCA1', name: 'Luz LED ring', price: '\u20AC11.20' },
      { emoji: '\uD83D\uDC86', name: 'Masajeador', price: '\u20AC19.90' },
      { emoji: '\uD83E\uDDF4', name: 'Botella termica', price: '\u20AC9.80' },
      { emoji: '\uD83D\uDC84', name: 'Cepillo alisador', price: '\u20AC18.50' },
      { emoji: '\uD83C\uDFA7', name: 'Auriculares BT', price: '\u20AC14.30' },
      { emoji: '\uD83D\uDC5C', name: 'Organizador', price: '\u20AC7.90' },
    ]
    const rmTrack = root.querySelector('#rmProductsTrack') as HTMLElement
    const allProducts = [...products, ...products]
    allProducts.forEach(p => {
      const card = document.createElement('div')
      card.className = 'rm-pcard'
      const imgDiv = document.createElement('div')
      imgDiv.className = 'rm-pcard-img'
      imgDiv.textContent = p.emoji
      card.appendChild(imgDiv)
      const nameDiv = document.createElement('div')
      nameDiv.className = 'rm-pcard-name'
      nameDiv.textContent = p.name
      card.appendChild(nameDiv)
      const priceDiv = document.createElement('div')
      priceDiv.className = 'rm-pcard-price'
      priceDiv.textContent = p.price
      card.appendChild(priceDiv)
      rmTrack.appendChild(card)
    })

    // Count-up animation for stats
    function animateStats() {
      const stats = root.querySelectorAll('.rm-stat-value') as NodeListOf<HTMLElement>
      stats.forEach(el => {
        const target = parseInt(el.dataset.target || '0')
        let prefix = '', suffix = ''
        const text = el.textContent || ''
        if (text.indexOf('#') === 0) prefix = '#'
        if (text.indexOf('%') > -1) suffix = '%'
        if (text.indexOf('\u20AC') > -1) prefix = '\u20AC'
        const duration = 1500
        const start = performance.now()
        function step(now: number) {
          const elapsed = now - start
          const progress = Math.min(elapsed / duration, 1)
          const eased = 1 - Math.pow(1 - progress, 3)
          const val = Math.floor(eased * target)
          el.textContent = prefix + val.toLocaleString('es-ES') + suffix
          if (progress < 1) requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
      })
    }

    // Cycle active stat highlight
    const statCards = root.querySelectorAll('.rm-stat')
    let activeStatIdx = 0
    let statInterval: ReturnType<typeof setInterval>
    function cycleStats() {
      statCards.forEach(s => s.classList.remove('rm-stat-active'))
      statCards[activeStatIdx]?.classList.add('rm-stat-active')
      activeStatIdx = (activeStatIdx + 1) % statCards.length
    }

    // Trigger on scroll
    let triggered = false
    const researchObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting && !triggered) {
          triggered = true
          typeSearch()
          animateStats()
          cycleStats()
          statInterval = setInterval(cycleStats, 2000)
          researchObs.unobserve(e.target)
        }
      })
    }, { threshold: 0.3 })
    const researchSection = root.querySelector('.research-section')
    if (researchSection) researchObs.observe(researchSection)

    // --- FAQ Accordion ---
    root.querySelectorAll('.faq-q').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = (btn as HTMLElement).closest('.faq-item')
        const wasOpen = item?.classList.contains('open')
        root.querySelectorAll('.faq-item.open').forEach(o => o.classList.remove('open'))
        if (!wasOpen) item?.classList.add('open')
      })
    })

    // --- Email Form ---
    const emailForm = root.querySelector('#emailForm') as HTMLFormElement
    emailForm?.addEventListener('submit', e => {
      e.preventDefault()
      const email = (root.querySelector('#emailInput') as HTMLInputElement).value.trim()
      const btn = emailForm.querySelector('button') as HTMLButtonElement
      const origText = btn.textContent
      btn.textContent = 'Enviando...'
      btn.disabled = true

      fetch('https://formsubmit.co/ajax/alldropsoporte@gmail.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          email,
          _subject: 'Nueva suscripcion AllDrop - Lista de espera',
          _template: 'table',
          _captcha: 'false',
        }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.success === 'true' || data.success === true) {
            emailForm.style.display = 'none'
            const note = root.querySelector('.form-note') as HTMLElement
            if (note) note.style.display = 'none'
            root.querySelector('#successMessage')?.classList.add('show')
          } else if (data.message && data.message.indexOf('Confirm') > -1) {
            emailForm.style.display = 'none'
            const note = root.querySelector('.form-note') as HTMLElement
            if (note) note.style.display = 'none'
            const msg = root.querySelector('#successMessage') as HTMLElement
            if (msg) {
              msg.textContent = 'Revisa alldropsoporte@gmail.com para confirmar FormSubmit (solo la primera vez). Tu email fue registrado.'
              msg.classList.add('show')
            }
          } else {
            btn.textContent = origText
            btn.disabled = false
            alert('Error: ' + (data.message || 'Intenta de nuevo'))
          }
        })
        .catch(() => {
          btn.textContent = origText
          btn.disabled = false
          alert('Error de conexion. Intenta de nuevo.')
        })
    })

    // Cleanup
    return () => {
      clearInterval(particleInterval)
      clearInterval(autoTimer)
      clearInterval(ugcInterval)
      if (statInterval) clearInterval(statInterval)
    }
  }, [])

  useEffect(() => {
    const cleanup = initLanding()
    return () => {
      if (typeof cleanup === 'function') cleanup()
    }
  }, [initLanding])

  return (
    <>
      <style jsx global>{`
        /* Reset for landing page */
        .alldrop-landing *, .alldrop-landing *::before, .alldrop-landing *::after { margin: 0; padding: 0; box-sizing: border-box; }
        .alldrop-landing {
          --bg-primary: #050508;
          --accent-cyan: #00f0ff;
          --accent-violet: #8b5cf6;
          --accent-magenta: #f43f8e;
          --text-primary: #f0f0f5;
          --text-muted: #6b6b80;
          --text-subtle: #3a3a50;
          font-family: 'Outfit', sans-serif;
          background: var(--bg-primary);
          color: var(--text-primary);
          overflow-x: hidden;
          min-height: 100vh;
        }
        .alldrop-landing .bg-grid { position:fixed;top:0;left:0;width:100%;height:100%;background-image:linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px);background-size:60px 60px;z-index:0; }
        .alldrop-landing .bg-glow { position:fixed;width:600px;height:600px;border-radius:50%;filter:blur(150px);opacity:0.15;z-index:0;pointer-events:none; }
        .alldrop-landing .bg-glow--cyan { background:var(--accent-cyan);top:-200px;right:-100px;animation:ad-float-glow 12s ease-in-out infinite; }
        .alldrop-landing .bg-glow--violet { background:var(--accent-violet);bottom:-200px;left:-100px;animation:ad-float-glow 15s ease-in-out infinite reverse; }
        .alldrop-landing .bg-glow--magenta { background:var(--accent-magenta);top:50%;left:50%;transform:translate(-50%,-50%);width:400px;height:400px;opacity:0.08;animation:ad-pulse-glow 8s ease-in-out infinite; }
        @keyframes ad-float-glow { 0%,100%{transform:translate(0,0)} 33%{transform:translate(30px,-20px)} 66%{transform:translate(-20px,30px)} }
        @keyframes ad-pulse-glow { 0%,100%{opacity:0.08;transform:translate(-50%,-50%) scale(1)} 50%{opacity:0.14;transform:translate(-50%,-50%) scale(1.15)} }
        .alldrop-landing .noise { position:fixed;top:0;left:0;width:100%;height:100%;z-index:1;pointer-events:none;opacity:0.035;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");background-repeat:repeat;background-size:256px 256px; }
        .alldrop-landing .particles { position:fixed;top:0;left:0;width:100%;height:100%;z-index:1;pointer-events:none;overflow:hidden; }
        .alldrop-landing .particle { position:absolute;width:2px;height:2px;background:var(--accent-cyan);border-radius:50%;opacity:0;animation:ad-particle-rise linear infinite; }
        @keyframes ad-particle-rise { 0%{opacity:0;transform:translateY(100vh) scale(0)} 10%{opacity:0.6} 90%{opacity:0.6} 100%{opacity:0;transform:translateY(-10vh) scale(1)} }
        @keyframes ad-fade-up { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ad-blink { 0%,100%{opacity:1} 50%{opacity:0.3} }

        /* HERO */
        .alldrop-landing .hero { position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;padding:3rem 2rem 3rem;text-align:center; }
        .alldrop-landing .logo-container { margin-bottom:1rem;animation:ad-fade-up 1s ease-out 0.2s both;display:flex;flex-direction:column;align-items:center;gap:0.5rem; }
        .alldrop-landing .logo-img { width:80px;height:80px;object-fit:contain;filter:drop-shadow(0 0 20px rgba(139,92,246,0.3)); }
        .alldrop-landing .logo { font-weight:900;font-size:clamp(2.2rem,5vw,3.5rem);letter-spacing:-0.03em;background:linear-gradient(135deg,var(--accent-cyan),var(--accent-violet),var(--accent-magenta));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
        .alldrop-landing .badge { display:inline-flex;align-items:center;gap:0.5rem;padding:0.4rem 1rem;border-radius:100px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.25);font-size:0.75rem;font-weight:500;color:var(--accent-violet);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:2rem;animation:ad-fade-up 1s ease-out 0.4s both; }
        .alldrop-landing .badge-dot { width:6px;height:6px;border-radius:50%;background:var(--accent-violet);animation:ad-blink 2s ease-in-out infinite; }
        .alldrop-landing .heading { margin-bottom:1.5rem;animation:ad-fade-up 1s ease-out 0.6s both; }
        .alldrop-landing .heading h1 { font-size:clamp(3rem,10vw,7rem);font-weight:900;line-height:0.95;letter-spacing:-0.04em;text-transform:uppercase; }
        .alldrop-landing .heading h1 .outline { -webkit-text-stroke:1.5px var(--text-subtle);-webkit-text-fill-color:transparent; }
        .alldrop-landing .heading h1 .gradient-word { background:linear-gradient(135deg,var(--accent-cyan) 0%,var(--accent-violet) 50%,var(--accent-magenta) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
        .alldrop-landing .subtext { max-width:520px;color:var(--text-muted);font-size:clamp(0.95rem,2vw,1.15rem);font-weight:300;line-height:1.7;margin-bottom:1rem;animation:ad-fade-up 1s ease-out 0.8s both; }

        /* 3D CAROUSEL */
        .alldrop-landing .carousel-section { position:relative;z-index:2;width:100%;padding:2rem 0 3rem;animation:ad-fade-up 1s ease-out 0.9s both; }
        .alldrop-landing .section-label { text-align:center;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.15em;color:var(--text-subtle);margin-bottom:1.5rem;font-weight:500; }
        .alldrop-landing .carousel-wrapper { position:relative;width:100%;height:440px;perspective:1200px;overflow:hidden; }
        .alldrop-landing .carousel-track { position:absolute;width:100%;height:100%;transform-style:preserve-3d; }
        .alldrop-landing .carousel-item { position:absolute;left:50%;top:50%;width:220px;height:400px;margin-left:-110px;margin-top:-200px;transition:all 0.8s cubic-bezier(0.25,0.8,0.25,1);border-radius:28px;overflow:hidden;border:3px solid rgba(255,255,255,0.1);background:#111118;box-shadow:0 25px 80px rgba(0,0,0,0.6);cursor:pointer; }
        .alldrop-landing .carousel-item.active { z-index:10;transform:translateX(0) scale(1.12);border-color:rgba(139,92,246,0.4);box-shadow:0 30px 100px rgba(0,0,0,0.7),0 0 60px rgba(139,92,246,0.15); }
        .alldrop-landing .carousel-item.prev { z-index:5;transform:translateX(-270px) rotateY(25deg) scale(0.85);opacity:0.7; }
        .alldrop-landing .carousel-item.next { z-index:5;transform:translateX(270px) rotateY(-25deg) scale(0.85);opacity:0.7; }
        .alldrop-landing .carousel-item.far-prev { z-index:2;transform:translateX(-460px) rotateY(40deg) scale(0.7);opacity:0.35; }
        .alldrop-landing .carousel-item.far-next { z-index:2;transform:translateX(460px) rotateY(-40deg) scale(0.7);opacity:0.35; }
        .alldrop-landing .carousel-item.hidden-item { opacity:0;transform:translateX(0) scale(0.5);z-index:0;pointer-events:none; }
        .alldrop-landing .carousel-item .notch { position:absolute;top:10px;left:50%;transform:translateX(-50%);width:55px;height:7px;border-radius:10px;background:rgba(255,255,255,0.08);z-index:3; }
        .alldrop-landing .carousel-item img { width:100%;height:100%;object-fit:cover; }
        .alldrop-landing .carousel-item .loading-placeholder { width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(165deg,#0a0f2e,#0a1f4a,#081a2a);font-size:2rem; }
        @keyframes ad-shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        .alldrop-landing .carousel-item .loading-placeholder::after { content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent 25%,rgba(255,255,255,0.04) 50%,transparent 75%);background-size:200% 100%;animation:ad-shimmer 2s infinite; }
        .alldrop-landing .carousel-controls { display:flex;align-items:center;justify-content:center;gap:1.5rem;margin-top:1.5rem; }
        .alldrop-landing .carousel-btn { width:48px;height:48px;border-radius:50%;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03);color:var(--text-muted);font-size:1.2rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.3s; }
        .alldrop-landing .carousel-btn:hover { border-color:var(--accent-violet);color:var(--accent-violet);background:rgba(139,92,246,0.1); }
        .alldrop-landing .carousel-status { font-family:'Space Mono',monospace;font-size:0.65rem;text-transform:uppercase;letter-spacing:0.15em;color:var(--text-subtle); }
        @media(max-width:700px) {
          .alldrop-landing .carousel-wrapper { height:370px; }
          .alldrop-landing .carousel-item { width:170px;height:320px;margin-left:-85px;margin-top:-160px; }
          .alldrop-landing .carousel-item.prev { transform:translateX(-180px) rotateY(25deg) scale(0.8); }
          .alldrop-landing .carousel-item.next { transform:translateX(180px) rotateY(-25deg) scale(0.8); }
          .alldrop-landing .carousel-item.far-prev,.alldrop-landing .carousel-item.far-next { opacity:0; }
        }

        /* UGC ROTATING STACK */
        .alldrop-landing .ugc-section { position:relative;z-index:2;padding:2rem 0 3rem;animation:ad-fade-up 1s ease-out 1s both; }
        .alldrop-landing .ugc-stack-wrapper { position:relative;width:100%;height:420px;display:flex;align-items:center;justify-content:center;perspective:1200px;overflow:hidden; }
        .alldrop-landing .ugc-card { position:absolute;width:185px;height:330px;border-radius:22px;overflow:hidden;border:2.5px solid rgba(255,255,255,0.15);background:#0a0a14;transition:all 0.75s cubic-bezier(0.4,0,0.2,1);cursor:pointer; }
        .alldrop-landing .ugc-card video { width:100%;height:100%;object-fit:cover;display:block; }
        .alldrop-landing .ugc-card .ugc-overlay { position:absolute;bottom:0;left:0;right:0;padding:14px;background:linear-gradient(0deg,rgba(0,0,0,0.8) 0%,rgba(0,0,0,0.4) 60%,transparent 100%);z-index:2;pointer-events:none; }
        .alldrop-landing .ugc-card .ugc-views { position:absolute;top:10px;left:10px;font-size:0.5rem;color:rgba(255,255,255,0.8);background:rgba(0,0,0,0.55);padding:3px 8px;border-radius:4px;font-weight:500;backdrop-filter:blur(4px);z-index:2; }
        .alldrop-landing .ugc-card .ugc-platform { position:absolute;top:10px;right:10px;font-size:0.8rem;z-index:2; }
        .alldrop-landing .ugc-card .ugc-name { font-size:0.75rem;font-weight:700;color:white;margin-bottom:2px; }
        .alldrop-landing .ugc-card .ugc-handle { font-size:0.55rem;color:rgba(255,255,255,0.5); }
        .alldrop-landing .ugc-card .ugc-notch { position:absolute;top:8px;left:50%;transform:translateX(-50%);width:45px;height:5px;border-radius:10px;background:rgba(255,255,255,0.1);z-index:3; }
        .alldrop-landing .ugc-card[data-pos="center"] { z-index:10;transform:translateX(0) scale(1) rotateY(0);opacity:1;border-color:rgba(139,92,246,0.5);box-shadow:0 20px 60px rgba(0,0,0,0.6),0 0 50px rgba(139,92,246,0.15); }
        .alldrop-landing .ugc-card[data-pos="left"] { z-index:5;transform:translateX(-220px) scale(0.82) rotateY(12deg);opacity:0.75;border-color:rgba(255,255,255,0.18);box-shadow:0 10px 40px rgba(0,0,0,0.5); }
        .alldrop-landing .ugc-card[data-pos="right"] { z-index:5;transform:translateX(220px) scale(0.82) rotateY(-12deg);opacity:0.75;border-color:rgba(255,255,255,0.18);box-shadow:0 10px 40px rgba(0,0,0,0.5); }
        .alldrop-landing .ugc-card[data-pos="exit-left"] { z-index:15;transform:translateX(-380px) scale(0.6) rotateY(25deg);opacity:0;pointer-events:none; }
        .alldrop-landing .ugc-card[data-pos="exit-right"] { z-index:15;transform:translateX(380px) scale(0.6) rotateY(-25deg);opacity:0;pointer-events:none; }
        .alldrop-landing .ugc-card[data-pos="enter"] { z-index:1;transform:translateX(0) scale(0.5) rotateY(0);opacity:0;pointer-events:none; }
        .alldrop-landing .ugc-card[data-pos="hidden"] { z-index:0;transform:translateX(0) scale(0.5);opacity:0;pointer-events:none; }
        @media(max-width:600px) {
          .alldrop-landing .ugc-stack-wrapper{height:350px;}
          .alldrop-landing .ugc-card{width:145px;height:260px;border-radius:18px;}
          .alldrop-landing .ugc-card[data-pos="left"] { transform:translateX(-160px) scale(0.78) rotateY(10deg); }
          .alldrop-landing .ugc-card[data-pos="right"] { transform:translateX(160px) scale(0.78) rotateY(-10deg); }
          .alldrop-landing .ugc-card[data-pos="exit-left"] { transform:translateX(-280px) scale(0.5) rotateY(20deg); }
          .alldrop-landing .ugc-card[data-pos="exit-right"] { transform:translateX(280px) scale(0.5) rotateY(-20deg); }
        }

        /* PRODUCT RESEARCH SECTION */
        .alldrop-landing .research-section { position:relative;z-index:2;padding:3rem 2rem 3rem;max-width:1100px;margin:0 auto; }
        .alldrop-landing .research-layout { display:flex;align-items:center;gap:3rem; }
        .alldrop-landing .research-text { flex:1;min-width:0; }
        .alldrop-landing .research-text h2 { font-size:clamp(1.8rem,4vw,2.8rem);font-weight:800;line-height:1.1;margin-bottom:1rem;letter-spacing:-0.03em; }
        .alldrop-landing .research-text h2 .rh-grad { background:linear-gradient(135deg,var(--accent-violet),var(--accent-magenta));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
        .alldrop-landing .research-text p { color:var(--text-muted);font-size:0.95rem;line-height:1.7;font-weight:300;max-width:420px; }
        .alldrop-landing .research-mockup { flex:1;min-width:0;position:relative;height:420px; }
        .alldrop-landing .rm-search { position:absolute;top:0;right:0;width:280px;background:rgba(255,255,255,0.06);border:1px solid rgba(139,92,246,0.3);border-radius:12px;padding:10px 14px;display:flex;align-items:center;gap:8px;backdrop-filter:blur(8px); }
        .alldrop-landing .rm-search-icon { color:var(--accent-violet);font-size:0.9rem;flex-shrink:0; }
        .alldrop-landing .rm-search-text { font-size:0.8rem;color:var(--text-primary);font-weight:400;white-space:nowrap;overflow:hidden;border-right:2px solid var(--accent-violet);padding-right:2px;animation:ad-rm-blink-cursor 0.8s step-end infinite; }
        @keyframes ad-rm-blink-cursor { 0%,100%{border-color:var(--accent-violet)} 50%{border-color:transparent} }
        .alldrop-landing .rm-products { position:absolute;top:0;left:0;width:150px;height:100%;overflow:hidden;mask-image:linear-gradient(180deg,transparent 0%,black 15%,black 85%,transparent 100%);-webkit-mask-image:linear-gradient(180deg,transparent 0%,black 15%,black 85%,transparent 100%); }
        .alldrop-landing .rm-products-track { display:flex;flex-direction:column;gap:12px;animation:ad-rm-scroll-products 18s linear infinite; }
        @keyframes ad-rm-scroll-products { 0%{transform:translateY(0)} 100%{transform:translateY(-50%)} }
        .alldrop-landing .rm-pcard { width:140px;height:105px;border-radius:14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);overflow:hidden;flex-shrink:0;display:flex;flex-direction:column;padding:8px;gap:6px;backdrop-filter:blur(4px); }
        .alldrop-landing .rm-pcard-img { width:100%;flex:1;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.8rem; }
        .alldrop-landing .rm-pcard-name { font-size:0.55rem;color:rgba(255,255,255,0.7);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        .alldrop-landing .rm-pcard-price { font-size:0.6rem;color:var(--accent-cyan);font-weight:700;font-family:'Space Mono',monospace; }
        .alldrop-landing .rm-products::after { content:'';position:absolute;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,var(--accent-violet),transparent);box-shadow:0 0 15px var(--accent-violet),0 0 30px rgba(139,92,246,0.3);animation:ad-rm-scan 3s ease-in-out infinite;z-index:5;pointer-events:none; }
        @keyframes ad-rm-scan { 0%,100%{top:15%} 50%{top:85%} }
        .alldrop-landing .rm-stats { position:absolute;top:50px;right:0;width:280px;display:grid;grid-template-columns:1fr 1fr;gap:7px; }
        .alldrop-landing .rm-stat { background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px 12px;backdrop-filter:blur(4px);transition:border-color 0.4s; }
        .alldrop-landing .rm-stat.rm-stat-active { border-color:rgba(139,92,246,0.4);box-shadow:0 0 20px rgba(139,92,246,0.08); }
        .alldrop-landing .rm-stat-label { font-size:0.5rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;font-weight:500; }
        .alldrop-landing .rm-stat-value { font-size:1.1rem;font-weight:700;font-family:'Space Mono',monospace;color:var(--text-primary); }
        .alldrop-landing .rm-stat-mini { display:flex;align-items:center;gap:4px;margin-top:3px; }
        .alldrop-landing .rm-stat-trend { font-size:0.5rem;font-weight:600; }
        .alldrop-landing .rm-stat-trend.up { color:#34d399; }
        .alldrop-landing .rm-stat-trend.down { color:var(--accent-magenta); }
        .alldrop-landing .rm-connect { position:absolute;top:50%;left:145px;right:calc(100% - 280px + 145px);height:1px;z-index:1; }
        .alldrop-landing .rm-connect::after { content:'';position:absolute;top:-1px;left:0;width:40px;height:3px;background:linear-gradient(90deg,var(--accent-violet),transparent);border-radius:2px;animation:ad-rm-pulse-line 2s ease-in-out infinite; }
        @keyframes ad-rm-pulse-line { 0%{left:0;opacity:0} 20%{opacity:1} 80%{opacity:1} 100%{left:calc(100% - 40px);opacity:0} }
        @media(max-width:750px) {
          .alldrop-landing .research-section { padding:2rem 1.2rem; }
          .alldrop-landing .research-layout { flex-direction:column;text-align:center; }
          .alldrop-landing .research-text p { max-width:none; }
          .alldrop-landing .research-mockup { position:relative;width:100%;max-width:340px;height:auto;margin:0 auto;display:flex;flex-direction:column;gap:12px; }
          .alldrop-landing .rm-search { position:relative;top:auto;right:auto;width:100%; }
          .alldrop-landing .rm-products { display:none; }
          .alldrop-landing .rm-connect { display:none; }
          .alldrop-landing .rm-stats { position:relative;top:auto;right:auto;width:100%; }
        }

        /* STORE BUILDER SECTION */
        .alldrop-landing .builder-section { position:relative;z-index:2;padding:3rem 2rem 3.5rem;max-width:1100px;margin:0 auto; }
        .alldrop-landing .builder-layout { display:flex;align-items:center;gap:3rem; }
        .alldrop-landing .builder-img { flex:1;min-width:0;position:relative;border-radius:18px;overflow:hidden;border:1px solid rgba(139,92,246,0.2);box-shadow:0 30px 80px rgba(0,0,0,0.5),0 0 60px rgba(139,92,246,0.08); }
        .alldrop-landing .builder-img img { width:100%;height:auto;display:block; }
        .alldrop-landing .builder-img::before { content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 60%,rgba(5,5,8,0.5) 100%);z-index:1;pointer-events:none; }
        .alldrop-landing .builder-img::after { content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(139,92,246,0.4),transparent);z-index:2; }
        .alldrop-landing .builder-content { flex:1;min-width:0; }
        .alldrop-landing .builder-content h2 { font-size:clamp(1.8rem,4vw,2.8rem);font-weight:800;line-height:1.1;margin-bottom:1rem;letter-spacing:-0.03em; }
        .alldrop-landing .builder-content h2 .bh-grad { background:linear-gradient(135deg,var(--accent-cyan),var(--accent-violet));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
        .alldrop-landing .builder-content p { color:var(--text-muted);font-size:0.95rem;line-height:1.7;font-weight:300;max-width:420px;margin-bottom:1.2rem; }
        .alldrop-landing .builder-features { display:flex;flex-direction:column;gap:10px; }
        .alldrop-landing .builder-feat { display:flex;align-items:center;gap:10px;font-size:0.85rem;color:var(--text-muted);font-weight:400; }
        .alldrop-landing .builder-feat-icon { width:28px;height:28px;border-radius:8px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);display:flex;align-items:center;justify-content:center;font-size:0.8rem;flex-shrink:0; }
        @media(max-width:750px) {
          .alldrop-landing .builder-section { padding:2rem 1.2rem; }
          .alldrop-landing .builder-layout { flex-direction:column;gap:2rem; }
          .alldrop-landing .builder-content { text-align:center; }
          .alldrop-landing .builder-content p { max-width:none; }
          .alldrop-landing .builder-features { align-items:center; }
        }

        /* FAQ SECTION */
        .alldrop-landing .faq-section { position:relative;z-index:2;padding:3rem 2rem 3.5rem;max-width:720px;margin:0 auto; }
        .alldrop-landing .faq-section h2 { text-align:center;font-size:clamp(1.8rem,4vw,2.6rem);font-weight:800;letter-spacing:-0.03em;margin-bottom:2rem; }
        .alldrop-landing .faq-section h2 .faq-grad { background:linear-gradient(135deg,var(--accent-violet),var(--accent-magenta));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
        .alldrop-landing .faq-item { border-bottom:1px solid rgba(255,255,255,0.06); }
        .alldrop-landing .faq-q { width:100%;background:none;border:none;color:var(--text-primary);font-family:'Outfit',sans-serif;font-size:0.95rem;font-weight:500;padding:1.1rem 0;display:flex;align-items:center;justify-content:space-between;gap:1rem;cursor:pointer;text-align:left;transition:color 0.3s; }
        .alldrop-landing .faq-q:hover { color:var(--accent-violet); }
        .alldrop-landing .faq-q-icon { flex-shrink:0;width:24px;height:24px;border-radius:50%;border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:0.75rem;color:var(--text-muted);transition:all 0.3s; }
        .alldrop-landing .faq-item.open .faq-q-icon { transform:rotate(45deg);border-color:var(--accent-violet);color:var(--accent-violet); }
        .alldrop-landing .faq-a { max-height:0;overflow:hidden;transition:max-height 0.4s ease,padding 0.3s ease; }
        .alldrop-landing .faq-item.open .faq-a { max-height:300px; }
        .alldrop-landing .faq-a-inner { padding:0 0 1.2rem;color:var(--text-muted);font-size:0.88rem;line-height:1.7;font-weight:300; }
        @media(max-width:600px) { .alldrop-landing .faq-section { padding:2rem 1.2rem; } }

        /* CTA */
        .alldrop-landing .features { display:flex;flex-wrap:wrap;justify-content:center;gap:0.75rem;margin-bottom:2rem;animation:ad-fade-up 1s ease-out 1.1s both; }
        .alldrop-landing .feature-tag { padding:0.5rem 1rem;border-radius:8px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);font-size:0.8rem;font-weight:400;color:var(--text-muted);transition:all 0.3s;cursor:default; }
        .alldrop-landing .feature-tag:hover { border-color:rgba(0,240,255,0.3);color:var(--accent-cyan);background:rgba(0,240,255,0.05);transform:translateY(-2px); }
        .alldrop-landing .feature-tag .icon { margin-right:0.4rem; }
        .alldrop-landing .cta-section { animation:ad-fade-up 1s ease-out 1.2s both;width:100%;max-width:480px; }
        .alldrop-landing .email-form { display:flex;gap:0;width:100%;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:5px;transition:border-color 0.3s; }
        .alldrop-landing .email-form:focus-within { border-color:rgba(139,92,246,0.4); }
        .alldrop-landing .email-form input { flex:1;background:transparent;border:none;outline:none;color:var(--text-primary);font-family:'Outfit',sans-serif;font-size:0.9rem;padding:0.8rem 1rem;font-weight:300; }
        .alldrop-landing .email-form input::placeholder { color:var(--text-subtle); }
        .alldrop-landing .email-form button { background:linear-gradient(135deg,var(--accent-violet),var(--accent-magenta));border:none;color:white;padding:0.8rem 1.5rem;border-radius:10px;font-family:'Outfit',sans-serif;font-size:0.85rem;font-weight:600;cursor:pointer;white-space:nowrap;transition:all 0.3s;letter-spacing:0.02em; }
        .alldrop-landing .email-form button:hover { opacity:0.9;transform:scale(1.02); }
        .alldrop-landing .form-note { text-align:center;margin-top:0.75rem;font-size:0.72rem;color:var(--text-subtle);font-weight:300; }
        .alldrop-landing .success-message { display:none;text-align:center;padding:1rem;color:var(--accent-cyan);font-weight:500;font-size:0.9rem;animation:ad-fade-up 0.5s ease-out; }
        .alldrop-landing .success-message.show { display:block; }
        .alldrop-landing .footer { position:relative;z-index:2;text-align:center;padding:2rem;font-size:0.72rem;color:var(--text-subtle);font-weight:300;letter-spacing:0.05em; }
        @media(max-width:600px) { .alldrop-landing .email-form{flex-direction:column;border-radius:12px} .alldrop-landing .email-form button{width:100%;padding:1rem} .alldrop-landing .features{gap:0.5rem} }
      `}</style>

      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Space+Mono:wght@400;700&display=swap"
        rel="stylesheet"
      />

      <div className="alldrop-landing" ref={containerRef}>
        <div className="bg-grid" />
        <div className="bg-glow bg-glow--cyan" />
        <div className="bg-glow bg-glow--violet" />
        <div className="bg-glow bg-glow--magenta" />
        <div className="noise" />
        <div className="particles" id="particles" />

        {/* HERO */}
        <div className="hero">
          <div className="logo-container">
            <img src={`${ASSET_BASE}/images/logo.png`} alt="AllDrop" className="logo-img" />
            <div className="logo">AllDrop</div>
          </div>
          <div className="badge">
            <div className="badge-dot" />
            En desarrollo
          </div>
          <div className="heading">
            <h1>
              <span className="outline">PROXIMA</span>
              <br />
              <span className="gradient-word">MENTE</span>
            </h1>
          </div>
          <p className="subtext">
            La suite todo-en-uno para dropshippers en Europa.
            <br />
            Product Research &middot; Creativos IA &middot; Landings &middot; Analytics.
            <br />
            Todo lo que necesitas, en un solo lugar.
          </p>

          <div className="features">
            <div className="feature-tag"><span className="icon">&#128269;</span> Product Research</div>
            <div className="feature-tag"><span className="icon">&#127912;</span> Studio Creativo IA</div>
            <div className="feature-tag"><span className="icon">&#128640;</span> Landing Builder</div>
            <div className="feature-tag"><span className="icon">&#128202;</span> Analytics Pro</div>
            <div className="feature-tag"><span className="icon">&#127916;</span> Video Generator</div>
            <div className="feature-tag"><span className="icon">&#129302;</span> Automatizacion</div>
          </div>

          <div className="cta-section">
            <form className="email-form" id="emailForm">
              <input type="email" placeholder="tu@email.com" required id="emailInput" />
              <button type="submit">Avisame</button>
            </form>
            <div className="form-note">Se el primero en acceder. Sin spam, lo prometemos.</div>
            <div className="success-message" id="successMessage">&#10003; Listo! Te avisaremos cuando lancemos.</div>
          </div>
        </div>

        {/* 3D CAROUSEL */}
        <div className="carousel-section">
          <div className="section-label">&#128640; Landings que convierten — generadas con IA</div>
          <div className="carousel-wrapper">
            <div className="carousel-track" id="carouselTrack" />
          </div>
          <div className="carousel-controls">
            <button className="carousel-btn" id="prevBtn">&#8249;</button>
            <span className="carousel-status" id="carouselStatus">PLAYING</span>
            <button className="carousel-btn" id="nextBtn">&#8250;</button>
          </div>
        </div>

        {/* UGC ROTATING STACK */}
        <div className="ugc-section">
          <div className="section-label">&#127916; Videos UGC con Influencers — generados con IA</div>
          <div className="ugc-stack-wrapper" id="ugcStack" />
        </div>

        {/* PRODUCT RESEARCH */}
        <div className="research-section">
          <div className="section-label">&#128269; Encuentra productos ganadores — analisis con IA</div>
          <div className="research-layout">
            <div className="research-text">
              <h2>
                Encuentra tu proximo
                <br />
                <span className="rh-grad">producto ganador</span>
              </h2>
              <p>
                Analiza millones de productos en tiempo real. Metricas de demanda, competencia, margenes y
                tendencias — todo potenciado por inteligencia artificial.
              </p>
            </div>
            <div className="research-mockup">
              <div className="rm-search">
                <span className="rm-search-icon">&#128269;</span>
                <span className="rm-search-text" id="rmSearchText" />
              </div>
              <div className="rm-products">
                <div className="rm-products-track" id="rmProductsTrack" />
              </div>
              <div className="rm-connect" />
              <div className="rm-stats" id="rmStats">
                <div className="rm-stat" data-stat="0">
                  <div className="rm-stat-label">Volumen busquedas</div>
                  <div className="rm-stat-value" data-target="14500">0</div>
                  <div className="rm-stat-mini"><span className="rm-stat-trend up">+23%</span></div>
                </div>
                <div className="rm-stat" data-stat="1">
                  <div className="rm-stat-label">Revenue mensual</div>
                  <div className="rm-stat-value" data-target="8420">&euro;0</div>
                  <div className="rm-stat-mini"><span className="rm-stat-trend up">+18%</span></div>
                </div>
                <div className="rm-stat" data-stat="2">
                  <div className="rm-stat-label">Competencia</div>
                  <div className="rm-stat-value" data-target="34">0</div>
                  <div className="rm-stat-mini"><span className="rm-stat-trend down">Baja</span></div>
                </div>
                <div className="rm-stat" data-stat="3">
                  <div className="rm-stat-label">Margen estimado</div>
                  <div className="rm-stat-value" data-target="67">0%</div>
                  <div className="rm-stat-mini"><span className="rm-stat-trend up">Alto</span></div>
                </div>
                <div className="rm-stat" data-stat="4">
                  <div className="rm-stat-label">BSR Rank</div>
                  <div className="rm-stat-value" data-target="1247">#0</div>
                  <div className="rm-stat-mini"><span className="rm-stat-trend up">Top 5%</span></div>
                </div>
                <div className="rm-stat" data-stat="5">
                  <div className="rm-stat-label">Reviews</div>
                  <div className="rm-stat-value" data-target="342">0</div>
                  <div className="rm-stat-mini"><span className="rm-stat-trend up">4.6&#9733;</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* STORE BUILDER */}
        <div className="builder-section">
          <div className="section-label">&#127978; Tu tienda online profesional — incluida en AllDrop</div>
          <div className="builder-layout">
            <div className="builder-img">
              <img src={`${ASSET_BASE}/images/droppage.webp`} alt="Dashboard de tu tienda online en AllDrop" loading="lazy" />
            </div>
            <div className="builder-content">
              <h2>
                Tu propia tienda
                <br />
                <span className="bh-grad">tipo Shopify</span>
              </h2>
              <p>
                No necesitas Shopify ni plataformas externas. AllDrop incluye un constructor de tiendas
                completo con todo lo que necesitas para vender desde el primer dia.
              </p>
              <div className="builder-features">
                <div className="builder-feat"><div className="builder-feat-icon">&#128230;</div> Gestion de productos y variantes</div>
                <div className="builder-feat"><div className="builder-feat-icon">&#128179;</div> Checkout optimizado para conversion</div>
                <div className="builder-feat"><div className="builder-feat-icon">&#128202;</div> Analytics y metricas en tiempo real</div>
                <div className="builder-feat"><div className="builder-feat-icon">&#127912;</div> Diseno personalizable sin codigo</div>
                <div className="builder-feat"><div className="builder-feat-icon">&#127758;</div> Dominio propio y SEO incluido</div>
                <div className="builder-feat"><div className="builder-feat-icon">&#128260;</div> Carritos abandonados y remarketing</div>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="faq-section">
          <h2><span className="faq-grad">Preguntas frecuentes</span></h2>
          <div className="faq-item">
            <button className="faq-q"><span>Que es AllDrop exactamente?</span><span className="faq-q-icon">+</span></button>
            <div className="faq-a"><div className="faq-a-inner">AllDrop es una suite todo-en-uno disenada para dropshippers en Europa. Incluye herramientas de product research con IA, generador de landings, studio creativo para anuncios y videos, tu propia tienda online, analytics avanzados y automatizacion — todo en una sola plataforma.</div></div>
          </div>
          <div className="faq-item">
            <button className="faq-q"><span>Necesito experiencia previa en dropshipping?</span><span className="faq-q-icon">+</span></button>
            <div className="faq-a"><div className="faq-a-inner">No. AllDrop esta pensado tanto para principiantes como para dropshippers avanzados. La IA te guia en cada paso: desde encontrar productos ganadores hasta crear creativos profesionales y lanzar tu tienda sin escribir una linea de codigo.</div></div>
          </div>
          <div className="faq-item">
            <button className="faq-q"><span>Realmente incluye una tienda online tipo Shopify?</span><span className="faq-q-icon">+</span></button>
            <div className="faq-a"><div className="faq-a-inner">Si. AllDrop incluye un constructor de tiendas completo con gestion de productos, checkout optimizado, dominio propio, politicas legales, carritos abandonados, analytics y mas. No necesitas pagar Shopify ni ninguna otra plataforma externa.</div></div>
          </div>
          <div className="faq-item">
            <button className="faq-q"><span>Como funciona el product research con IA?</span><span className="faq-q-icon">+</span></button>
            <div className="faq-a"><div className="faq-a-inner">Nuestro motor de IA analiza millones de productos en tiempo real. Te muestra metricas clave como volumen de busquedas, revenue estimado, nivel de competencia, margen de beneficio y tendencias — para que puedas tomar decisiones basadas en datos, no en intuicion.</div></div>
          </div>
          <div className="faq-item">
            <button className="faq-q"><span>Puedo generar landings y creativos con IA?</span><span className="faq-q-icon">+</span></button>
            <div className="faq-a"><div className="faq-a-inner">Absolutamente. AllDrop genera landing pages completas optimizadas para conversion, videos UGC con influencers virtuales, imagenes de producto profesionales y textos persuasivos para tus anuncios — todo con inteligencia artificial en segundos.</div></div>
          </div>
          <div className="faq-item">
            <button className="faq-q"><span>Cuando se lanza y cuanto costara?</span><span className="faq-q-icon">+</span></button>
            <div className="faq-a"><div className="faq-a-inner">Estamos en fase final de desarrollo. Dejanos tu email para ser de los primeros en acceder. Los early adopters tendran acceso a precios especiales de lanzamiento y funcionalidades exclusivas.</div></div>
          </div>
        </div>

        <div className="footer">&copy; 2026 AllDrop &middot; Hecho para dropshippers en Europa</div>
      </div>
    </>
  )
}
