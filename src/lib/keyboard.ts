// Opening a sheet with the keyboard already up.
//
// iPhone Safari only shows the keyboard when focus happens during the tap itself, but a sheet's text box
// appears a moment after the tap. So the tap focuses a hidden stand-in field right away (keyboard opens),
// and when the real box appears it takes the focus over; moving focus between fields keeps the keyboard up.

let proxy: HTMLInputElement | undefined;

/** Call inside the tap handler that opens a typing sheet. */
export function primeKeyboard(): void {
  proxy?.remove();
  const el = document.createElement('input');
  el.setAttribute('aria-hidden', 'true');
  el.tabIndex = -1;
  // 16px stops iPhone zooming in; it sits at the top so focusing it doesn't scroll the page.
  el.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0';
  document.body.append(el);
  el.focus({ preventScroll: true });
  proxy = el;
  // If no sheet takes over (it failed to open), don't leave the stand-in behind.
  setTimeout(() => {
    if (proxy === el) release();
  }, 1500);
}

/** The real field takes the focus (and the keyboard) from the stand-in. */
export function takeFocus(input: HTMLElement | undefined): void {
  input?.focus({ preventScroll: true });
  release();
}

function release(): void {
  proxy?.remove();
  proxy = undefined;
}
