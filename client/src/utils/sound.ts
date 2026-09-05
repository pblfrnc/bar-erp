// Utilitário de alerta sonoro para a Cozinha usando a Web Audio API nativa
let audioCtx: AudioContext | null = null;

export function playKitchenChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;

    // Primeiro tom (Dó agudo - 587.33 Hz)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.5);

    // Segundo tom (Sol mais agudo - 783.99 Hz)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(783.99, now + 0.15);
    gain2.gain.setValueAtTime(0.4, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.8);
  } catch (err) {
    console.warn('Não foi possível reproduzir som de cozinha:', err);
  }
}

// Alerta sonoro de Pedido Pronto para o Garçom (Campainha alegre e vibrante de 3 notas)
export function playOrderReadyChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;

    // Nota 1: Sol (783.99 Hz)
    const o1 = audioCtx.createOscillator();
    const g1 = audioCtx.createGain();
    o1.type = 'triangle';
    o1.frequency.setValueAtTime(783.99, now);
    g1.gain.setValueAtTime(0.4, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    o1.connect(g1);
    g1.connect(audioCtx.destination);
    o1.start(now);
    o1.stop(now + 0.35);

    // Nota 2: Dó alto (1046.50 Hz)
    const o2 = audioCtx.createOscillator();
    const g2 = audioCtx.createGain();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(1046.50, now + 0.12);
    g2.gain.setValueAtTime(0.5, now + 0.12);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    o2.connect(g2);
    g2.connect(audioCtx.destination);
    o2.start(now + 0.12);
    o2.stop(now + 0.5);

    // Nota 3: Mi alto (1318.51 Hz) - fechamento alegre
    const o3 = audioCtx.createOscillator();
    const g3 = audioCtx.createGain();
    o3.type = 'sine';
    o3.frequency.setValueAtTime(1318.51, now + 0.25);
    g3.gain.setValueAtTime(0.6, now + 0.25);
    g3.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    o3.connect(g3);
    g3.connect(audioCtx.destination);
    o3.start(now + 0.25);
    o3.stop(now + 0.8);

    // Vibrar dispositivo se disponível no celular Android
    vibrateDevice([200, 100, 200]);
  } catch (err) {
    console.warn('Não foi possível reproduzir som de pedido pronto:', err);
  }
}

export function vibrateDevice(pattern: number[] = [200, 100, 200]) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignora se não for suportado
  }
}
