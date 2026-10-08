import { useEffect, useRef, useState } from 'react';
import { BASE, FLOOR_HEIGHT, drop, newGame, startGame, tick, type Floor, type Game } from './engine';
import { STORAGE_KEY, emptyRecords, finishRun, parseRecords, type Records } from './storage';

function Icon({ name, size = 20 }: { name: 'stack' | 'arrow' | 'pause' | 'play' | 'trophy' | 'flag'; size?: number }) {
  const paths = {
    stack: <><path d="m3 7 9-4 9 4-9 4-9-4Zm0 5 9 4 9-4M3 17l9 4 9-4" /></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    pause: <><path d="M8 5v14M16 5v14" /></>,
    play: <path d="m8 5 11 7-11 7V5Z" />,
    trophy: <><path d="M7 3h10v6a5 5 0 0 1-10 0V3Zm5 11v6m-4 1h8M7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4" /></>,
    flag: <><path d="M5 22V3m0 1c5-5 9 5 15 0v10c-6 5-10-5-15 0M2 22h6" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function BlueprintFloor({ floor, y, active = false, number }: { floor: Floor; y: number; active?: boolean; number?: number }) {
  const windows = Math.max(0, Math.floor((floor.width - 14) / 27));
  return <g data-floor={active ? 'moving' : number} data-x={floor.x} data-width={floor.width} className={active ? 'floor moving-floor' : 'floor'}>
    <rect x={floor.x} y={y} width={floor.width} height={FLOOR_HEIGHT} />
    {Array.from({ length: windows }, (_, i) => <rect className="window" key={i} x={floor.x + (floor.width - (windows * 27 - 12)) / 2 + i * 27} y={y + 8} width="15" height="12" />)}
    <path d={`M${floor.x} ${y + 4}h${floor.width}`} className="floor-seam" />
  </g>;
}

function Scene({ game }: { game: Game }) {
  const count = game.floors.length;
  // Reserve the upper playfield for the height counter, even on narrow frames.
  const camera = Math.max(0, count - 2) * FLOOR_HEIGHT;
  const landingY = 350 - (count + 1) * FLOOR_HEIGHT;
  const movingY = landingY - 112 + (game.phase === 'dropping' ? game.fall ** 2 * 112 : 0);
  const center = game.moving.x + game.moving.width / 2;
  return <svg className="scene-svg" viewBox="0 0 400 430" fill="none" aria-hidden="true">
    <defs>
      <pattern id="hatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)"><path d="M0 0v8" stroke="currentColor" strokeWidth="2" /></pattern>
    </defs>
    <g className="skyline-outline"><path d="M0 371h26v-56h35v22h20v-79h33v113m178 0v-89h28v-33h22v93h22v-29h25v58h11" /><path d="M33 330h20m-20 9h20m49-61h23m-23 10h23m202 13h16m-16 11h16" /></g>
    <g transform={`translate(0 ${camera})`}>
      <path className="construction-line" d="M200 78V382" />
      <g className="foundation">
        <path d="M111 350h178v7H111zM120 357h160v41H120z" />
        <path d="M191 398v-27h18v27M132 371h17v15h-17zM163 371h17v15h-17zM220 371h17v15h-17zM250 371h17v15h-17z" />
        <path d="M96 398h208v8H96z" />
        <path d="M96 398h208v8H96z" fill="url(#hatch)" opacity="0.3" />
      </g>
      {game.floors.map((floor, i) => i >= count - 12 && <BlueprintFloor key={i} floor={floor} y={350 - (i + 1) * FLOOR_HEIGHT} number={i + 1} />)}
      {game.fragment && <g opacity={1 - game.fragment.age / 0.6} transform={`translate(0 ${game.fragment.age ** 2 * 700}) rotate(${game.fragment.age * 35} ${game.fragment.x} ${game.fragment.y})`}>
        <rect className="cut-piece" x={game.fragment.x} y={game.fragment.y} width={game.fragment.width} height={FLOOR_HEIGHT} />
      </g>}
      {game.phase !== 'over' && <>
        <g className="hoist" opacity={game.phase === 'dropping' ? 0 : 1}>
          <path d={`M200 ${-camera - 20}L${center} ${movingY - 23}m0 0-40 23m40-23 40 23`} />
          <circle cx={center} cy={movingY - 23} r="3" />
        </g>
        <path className="drop-guide" d={`M${game.moving.x} ${movingY + 28}V${landingY + 28}m${game.moving.width} 0V${movingY + 28}`} />
        <BlueprintFloor floor={game.moving} y={movingY} active />
        <g className="dimension"><path d={`M${game.moving.x} ${movingY - 14}h${game.moving.width}m0-4v8m${-game.moving.width}-8v8`} />
          <text x={center} y={movingY - 21} textAnchor="middle">{Math.round(game.moving.width / BASE.width * 100)}%</text>
        </g>
      </>}
      <g className="dimension foundation-dimension"><path d="M120 422h160m-160-4v8m160-8v8" /><text x="200" y="417" textAnchor="middle">FOUNDATION / 01</text></g>
    </g>
    <g className="ground-line" transform={`translate(0 ${camera})`}><path d="M20 406h360" /><path d="m25 403-6 6m358-6-6 6" /></g>
  </svg>;
}

function loadRecords() {
  try { return { records: parseRecords(localStorage.getItem(STORAGE_KEY)), available: true }; }
  catch { return { records: emptyRecords(), available: false }; }
}

export function App() {
  const [initial] = useState(loadRecords);
  const [records, setRecords] = useState(initial.records);
  const [storageAvailable, setStorageAvailable] = useState(initial.available);
  const recordsRef = useRef(records);
  const [game, setGame] = useState(newGame);
  const gameRef = useRef(game);
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const startBest = useRef(records.best);
  const primaryRef = useRef<HTMLButtonElement>(null);

  function update(next: Game) { gameRef.current = next; setGame(next); }
  function save(next: Records) {
    recordsRef.current = next;
    setRecords(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
    catch { setStorageAvailable(false); }
  }
  function action() {
    const current = gameRef.current;
    if (current.phase === 'ready' || current.phase === 'over') {
      startBest.current = recordsRef.current.best;
      update(startGame());
    } else if (current.paused) update({ ...current, paused: false });
    else update(drop(current));
  }
  function togglePause() {
    const current = gameRef.current;
    if (current.phase === 'swinging' || current.phase === 'dropping') update({ ...current, paused: !current.paused });
  }

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReducedMotion(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    let frame: number;
    let previous = performance.now();
    function animate(time: number) {
      const before = gameRef.current;
      const after = tick(before, Math.min((time - previous) / 1000, 0.05), reducedMotion);
      previous = time;
      if (after !== before) {
        if (after.floors.length > recordsRef.current.best) save({ ...recordsRef.current, best: after.floors.length });
        if (after.phase === 'over' && before.phase !== 'over') {
          save(finishRun(recordsRef.current, after.floors.length, after.perfects));
          // The playfield becomes unavailable; keep keyboard focus on the next action.
          if (document.activeElement?.classList.contains('scene-hit')) primaryRef.current?.focus();
        }
        update(after);
      }
      frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion]);

  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.code === 'KeyP' || event.code === 'Escape') { event.preventDefault(); togglePause(); }
      if (event.code === 'Space' && !(event.target instanceof HTMLElement && event.target.closest('button, input, textarea, select, a, summary'))) {
        event.preventDefault(); action();
      }
    }
    function pauseHidden() {
      if (document.hidden) {
        const current = gameRef.current;
        if (current.phase === 'swinging' || current.phase === 'dropping') update({ ...current, paused: true });
      }
    }
    window.addEventListener('keydown', key);
    document.addEventListener('visibilitychange', pauseHidden);
    return () => { window.removeEventListener('keydown', key); document.removeEventListener('visibilitychange', pauseHidden); };
  }, []);

  const active = game.phase === 'swinging' || game.phase === 'dropping';
  const label = game.phase === 'ready' ? 'Start building' : game.phase === 'over' ? 'Build again' : game.paused ? 'Resume building' : 'Drop floor';
  const status = game.paused ? 'Paused' : active ? 'Building' : game.phase === 'over' ? 'Run complete' : 'Ready to build';
  const newBest = game.floors.length > startBest.current;

  return <div className="app-shell">
    <a className="skip-link" href="#play">Skip to game</a>
    <header className="site-header">
      <a className="wordmark" href="#play" aria-label="Skyline, go to game"><span className="brand-symbol"><Icon name="stack" size={25} /></span>skyline<span className="wordmark-dot">.</span></a>
      <span className="edition">A GAME OF BALANCE <span className="edition-divider">/</span> <span>VOL. 001</span></span>
      <span className="local-badge"><span /> All play. No pressure.</span>
    </header>

    <main>
      <div className="intro">
        <div><p className="eyebrow">THE BLUEPRINT SERIES</p><h1>One floor at a time<span>.</span></h1><p className="intro-copy">A little timing. A taller skyline. How high can you go?</p></div>
        <div className="personal-best"><Icon name="trophy" size={23} /><div><span className="eyebrow">PERSONAL BEST</span><p><strong data-testid="best">{records.best.toString().padStart(2, '0')}</strong><span>floors</span></p></div></div>
      </div>

      <div className="workspace">
        <section id="play" className="game-panel" aria-label="Tower building game" tabIndex={-1}>
          <div className="blueprint" data-phase={game.phase} data-paused={game.paused}>
            <div className="board-heading"><span><span className="crosshair">+</span> THE BUILD SITE</span><span className="board-status"><i />{status}</span></div>
            <div className="height-display"><span className="eyebrow">HEIGHT</span><strong data-testid="height">{game.floors.length.toString().padStart(2, '0')}</strong><span className="height-unit">{game.floors.length === 1 ? 'floor' : 'floors'}</span></div>
            <span className="drawing-number">ELEVATION A—A</span>
            <button type="button" className="scene-hit" aria-label="Drop floor onto the tower" aria-disabled={!active || game.paused || game.phase === 'dropping'} onClick={() => update(drop(gameRef.current))} tabIndex={active && !game.paused ? 0 : -1}>
              <Scene game={game} />
            </button>
            {game.phase === 'ready' && <div className="ready-note"><span className="note-line" />Room for something great.</div>}
            {active && !game.paused && <div className="placement-note" aria-hidden="true">{game.message ? game.message.startsWith('Perfect') ? '✦ Perfect alignment' : `${Math.round(game.moving.width / BASE.width * 100)}% width remaining` : 'Find your moment. Drop your floor.'}</div>}
            {(game.paused || game.phase === 'over') && <div className="result-overlay"><div className="result-card">
              <span className="eyebrow">{game.paused ? 'TAKE A BREATHER' : newBest ? 'A NEW PERSONAL BEST' : 'BLUEPRINT COMPLETE'}</span>
              <h2>{game.paused ? 'On hold.' : game.floors.length === 0 ? 'A fresh foundation.' : 'Look how far you grew.'}</h2>
              <p>{game.paused ? 'Your tower will be right here.' : game.floors.length === 0 ? 'That one missed. Line up the next drop with the foundation.' : `${game.floors.length} ${game.floors.length === 1 ? 'floor' : 'floors'} built · ${game.perfects} perfect ${game.perfects === 1 ? 'drop' : 'drops'}`}</p>
              {!game.paused && <span className="result-footnote">{storageAvailable ? 'Added to your local leaderboard.' : 'Added to this session’s leaderboard.'}</span>}
              <span className="result-arrow" aria-hidden="true">↓</span>
            </div></div>}
            <div className="board-footer"><span>SCALE 1:∞</span><span className="board-tip">{reducedMotion ? 'REDUCED EFFECTS' : 'PRECISION OVER SPEED'}</span><span>+ Y</span></div>
          </div>
          <div className="game-controls">
            <button type="button" ref={primaryRef} className="primary-button" onClick={action} aria-disabled={game.phase === 'dropping' && !game.paused}>
              <span>{label}</span><Icon name={game.paused ? 'play' : 'arrow'} />
            </button>
            <span className="keyboard-hint"><kbd>space</kbd> to drop</span>
            <button type="button" className="pause-button" disabled={!active} onClick={togglePause} aria-label={game.paused ? 'Resume game' : 'Pause game'} title={game.paused ? 'Resume (P)' : 'Pause (P)'}><Icon name={game.paused ? 'play' : 'pause'} /></button>
          </div>
          <p className="play-caption"><span className="tiny-square" />Tap the blue playfield or use the button to drop.</p>
          <p className="sr-only" role="status" aria-atomic="true">{game.paused ? 'Game paused.' : game.phase === 'over' ? `Run complete. ${game.floors.length} floors. ${newBest ? 'New personal best.' : ''} Choose Build again to restart.` : game.message}</p>
        </section>

        <aside className="sidebar" aria-label="Records and instructions">
          <section className="leaderboard" aria-labelledby="leaderboard-title">
            <div className="section-title"><h2 id="leaderboard-title"><Icon name="trophy" size={19} />Leaderboard</h2><span className="small-tag">LOCAL</span></div>
            <p className="section-description">Small beginnings. Personal records.</p>
            <div className="leaderboard-labels"><span>BUILD</span><span>FLOORS</span></div>
            {records.runs.length ? <ol className="rankings">{records.runs.map((run, index) => <li key={run.id} className={index === 0 ? 'first-place' : ''}>
              <span className="rank">{String(index + 1).padStart(2, '0')}</span><div><strong>Build {String(run.id).padStart(2, '0')}</strong><span>{run.perfects} perfect {run.perfects === 1 ? 'drop' : 'drops'}</span></div><strong className="rank-height">{run.height}</strong>
            </li>)}</ol> : <div className="empty-leaderboard"><span className="empty-icon"><Icon name="flag" size={27} /></span><h3>The sky is unwritten.</h3><p>Finish your first build to<br />put it on the board.</p><span className="empty-dash">— — —</span></div>}
            <div className="storage-note"><span className="tiny-square" /><p>{storageAvailable ? 'Your top 5 builds, saved in this browser.' : 'Storage is unavailable. Records last for this session only.'}</p></div>
          </section>

          <section className="field-guide" aria-labelledby="guide-title">
            <div className="guide-heading"><h2 id="guide-title">A builder’s field guide</h2><span aria-hidden="true">↗</span></div>
            <ol className="instructions">
              <li><span>01</span><div><h3>Time your drop</h3><p>The block swings. Tap when it lines up with the floor below.</p></div></li>
              <li><span>02</span><div><h3>Keep your edges</h3><p>Overhangs fall away. A perfect drop keeps the full width.</p></div></li>
              <li><span>03</span><div><h3>Build a little higher</h3><p>A miss ends your run. Take a breath, then beat your best.</p></div></li>
            </ol>
            <div className="guide-tip"><span aria-hidden="true">✦</span><p>There’s no time limit.<br />A good builder knows when to wait.</p></div>
          </section>
        </aside>
      </div>
    </main>
    <footer className="site-footer"><span>MADE OF SMALL, GOOD DECISIONS.</span><span>ONE BLOCK. ENDLESS POSSIBILITY. <Icon name="stack" size={16} /></span></footer>
  </div>;
}
