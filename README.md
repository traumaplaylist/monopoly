# Party Board — «Мегаполис»

Онлайн-настольная party-игра для четырёх друзей: экономика как в классической настольной игре + мини-игры, дуэли за сделки, предметы и призрак после банкротства. Сервер авторитетный (Node + Socket.IO + SQLite), клиент — React + Three.js, один и тот же для ПК, телефона и будущих приложений Android/iOS.

## Быстрый старт (Windows PowerShell, macOS, Linux)

Нужен **Node.js 22.13+** (лучше LTS 24) — https://nodejs.org.

```powershell
npm install
npm run dev
```

Откройте http://localhost:5173. Сервер — порт 3001 (dev-режим), клиент — 5173. Остановить: `Ctrl+C` (останавливает оба процесса).

Играть вчетвером на одном компьютере для проверки: откройте 4 окна в **разных профилях браузера или режимах инкогнито** (у каждого должна быть своя сессия), создайте комнату в одном и войдите по коду в остальных. В dev-режиме хозяин может отметить «заполнить ботами» и начать в одиночку.

### С телефона в той же Wi-Fi
`npm run dev` печатает адрес вида `http://192.168.x.x:5173`. Откройте его на телефоне — клиент сам подключится к серверу на том же компьютере (`192.168.x.x:3001`). Если не открывается — разрешите Node.js в брандмауэре Windows для частной сети (мы его не меняем автоматически).

## Команды

| Команда | Что делает |
|---|---|
| `npm run dev` | сервер (dev, боты разрешены) + клиент с горячей перезагрузкой |
| `npm run dev:server` / `npm run dev:client` | по отдельности |
| `npm run typecheck` | проверка типов всего монорепозитория |
| `npm test` | тесты ядра правил и сервера (Vitest) |
| `npm run e2e` | Playwright: 4 браузерных контекста против реального сервера, сохраняет скриншоты в `docs/screenshots/` |
| `npm run build` | типы + сборка клиента (`apps/client/dist`) + сервера (`apps/server/dist/server.mjs`) |
| `npm start` | production-сервер из сборки (см. ниже) |

## Production (один процесс)
```bash
npm run build
cp .env.example .env   # заполните значения
# сервер может сам раздавать собранный клиент:
STATIC_DIR=apps/client/dist ALLOWED_ORIGINS=https://game.example.com npm start
```
Нужен долгоживущий процесс с WebSocket (VPS, контейнер, любой хост с Node), за обратным прокси с HTTPS/WSS (Caddy/nginx). Статический хостинг для сервера не подходит. Резервное копирование — файл SQLite из `DB_PATH`. Деплой не выполнялся.

## Структура
См. `docs/ARCHITECTURE.md`. Кратко: `packages/content` (карта и числа), `packages/game-core` (правила), `packages/protocol` (схемы), `apps/server`, `apps/client`, `tests/e2e`.

## Документы
`docs/PRODUCT.md` · `docs/RULES_V1.md` · `docs/ARCHITECTURE.md` · `docs/DECISIONS.md` · `docs/ROADMAP.md` · `docs/VALIDATION.md` · `docs/BUILD_MOBILE.md` · `docs/PLAYTEST.md` · `docs/CONTENT_BACKLOG.md` · `docs/ASSETS.md` · `docs/WORK_LOG.md`
