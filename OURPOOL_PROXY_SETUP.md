# Настройка прокси для OurPool API на WordPress

## Описание

В режиме разработки (dev) проксирование API запросов к `ourpool.io` выполняется через gulp (см. `gulpfile.js`). Для продакшена на WordPress необходимо использовать PHP прокси.

## Установка

### 1. Размещение файла прокси

Скопируйте файл `ourpool-proxy.php` из `src/resources/` в папку assets вашей WordPress темы:

```
wp-content/themes/infinity/assets/ourpool-proxy.php
```

**Важно:** Убедитесь, что путь соответствует пути в JavaScript коде:

```javascript
const proxyPath = "/wp-content/themes/infinity/assets/ourpool-proxy.php";
```

Если ваша тема называется по-другому, измените путь в:

- `src/js/components/calculator-engine.js` (строка 592)
- `src/js/components/charts.js` (строки 127, 165)

### 2. Настройка токенов

**⚠️ ВАЖНО:** Токены больше не передаются в клиентском коде! Они хранятся на сервере WordPress.

См. подробную инструкцию в файле `OURPOOL_TOKEN_SETUP.md`

**Быстрая настройка:**

```php
// В functions.php темы
update_option('ourpool_global_token', 'ваш-токен');
update_option('ourpool_global_account', 'ваш-аккаунт');
```

### 3. Проверка прав доступа

Убедитесь, что файл имеет права на чтение:

```bash
chmod 644 wp-content/themes/infinity/assets/ourpool-proxy.php
```

### 4. Настройка безопасности (опционально)

По умолчанию прокси доступен публично. Если нужно ограничить доступ, раскомментируйте проверку в начале файла:

```php
if (!defined('ABSPATH')) {
    die('Direct access not allowed');
}
```

Или добавьте свою логику проверки авторизации.

### 5. Прокси для курсов BTC/валют

Фронтенд автоматически переключается на серверный прокси вне dev-окружения.

1. Скопируйте `src/resources/market-proxy.php` в тему:
   ```
   wp-content/themes/infinity/assets/market-proxy.php
   ```
2. Если путь отличается — задайте его через `INFINITY_ENV.MARKET_PROXY_URL` или мета-тег:
   ```html
   <meta name="market-proxy-url" content="/custom-path/market-proxy.php" />
   ```
3. Прокси поддерживает параметры `?type=btc` и `?type=fiat` и возвращает данные напрямую из Coinpaprika / ExchangeRate API.

## Как это работает

### Dev режим (localhost)

- Запросы к `/api/*` проксируются через gulp middleware
- Gulp перенаправляет на `https://ourpool.io/api/*`

### Prod режим (WordPress)

- JavaScript определяет, что это не dev режим
- Запросы идут на PHP прокси: `/wp-content/themes/infinity/assets/ourpool-proxy.php?path=/api/...`
- PHP прокси делает запрос к `https://ourpool.io/api/...` и возвращает ответ

## Пример запроса

**Dev:**

```javascript
// В dev режиме токен можно передать (для локальной разработки)
fetch("/api/v1/accounts/account/btc/rewards-stats?token=xxx");
```

**Prod:**

```javascript
// В продакшене токен НЕ передается - он получается на сервере автоматически
fetch(
  "/wp-content/themes/infinity/assets/ourpool-proxy.php?path=/api/v1/accounts/{account}/btc/rewards-stats"
);
// Плейсхолдер {account} будет заменен на сервере, если account настроен
```

## Тестирование

После установки проверьте работу прокси:

1. Откройте консоль браузера на продакшн сайте
2. Выполните запрос:

```javascript
// Токен не передается - он получается на сервере автоматически
fetch(
  "/wp-content/themes/infinity/assets/ourpool-proxy.php?path=/api/v1/accounts/{account}/btc/rewards-stats"
)
  .then((r) => r.json())
  .then(console.log)
  .catch(console.error);
```

3. Должен вернуться ответ от OurPool API или ошибка

**Если получаете ошибку "Direct acc..." или "Unexpected token":**

Это означает, что WordPress выводит предупреждение перед JSON ответом. Возможные причины:

1. **WordPress не подключается правильно** - проверьте путь к `wp-load.php`
2. **Есть защита от прямого доступа** - некоторые темы/плагины блокируют прямой доступ к файлам

**Решение:**

Проверьте, что файл прокси находится по правильному пути:

```
wp-content/themes/infinity/assets/ourpool-proxy.php
```

Или попробуйте использовать WordPress AJAX endpoint вместо прямого файла (см. раздел "Альтернативные варианты" ниже).

**Для отладки:**

Откройте файл `ourpool-proxy.php` напрямую в браузере (без параметров) - вы должны увидеть JSON ошибку `{"error":"Missing path parameter"}`. Если видите HTML или текст "Direct access not allowed", значит проблема в подключении WordPress.

## Альтернативные варианты

### Вариант 1: Через .htaccess (Apache)

Если используете Apache, можно настроить проксирование через `.htaccess`:

```apache
RewriteEngine On
RewriteCond %{REQUEST_URI} ^/api/(.*)$
RewriteRule ^api/(.*)$ https://ourpool.io/api/$1 [P,L]
```

**Плюсы:** Не нужен PHP файл  
**Минусы:** Требует модуль `mod_proxy` и `mod_rewrite`

### Вариант 2: Через nginx

Если используете nginx, добавьте в конфигурацию:

```nginx
location /api/ {
    proxy_pass https://ourpool.io;
    proxy_set_header Host ourpool.io;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # CORS заголовки
    add_header Access-Control-Allow-Origin *;
    add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
    add_header Access-Control-Allow-Headers "Content-Type, Authorization";
}
```

**Плюсы:** Более производительно  
**Минусы:** Требует доступ к конфигурации nginx

### Вариант 3: WordPress AJAX endpoint (рекомендуется, если прямой файл не работает)

Создайте AJAX endpoint в `functions.php` темы:

```php
// В functions.php
add_action('wp_ajax_ourpool_proxy', 'handle_ourpool_proxy');
add_action('wp_ajax_nopriv_ourpool_proxy', 'handle_ourpool_proxy'); // Для неавторизованных

function handle_ourpool_proxy() {
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *');

    $apiPath = isset($_GET['path']) ? $_GET['path'] : '';
    if (empty($apiPath)) {
        wp_send_json_error(['message' => 'Missing path parameter'], 400);
        return;
    }

    // Получаем токен и account
    $token = get_option('ourpool_global_token', '');
    $account = get_option('ourpool_global_account', '');

    if (empty($token)) {
        wp_send_json_error(['message' => 'Token not configured'], 500);
        return;
    }

    // Формируем URL
    $apiPath = ltrim($apiPath, '/');
    if (strpos($apiPath, '{account}') !== false && !empty($account)) {
        $apiPath = str_replace('{account}', urlencode($account), $apiPath);
    }

    $targetUrl = 'https://ourpool.io/' . $apiPath;
    $queryParams = $_GET;
    unset($queryParams['path'], $queryParams['action']);
    if (!empty($token) && strpos($apiPath, 'token=') === false) {
        $queryParams['token'] = $token;
    }
    if (!empty($queryParams)) {
        $targetUrl .= '?' . http_build_query($queryParams);
    }

    // Выполняем запрос через wp_remote_get
    $response = wp_remote_get($targetUrl, [
        'timeout' => 30,
        'sslverify' => true,
    ]);

    if (is_wp_error($response)) {
        wp_send_json_error(['message' => 'Proxy error: ' . $response->get_error_message()], 500);
        return;
    }

    $body = wp_remote_retrieve_body($response);
    $code = wp_remote_retrieve_response_code($response);

    http_response_code($code);
    echo $body;
    exit;
}
```

**Использование в JavaScript:**

```javascript
// Вместо прямого файла используйте:
const proxyPath = "/wp-admin/admin-ajax.php?action=ourpool_proxy";
const url = `${proxyPath}&path=${encodeURIComponent(apiPath)}`;
```

**Плюсы:** Полная интеграция с WordPress, нет проблем с прямым доступом  
**Минусы:** Требует изменения JavaScript кода (путь к прокси)

### Вариант 4: WordPress REST API endpoint

Можно создать кастомный WordPress endpoint:

```php
// В functions.php
add_action('rest_api_init', function() {
    register_rest_route('infinity/v1', '/ourpool/(?P<path>.*)', [
        'methods' => 'GET',
        'callback' => 'proxy_ourpool_api',
        'permission_callback' => '__return_true'
    ]);
});

function proxy_ourpool_api($request) {
    $path = $request->get_param('path');
    $url = 'https://ourpool.io/api/' . $path;

    // ... логика проксирования
}
```

**Плюсы:** Интеграция с WordPress  
**Минусы:** Требует больше кода

## Устранение проблем

### Ошибка 404

- Проверьте путь к файлу прокси
- Убедитесь, что файл скопирован в правильную папку

### Ошибка 500

- Проверьте логи PHP ошибок
- Убедитесь, что включено расширение `curl` в PHP
- Проверьте права доступа к файлу

### CORS ошибки

- Убедитесь, что PHP прокси устанавливает CORS заголовки
- Проверьте, что запрос идет на правильный домен

### Таймауты

- Увеличьте `CURLOPT_TIMEOUT` в `ourpool-proxy.php` если запросы долгие

## Обновление кода

Если нужно изменить путь к прокси, обновите в следующих файлах:

- `src/js/components/calculator-engine.js`
- `src/js/components/charts.js`

После изменения выполните сборку:

```bash
npm run build
```
