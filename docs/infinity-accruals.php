<?php
/**
 * Infinity Accruals System (Адаптированная версия)
 *
 * Система почасовых расчётов и ежедневных начислений на основе формул из calculator-engine.js
 * Использует существующую структуру user_meta без создания дополнительных таблиц
 *
 * Установка:
 * 1. Подключите этот файл в functions.php: require_once get_template_directory() . '/assets/infinity-accruals.php';
 * 2. Настройте WP-Cron задачи (регистрируются автоматически)
 */

// Предотвращаем прямой доступ
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Получение конфигурации доходности
 * Использует те же значения, что и calculator-engine.js
 */
function infinity_get_yield_config() {
    // Значения по умолчанию из calculator-engine.js
    $default = [
        'btcPerThPerDay' => 0.0000004,
        'uptimePercent' => 93.09,
        'pricePerKwh' => 0.06,
        'deviceWatt' => 3550,
        'deviceTh' => 188,
    ];

    // Можно переопределить через опции WordPress или ACF
    $acf_config = get_field('calculator_yield', 'option');
    if ($acf_config) {
        $default['btcPerThPerDay'] = isset($acf_config['btcPerThPerDay']) ? floatval($acf_config['btcPerThPerDay']) : $default['btcPerThPerDay'];
        $default['uptimePercent'] = isset($acf_config['uptimePercent']) ? floatval($acf_config['uptimePercent']) : $default['uptimePercent'];
    }

    $acf_electricity = get_field('calculator_electricity', 'option');
    if ($acf_electricity) {
        $default['pricePerKwh'] = isset($acf_electricity['pricePerKwh']) ? floatval($acf_electricity['pricePerKwh']) : $default['pricePerKwh'];
        $default['deviceWatt'] = isset($acf_electricity['deviceWatt']) ? intval($acf_electricity['deviceWatt']) : $default['deviceWatt'];
        $default['deviceTh'] = isset($acf_electricity['deviceTh']) ? intval($acf_electricity['deviceTh']) : $default['deviceTh'];
    }

    // Можно переопределить через опции WordPress
    $config = get_option('infinity_yield_config', $default);
    return wp_parse_args($config, $default);
}

/**
 * Получение курса BTC
 * Использует тот же источник, что и фронтенд
 */
function infinity_get_btc_price() {
    // Пробуем получить из кеша (обновляется каждый час)
    $cached = get_transient('infinity_btc_price');
    if ($cached !== false) {
        return floatval($cached);
    }

    // Получаем через API
    $price = infinity_fetch_btc_price_from_api();

    if ($price > 0) {
        // Кешируем на 1 час
        set_transient('infinity_btc_price', $price, HOUR_IN_SECONDS);
        return $price;
    }

    // Fallback значение
    return 109500.0;
}

/**
 * Получение токена OurPool (используем существующую логику)
 */
function infinity_get_ourpool_token() {
    // Глобальный токен из опций сайта
    $global_token = get_option('ourpool_global_token', '');
    if (!empty($global_token) && $global_token !== 'ваш-токен-здесь') {
        return $global_token;
    }

    // Константа (для разработки)
    if (defined('OURPOOL_TOKEN') && !empty(OURPOOL_TOKEN)) {
        return OURPOOL_TOKEN;
    }

    return '';
}

/**
 * Получение account OurPool (используем существующую логику)
 */
function infinity_get_ourpool_account() {
    // Глобальный account из опций сайта
    $global_account = get_option('ourpool_global_account', '');
    if (!empty($global_account) && $global_account !== 'ваш-аккаунт-здесь') {
        return $global_account;
    }

    // Константа (для разработки)
    if (defined('OURPOOL_ACCOUNT') && !empty(OURPOOL_ACCOUNT)) {
        return OURPOOL_ACCOUNT;
    }

    return '';
}

/**
 * Получение курса BTC из API
 * Приоритет: OurPool API -> CoinGecko (fallback)
 */
function infinity_fetch_btc_price_from_api() {
    // Пробуем получить через OurPool API (если есть endpoint для курса)
    $token = infinity_get_ourpool_token();
    if (!empty($token)) {
        // Если в OurPool есть endpoint для курса BTC, используем его
        // Пока используем CoinGecko как fallback
    }

    // Fallback: CoinGecko (бесплатный API)
    $url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd';
    $response = wp_remote_get($url, [
        'timeout' => 10,
        'sslverify' => true,
    ]);

    if (!is_wp_error($response)) {
        $body = json_decode(wp_remote_retrieve_body($response), true);
        if (isset($body['bitcoin']['usd'])) {
            return floatval($body['bitcoin']['usd']);
        }
    }

    return 0;
}

/**
 * Получение реальных данных начислений из OurPool API для пользователя
 * Использует прокси для безопасного доступа
 */
function infinity_fetch_ourpool_rewards($user_id, $start_date = null, $end_date = null) {
    $token = infinity_get_ourpool_token();
    $account = infinity_get_ourpool_account();

    if (empty($token) || empty($account)) {
        return null;
    }

    // Используем прокси для доступа к OurPool API
    // Используем home_url для формирования правильного URL
    $proxy_url = home_url('/wp-content/themes/infinity/assets/ourpool-proxy.php');

    // Формируем путь API для получения наград
    // Предполагаем, что в OurPool есть endpoint для получения наград по датам
    $api_path = '/api/v1/accounts/' . urlencode($account) . '/btc/rewards-stats';

    // Добавляем параметры дат, если указаны
    $query_params = ['path' => $api_path];
    if ($start_date) {
        $query_params['start_date'] = date('Y-m-d', strtotime($start_date));
    }
    if ($end_date) {
        $query_params['end_date'] = date('Y-m-d', strtotime($end_date));
    }

    $url = $proxy_url . '?' . http_build_query($query_params);

    $response = wp_remote_get($url, [
        'timeout' => 15,
        'sslverify' => true,
    ]);

    if (is_wp_error($response)) {
        return null;
    }

    $body = json_decode(wp_remote_retrieve_body($response), true);
    return $body;
}

/**
 * Получение реальных транзакций из OurPool API
 */
function infinity_fetch_ourpool_transactions($user_id, $limit = 100) {
    $token = infinity_get_ourpool_token();
    $account = infinity_get_ourpool_account();

    if (empty($token) || empty($account)) {
        return null;
    }

    // Используем прокси для доступа к OurPool API
    $proxy_url = home_url('/wp-content/themes/infinity/assets/ourpool-proxy.php');
    $api_path = '/api/v1/accounts/' . urlencode($account) . '/btc/transactions';

    $query_params = ['path' => $api_path];
    if ($limit > 0) {
        $query_params['limit'] = intval($limit);
    }

    $url = $proxy_url . '?' . http_build_query($query_params);

    $response = wp_remote_get($url, [
        'timeout' => 15,
        'sslverify' => true,
    ]);

    if (is_wp_error($response)) {
        return null;
    }

    $body = json_decode(wp_remote_retrieve_body($response), true);
    return $body;
}

/**
 * Получение текущей мощности пользователя
 * Использует существующее поле infinity_user_power
 */
function infinity_get_user_current_power($user_id) {
    $power = get_user_meta($user_id, 'infinity_user_power', true);
    return $power !== '' ? floatval($power) : 0.0;
}

/**
 * Расчёт начисления за час по формулам из calculator-engine.js
 */
function infinity_calculate_hourly_accrual($power_th, $btc_price, $config = null) {
    if ($config === null) {
        $config = infinity_get_yield_config();
    }

    $btc_per_th_per_day = floatval($config['btcPerThPerDay']);
    $uptime_percent = floatval($config['uptimePercent']);
    $price_per_kwh = floatval($config['pricePerKwh']);
    $device_watt = floatval($config['deviceWatt']);
    $device_th = floatval($config['deviceTh']);

    // Uptime в долях (0..1)
    $uptime = max(0, min(100, $uptime_percent)) / 100;

    // Добыча BTC за день
    $daily_btc = $btc_per_th_per_day * $power_th * $uptime;

    // Добыча BTC за час
    $hourly_btc = $daily_btc / 24;

    // Расчёт стоимости электричества
    $device_watt_per_th = $device_watt / $device_th;
    $total_watt = $device_watt_per_th * $power_th;
    $kwh_per_day = ($total_watt / 1000) * 24;
    $electricity_per_day = $kwh_per_day * $price_per_kwh * $uptime;
    $electricity_per_hour = $electricity_per_day / 24;

    // Чистая прибыль (BTC) за час
    $btc_net = max(0, $hourly_btc - ($electricity_per_hour / $btc_price));

    // Чистая прибыль (USD) за час
    $usd_net = max(0, ($hourly_btc * $btc_price) - $electricity_per_hour);

    return [
        'btc_accrual' => round($btc_net, 11),
        'usd_accrual' => round($usd_net, 2),
        'electricity_cost_usd' => round($electricity_per_hour, 2),
        'btc_gross' => round($hourly_btc, 11),
        'usd_gross' => round($hourly_btc * $btc_price, 2),
    ];
}

/**
 * Сохранение почасового начисления в user_meta
 * Хранится в массиве для последующего использования в графиках
 */
function infinity_save_hourly_accrual($user_id, $hour_start, $power_th, $btc_price, $accrual_data, $config = null) {
    // Округляем час вниз (например, 18:37 -> 18:00)
    $hour_start_rounded = date('Y-m-d H:00:00', strtotime($hour_start));

    // Получаем существующий лог
    $log = get_user_meta($user_id, 'infinity_hourly_accruals_log', true);
    if (!is_array($log)) {
        $log = [];
    }

    // Проверяем, не записано ли уже для этого часа
    $hour_key = str_replace([' ', ':'], ['_', ''], $hour_start_rounded);
    if (isset($log[$hour_key])) {
        return false; // Уже записано
    }

    // Добавляем запись
    $log[$hour_key] = [
        'hour_start' => $hour_start_rounded,
        'power_th' => $power_th,
        'btc_price' => $btc_price,
        'btc_accrual' => $accrual_data['btc_accrual'],
        'usd_accrual' => $accrual_data['usd_accrual'],
        'electricity_cost_usd' => $accrual_data['electricity_cost_usd'],
        'config_snapshot' => $config ? $config : infinity_get_yield_config(),
        'data_source' => isset($accrual_data['data_source']) ? $accrual_data['data_source'] : 'calculated', // 'real' или 'calculated'
        'created_at' => current_time('mysql'),
    ];

    // Ограничиваем размер (храним максимум последние 2000 часов ~83 дня)
    if (count($log) > 2000) {
        // Сортируем по дате и оставляем последние 2000
        uasort($log, function($a, $b) {
            return strcmp($a['hour_start'], $b['hour_start']);
        });
        $log = array_slice($log, -2000, 2000, true);
    }

    update_user_meta($user_id, 'infinity_hourly_accruals_log', $log);
    return true;
}

/**
 * WP-Cron задача: расчёт начислений за текущий час
 * Запускается каждый час
 */
function infinity_calculate_hourly_accruals() {
    // Получаем всех пользователей с активной мощностью
    $users = get_users([
        'meta_key' => 'infinity_user_power',
        'meta_compare' => '>',
        'meta_value' => '0',
    ]);

    if (empty($users)) {
        return;
    }

    $config = infinity_get_yield_config();
    $btc_price = infinity_get_btc_price();

    // Текущий час, округлённый вниз (UTC)
    $current_hour = gmdate('Y-m-d H:00:00');

    foreach ($users as $user) {
        $user_id = $user->ID;

        // Получаем текущую мощность пользователя
        $power_th = infinity_get_user_current_power($user_id);

        if ($power_th <= 0) {
            continue;
        }

        // Рассчитываем начисление
        $accrual_data = infinity_calculate_hourly_accrual($power_th, $btc_price, $config);

        // Сохраняем в лог
        infinity_save_hourly_accrual($user_id, $current_hour, $power_th, $btc_price, $accrual_data, $config);
    }
}

/**
 * WP-Cron задача: ежедневное начисление на баланс
 * Запускается раз в день (например, в 00:15)
 * Использует реальные данные из OurPool API, если доступны
 */
function infinity_process_daily_balances() {
    // Вчерашняя дата
    $yesterday = date('Y-m-d', strtotime('-1 day'));

    // Получаем всех пользователей с активной мощностью
    $users = get_users([
        'meta_key' => 'infinity_user_power',
        'meta_compare' => '>',
        'meta_value' => '0',
    ]);

    if (empty($users)) {
        return;
    }

    foreach ($users as $user) {
        $user_id = $user->ID;

        // Проверяем, не обработан ли уже этот день
        $processed_days = get_user_meta($user_id, 'infinity_processed_days', true);
        if (!is_array($processed_days)) {
            $processed_days = [];
        }

        if (in_array($yesterday, $processed_days)) {
            continue; // Уже обработано
        }

        $total_btc = 0.0;
        $total_usd = 0.0;
        $data_source = 'calculated'; // 'real' или 'calculated'

        // Пытаемся получить реальные данные из OurPool API
        $ourpool_rewards = infinity_fetch_ourpool_rewards($user_id, $yesterday, $yesterday);

        if ($ourpool_rewards && !empty($ourpool_rewards)) {
            // Парсим реальные данные из OurPool
            // ВАЖНО: Структура ответа зависит от реального API OurPool
            // Нужно адаптировать парсинг под фактическую структуру ответа
            // Возможные варианты полей: btc_amount, total_btc, amount, rewards и т.д.

            $real_btc = 0.0;

            // Пробуем разные возможные варианты структуры ответа
            if (isset($ourpool_rewards['btc_amount'])) {
                $real_btc = floatval($ourpool_rewards['btc_amount']);
            } elseif (isset($ourpool_rewards['total_btc'])) {
                $real_btc = floatval($ourpool_rewards['total_btc']);
            } elseif (isset($ourpool_rewards['amount'])) {
                $real_btc = floatval($ourpool_rewards['amount']);
            } elseif (isset($ourpool_rewards['rewards']) && is_array($ourpool_rewards['rewards'])) {
                // Если это массив наград, суммируем
                foreach ($ourpool_rewards['rewards'] as $reward) {
                    if (isset($reward['amount']) || isset($reward['btc'])) {
                        $real_btc += floatval($reward['amount'] ?? $reward['btc'] ?? 0);
                    }
                }
            } elseif (is_array($ourpool_rewards) && isset($ourpool_rewards[0])) {
                // Если это массив транзакций, суммируем начисления за день
                foreach ($ourpool_rewards as $tx) {
                    if (isset($tx['type']) && ($tx['type'] === 'reward' || $tx['type'] === 'mining' || $tx['type'] === 'credit')) {
                        $tx_date = isset($tx['date']) ? date('Y-m-d', strtotime($tx['date'])) : '';
                        if ($tx_date === $yesterday) {
                            $real_btc += floatval($tx['amount'] ?? $tx['value'] ?? $tx['btc'] ?? 0);
                        }
                    }
                }
            }

            if ($real_btc > 0) {
                $total_btc = $real_btc;
                $data_source = 'real';

                // Рассчитываем USD на основе текущего курса
                $btc_price = infinity_get_btc_price();
                $total_usd = $total_btc * $btc_price;
            }
        }

        // Если реальных данных нет, используем расчетные из почасового лога
        if ($data_source === 'calculated') {
            $log = get_user_meta($user_id, 'infinity_hourly_accruals_log', true);
            if (is_array($log) && !empty($log)) {
                $start_date = $yesterday . ' 00:00:00';
                $end_date = $yesterday . ' 23:59:59';

                foreach ($log as $entry) {
                    $hour_start = isset($entry['hour_start']) ? $entry['hour_start'] : '';
                    if ($hour_start >= $start_date && $hour_start <= $end_date) {
                        $total_btc += floatval($entry['btc_accrual'] ?? 0);
                        $total_usd += floatval($entry['usd_accrual'] ?? 0);
                    }
                }
            }
        }

        if ($total_btc <= 0 && $total_usd <= 0) {
            continue; // Нет начислений за этот день
        }

        // Обновляем баланс пользователя через существующую систему транзакций
        $current_btc = infinity_get_user_btc_balance($user_id);
        $new_btc = $current_btc + $total_btc;

        // Формируем комментарий с указанием источника данных
        $note = sprintf(
            'Автоматическое начисление за %s (%s)',
            $yesterday,
            $data_source === 'real' ? 'реальные данные OurPool' : 'расчетные данные'
        );

        // Используем существующую функцию для добавления транзакции
        if (function_exists('infinity_append_btc_transaction')) {
            infinity_append_btc_transaction(
                $user_id,
                'add',
                $total_btc,
                $new_btc,
                $note
            );
        } else {
            // Fallback: обновляем баланс напрямую
            update_user_meta($user_id, 'infinity_user_btc_balance', $new_btc);
        }

        // Обновляем USD баланс
        $current_usd = floatval(get_user_meta($user_id, 'infinity_balance_usd', true) ?: 0);
        update_user_meta($user_id, 'infinity_balance_usd', $current_usd + $total_usd);

        // Отмечаем день как обработанный
        $processed_days[] = $yesterday;
        // Храним максимум последние 365 дней
        if (count($processed_days) > 365) {
            $processed_days = array_slice($processed_days, -365);
        }
        update_user_meta($user_id, 'infinity_processed_days', $processed_days);
    }
}

/**
 * Регистрация WP-Cron задач
 */
function infinity_register_cron_tasks() {
    // Почасовой расчёт (каждый час в :00 минут)
    if (!wp_next_scheduled('infinity_hourly_accruals')) {
        wp_schedule_event(time(), 'hourly', 'infinity_hourly_accruals');
    }

    // Ежедневное начисление (каждый день в 00:15)
    if (!wp_next_scheduled('infinity_daily_balances')) {
        $timestamp = strtotime('tomorrow 00:15');
        wp_schedule_event($timestamp, 'daily', 'infinity_daily_balances');
    }
}

// Хуки для WP-Cron
add_action('infinity_hourly_accruals', 'infinity_calculate_hourly_accruals');
add_action('infinity_daily_balances', 'infinity_process_daily_balances');

// Регистрируем задачи при инициализации
add_action('init', 'infinity_register_cron_tasks');

/**
 * REST API: Получение данных для графика
 * GET /wp-json/infinity/v1/accruals?period=day|week|month&user_id=123
 */
add_action('rest_api_init', function() {
    register_rest_route('infinity/v1', '/accruals', [
        'methods' => 'GET',
        'callback' => 'infinity_get_accruals_api',
        'permission_callback' => function() {
            return is_user_logged_in();
        },
        'args' => [
            'period' => [
                'required' => true,
                'type' => 'string',
                'enum' => ['day', 'week', 'month'],
            ],
            'user_id' => [
                'required' => false,
                'type' => 'integer',
                'default' => 0,
            ],
        ],
    ]);

    // Endpoint для получения текущего баланса
    register_rest_route('infinity/v1', '/balance', [
        'methods' => 'GET',
        'callback' => 'infinity_get_balance_api',
        'permission_callback' => function() {
            return is_user_logged_in();
        },
    ]);

    // Endpoint для получения информации о покупках мощности
    register_rest_route('infinity/v1', '/purchases', [
        'methods' => 'GET',
        'callback' => 'infinity_get_purchases_api',
        'permission_callback' => function() {
            return is_user_logged_in();
        },
        'args' => [
            'user_id' => [
                'required' => false,
                'type' => 'integer',
                'default' => 0,
            ],
        ],
    ]);

    // Endpoint для создания заявки на покупку мощности
    register_rest_route('infinity/v1', '/purchase-request', [
        'methods' => 'POST',
        'callback' => 'infinity_create_purchase_request_api',
        'permission_callback' => function() {
            return is_user_logged_in();
        },
        'args' => [
            'power_th' => [
                'required' => true,
                'type' => 'number',
                'validate_callback' => function($param) {
                    return floatval($param) > 0;
                },
            ],
            'amount' => [
                'required' => false,
                'type' => 'number',
                'default' => 0,
            ],
            'currency' => [
                'required' => false,
                'type' => 'string',
                'default' => 'usd',
            ],
            'note' => [
                'required' => false,
                'type' => 'string',
                'default' => '',
            ],
        ],
    ]);

    // Endpoint для получения заявок на покупку (для администратора)
    register_rest_route('infinity/v1', '/purchase-requests', [
        'methods' => 'GET',
        'callback' => 'infinity_get_purchase_requests_api',
        'permission_callback' => function() {
            return current_user_can('administrator');
        },
        'args' => [
            'status' => [
                'required' => false,
                'type' => 'string',
                'enum' => ['pending', 'approved', 'rejected', 'all'],
                'default' => 'pending',
            ],
        ],
    ]);

    // Endpoint для создания заявки на вывод BTC
    register_rest_route('infinity/v1', '/withdraw-request', [
        'methods' => 'POST',
        'callback' => 'infinity_create_withdraw_request_api',
        'permission_callback' => function() {
            return is_user_logged_in();
        },
        'args' => [
            'amount' => [
                'required' => true,
                'type' => 'number',
                'validate_callback' => function($param) {
                    return floatval($param) > 0;
                },
            ],
            'wallet_id' => [
                'required' => true,
                'type' => 'string',
            ],
        ],
    ]);

    // Endpoint для получения заявок на вывод (для администратора)
    register_rest_route('infinity/v1', '/withdraw-requests', [
        'methods' => 'GET',
        'callback' => 'infinity_get_withdraw_requests_api',
        'permission_callback' => function() {
            return current_user_can('administrator');
        },
        'args' => [
            'status' => [
                'required' => false,
                'type' => 'string',
                'enum' => ['pending', 'approved', 'rejected', 'all'],
                'default' => 'pending',
            ],
        ],
    ]);
});

/**
 * REST API callback: получение данных начислений для графика
 */
function infinity_get_accruals_api($request) {
    $period = $request->get_param('period');
    $user_id = intval($request->get_param('user_id'));

    // Если user_id не указан, используем текущего пользователя
    if ($user_id <= 0) {
        $user_id = get_current_user_id();
    }

    // Проверяем права доступа
    if ($user_id !== get_current_user_id() && !current_user_can('administrator')) {
        return new WP_Error('forbidden', 'Access denied', ['status' => 403]);
    }

    // Получаем дату регистрации пользователя
    $user_data = get_userdata($user_id);
    $user_registered = $user_data ? $user_data->user_registered : null;
    $registration_date = null;
    if ($user_registered) {
        $registration_date = new DateTime($user_registered, new DateTimeZone('UTC'));
        $registration_date->setTime(0, 0, 0); // Начало дня регистрации
    }

    // Текущий час, округлённый вниз (UTC) - правая граница графика
    $now = new DateTime('now', new DateTimeZone('UTC'));
    $current_hour = $now->format('Y-m-d H:00:00');
    $today = (clone $now)->setTime(0, 0, 0);

    // Определяем диапазон дат с учетом даты регистрации
    $start_date = null;
    $end_date = $current_hour; // Не забегаем вперёд

    switch ($period) {
        case 'day':
            // За день - от начала текущего дня
            $start_date = $today->format('Y-m-d 00:00:00');
            break;
        case 'week':
            // За неделю - от даты регистрации или от 7 дней назад (что больше)
            $week_ago = (clone $today)->modify('-6 days');
            if ($registration_date && $registration_date > $week_ago) {
                // Если регистрация была позже, начинаем с даты регистрации
                $start_date = $registration_date->format('Y-m-d 00:00:00');
            } else {
                // Иначе начинаем с 7 дней назад
                $start_date = $week_ago->format('Y-m-d 00:00:00');
            }
            break;
        case 'month':
            // За месяц - от даты регистрации или от 30 дней назад (что больше)
            $month_ago = (clone $today)->modify('-29 days');
            if ($registration_date && $registration_date > $month_ago) {
                // Если регистрация была позже, начинаем с даты регистрации
                $start_date = $registration_date->format('Y-m-d 00:00:00');
            } else {
                // Иначе начинаем с 30 дней назад
                $start_date = $month_ago->format('Y-m-d 00:00:00');
            }
            break;
    }

    // Получаем лог начислений пользователя
    $log = get_user_meta($user_id, 'infinity_hourly_accruals_log', true);
    if (!is_array($log) || empty($log)) {
        return new WP_REST_Response([
            'period' => $period,
            'start_date' => $start_date,
            'end_date' => $end_date,
            'current_hour' => $current_hour,
            'data' => [],
        ], 200);
    }

    // Фильтруем по диапазону дат
    $filtered_log = [];
    foreach ($log as $entry) {
        $hour_start = isset($entry['hour_start']) ? $entry['hour_start'] : '';
        if ($hour_start >= $start_date && $hour_start <= $end_date) {
            $filtered_log[] = $entry;
        }
    }

    // Сортируем по дате
    usort($filtered_log, function($a, $b) {
        $timeA = isset($a['hour_start']) ? strtotime($a['hour_start']) : 0;
        $timeB = isset($b['hour_start']) ? strtotime($b['hour_start']) : 0;
        return $timeA <=> $timeB;
    });

    // Формируем данные для графика
    $data = [];
    $cumulative_btc = 0.0;

    foreach ($filtered_log as $entry) {
        $cumulative_btc += floatval($entry['btc_accrual'] ?? 0);

        $hour_time = new DateTime($entry['hour_start'], new DateTimeZone('UTC'));

        // Форматируем метку в зависимости от периода
        if ($period === 'day') {
            $label = $hour_time->format('H:i');
        } else {
            $label = $hour_time->format('d.m');
        }

        $data[] = [
            'timestamp' => $entry['hour_start'],
            'label' => $label,
            'btc' => floatval($cumulative_btc),
            'btc_hourly' => floatval($entry['btc_accrual'] ?? 0),
            'usd' => floatval($entry['usd_accrual'] ?? 0),
            'power_th' => floatval($entry['power_th'] ?? 0),
            'btc_price' => floatval($entry['btc_price'] ?? 0),
        ];
    }

    return new WP_REST_Response([
        'period' => $period,
        'start_date' => $start_date,
        'end_date' => $end_date,
        'current_hour' => $current_hour,
        'data' => $data,
    ], 200);
}

/**
 * REST API callback: получение текущего баланса
 */
function infinity_get_balance_api($request) {
    $user_id = get_current_user_id();

    $btc_balance = infinity_get_user_btc_balance($user_id);
    $usd_balance = floatval(get_user_meta($user_id, 'infinity_balance_usd', true) ?: 0);

    return new WP_REST_Response([
        'btc' => $btc_balance,
        'usd' => $usd_balance,
    ], 200);
}

/**
 * REST API callback: получение информации о покупках мощности
 * Получает данные из infinity_power_transactions (только операции типа 'add')
 */
function infinity_get_purchases_api($request) {
    $user_id = intval($request->get_param('user_id'));

    // Если user_id не указан, используем текущего пользователя
    if ($user_id <= 0) {
        $user_id = get_current_user_id();
    }

    // Проверяем права доступа
    if ($user_id !== get_current_user_id() && !current_user_can('administrator')) {
        return new WP_Error('forbidden', 'Access denied', ['status' => 403]);
    }

    // Получаем транзакции мощности из user_meta
    if (!function_exists('infinity_get_user_power_transactions')) {
        return new WP_REST_Response([
            'purchases' => [],
        ], 200);
    }

    $transactions = infinity_get_user_power_transactions($user_id);

    // Фильтруем только операции добавления мощности (покупки)
    $purchases = [];
    foreach ($transactions as $transaction) {
        if (isset($transaction['type']) && $transaction['type'] === 'add') {
            $date = '';
            if (!empty($transaction['date'])) {
                $date = $transaction['date'];
            } elseif (!empty($transaction['datetime'])) {
                $timestamp = strtotime($transaction['datetime']);
                if ($timestamp) {
                    $date = date('Y-m-d', $timestamp);
                }
            }

            if (!empty($date)) {
                $power_th = isset($transaction['power_th']) ? floatval($transaction['power_th']) : 0;
                if ($power_th > 0) {
                    $purchases[] = [
                        'date' => $date,
                        'power_th' => $power_th,
                        'amount' => 0, // Сумма не хранится в транзакциях, можно добавить позже
                    ];
                }
            }
        }
    }

    // Сортируем по дате (от старых к новым)
    usort($purchases, function($a, $b) {
        $dateA = strtotime($a['date'] ?? '1970-01-01');
        $dateB = strtotime($b['date'] ?? '1970-01-01');
        return $dateA - $dateB;
    });

    return new WP_REST_Response([
        'purchases' => $purchases,
    ], 200);
}

/**
 * Функции для работы с заявками на покупку мощности
 */

/**
 * Создание заявки на покупку мощности
 */
function infinity_create_purchase_request($user_id, $power_th, $amount = 0, $currency = 'usd', $note = '') {
    $requests = get_option('infinity_purchase_requests', []);
    if (!is_array($requests)) {
        $requests = [];
    }

    $request_id = 'req_' . time() . '_' . $user_id . '_' . wp_generate_password(8, false);

    $user = get_userdata($user_id);
    $request = [
        'id' => $request_id,
        'user_id' => $user_id,
        'user_email' => $user ? $user->user_email : '',
        'user_name' => $user ? $user->display_name : '',
        'power_th' => floatval($power_th),
        'amount' => floatval($amount),
        'currency' => sanitize_text_field($currency),
        'note' => sanitize_textarea_field($note),
        'status' => 'pending',
        'created_at' => current_time('mysql'),
        'created_date' => current_time('Y-m-d'),
    ];

    $requests[$request_id] = $request;

    // Ограничиваем количество заявок (храним последние 1000)
    if (count($requests) > 1000) {
        // Сортируем по дате и оставляем последние 1000
        uasort($requests, function($a, $b) {
            return strcmp($a['created_at'], $b['created_at']);
        });
        $requests = array_slice($requests, -1000, 1000, true);
    }

    update_option('infinity_purchase_requests', $requests);

    // Обновляем счетчик неподтвержденных заявок для администратора
    infinity_update_pending_requests_count();

    return $request_id;
}

/**
 * Получение заявок на покупку
 */
function infinity_get_purchase_requests($status = 'pending') {
    $requests = get_option('infinity_purchase_requests', []);
    if (!is_array($requests)) {
        return [];
    }

    if ($status === 'all') {
        return $requests;
    }

    $filtered = [];
    foreach ($requests as $request) {
        if (isset($request['status']) && $request['status'] === $status) {
            $filtered[$request['id']] = $request;
        }
    }

    return $filtered;
}

/**
 * Получение заявки по ID
 */
function infinity_get_purchase_request($request_id) {
    $requests = get_option('infinity_purchase_requests', []);
    if (!is_array($requests)) {
        return null;
    }

    return isset($requests[$request_id]) ? $requests[$request_id] : null;
}

/**
 * Обновление статуса заявки
 */
function infinity_update_purchase_request_status($request_id, $status, $admin_note = '') {
    $requests = get_option('infinity_purchase_requests', []);
    if (!is_array($requests) || !isset($requests[$request_id])) {
        return false;
    }

    $request = $requests[$request_id];
    $request['status'] = $status;
    $request['processed_at'] = current_time('mysql');
    $request['processed_by'] = get_current_user_id();
    $request['admin_note'] = sanitize_textarea_field($admin_note);

    $requests[$request_id] = $request;
    update_option('infinity_purchase_requests', $requests);

    // Обновляем счетчик неподтвержденных заявок
    infinity_update_pending_requests_count();

    return true;
}

/**
 * Подтверждение заявки и начисление мощности
 */
function infinity_approve_purchase_request($request_id, $admin_note = '') {
    $request = infinity_get_purchase_request($request_id);
    if (!$request || $request['status'] !== 'pending') {
        return false;
    }

    $user_id = $request['user_id'];
    $power_th = $request['power_th'];

    // Получаем текущий баланс мощности
    $current_power = get_user_meta($user_id, 'infinity_user_power', true);
    $current_power = $current_power !== '' ? floatval($current_power) : 0;
    $new_power = $current_power + $power_th;

    // Обновляем баланс
    update_user_meta($user_id, 'infinity_user_power', $new_power);

    // Добавляем транзакцию
    $note = 'Покупка мощности через калькулятор';
    if (!empty($request['note'])) {
        $note .= ': ' . $request['note'];
    }
    if (!empty($admin_note)) {
        $note .= ' (Примечание администратора: ' . $admin_note . ')';
    }

    if (function_exists('infinity_append_power_transaction')) {
        infinity_append_power_transaction($user_id, 'add', $power_th, $new_power, $note);
    }

    // Обновляем статус заявки
    infinity_update_purchase_request_status($request_id, 'approved', $admin_note);

    return true;
}

/**
 * Отклонение заявки
 */
function infinity_reject_purchase_request($request_id, $admin_note = '') {
    $request = infinity_get_purchase_request($request_id);
    if (!$request || $request['status'] !== 'pending') {
        return false;
    }

    infinity_update_purchase_request_status($request_id, 'rejected', $admin_note);
    return true;
}

/**
 * Обновление счетчика неподтвержденных заявок
 */
function infinity_update_pending_requests_count() {
    $pending = infinity_get_purchase_requests('pending');
    $count = count($pending);
    update_option('infinity_pending_purchase_requests_count', $count);
    return $count;
}

/**
 * Получение количества неподтвержденных заявок
 */
function infinity_get_pending_requests_count() {
    return intval(get_option('infinity_pending_purchase_requests_count', 0));
}

/**
 * REST API callback: создание заявки на покупку мощности
 */
function infinity_create_purchase_request_api($request) {
    $user_id = get_current_user_id();
    if (!$user_id) {
        return new WP_Error('unauthorized', 'Необходима авторизация', ['status' => 401]);
    }

    $power_th = floatval($request->get_param('power_th'));
    $amount = floatval($request->get_param('amount') ?: 0);
    $currency = sanitize_text_field($request->get_param('currency') ?: 'usd');
    $note = sanitize_textarea_field($request->get_param('note') ?: '');

    if ($power_th <= 0) {
        return new WP_Error('invalid_power', 'Мощность должна быть больше нуля', ['status' => 400]);
    }

    $request_id = infinity_create_purchase_request($user_id, $power_th, $amount, $currency, $note);

    if ($request_id) {
        return new WP_REST_Response([
            'success' => true,
            'message' => 'Заявка на покупку мощности успешно создана',
            'request_id' => $request_id,
        ], 201);
    } else {
        return new WP_Error('create_failed', 'Не удалось создать заявку', ['status' => 500]);
    }
}

/**
 * REST API callback: получение заявок на покупку (для администратора)
 */
function infinity_get_purchase_requests_api($request) {
    if (!current_user_can('administrator')) {
        return new WP_Error('forbidden', 'Доступ запрещен', ['status' => 403]);
    }

    $status = $request->get_param('status') ?: 'pending';
    $requests = infinity_get_purchase_requests($status);

    // Сортируем по дате создания (новые сначала)
    uasort($requests, function($a, $b) {
        $timeA = isset($a['created_at']) ? strtotime($a['created_at']) : 0;
        $timeB = isset($b['created_at']) ? strtotime($b['created_at']) : 0;
        return $timeB <=> $timeA;
    });

    return new WP_REST_Response([
        'requests' => array_values($requests),
        'count' => count($requests),
    ], 200);
}

/**
 * Функции для работы с заявками на вывод BTC
 */

/**
 * Создание заявки на вывод BTC
 */
function infinity_create_withdraw_request($user_id, $amount, $wallet_id, $wallet_address) {
    $requests = get_option('infinity_withdraw_requests', []);
    if (!is_array($requests)) {
        $requests = [];
    }

    // Проверяем баланс пользователя
    $current_balance = infinity_get_user_btc_balance($user_id);
    if ($current_balance < $amount) {
        return false; // Недостаточно средств
    }

    $request_id = 'wdr_' . time() . '_' . $user_id . '_' . wp_generate_password(8, false);

    $user = get_userdata($user_id);
    $request = [
        'id' => $request_id,
        'user_id' => $user_id,
        'user_email' => $user ? $user->user_email : '',
        'user_name' => $user ? $user->display_name : '',
        'amount' => floatval($amount),
        'wallet_id' => sanitize_text_field($wallet_id),
        'wallet_address' => sanitize_text_field($wallet_address),
        'status' => 'pending',
        'created_at' => current_time('mysql'),
        'created_date' => current_time('Y-m-d'),
    ];

    $requests[$request_id] = $request;

    // Ограничиваем количество заявок (храним последние 1000)
    if (count($requests) > 1000) {
        uasort($requests, function($a, $b) {
            return strcmp($a['created_at'], $b['created_at']);
        });
        $requests = array_slice($requests, -1000, 1000, true);
    }

    update_option('infinity_withdraw_requests', $requests);

    // Списываем BTC сразу при создании заявки
    $new_balance = $current_balance - $amount;
    update_user_meta($user_id, 'infinity_user_btc_balance', $new_balance);

    // Добавляем транзакцию "Создание заявки на вывод"
    if (function_exists('infinity_append_btc_transaction')) {
        infinity_append_btc_transaction(
            $user_id,
            'remove',
            $amount,
            $new_balance,
            'Создание заявки на вывод'
        );
    }

    // Обновляем счетчик неподтвержденных заявок на вывод
    infinity_update_pending_withdraw_requests_count();

    return $request_id;
}

/**
 * Получение заявок на вывод
 */
function infinity_get_withdraw_requests($status = 'pending') {
    $requests = get_option('infinity_withdraw_requests', []);
    if (!is_array($requests)) {
        return [];
    }

    if ($status === 'all') {
        return $requests;
    }

    $filtered = [];
    foreach ($requests as $request) {
        if (isset($request['status']) && $request['status'] === $status) {
            $filtered[$request['id']] = $request;
        }
    }

    return $filtered;
}

/**
 * Получение заявки на вывод по ID
 */
function infinity_get_withdraw_request($request_id) {
    $requests = get_option('infinity_withdraw_requests', []);
    if (!is_array($requests)) {
        return null;
    }

    return isset($requests[$request_id]) ? $requests[$request_id] : null;
}

/**
 * Обновление статуса заявки на вывод
 */
function infinity_update_withdraw_request_status($request_id, $status, $admin_note = '') {
    $requests = get_option('infinity_withdraw_requests', []);
    if (!is_array($requests) || !isset($requests[$request_id])) {
        return false;
    }

    $request = $requests[$request_id];
    $request['status'] = $status;
    $request['processed_at'] = current_time('mysql');
    $request['processed_by'] = get_current_user_id();
    $request['admin_note'] = sanitize_textarea_field($admin_note);

    $requests[$request_id] = $request;
    update_option('infinity_withdraw_requests', $requests);

    // Обновляем счетчик неподтвержденных заявок
    infinity_update_pending_withdraw_requests_count();

    return true;
}

/**
 * Подтверждение заявки на вывод
 */
function infinity_approve_withdraw_request($request_id, $admin_note = '') {
    $request = infinity_get_withdraw_request($request_id);
    if (!$request || $request['status'] !== 'pending') {
        return false;
    }

    $user_id = $request['user_id'];
    $amount = $request['amount'];
    $wallet_address = $request['wallet_address'];

    // Обновляем транзакцию в истории
    $btc_history = infinity_get_user_btc_transactions($user_id);
    if (is_array($btc_history)) {
        // Находим последнюю транзакцию "Создание заявки на вывод" с этой суммой
        // Ищем с конца массива (самые новые транзакции)
        $found = false;
        $history_array = array_values($btc_history); // Преобразуем в числовой массив для правильной работы с ключами
        for ($i = count($history_array) - 1; $i >= 0; $i--) {
            $entry = $history_array[$i];
            if (isset($entry['type']) && $entry['type'] === 'remove' &&
                isset($entry['note']) && $entry['note'] === 'Создание заявки на вывод' &&
                abs(floatval($entry['btc_amount']) - $amount) < 0.00000001) {
                // Обновляем примечание
                $history_array[$i]['note'] = sprintf('Вывод %s BTC на кошелек %s',
                    number_format($amount, 8, '.', ' '),
                    $wallet_address
                );
                $found = true;
                break;
            }
        }
        if ($found) {
            update_user_meta($user_id, 'infinity_btc_transactions', $history_array);
        }
    }

    // Обновляем статус заявки
    infinity_update_withdraw_request_status($request_id, 'approved', $admin_note);

    return true;
}

/**
 * Отклонение заявки на вывод (возвращаем BTC пользователю)
 */
function infinity_reject_withdraw_request($request_id, $admin_note = '') {
    $request = infinity_get_withdraw_request($request_id);
    if (!$request || $request['status'] !== 'pending') {
        return false;
    }

    $user_id = $request['user_id'];
    $amount = $request['amount'];

    // Возвращаем BTC пользователю
    $current_balance = infinity_get_user_btc_balance($user_id);
    $new_balance = $current_balance + $amount;
    update_user_meta($user_id, 'infinity_user_btc_balance', $new_balance);

    // Добавляем транзакцию о возврате
    if (function_exists('infinity_append_btc_transaction')) {
        $note = 'Отмена заявки на вывод';
        if (!empty($admin_note)) {
            $note .= ': ' . $admin_note;
        }
        infinity_append_btc_transaction($user_id, 'add', $amount, $new_balance, $note);
    }

    // Обновляем транзакцию в истории (меняем примечание)
    $btc_history = infinity_get_user_btc_transactions($user_id);
    if (is_array($btc_history)) {
        $history_array = array_values($btc_history); // Преобразуем в числовой массив
        for ($i = count($history_array) - 1; $i >= 0; $i--) {
            $entry = $history_array[$i];
            if (isset($entry['type']) && $entry['type'] === 'remove' &&
                isset($entry['note']) && $entry['note'] === 'Создание заявки на вывод' &&
                abs(floatval($entry['btc_amount']) - $amount) < 0.00000001) {
                $history_array[$i]['note'] = 'Отмена заявки на вывод' . (!empty($admin_note) ? ': ' . $admin_note : '');
                break;
            }
        }
        update_user_meta($user_id, 'infinity_btc_transactions', $history_array);
    }

    infinity_update_withdraw_request_status($request_id, 'rejected', $admin_note);
    return true;
}

/**
 * Обновление счетчика неподтвержденных заявок на вывод
 */
function infinity_update_pending_withdraw_requests_count() {
    $pending = infinity_get_withdraw_requests('pending');
    $count = count($pending);
    update_option('infinity_pending_withdraw_requests_count', $count);
    return $count;
}

/**
 * Получение количества неподтвержденных заявок на вывод
 */
function infinity_get_pending_withdraw_requests_count() {
    return intval(get_option('infinity_pending_withdraw_requests_count', 0));
}

/**
 * REST API callback: создание заявки на вывод BTC
 */
function infinity_create_withdraw_request_api($request) {
    $user_id = get_current_user_id();
    if (!$user_id) {
        return new WP_Error('unauthorized', 'Необходима авторизация', ['status' => 401]);
    }

    $amount = floatval($request->get_param('amount'));
    $wallet_id = sanitize_text_field($request->get_param('wallet_id'));

    if ($amount <= 0) {
        return new WP_Error('invalid_amount', 'Сумма должна быть больше нуля', ['status' => 400]);
    }

    // Проверяем баланс
    $current_balance = infinity_get_user_btc_balance($user_id);
    if ($current_balance < $amount) {
        return new WP_Error('insufficient_balance', 'Недостаточно средств на балансе', ['status' => 400]);
    }

    // Получаем кошелек
    if (!function_exists('infinity_get_user_wallets')) {
        return new WP_Error('wallets_not_found', 'Функция получения кошельков не найдена', ['status' => 500]);
    }

    $wallets = infinity_get_user_wallets($user_id);
    $wallet = null;
    foreach ($wallets as $w) {
        if (isset($w['id']) && $w['id'] === $wallet_id) {
            $wallet = $w;
            break;
        }
    }

    if (!$wallet || !isset($wallet['address'])) {
        return new WP_Error('wallet_not_found', 'Кошелек не найден', ['status' => 404]);
    }

    $request_id = infinity_create_withdraw_request($user_id, $amount, $wallet_id, $wallet['address']);

    if ($request_id) {
        return new WP_REST_Response([
            'success' => true,
            'message' => 'Заявка на вывод успешно создана. BTC списан с баланса.',
            'request_id' => $request_id,
            'new_balance' => infinity_get_user_btc_balance($user_id),
        ], 201);
    } else {
        return new WP_Error('create_failed', 'Не удалось создать заявку', ['status' => 500]);
    }
}

/**
 * REST API callback: получение заявок на вывод (для администратора)
 */
function infinity_get_withdraw_requests_api($request) {
    if (!current_user_can('administrator')) {
        return new WP_Error('forbidden', 'Доступ запрещен', ['status' => 403]);
    }

    $status = $request->get_param('status') ?: 'pending';
    $requests = infinity_get_withdraw_requests($status);

    // Сортируем по дате создания (новые сначала)
    uasort($requests, function($a, $b) {
        $timeA = isset($a['created_at']) ? strtotime($a['created_at']) : 0;
        $timeB = isset($b['created_at']) ? strtotime($b['created_at']) : 0;
        return $timeB <=> $timeA;
    });

    return new WP_REST_Response([
        'requests' => array_values($requests),
        'count' => count($requests),
    ], 200);
}
