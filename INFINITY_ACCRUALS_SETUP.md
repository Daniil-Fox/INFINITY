# Настройка системы начислений Infinity

## Описание

Система автоматически рассчитывает почасовые начисления на основе формул из `calculator-engine.js` и ежедневно начисляет их на баланс пользователя в WordPress.

## Установка

### 1. Создание таблиц в базе данных

Выполните следующий SQL в базе данных WordPress:

```sql
CREATE TABLE IF NOT EXISTS `wp_infinity_hourly_accruals` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `hour_start` datetime NOT NULL COMMENT 'Начало часа (UTC, округлённое вниз)',
  `power_th` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Мощность пользователя на этот час',
  `btc_price` decimal(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Курс BTC на этот час',
  `btc_accrual` decimal(18,11) NOT NULL DEFAULT 0.00000000000 COMMENT 'Начисление BTC за час',
  `usd_accrual` decimal(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Начисление USD за час',
  `electricity_cost_usd` decimal(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Стоимость электричества за час',
  `config_snapshot` text COMMENT 'Снимок конфигурации на момент расчёта (JSON)',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_hour` (`user_id`, `hour_start`),
  KEY `user_id` (`user_id`),
  KEY `hour_start` (`hour_start`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_infinity_daily_balances` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `date` date NOT NULL COMMENT 'Дата начисления',
  `btc_amount` decimal(18,11) NOT NULL DEFAULT 0.00000000000 COMMENT 'Сумма BTC за день',
  `usd_amount` decimal(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Сумма USD за день',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT 'pending, processed, failed',
  `processed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_date` (`user_id`, `date`),
  KEY `user_id` (`user_id`),
  KEY `date` (`date`),
  KEY `status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2. Подключение PHP файла

Скопируйте `src/resources/infinity-accruals.php` в `functions.php` вашей темы WordPress или подключите через `require_once`:

```php
// В functions.php темы
require_once get_template_directory() . '/resources/infinity-accruals.php';
```

### 3. Настройка данных пользователей

Для каждого пользователя нужно сохранить информацию о покупках мощности в `user_meta`:

```php
// Пример: сохранение покупки мощности
$user_id = 123;
$purchases = [
    [
        'date' => '2025-11-06',
        'power_th' => 100,
        'amount' => 2500, // Сумма в USD (опционально)
    ],
    // Можно добавить несколько покупок
];

update_user_meta($user_id, 'infinity_power_purchases', $purchases);
```

### 4. Настройка WP-Cron

WP-Cron задачи регистрируются автоматически при подключении файла. Проверьте, что WP-Cron работает:

```php
// Проверка следующего запуска
$next_hourly = wp_next_scheduled('infinity_hourly_accruals');
$next_daily = wp_next_scheduled('infinity_daily_balances');

echo "Следующий почасовой расчёт: " . date('Y-m-d H:i:s', $next_hourly);
echo "Следующее ежедневное начисление: " . date('Y-m-d H:i:s', $next_daily);
```

**Важно:** Если сайт имеет низкий трафик, WP-Cron может не срабатывать вовремя. Рекомендуется настроить реальный cron:

```bash
# В crontab сервера
0 * * * * wget -q -O - https://your-site.com/wp-cron.php?doing_wp_cron >/dev/null 2>&1
```

### 5. Настройка конфигурации доходности

По умолчанию используются значения из `calculator-engine.js`. Можно переопределить через опции WordPress:

```php
update_option('infinity_yield_config', [
    'btcPerThPerDay' => 0.0000004,
    'uptimePercent' => 93.09,
    'pricePerKwh' => 0.06,
    'deviceWatt' => 3550,
    'deviceTh' => 188,
]);
```

### 6. Настройка получения курса BTC

В функции `infinity_fetch_btc_price_from_api()` нужно подключить реальный источник курса BTC. Можно использовать:

- OurPool API (если есть endpoint)
- CoinGecko API
- Другой источник

Пример через CoinGecko:

```php
function infinity_fetch_btc_price_from_api() {
    $url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd';
    $response = wp_remote_get($url, ['timeout' => 10]);

    if (!is_wp_error($response)) {
        $body = json_decode(wp_remote_retrieve_body($response), true);
        return floatval($body['bitcoin']['usd'] ?? 0);
    }

    return 0;
}
```

## REST API Endpoints

### Получение данных для графика

```
GET /wp-json/infinity/v1/accruals?period=day|week|month
```

**Параметры:**

- `period` (обязательный): `day`, `week` или `month`
- `user_id` (опциональный): ID пользователя (по умолчанию - текущий пользователь)

**Ответ:**

```json
{
  "period": "day",
  "start_date": "2025-11-18 00:00:00",
  "end_date": "2025-11-18 18:00:00",
  "current_hour": "2025-11-18 18:00:00",
  "data": [
    {
      "timestamp": "2025-11-18 00:00:00",
      "label": "00:00",
      "btc": 0.000001234,
      "btc_hourly": 0.000000051,
      "usd": 0.13,
      "power_th": 100,
      "btc_price": 109500
    }
  ]
}
```

### Получение текущего баланса

```
GET /wp-json/infinity/v1/balance
```

**Ответ:**

```json
{
  "btc": 0.000123456,
  "usd": 13.52
}
```

## Как это работает

1. **Почасовой расчёт** (каждый час в :00 минут):

   - Получает всех пользователей с активной мощностью
   - Для каждого пользователя рассчитывает начисление за текущий час
   - Сохраняет в таблицу `wp_infinity_hourly_accruals`
   - Использует актуальный курс BTC и конфигурацию доходности

2. **Ежедневное начисление** (каждый день в 00:15):

   - Суммирует все часы за вчерашний день
   - Создаёт запись в `wp_infinity_daily_balances`
   - Обновляет баланс пользователя в `user_meta`:
     - `infinity_balance_btc`
     - `infinity_balance_usd`

3. **График на фронтенде**:
   - Запрашивает данные через REST API
   - Показывает только фактические начисления (не забегает вперёд)
   - Правая граница графика - текущий час, округлённый вниз

## Важные моменты

- Все расчёты ведутся в UTC
- График не показывает будущие данные
- Если курс BTC изменился, новый час рассчитывается с новым курсом (прошлые часы не пересчитываются)
- Баланс пользователя хранится в `user_meta` и обновляется ежедневно

## Отладка

Проверка работы системы:

```php
// Проверить последние начисления пользователя
global $wpdb;
$user_id = 123;
$table = $wpdb->prefix . 'infinity_hourly_accruals';
$results = $wpdb->get_results($wpdb->prepare(
    "SELECT * FROM {$table} WHERE user_id = %d ORDER BY hour_start DESC LIMIT 10",
    $user_id
));

// Проверить баланс пользователя
$btc = get_user_meta($user_id, 'infinity_balance_btc', true);
$usd = get_user_meta($user_id, 'infinity_balance_usd', true);
```

## Обновление фронтенда

После установки PHP файла, фронтенд автоматически начнёт использовать REST API вместо генерации данных. График будет показывать только фактические начисления до текущего часа.
