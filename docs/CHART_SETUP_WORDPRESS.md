# Настройка графиков доходности в WordPress

## Обзор

Графики доходности автоматически учитывают дату регистрации пользователя. Если пользователь зарегистрировался 10 ноября, то:

- График за **месяц** начинается с 10 ноября
- График за **неделю** начинается с 10 ноября (если регистрация была менее 7 дней назад)
- График за **день** всегда показывает текущий день

## Шаг 1: Подключение PHP файла

Добавьте в `functions.php` вашей темы WordPress:

```php
<?php
// Подключение системы начислений
require_once get_template_directory() . '/resources/infinity-accruals.php';
```

Или если файл находится в другом месте:

```php
require_once get_template_directory() . '/assets/infinity-accruals.php';
```

## Шаг 2: Передача REST API Nonce на фронтенд

Добавьте в `functions.php` функцию для передачи nonce:

```php
/**
 * Передача REST API nonce для авторизации запросов
 */
function infinity_enqueue_chart_scripts() {
    // Подключаем скрипт графиков
    wp_enqueue_script(
        'infinity-charts',
        get_template_directory_uri() . '/js/components/charts.js',
        ['chart-js'], // Зависимость от Chart.js
        '1.0.0',
        true
    );

    // Передаем nonce для REST API
    if (is_user_logged_in()) {
        wp_localize_script('infinity-charts', 'infinityData', [
            'restNonce' => wp_create_nonce('wp_rest'),
        ]);

        // Также устанавливаем глобальную переменную для обратной совместимости
        ?>
        <script>
        window.INFINITY_REST_NONCE = '<?php echo wp_create_nonce("wp_rest"); ?>';
        </script>
        <?php
    }
}
add_action('wp_enqueue_scripts', 'infinity_enqueue_chart_scripts');
```

## Шаг 3: Настройка данных о покупках мощности

Для корректной работы графиков необходимо сохранять информацию о покупках мощности пользователя.

### Вариант 1: Через user_meta (рекомендуется)

```php
/**
 * Сохранение покупки мощности пользователя
 */
function infinity_add_power_purchase($user_id, $power_th, $amount = 0, $date = null) {
    if (!$date) {
        $date = current_time('Y-m-d');
    }

    // Получаем существующие покупки
    $purchases = get_user_meta($user_id, 'infinity_power_purchases', true);
    if (!is_array($purchases)) {
        $purchases = [];
    }

    // Добавляем новую покупку
    $purchases[] = [
        'date' => $date,
        'power_th' => floatval($power_th),
        'amount' => floatval($amount),
    ];

    // Сортируем по дате
    usort($purchases, function($a, $b) {
        return strtotime($a['date']) - strtotime($b['date']);
    });

    // Сохраняем
    update_user_meta($user_id, 'infinity_power_purchases', $purchases);

    // Обновляем текущую мощность пользователя
    $current_power = get_user_meta($user_id, 'infinity_user_power', true);
    $current_power = $current_power !== '' ? floatval($current_power) : 0;
    update_user_meta($user_id, 'infinity_user_power', $current_power + floatval($power_th));
}
```

### Вариант 2: Через REST API endpoint

Используйте существующий endpoint `/wp-json/infinity/v1/purchase-request` для создания заявок на покупку.

## Шаг 4: Передача данных о покупках на фронтенд

Добавьте в `functions.php`:

```php
/**
 * Передача данных о покупках пользователя на фронтенд
 */
function infinity_output_user_data() {
    if (!is_user_logged_in()) {
        return;
    }

    $user_id = get_current_user_id();

    // Получаем покупки из user_meta
    $purchases = get_user_meta($user_id, 'infinity_power_purchases', true);
    if (!is_array($purchases)) {
        $purchases = [];
    }

    // Преобразуем в формат для фронтенда
    $purchases_formatted = array_map(function($purchase) {
        return [
            'date' => isset($purchase['date']) ? $purchase['date'] : date('Y-m-d'),
            'powerTh' => isset($purchase['power_th']) ? floatval($purchase['power_th']) : 0,
            'amount' => isset($purchase['amount']) ? floatval($purchase['amount']) : 0,
        ];
    }, $purchases);

    // Сортируем по дате
    usort($purchases_formatted, function($a, $b) {
        return strtotime($a['date']) - strtotime($b['date']);
    });

    ?>
    <script>
    window.INFINITY_USER_DATA = {
        purchases: <?php echo json_encode($purchases_formatted, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>
    };
    </script>
    <?php
}
add_action('wp_head', 'infinity_output_user_data', 5);
```

## Шаг 5: Настройка WP-Cron для автоматических начислений

WP-Cron задачи регистрируются автоматически при подключении `infinity-accruals.php`. Убедитесь, что WP-Cron работает:

### Проверка работы WP-Cron

```php
// В functions.php для отладки
add_action('admin_notices', function() {
    if (current_user_can('administrator')) {
        $next_hourly = wp_next_scheduled('infinity_hourly_accruals');
        $next_daily = wp_next_scheduled('infinity_daily_balances');

        echo '<div class="notice notice-info"><p>';
        echo 'Следующий почасовой расчет: ' . ($next_hourly ? date('Y-m-d H:i:s', $next_hourly) : 'не запланирован') . '<br>';
        echo 'Следующее ежедневное начисление: ' . ($next_daily ? date('Y-m-d H:i:s', $next_daily) : 'не запланировано');
        echo '</p></div>';
    }
});
```

### Настройка реального Cron (рекомендуется для продакшн)

Для продакшн-сервера рекомендуется использовать системный cron вместо WP-Cron:

1. Откройте crontab: `crontab -e`
2. Добавьте строки:

```bash
# Почасовой расчет начислений (каждый час в :00 минут)
0 * * * * curl -s https://your-site.com/wp-cron.php?doing_wp_cron > /dev/null 2>&1

# Или используйте wget:
# 0 * * * * wget -q -O - https://your-site.com/wp-cron.php?doing_wp_cron > /dev/null 2>&1
```

Или используйте `wp-cli`:

```bash
# Почасовой расчет
0 * * * * cd /path/to/wordpress && wp cron event run infinity_hourly_accruals --allow-root

# Ежедневное начисление (в 00:15)
15 0 * * * cd /path/to/wordpress && wp cron event run infinity_daily_balances --allow-root
```

## Шаг 6: Проверка работы API

### Тестирование через браузер

1. Войдите в систему как пользователь
2. Откройте консоль браузера (F12)
3. Выполните запрос:

```javascript
fetch("/wp-json/infinity/v1/accruals?period=day", {
  credentials: "same-origin",
  headers: {
    Accept: "application/json",
    "X-WP-Nonce": window.INFINITY_REST_NONCE,
  },
})
  .then((r) => r.json())
  .then((data) => console.log("Данные графика:", data));
```

### Тестирование через curl

```bash
# Получите nonce из браузера (в консоли: window.INFINITY_REST_NONCE)
curl -X GET "https://your-site.com/wp-json/infinity/v1/accruals?period=day" \
  -H "Accept: application/json" \
  -H "X-WP-Nonce: YOUR_NONCE_HERE" \
  --cookie "wordpress_logged_in_xxx=YOUR_COOKIE"
```

## Шаг 7: Настройка на продакшн-сервере

### 1. Проверьте права доступа к файлам

```bash
chmod 644 src/resources/infinity-accruals.php
chmod 644 functions.php
```

### 2. Убедитесь, что WP-Cron работает

Отключите `DISABLE_WP_CRON` в `wp-config.php` только если используете системный cron:

```php
// НЕ добавляйте эту строку, если используете WP-Cron
// define('DISABLE_WP_CRON', true);
```

### 3. Настройте системный Cron (рекомендуется)

См. раздел "Настройка реального Cron" выше.

### 4. Проверьте логи ошибок

```bash
tail -f /var/log/php-fpm/error.log
# или
tail -f /var/log/apache2/error.log
```

### 5. Кеширование

Если используете кеширование (WP Super Cache, W3 Total Cache и т.д.), исключите страницы с графиками из кеша или используйте фрагментированное кеширование.

## Структура данных

### Формат покупки мощности

```php
[
    'date' => '2024-11-10',      // Дата в формате YYYY-MM-DD
    'power_th' => 100.0,         // Мощность в TH
    'amount' => 2500.0           // Сумма в USD (опционально)
]
```

### Формат ответа API `/wp-json/infinity/v1/accruals`

```json
{
  "period": "day",
  "start_date": "2024-11-10 00:00:00",
  "end_date": "2024-11-10 15:00:00",
  "current_hour": "2024-11-10 15:00:00",
  "data": [
    {
      "timestamp": "2024-11-10 00:00:00",
      "label": "00:00",
      "btc": 0.0000004,
      "btc_hourly": 0.0000004,
      "usd": 0.04,
      "power_th": 100.0,
      "btc_price": 109500.0
    }
  ]
}
```

## Устранение проблем

### Ошибка 401 (Unauthorized)

1. Проверьте, что nonce передается на фронтенд
2. Убедитесь, что пользователь авторизован
3. Проверьте, что nonce не истек (обновляется при каждой загрузке страницы)

### График не отображается

1. Проверьте консоль браузера на наличие ошибок
2. Убедитесь, что Chart.js подключен
3. Проверьте, что данные приходят из API (см. "Проверка работы API")

### Данные не обновляются

1. Проверьте работу WP-Cron
2. Убедитесь, что начисления записываются в `infinity_hourly_accruals_log`
3. Проверьте, что мощность пользователя (`infinity_user_power`) больше 0

### График начинается не с даты регистрации

1. Проверьте, что дата регистрации пользователя корректна в БД
2. Убедитесь, что используется последняя версия `infinity-accruals.php`
3. Проверьте логи сервера на наличие ошибок

## Пример полной интеграции

```php
<?php
// В functions.php

// 1. Подключение системы начислений
require_once get_template_directory() . '/resources/infinity-accruals.php';

// 2. Подключение скриптов и передача данных
function infinity_setup_charts() {
    // Подключаем Chart.js (если еще не подключен)
    wp_enqueue_script(
        'chart-js',
        'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
        [],
        '4.4.0',
        true
    );

    // Подключаем скрипт графиков
    wp_enqueue_script(
        'infinity-charts',
        get_template_directory_uri() . '/js/components/charts.js',
        ['chart-js'],
        '1.0.0',
        true
    );

    if (is_user_logged_in()) {
        $user_id = get_current_user_id();

        // Передаем nonce
        wp_localize_script('infinity-charts', 'infinityData', [
            'restNonce' => wp_create_nonce('wp_rest'),
        ]);

        // Глобальная переменная для обратной совместимости
        ?>
        <script>
        window.INFINITY_REST_NONCE = '<?php echo wp_create_nonce("wp_rest"); ?>';
        </script>
        <?php

        // Передаем данные о покупках
        $purchases = get_user_meta($user_id, 'infinity_power_purchases', true);
        if (!is_array($purchases)) {
            $purchases = [];
        }

        $purchases_formatted = array_map(function($p) {
            return [
                'date' => $p['date'] ?? date('Y-m-d'),
                'powerTh' => floatval($p['power_th'] ?? 0),
                'amount' => floatval($p['amount'] ?? 0),
            ];
        }, $purchases);

        usort($purchases_formatted, function($a, $b) {
            return strtotime($a['date']) - strtotime($b['date']);
        });

        ?>
        <script>
        window.INFINITY_USER_DATA = {
            purchases: <?php echo json_encode($purchases_formatted, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>
        };
        </script>
        <?php
    }
}
add_action('wp_enqueue_scripts', 'infinity_setup_charts');
```

## Дополнительные настройки

### Изменение конфигурации доходности

В админке WordPress можно настроить параметры доходности через ACF (Advanced Custom Fields) или напрямую через опции:

```php
update_option('infinity_yield_config', [
    'btcPerThPerDay' => 0.0000004,
    'uptimePercent' => 93.09,
    'pricePerKwh' => 0.06,
    'deviceWatt' => 3550,
    'deviceTh' => 188,
]);
```

### Ручной запуск расчета начислений

Для тестирования можно запустить расчет вручную:

```php
// В functions.php (только для разработки!)
add_action('admin_init', function() {
    if (isset($_GET['run_accruals']) && current_user_can('administrator')) {
        infinity_calculate_hourly_accruals();
        wp_die('Расчет выполнен');
    }
});
```

Затем откройте: `https://your-site.com/wp-admin/?run_accruals=1`

---

**Важно**: После настройки обязательно протестируйте работу графиков на тестовом пользователе перед развертыванием на продакшн!
