<?php
/**
 * Прокси для API OurPool
 *
 * Этот файл должен быть размещен в корне WordPress темы или в папке assets
 * Путь: wp-content/themes/infinity/assets/ourpool-proxy.php
 *
 * Использование:
 * /wp-content/themes/infinity/assets/ourpool-proxy.php?path=/api/v1/accounts/...
 */

// Включаем буферизацию вывода с самого начала, чтобы перехватить весь вывод WordPress
ob_start();

// Подключаем WordPress (если файл находится в теме)
// Пробуем несколько возможных путей
$possiblePaths = [
    dirname(dirname(dirname(dirname(__FILE__)))) . '/wp-load.php', // wp-content/themes/infinity/assets/
    dirname(dirname(dirname(__FILE__))) . '/wp-load.php', // альтернативный путь
    $_SERVER['DOCUMENT_ROOT'] . '/wp-load.php', // из корня сайта
];

$wpLoaded = false;
foreach ($possiblePaths as $wpLoadPath) {
    if (file_exists($wpLoadPath)) {
        // Подавляем вывод ошибок при подключении WordPress
        @require_once $wpLoadPath;
        $wpLoaded = true;
        break;
    }
}

// Очищаем весь вывод, который мог быть сгенерирован WordPress
ob_end_clean();

/**
 * Получение токена OurPool из безопасного источника
 * Токен один для всех пользователей (глобальный)
 * Приоритет:
 * 1. Опция сайта (глобальный токен)
 * 2. Константа OURPOOL_TOKEN (если определена, только для разработки)
 */
function get_ourpool_token() {
    // 1. Глобальный токен из опций сайта
    if (function_exists('get_option')) {
        $global_token = get_option('ourpool_global_token', '');
        if (!empty($global_token)) {
            return $global_token;
        }
    }

    // 2. Константа (для разработки)
    if (defined('OURPOOL_TOKEN') && !empty(OURPOOL_TOKEN)) {
        return OURPOOL_TOKEN;
    }

    return '';
}

/**
 * Получение account из безопасного источника
 * Account один для всех пользователей (глобальный)
 * Приоритет:
 * 1. Опция сайта (глобальный account)
 * 2. Константа OURPOOL_ACCOUNT (если определена, только для разработки)
 */
function get_ourpool_account() {
    // 1. Глобальный account из опций сайта
    if (function_exists('get_option')) {
        $global_account = get_option('ourpool_global_account', '');
        if (!empty($global_account)) {
            return $global_account;
        }
    }

    // 2. Константа (для разработки)
    if (defined('OURPOOL_ACCOUNT') && !empty(OURPOOL_ACCOUNT)) {
        return OURPOOL_ACCOUNT;
    }

    return '';
}

// Обработка OPTIONS запросов (preflight) - до установки заголовков
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    http_response_code(200);
    exit;
}

// Устанавливаем заголовки
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Получаем путь из query параметра
$apiPath = isset($_GET['path']) ? $_GET['path'] : '';

if (empty($apiPath)) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing path parameter']);
    exit;
}

// Убираем начальный слеш, если есть
$apiPath = ltrim($apiPath, '/');

// Получаем токен и account из безопасного источника
$token = get_ourpool_token();
$account = get_ourpool_account();

// Если токен не найден, возвращаем ошибку (только для отладки можно закомментировать)
if (empty($token)) {
    // Для отладки можно вернуть информацию о том, что токен не найден
    // В продакшене лучше вернуть общую ошибку
    http_response_code(500);
    echo json_encode([
        'error' => 'OurPool token not configured',
        'debug' => [
            'wp_loaded' => $wpLoaded,
            'function_exists_get_option' => function_exists('get_option'),
            'defined_OURPOOL_TOKEN' => defined('OURPOOL_TOKEN'),
        ]
    ]);
    exit;
}

// Если в пути есть плейсхолдер {account}, заменяем его
if (strpos($apiPath, '{account}') !== false && !empty($account)) {
    $apiPath = str_replace('{account}', urlencode($account), $apiPath);
}

// Базовый URL OurPool API
$baseUrl = 'https://ourpool.io';

// Формируем полный URL
$targetUrl = $baseUrl . '/' . $apiPath;

// Добавляем токен в query параметры (если не передан в пути)
$queryParams = $_GET;
unset($queryParams['path']);

// Если токен не в пути, добавляем его в query
if (!empty($token) && strpos($apiPath, 'token=') === false) {
    $queryParams['token'] = $token;
}

if (!empty($queryParams)) {
    $targetUrl .= '?' . http_build_query($queryParams);
}

// Настройки для cURL
$ch = curl_init($targetUrl);

// Базовые опции
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_CONNECTTIMEOUT => 10,
]);

// Копируем заголовки из входящего запроса
$headers = [];
if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $headers[] = 'Authorization: ' . $_SERVER['HTTP_AUTHORIZATION'];
}
if (isset($_SERVER['HTTP_CONTENT_TYPE'])) {
    $headers[] = 'Content-Type: ' . $_SERVER['HTTP_CONTENT_TYPE'];
}
if (isset($_SERVER['HTTP_ACCEPT'])) {
    $headers[] = 'Accept: ' . $_SERVER['HTTP_ACCEPT'];
}

if (!empty($headers)) {
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
}

// Для POST/PUT запросов передаем тело
if ($_SERVER['REQUEST_METHOD'] === 'POST' || $_SERVER['REQUEST_METHOD'] === 'PUT') {
    $postData = file_get_contents('php://input');
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $_SERVER['REQUEST_METHOD']);
}

// Устанавливаем метод запроса
if ($_SERVER['REQUEST_METHOD'] !== 'GET' && $_SERVER['REQUEST_METHOD'] !== 'POST') {
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $_SERVER['REQUEST_METHOD']);
}

// Выполняем запрос
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

// Обработка ошибок cURL
if ($error) {
    http_response_code(500);
    echo json_encode(['error' => 'Proxy error: ' . $error]);
    exit;
}

// Проверяем, что получили валидный ответ
if ($response === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to get response from OurPool API']);
    exit;
}

// Устанавливаем HTTP код ответа
http_response_code($httpCode);

// Определяем Content-Type из ответа
// Если ответ начинается с JSON, устанавливаем соответствующий заголовок
$contentType = 'application/json';
if (!empty($response)) {
    $trimmedResponse = trim($response);
    if (strpos($trimmedResponse, '{') === 0 || strpos($trimmedResponse, '[') === 0) {
        $contentType = 'application/json';
    } else {
        // Если не JSON, проверяем заголовки ответа от OurPool
        $contentType = 'text/plain';
    }
}
header('Content-Type: ' . $contentType);

// Выводим ответ
echo $response;
exit;

