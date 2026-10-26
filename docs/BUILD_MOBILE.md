# Мобильные приложения (Capacitor)

Приложения — оболочка Capacitor над тем же web-клиентом (`apps/client`). Web-ресурсы входят в сборку (не открывают dev-URL); адрес сервера задаётся при сборке переменной `VITE_SERVER_URL`.

## Что сделано
- `apps/client/capacitor.config.json`: `appId com.partyboard.megapolis`, `webDir dist`, схема `https` на Android (origin `https://localhost`), без mixed content.
- Нативные проекты сгенерированы (Capacitor 8.5.3): `apps/client/android/` и `apps/client/ios/`. Скопированные web-ресурсы (`…/public`) в git не попадают — их кладёт `npx cap sync`.
- Портретная ориентация: Android — `android:screenOrientation="portrait"` у `MainActivity` (на всех устройствах, включая планшеты); iPhone — только Portrait в `Info.plist`, iPad — все ориентации (на планшете в горизонтали работает ПК-раскладка). В браузере ориентация не блокируется — вертикальная вёрстка работает сама.
- Safe areas: `viewport-fit=cover` + `env(safe-area-inset-*)` во всех экранах; высота — `100dvh` с запасным `100vh`.
- Кнопка «назад» Android (`apps/client/src/net/native.ts`, `@capacitor/app`): сначала отменяет режим установки ловушки, затем закрывает открытую панель, на верхнем уровне сворачивает приложение — партию не покидает.
- Жизненный цикл: при возврате из фона (`appStateChange` в приложении, `visibilitychange` в браузере) клиент отбрасывает устаревшие анимации и запрашивает авторитетный снимок. Сервер в это время продолжает таймеры.
- Сервер разрешает origin'ы WebView по умолчанию: `capacitor://localhost` (iOS), `https://localhost` (Android) — переменная `ALLOWED_ORIGINS`.

## Проверено в этом окружении (облачный Linux-контейнер)
| Шаг | Результат |
|---|---|
| `npx cap add android` / `npx cap add ios` | ✅ проекты созданы |
| Сборка APK (`gradlew assembleDebug`) | ❌ **не собрано**: запуск выполнен, Gradle упал на загрузке Android Gradle Plugin 8.13.0 с `dl.google.com` (403 от прокси окружения). Android SDK тоже недоступен. |
| iOS | **не проверено**: нужен macOS + Xcode. |
| Реальные телефоны | **не проверено**: только эмуляция размеров в Chromium. |

## Как собрать Android debug APK (Windows, ваш компьютер)
1. Установите Android Studio (вместе с Android SDK и JDK 21).
2. В корне репозитория:
   ```powershell
   npm install
   $env:VITE_SERVER_URL = "http://192.168.1.50:3001"   # адрес вашего сервера (для теста в Wi-Fi)
   npm run build -w @pb/client
   cd apps/client
   npx cap sync android
   cd android
   .\gradlew.bat assembleDebug
   ```
3. Готовый файл: `apps/client/android/app/build/outputs/apk/debug/app-debug.apk`.
4. Для теста по Wi-Fi с адресом `http://…` Android требует разрешить cleartext только для отладки: в `android/app/src/main/AndroidManifest.xml` временно добавьте `android:usesCleartextTraffic="true"` в `<application>` (в production используйте HTTPS/WSS и не включайте cleartext).

## Как собрать iOS (нужен Mac)
1. Скопируйте репозиторий на Mac, установите Xcode и CocoaPods (если потребуется).
2. `npm install`, `VITE_SERVER_URL=https://… npm run build -w @pb/client`, `cd apps/client && npx cap sync ios && npx cap open ios`.
3. В Xcode выберите команду подписи (Signing & Capabilities) и запустите на устройстве. iOS требует HTTPS для сервера (ATS).

## Не сделано / ограничения
- Иконка и splash-экран приложения — стандартные Capacitor.
- Push-уведомления, магазины — не входят в альфу.
