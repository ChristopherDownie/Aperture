import visionIcon from './vision.svg?raw';

/** Vela 0.7.3 has no public slot for non-drawing actions in the left toolbar.
 * Keep this small DOM adapter isolated until that extension point is available.
 * The observer restores our button when Vela rebuilds the bar on theme changes.
 */
export function mountVisionTrigger(host: HTMLElement, onToggle: () => void) {
  const toolbar = host.querySelector<HTMLElement>('.vela-dtb');
  if (!toolbar) return { destroy: () => {}, setActive: (_active: boolean) => {} };

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'vela-dtb-btn vision-trigger';
  button.setAttribute('aria-label', 'Vision');
  button.setAttribute('aria-pressed', 'false');
  button.title = 'Vision — webcam gestures';
  button.innerHTML = `<span class="vela-dtb-hit" aria-hidden="true">${visionIcon}</span>`;
  button.addEventListener('click', onToggle);
  const insert = () => {
    if (button.parentElement !== toolbar) {
      toolbar.insertBefore(button, toolbar.children[1] ?? null);
    }
  };
  insert();
  const observer = new MutationObserver(insert);
  observer.observe(toolbar, { childList: true });

  return {
    setActive: (active: boolean) => {
      button.setAttribute('aria-pressed', String(active));
      button.dataset.active = active ? '1' : '';
      button.title = active ? 'Stop Vision' : 'Vision — webcam gestures';
    },
    destroy: () => {
      observer.disconnect();
      button.removeEventListener('click', onToggle);
      button.remove();
    },
  };
}
