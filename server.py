import http.server
import socketserver

PORT = 8000

class MyHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Мы убрали COOP и COEP, которые могли блокировать скачивание Blob
        # Оставляем только базовые заголовки, если нужно
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

# Явное указание типов, чтобы браузер понимал файлы
MyHandler.extensions_map.update({
    '.js': 'application/javascript',
    '.wasm': 'application/wasm',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
})

print(f"Сервер запущен: http://127.0.0.1:{PORT}")
# Принудительно слушаем на IPv4 для стабильности
with socketserver.TCPServer(("127.0.0.1", PORT), MyHandler) as httpd:
    httpd.serve_forever()