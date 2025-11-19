<?php
/**
 * Прокси для рыночных данных (курс BTC и валют)
 *
 * Копируйте файл в wp-content/themes/infinity/assets/market-proxy.php
 * и, при необходимости, обновите путь в JS (INFINITY_ENV.MARKET_PROXY_URL).
 */

ob_start();
$possiblePaths = [
    dirname(dirname(dirname(dirname(__FILE__)))) . '/wp-load.php',
    dirname(dirname(dirname(__FILE__))) . '/wp-load.php',
    isset($_SERVER['DOCUMENT_ROOT']) ? $_SERVER['DOCUMENT_ROOT'] . '/wp-load.php' : null,
];

foreach ($possiblePaths as $wpLoadPath) {
    if ($wpLoadPath && file_exists($wpLoadPath)) {
        @require_once $wpLoadPath;
        break;
    }
}
ob_end_clean();

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$type = isset($_GET['type']) ? $_GET['type'] : 'btc';

if ($type === 'fiat') {
    handleFiatRates();
} else {
    handleBtcPrice();
}

function handleBtcPrice() {
    $url = 'https://api.coinpaprika.com/v1/tickers/btc-bitcoin';
    [$body, $status, $error] = fetchExternal($url);
    if ($error) {
        http_response_code(200);
        echo json_encode([
            'price' => 109500,
            'source' => 'fallback',
        ]);
        exit;
    }
    http_response_code($status);
    echo $body;
    exit;
}

function handleFiatRates() {
    $urls = [
        'https://api.exchangerate-api.com/v4/latest/USD',
        'https://api.frankfurter.app/latest?from=USD&to=EUR,RUB',
        'https://api.exchangerate.host/latest?base=USD&symbols=EUR,RUB',
    ];

    foreach ($urls as $url) {
        [$body, $status, $error] = fetchExternal($url);
        if (!$error && $status >= 200 && $status < 300 && $body) {
            http_response_code($status);
            echo $body;
            exit;
        }
    }

    http_response_code(200);
    echo json_encode([
        'rates' => ['EUR' => 0.92, 'RUB' => 92],
        'base' => 'USD',
        'source' => 'fallback',
    ]);
    exit;
}

function fetchExternal($url) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_USERAGENT => 'InfinityMarketProxy/1.0',
    ]);
    $body = curl_exec($ch);
    $error = curl_error($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($error) {
        return [null, 0, $error];
    }
    return [$body, $status, null];
}

