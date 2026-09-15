import { VelaWorkspace } from '@luxalgo/vela/workspace';
import { CoinbaseProvider } from '@luxalgo/vela/providers/coinbase';
import { BinanceProvider } from '@luxalgo/vela/providers/binance';
import { HyperliquidProvider } from '@luxalgo/vela/providers/hyperliquid';
import { mountVisionTrigger } from './vision-trigger';
import { createVisionController } from './vision-controller';
import './style.css';

const root = document.querySelector<HTMLElement>('#app')!;
root.innerHTML = `
  <header class="app-header">
    <div class="brand"><span class="brand-mark" aria-hidden="true">A</span><h1>Aperture</h1><span class="local-badge">Local workspace</span></div>
    <a href="https://docs.luxalgo.com/vela/user/drawing-tools" target="_blank" rel="noreferrer">Drawing guide <span aria-hidden="true">↗</span></a>
  </header>
  <section id="chart" aria-label="Interactive chart and drawing tools"></section>
`;

try {
  const workspace = new VelaWorkspace('#chart', {
    layout: '1',
    symbol: 'coinbase:BTC-USD',
    timeframe: '60',
    bars: 600,
    providers: {
      coinbase: () => new CoinbaseProvider(),
      binance: () => new BinanceProvider(),
      hyperliquid: () => new HyperliquidProvider(),
    },
    live: true,
    theme: 'dark',
    timezone: 'America/Jamaica',
    drawingToolbar: true,
    persist: 'vision-charting.workspace.v1',
    autofocus: true,
  });

  const trigger = mountVisionTrigger(root, () => vision.toggle());
  const vision = createVisionController(workspace, trigger.setActive);

  // Tear down subscriptions and sockets before Vite replaces this module.
  import.meta.hot?.dispose(() => {
    vision.destroy();
    trigger.destroy();
    workspace.destroy();
  });
} catch (error) {
  console.error('Vela workspace could not start:', error);
  const chart = document.querySelector<HTMLElement>('#chart')!;
  const message = document.createElement('div');
  message.className = 'startup-error';
  message.setAttribute('role', 'alert');
  message.textContent = 'The chart could not start. Reload the page to try again.';
  chart.append(message);
}
