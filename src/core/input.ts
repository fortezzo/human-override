// Keyboard and mouse state.
//
// The game reads input from here once per frame instead of reacting to
// browser events directly, which keeps game code simple and makes it
// possible for the debug autopilot to "press" the same buttons a player does.

export type Action =
  | 'forward'
  | 'back'
  | 'left'
  | 'right'
  | 'sprint'
  | 'jump'
  | 'fire'
  | 'aim'
  | 'reload'
  | 'interact'
  | 'melee'
  | 'grenade'
  | 'weapon1'
  | 'weapon2';

const KEY_BINDINGS: Record<string, Action> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
  Space: 'jump',
  KeyR: 'reload',
  KeyF: 'interact',
  KeyV: 'melee',
  KeyG: 'grenade',
  Digit1: 'weapon1',
  Digit2: 'weapon2',
};

const MOUSE_BINDINGS: Record<number, Action> = { 0: 'fire', 2: 'aim' };

export class Input {
  private held = new Set<Action>();
  private pressed = new Set<Action>();
  private lookX = 0;
  private lookY = 0;
  private wheel = 0;
  private readonly keyListeners = new Map<string, () => void>();
  private disposers: Array<() => void> = [];

  /** True while the mouse is captured by the game. */
  locked = false;
  onLockChange: (locked: boolean) => void = () => {};

  constructor(private readonly element: HTMLElement) {
    const on = <K extends keyof DocumentEventMap>(target: Document | HTMLElement | Window, type: K, handler: (e: DocumentEventMap[K]) => void) => {
      target.addEventListener(type, handler as EventListener);
      this.disposers.push(() => target.removeEventListener(type, handler as EventListener));
    };

    on(document, 'keydown', (e) => {
      if (e.repeat) return;
      const once = this.keyListeners.get(e.code);
      if (once) once();
      const action = KEY_BINDINGS[e.code];
      if (!action || !this.locked) return;
      e.preventDefault();
      this.press(action);
    });
    on(document, 'keyup', (e) => {
      const action = KEY_BINDINGS[e.code];
      if (action) this.release(action);
    });
    on(document, 'mousedown', (e) => {
      const action = MOUSE_BINDINGS[e.button];
      if (action && this.locked) this.press(action);
    });
    on(document, 'mouseup', (e) => {
      const action = MOUSE_BINDINGS[e.button];
      if (action) this.release(action);
    });
    on(document, 'mousemove', (e) => {
      if (!this.locked) return;
      this.lookX += e.movementX;
      this.lookY += e.movementY;
    });
    on(document, 'wheel', (e) => {
      if (this.locked) this.wheel += Math.sign(e.deltaY);
    });
    on(document, 'contextmenu', (e) => e.preventDefault());
    on(document, 'pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.element;
      if (!this.locked) this.held.clear();
      this.onLockChange(this.locked);
    });
    on(window as unknown as Document, 'blur' as keyof DocumentEventMap, () => this.held.clear());
  }

  /**
   * Ask the browser to capture the mouse. Must be called from a click.
   * Browsers refuse to re-capture for about a second after the player
   * presses Esc, so a refused request is retried a few times.
   */
  lock(attempt = 0): void {
    if (this.locked) return;
    const retry = () => {
      if (!this.locked && attempt < 8) window.setTimeout(() => this.lock(attempt + 1), 250);
    };
    try {
      const request = this.element.requestPointerLock() as unknown;
      // Newer browsers return a promise that rejects when refused.
      if (request instanceof Promise) request.catch(retry);
      else window.setTimeout(retry, 250);
    } catch {
      retry();
    }
  }

  unlock(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  /** Run `handler` whenever a key is pressed, whether or not the mouse is captured. */
  onKey(code: string, handler: () => void): void {
    this.keyListeners.set(code, handler);
  }

  press(action: Action): void {
    if (!this.held.has(action)) this.pressed.add(action);
    this.held.add(action);
  }

  release(action: Action): void {
    this.held.delete(action);
  }

  isDown(action: Action): boolean {
    return this.held.has(action);
  }

  /** True only on the frame the action went down. */
  wasPressed(action: Action): boolean {
    return this.pressed.has(action);
  }

  /** Mouse movement since last frame, in pixels. */
  consumeLook(): { x: number; y: number } {
    const look = { x: this.lookX, y: this.lookY };
    this.lookX = 0;
    this.lookY = 0;
    return look;
  }

  consumeWheel(): number {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }

  /** Call at the end of each frame. */
  endFrame(): void {
    this.pressed.clear();
  }

  dispose(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers = [];
  }
}
