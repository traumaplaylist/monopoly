import { useGame } from '../game/store';
import { AssetsPanel } from './AssetsPanel';
import type { DrawerTab } from './BottomBar';
import { LogPanel } from './LogPanel';

export function Drawer({ tab, onTab, onClose }: { tab: DrawerTab; onTab: (t: DrawerTab) => void; onClose: () => void }) {
  const botDelay = useGame((s) => s.botDelay);
  const setBotDelay = useGame((s) => s.setBotDelay);
  const quit = useGame((s) => s.quitToMenu);
  return (
    <div className="drawer-layer" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="tabs">
          <button className={tab === 'log' ? 'on' : ''} onClick={() => onTab('log')}>
            Журнал
          </button>
          <button className={tab === 'assets' ? 'on' : ''} onClick={() => onTab('assets')}>
            Активы
          </button>
          <button className={tab === 'settings' ? 'on' : ''} onClick={() => onTab('settings')}>
            Настройки
          </button>
          <button className="close-x" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="drawer-body">
          {tab === 'log' && <LogPanel />}
          {tab === 'assets' && <AssetsPanel />}
          {tab === 'settings' && (
            <div className="form">
              <label>
                Скорость ботов
                <select value={botDelay} onChange={(e) => setBotDelay(Number(e.target.value))}>
                  <option value={1200}>Медленно</option>
                  <option value={700}>Нормально</option>
                  <option value={250}>Быстро</option>
                </select>
              </label>
              <button className="btn wide" onClick={quit}>
                Выйти в меню (партия сохранится)
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
