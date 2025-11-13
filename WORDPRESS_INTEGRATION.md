# Интеграция графиков с WordPress

## Передача данных о пополнениях пользователя

Для корректной работы графиков добычи BTC необходимо передать данные о пополнениях пользователя из WordPress в JavaScript.

### Формат данных

Создайте глобальную переменную `window.INFINITY_USER_DATA` в шаблоне WordPress перед подключением скрипта `charts.js`:

```php
<script>
window.INFINITY_USER_DATA = {
  purchases: [
    {
      date: "2024-11-06", // Дата пополнения в формате YYYY-MM-DD или ISO string
      amount: 2700,       // Сумма пополнения в долларах (опционально)
      powerTh: 100         // Количество мощностей в TH
    },
    {
      date: "2024-11-15", // Второе пополнение
      amount: 5400,
      powerTh: 200
    }
    // ... другие пополнения
  ]
};
</script>
```

### Пример для WordPress

#### Вариант 1: В шаблоне страницы (functions.php или в теме)

```php
function add_user_chart_data() {
    if (is_user_logged_in()) {
        $user_id = get_current_user_id();
        
        // Получаем данные о пополнениях пользователя из БД или мета-полей
        $purchases = get_user_meta($user_id, 'user_purchases', true);
        
        if ($purchases && is_array($purchases)) {
            ?>
            <script>
            window.INFINITY_USER_DATA = {
                purchases: <?php echo json_encode($purchases); ?>
            };
            </script>
            <?php
        }
    }
}
add_action('wp_footer', 'add_user_chart_data');
```

#### Вариант 2: Через wp_localize_script

```php
function enqueue_chart_scripts() {
    wp_enqueue_script('charts', get_template_directory_uri() . '/js/charts.js', [], '1.0.0', true);
    
    if (is_user_logged_in()) {
        $user_id = get_current_user_id();
        $purchases = get_user_meta($user_id, 'user_purchases', true);
        
        wp_localize_script('charts', 'INFINITY_USER_DATA', [
            'purchases' => $purchases ?: []
        ]);
    }
}
add_action('wp_enqueue_scripts', 'enqueue_chart_scripts');
```

#### Вариант 3: В шаблоне страницы личного кабинета

```php
<?php
// В шаблоне страницы личного кабинета (например, page-account.php)
$user_id = get_current_user_id();
$purchases = get_user_meta($user_id, 'user_purchases', true);

if (!$purchases) {
    // Заглушка, если нет данных
    $purchases = [
        [
            'date' => date('Y') . '-11-06',
            'amount' => 0,
            'powerTh' => 100
        ]
    ];
}
?>
<script>
window.INFINITY_USER_DATA = {
    purchases: <?php echo json_encode($purchases, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>
};
</script>
```

### Структура данных пополнения

Каждый элемент массива `purchases` должен содержать:

- **date** (обязательно): Дата пополнения в формате:
  - `"YYYY-MM-DD"` (например, `"2024-11-06"`)
  - ISO string (например, `"2024-11-06T00:00:00Z"`)
  - Timestamp в миллисекундах
  
- **powerTh** (обязательно): Количество мощностей в TH (число)
  
- **amount** (опционально): Сумма пополнения в долларах (число). Если не указано, будет показано "—"

### Пример данных из БД

Если у вас есть таблица `wp_user_purchases`:

```php
global $wpdb;
$user_id = get_current_user_id();

$purchases_db = $wpdb->get_results($wpdb->prepare(
    "SELECT purchase_date, amount_usd, power_th 
     FROM {$wpdb->prefix}user_purchases 
     WHERE user_id = %d 
     ORDER BY purchase_date ASC",
    $user_id
), ARRAY_A);

$purchases = array_map(function($row) {
    return [
        'date' => $row['purchase_date'],
        'amount' => floatval($row['amount_usd']),
        'powerTh' => floatval($row['power_th'])
    ];
}, $purchases_db);

?>
<script>
window.INFINITY_USER_DATA = {
    purchases: <?php echo json_encode($purchases); ?>
};
</script>
```

### Важные замечания

1. **Порядок пополнений**: Массив должен быть отсортирован по дате (от старых к новым)
2. **Формат даты**: JavaScript автоматически парсит даты, но рекомендуется использовать ISO формат
3. **Мощности**: `powerTh` накапливаются - если первое пополнение 100 TH, второе 50 TH, то после второго пополнения у пользователя 150 TH
4. **Заглушка**: Если `window.INFINITY_USER_DATA` не определена или пуста, используется заглушка: дата 06.11 текущего года, 100 TH

### Проверка данных

Для отладки можно проверить данные в консоли браузера:

```javascript
console.log(window.INFINITY_USER_DATA);
```

### Пример полной интеграции

```php
<?php
// В functions.php
function setup_user_chart_data() {
    if (!is_user_logged_in()) {
        return;
    }
    
    $user_id = get_current_user_id();
    
    // Получаем пополнения из мета-полей или БД
    $purchases_raw = get_user_meta($user_id, 'purchases', true);
    
    // Преобразуем в нужный формат
    $purchases = [];
    if ($purchases_raw && is_array($purchases_raw)) {
        foreach ($purchases_raw as $purchase) {
            $purchases[] = [
                'date' => isset($purchase['date']) ? $purchase['date'] : date('Y-m-d'),
                'amount' => isset($purchase['amount']) ? floatval($purchase['amount']) : 0,
                'powerTh' => isset($purchase['power_th']) ? floatval($purchase['power_th']) : 0
            ];
        }
    }
    
    // Если нет данных, используем заглушку
    if (empty($purchases)) {
        $purchases = [
            [
                'date' => date('Y') . '-11-06',
                'amount' => 0,
                'powerTh' => 100
            ]
        ];
    }
    
    // Сортируем по дате
    usort($purchases, function($a, $b) {
        return strtotime($a['date']) - strtotime($b['date']);
    });
    
    ?>
    <script>
    window.INFINITY_USER_DATA = {
        purchases: <?php echo json_encode($purchases, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>
    };
    </script>
    <?php
}
add_action('wp_head', 'setup_user_chart_data', 5); // Ранний хук, чтобы данные были доступны до загрузки скриптов
?>
```

