# Настройка токенов OurPool для WordPress

## Безопасное хранение токенов

Токены OurPool больше **не передаются** в клиентском коде. Они хранятся на сервере WordPress и автоматически добавляются PHP прокси при запросах к API.

**⚠️ Важно:** Токен и account для API OurPool - **один для всех пользователей** (глобальные). Они используются для получения общих данных статистики в калькуляторе.

## Способы настройки токенов

### 1. Глобальный токен сайта (рекомендуется)

Токен и account устанавливаются один раз для всего сайта через опции WordPress. Это единственный способ для продакшена.

**Установка через код:**

```php
// В functions.php или плагине
update_option('ourpool_global_token', 'a09be072-d684-4f73-afa1-39f745d98f0c');
update_option('ourpool_global_account', 'olegkarpun');
```

**Установка через админку:**
Можно создать страницу настроек в админке WordPress:

```php
// В functions.php
add_action('admin_menu', function() {
    add_options_page(
        'OurPool Settings',
        'OurPool',
        'manage_options',
        'ourpool-settings',
        'ourpool_settings_page'
    );
});

function ourpool_settings_page() {
    if (isset($_POST['ourpool_token'])) {
        update_option('ourpool_global_token', sanitize_text_field($_POST['ourpool_token']));
        update_option('ourpool_global_account', sanitize_text_field($_POST['ourpool_account']));
        echo '<div class="notice notice-success"><p>Настройки сохранены!</p></div>';
    }

    $token = get_option('ourpool_global_token', '');
    $account = get_option('ourpool_global_account', '');
    ?>
    <div class="wrap">
        <h1>Настройки OurPool</h1>
        <form method="post">
            <table class="form-table">
                <tr>
                    <th><label for="ourpool_token">Token</label></th>
                    <td><input type="text" id="ourpool_token" name="ourpool_token" value="<?php echo esc_attr($token); ?>" class="regular-text" /></td>
                </tr>
                <tr>
                    <th><label for="ourpool_account">Account</label></th>
                    <td><input type="text" id="ourpool_account" name="ourpool_account" value="<?php echo esc_attr($account); ?>" class="regular-text" /></td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>
    </div>
    <?php
}
```

### 2. Константы (только для разработки)

Для локальной разработки можно использовать константы в `wp-config.php`:

```php
// В wp-config.php
define('OURPOOL_TOKEN', 'a09be072-d684-4f73-afa1-39f745d98f0c');
define('OURPOOL_ACCOUNT', 'olegkarpun');
```

**⚠️ Внимание:** Не используйте константы в продакшене! Это небезопасно.

## Приоритет получения токена

PHP прокси получает токен в следующем порядке приоритета:

1. **Глобальная опция сайта** (`ourpool_global_token`) - основной способ для продакшена
2. **Константа** (`OURPOOL_TOKEN`) - только для разработки

**Важно:** Токен и account **глобальные** - один для всех пользователей. Они используются для получения общих данных статистики OurPool в калькуляторе.

## Удаление токенов из клиентского кода

### Что было удалено:

1. ❌ Хардкод токенов в JavaScript файлах
2. ❌ Передача токенов через URL параметры в продакшене
3. ❌ Meta-теги с токенами в HTML (опционально, можно оставить для dev)

### Что осталось (только для dev):

- В dev режиме токен все еще можно передавать через `window.INFINITY_ENV` или meta-теги для локальной разработки
- В продакшене токен **всегда** получается на сервере

## Проверка работы

### 1. Проверка получения токена

Добавьте временный лог в `ourpool-proxy.php`:

```php
// Временная отладка (удалите после проверки)
error_log('OurPool Token: ' . (empty($token) ? 'NOT FOUND' : 'FOUND'));
error_log('OurPool Account: ' . (empty($account) ? 'NOT FOUND' : $account));
```

### 2. Проверка запроса

Откройте консоль браузера и выполните:

```javascript
fetch(
  "/wp-content/themes/infinity/assets/ourpool-proxy.php?path=/api/v1/accounts/test/btc/rewards-stats"
)
  .then((r) => r.json())
  .then(console.log)
  .catch(console.error);
```

Если токен настроен правильно, запрос должен вернуть данные от OurPool API.

## Миграция существующих токенов

Если у вас уже есть токены в клиентском коде:

1. **Найдите все места, где используются токены:**

   ```bash
   grep -r "OURPOOL_TOKEN" src/
   grep -r "ourpool-token" src/
   ```

2. **Установите глобальный токен в WordPress:**

   ```php
   update_option('ourpool_global_token', $token);
   update_option('ourpool_global_account', $account);
   ```

3. **Удалите токены из клиентского кода:**
   - Удалите из `window.INFINITY_ENV`
   - Удалите meta-теги (или оставьте пустыми для dev)
   - Удалите хардкод из JavaScript файлов

## Безопасность

✅ **Токены хранятся на сервере** - не видны в клиентском коде  
✅ **Токены не передаются в URL** - добавляются на сервере  
✅ **Глобальный токен** - один токен и account для всех пользователей (для калькулятора)  
✅ **Простая настройка** - устанавливается один раз через опции WordPress

## Пример полной настройки

```php
// В functions.php темы
add_action('init', function() {
    // Установка глобального токена (один раз для всего сайта)
    if (!get_option('ourpool_global_token')) {
        update_option('ourpool_global_token', 'ваш-токен-здесь');
        update_option('ourpool_global_account', 'ваш-аккаунт-здесь');
    }
});
```

**Или через админку WordPress:**

Используйте страницу настроек (см. раздел "Установка через админку" выше) или установите напрямую:

```php
// В functions.php - установка напрямую
update_option('ourpool_global_token', 'a09be072-d684-4f73-afa1-39f745d98f0c');
update_option('ourpool_global_account', 'olegkarpun');
```
