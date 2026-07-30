/* ============================================================
   CARTA PARA ALEX — SCRIPT.JS
   Autor: Frontend Engineer Senior
   Descripción: Controla el flujo completo de la experiencia:
   bienvenida → sobre (4 clics) → carta → cierre → pantalla final.
   Cada función tiene una única responsabilidad y está documentada.
============================================================ */

(function () {
  'use strict';

  /* ============================================================
     REFERENCIAS AL DOM
     Se cachean una sola vez para evitar consultas repetidas.
  ============================================================ */
  const welcomeScreen = document.getElementById('welcomeScreen');
  const openSurpriseBtn = document.getElementById('openSurpriseBtn');

  const mainScene = document.getElementById('mainScene');
  const envelope = document.getElementById('envelope');
  const envelopeHint = document.getElementById('envelopeHint');
  const closeLetterBtn = document.getElementById('closeLetterBtn');

  const finalScreen = document.getElementById('finalScreen');

  const starsContainer = document.getElementById('stars');
  const particlesContainer = document.getElementById('particles');

  const musicToggle = document.getElementById('musicToggle');
  const bgMusic = document.getElementById('bgMusic');

  const sfx = {
    click: document.getElementById('sfxClick'),
    paper: document.getElementById('sfxPaper'),
    openEnvelope: document.getElementById('sfxOpenEnvelope'),
    sparkle: document.getElementById('sfxSparkle'),
  };

  /* ============================================================
     ESTADO INTERNO
  ============================================================ */
  const TOTAL_STEPS = 4;
  let currentStep = 0;
  let isAnimating = false; // Evita clics repetidos durante una transición
  let musicHasStarted = false;

  // Mensajes de guía mostrados sobre el sobre, uno por cada paso
  const HINT_MESSAGES = [
    'Toca el sobre para comenzar',
    'Sigue tocando para abrir la carta',
    'Un poco más...',
    'Ya casi está lista...',
    '',
  ];

  /* ============================================================
     UTILIDAD: playSound(id)
     Reproduce un efecto de sonido desde el inicio, permitiendo
     que se solape con reproducciones anteriores. Si el archivo
     de audio no existe todavía (proyecto recién descargado) o el
     navegador bloquea la reproducción, falla de forma silenciosa
     para no interrumpir la experiencia visual.
  ============================================================ */
  function playSound(audioElement) {
    if (!audioElement) return;
    try {
      audioElement.currentTime = 0;
      const playPromise = audioElement.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          /* Reproducción bloqueada o archivo ausente: se ignora */
        });
      }
    } catch (error) {
      /* Silenciado intencionalmente */
    }
  }

  /* ============================================================
     UTILIDAD: onceTransitionEnds(element, fallbackMs)
     Ejecuta un callback cuando termina una transición/animación
     CSS, con un temporizador de respaldo por si el evento no
     llega (por ejemplo, con "prefers-reduced-motion").
  ============================================================ */
  function afterAnimation(element, durationMs, callback) {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      callback();
    };
    const handler = (event) => {
      if (event.target === element) {
        element.removeEventListener('transitionend', handler);
        finish();
      }
    };
    element.addEventListener('transitionend', handler);
    window.setTimeout(finish, durationMs);
  }

  /* ============================================================
     GENERACIÓN DEL FONDO: generateStars()
     Crea estrellas de distintos tamaños con animaciones de
     parpadeo independientes (duración y retraso aleatorios),
     para que nunca titilen todas al mismo tiempo.
  ============================================================ */
  function generateStars(count) {
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < count; i += 1) {
      const star = document.createElement('span');
      star.className = 'star';

      const size = Math.random() * 2.2 + 1; // 1px a 3.2px
      const top = Math.random() * 100;
      const left = Math.random() * 100;
      const duration = Math.random() * 3 + 2.5; // 2.5s a 5.5s
      const delay = Math.random() * 5;

      star.style.width = `${size}px`;
      star.style.height = `${size}px`;
      star.style.top = `${top}%`;
      star.style.left = `${left}%`;
      star.style.animationDuration = `${duration}s`;
      star.style.animationDelay = `${delay}s`;

      fragment.appendChild(star);
    }

    starsContainer.appendChild(fragment);
  }

  /* ============================================================
     GENERACIÓN DEL FONDO: generateParticles()
     Crea partículas doradas que flotan lentamente en direcciones
     ligeramente distintas, simulando polvo iluminado en el aire.
  ============================================================ */
  function generateParticles(count) {
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < count; i += 1) {
      const particle = document.createElement('span');
      particle.className = 'particle';

      const size = Math.random() * 3 + 2; // 2px a 5px
      const left = Math.random() * 100;
      const bottom = Math.random() * 20; // nace cerca de la parte baja
      const duration = Math.random() * 10 + 14; // 14s a 24s: muy lento
      const delay = Math.random() * 12;
      const driftX = `${(Math.random() - 0.5) * 80}px`;
      const driftY = `${-(Math.random() * 120 + 100)}px`;

      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.left = `${left}%`;
      particle.style.bottom = `${bottom}%`;
      particle.style.animationDuration = `${duration}s`;
      particle.style.animationDelay = `${delay}s`;
      particle.style.setProperty('--drift-x', driftX);
      particle.style.setProperty('--drift-y', driftY);

      fragment.appendChild(particle);
    }

    particlesContainer.appendChild(fragment);
  }

  /* ============================================================
     startBackgroundMusic()
     Inicia la música de fondo en bucle a bajo volumen. Se llama
     únicamente tras una interacción del usuario (clic en "Abrir
     sorpresa"), respetando las políticas de autoplay de los
     navegadores. Falla en silencio si el archivo no está listo.
  ============================================================ */
  function startBackgroundMusic() {
    if (musicHasStarted || !bgMusic) return;
    bgMusic.volume = 0.35;
    const playPromise = bgMusic.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise
        .then(() => {
          musicHasStarted = true;
          musicToggle.setAttribute('aria-pressed', 'true');
        })
        .catch(() => {
          /* El navegador bloqueó el autoplay; el usuario podrá
             activar la música manualmente con musicToggle */
        });
    }
  }

  /* ============================================================
     toggleMusic()
     Alterna manualmente la música de fondo mediante el botón
     flotante. Refleja el estado en aria-pressed para lectores
     de pantalla.
  ============================================================ */
  function toggleMusic() {
    if (!bgMusic) return;

    if (bgMusic.paused) {
      bgMusic.volume = 0.35;
      bgMusic.play()
        .then(() => {
          musicHasStarted = true;
          musicToggle.setAttribute('aria-pressed', 'true');
        })
        .catch(() => {});
    } else {
      bgMusic.pause();
      musicToggle.setAttribute('aria-pressed', 'false');
    }
  }

  /* ============================================================
     showWelcome()
     Estado inicial de la página. La pantalla de bienvenida ya
     es visible por defecto en el HTML/CSS (fadeIn automático),
     por lo que esta función solo deja el foco correctamente
     posicionado para navegación por teclado.
  ============================================================ */
  function showWelcome() {
    openSurpriseBtn.focus({ preventScroll: true });
  }

  /* ============================================================
     revealMainScene()
     Ejecuta la transición cinematográfica entre la pantalla de
     bienvenida y el escenario principal: desactiva el botón,
     aplica fade out, espera, y muestra el sobre con fade in.
  ============================================================ */
  function revealMainScene() {
    openSurpriseBtn.disabled = true;
    playSound(sfx.click);
    startBackgroundMusic();

    welcomeScreen.classList.add('is-leaving');

    afterAnimation(welcomeScreen, 950, () => {
      welcomeScreen.hidden = true;
      mainScene.hidden = false;
      envelope.focus({ preventScroll: true });
    });
  }

  /* ============================================================
     updateEnvelopeAccessibility()
     Actualiza el aria-label del sobre y el texto de ayuda visible
     según el paso actual, para que la interacción sea comprensible
     tanto visualmente como para lectores de pantalla.
  ============================================================ */
  function updateEnvelopeAccessibility() {
    const nextStep = Math.min(currentStep + 1, TOTAL_STEPS);
    envelope.setAttribute(
      'aria-label',
      currentStep >= TOTAL_STEPS
        ? 'La carta ya está abierta'
        : `Toca el sobre para continuar. Paso ${nextStep} de ${TOTAL_STEPS}.`
    );

    envelopeHint.textContent = HINT_MESSAGES[currentStep] || '';
    if (!HINT_MESSAGES[currentStep]) {
      envelopeHint.classList.add('is-hidden');
    }
  }

  /* ============================================================
     openEnvelope()
     PASO 1: la solapa del sobre gira lentamente hacia atrás y el
     sello (corazón) late con más intensidad, acompañado de un
     sonido de apertura.
  ============================================================ */
  function openEnvelope() {
    envelope.classList.add('step-1');
    playSound(sfx.openEnvelope);
  }

  /* ============================================================
     pullLetter()
     PASO 2: la carta, todavía plegada, comienza a asomar desde
     el interior del sobre, como si se estuviera sacando con
     cuidado.
  ============================================================ */
  function pullLetter() {
    envelope.classList.add('step-2');
    playSound(sfx.paper);
  }

  /* ============================================================
     unfoldLetter()
     PASO 3: la carta termina de salir por completo y se
     despliega, mostrando ya su forma final de hoja abierta.
  ============================================================ */
  function unfoldLetter() {
    envelope.classList.add('step-3');
    playSound(sfx.paper);
  }

  /* ============================================================
     openLetter()
     PASO 4: la carta se expande hacia el centro de la pantalla,
     revelando el contenido completo y habilitando el scroll.
     Aparece el botón "Cerrar carta".
  ============================================================ */
  function openLetter() {
    envelope.classList.add('step-4');
    playSound(sfx.sparkle);

    envelope.setAttribute('tabindex', '-1');
    envelope.setAttribute('aria-disabled', 'true');

    afterAnimation(envelope.querySelector('.letter'), 1700, () => {
      closeLetterBtn.hidden = false;
      closeLetterBtn.focus({ preventScroll: true });
    });
  }

  /* ============================================================
     handleEnvelopeClick()
     Controlador único de la secuencia de 4 clics sobre el sobre.
     Avanza un paso por clic y bloquea nuevos clics mientras una
     animación está en curso, para mantener el ritmo cinematográfico.
  ============================================================ */
  function handleEnvelopeClick() {
    if (isAnimating || currentStep >= TOTAL_STEPS) return;

    isAnimating = true;
    currentStep += 1;

    const stepActions = {
      1: openEnvelope,
      2: pullLetter,
      3: unfoldLetter,
      4: openLetter,
    };

    const action = stepActions[currentStep];
    if (action) action();

    updateEnvelopeAccessibility();

    // Libera el bloqueo de clics una vez concluye la transición del paso
    window.setTimeout(() => {
      isAnimating = false;
    }, 900);
  }

  /* ============================================================
     closeLetter()
     Invierte la secuencia: la carta se pliega y regresa al
     interior del sobre, que luego se desvanece junto con el
     resto del escenario principal.
  ============================================================ */
  function closeLetter() {
    playSound(sfx.paper);

    closeLetterBtn.hidden = true;
    envelope.classList.remove('step-4', 'step-3', 'step-2');
    envelope.classList.add('is-closing');

    afterAnimation(envelope.querySelector('.letter'), 1700, () => {
      mainScene.classList.add('is-leaving');
      afterAnimation(mainScene, 950, showFinalScreen);
    });
  }

  /* ============================================================
     showFinalScreen()
     Oculta por completo el escenario principal y revela la
     pantalla final con el mensaje de despedida y el corazón
     latiendo. Punto de cierre de la experiencia.
  ============================================================ */
  function showFinalScreen() {
    mainScene.hidden = true;
    finalScreen.hidden = false;
    finalScreen.focus({ preventScroll: true });
  }

  /* ============================================================
     handleEnvelopeKeydown(event)
     El sobre usa role="button" sobre un <div> (no un <button>
     nativo) para poder alojar el botón "Cerrar carta" en su
     interior sin anidar elementos interactivos, lo cual es
     inválido en HTML. Por eso Enter y Espacio deben activarse
     manualmente para mantener la accesibilidad por teclado.
  ============================================================ */
  function handleEnvelopeKeydown(event) {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      handleEnvelopeClick();
    }
  }

  /* ============================================================
     initEnvelopeInteraction()
     Registra los listeners de teclado y clic sobre el sobre.
  ============================================================ */
  function initEnvelopeInteraction() {
    envelope.addEventListener('click', handleEnvelopeClick);
    envelope.addEventListener('keydown', handleEnvelopeKeydown);

    // stopPropagation evita que el clic en "Cerrar carta" también
    // burbujee hacia el sobre y dispare un avance de paso indebido
    closeLetterBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      closeLetter();
    });
  }

  /* ============================================================
     initWelcomeInteraction()
     Registra el listener del botón "Abrir sorpresa".
  ============================================================ */
  function initWelcomeInteraction() {
    openSurpriseBtn.addEventListener('click', revealMainScene);
  }

  /* ============================================================
     initMusicToggle()
     Registra el listener del botón flotante de música.
  ============================================================ */
  function initMusicToggle() {
    musicToggle.addEventListener('click', toggleMusic);
  }

  /* ============================================================
     init()
     Punto de entrada. Genera el fondo, registra los listeners
     y deja la experiencia lista para comenzar.
  ============================================================ */
  function init() {
    generateStars(90);
    generateParticles(24);

    initWelcomeInteraction();
    initEnvelopeInteraction();
    initMusicToggle();

    showWelcome();
    updateEnvelopeAccessibility();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
