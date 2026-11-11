// Règles de l'écran de démarrage (aucune dépendance au DOM : testé à part).
// - aucun délai artificiel : le splash n'apparaît que si le vrai démarrage dépasse showDelay (400 ms) ;
// - il disparaît dès que l'appli est prête, au plus tard après maxDelay (3 s) ;
// - un clic ou une touche le ferme tout de suite ; il ne s'affiche qu'une fois (au lancement).
export function createSplash({ show, hide, showDelay = 400, maxDelay = 3000, minShow = 0, timers = { setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: (i) => clearTimeout(i) } }) {
  let started = false;
  let shown = false;
  let done = false;
  let showTimer = null;
  let maxTimer = null;
  let minTimer = null;
  let minElapsed = false;
  let readyPending = false;

  // Affichage : si minShow > 0, l'animation va au bout même si l'appli est prête plus tôt.
  function display() {
    shown = true;
    show();
    if (minShow > 0) {
      minTimer = timers.setTimeout(() => {
        minElapsed = true;
        if (readyPending) finish('ready');
      }, minShow);
    } else minElapsed = true;
  }

  function finish(reason) {
    if (done) return;
    done = true;
    timers.clearTimeout(showTimer);
    timers.clearTimeout(maxTimer);
    timers.clearTimeout(minTimer);
    if (shown) hide(reason);
  }

  return {
    start() {
      if (started) return;
      started = true;
      if (showDelay <= 0) display();
      else showTimer = timers.setTimeout(() => { if (!done) display(); }, showDelay);
      maxTimer = timers.setTimeout(() => finish('timeout'), maxDelay);
    },
    ready() {
      // tout est chargé : on attend la fin de l'animation minimale si le splash est affiché
      if (shown && !minElapsed) readyPending = true;
      else finish('ready');
    },
    skip: () => finish('skip'), // clic ou touche
    state: () => ({ shown, done }),
  };
}
