// Règles de l'écran de démarrage (aucune dépendance au DOM : testé à part).
// - aucun délai artificiel : le splash n'apparaît que si le vrai démarrage dépasse showDelay (400 ms) ;
// - il disparaît dès que l'appli est prête, au plus tard après maxDelay (3 s) ;
// - un clic ou une touche le ferme tout de suite ; il ne s'affiche qu'une fois (au lancement).
export function createSplash({ show, hide, showDelay = 400, maxDelay = 3000, timers = { setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: (i) => clearTimeout(i) } }) {
  let started = false;
  let shown = false;
  let done = false;
  let showTimer = null;
  let maxTimer = null;

  function finish(reason) {
    if (done) return;
    done = true;
    timers.clearTimeout(showTimer);
    timers.clearTimeout(maxTimer);
    if (shown) hide(reason);
  }

  return {
    start() {
      if (started) return;
      started = true;
      showTimer = timers.setTimeout(() => {
        if (done) return;
        shown = true;
        show();
      }, showDelay);
      maxTimer = timers.setTimeout(() => finish('timeout'), maxDelay);
    },
    ready: () => finish('ready'), // tout est chargé
    skip: () => finish('skip'), // clic ou touche
    state: () => ({ shown, done }),
  };
}
