/**
 * main.js - Основная логика конвертера TeX в Docx
 * Использует WebAssembly версию Pandoc и локальный препроцессор
 */

// Импорт через имя, заданное в importmap (index.html)
import { pandoc } from "wasm-pandoc";
// Импорт логики очистки TeX (порт твоего Python-скрипта)
import TeXPreprocessor from "./preprocessor.js";
import { renderAsync } from "docx-preview"; // Новая библиотека

// --- Элементы интерфейса ---

const btn = document.getElementById('convertBtn');
const saveBtn = document.getElementById('saveBtn');
const status = document.getElementById('status');
const texInput = document.getElementById('texInput');
const previewContainer = document.getElementById('document-preview');

const fileInput = document.getElementById('fileInput');
const progressBar = document.getElementById('progressBar');
const loadingContainer = document.getElementById('loadingContainer');
const percentText = document.getElementById('percentText');

// Путь к твоему локальному файлу движка
const WASM_URL = "./package/pandoc.wasm";
let lastGeneratedBlob = null; // Для хранения последнего сгенерированного файла

/**
 * 1. Инициализация движка
 * Скачивает файл для отображения прогресс-бара.
 * Библиотека потом возьмет этот файл из кэша браузера.
 */
async function initEngine() {
    if (loadingContainer) loadingContainer.style.display = 'block';
    status.textContent = "Загрузка движка Pandoc (локально)...";

    try {
        const response = await fetch(WASM_URL);
        if (!response.ok) throw new Error(`Файл не найден по пути: ${WASM_URL}`);

        const reader = response.body.getReader();
        const contentLength = +response.headers.get('Content-Length');
        
        let receivedLength = 0;
        
        while(true) {
            const {done, value} = await reader.read();
            if (done) break;
            receivedLength += value.length;
            
            if (contentLength && progressBar && percentText) {
                const percent = Math.round((receivedLength / contentLength) * 100);
                progressBar.style.width = percent + '%';
                percentText.textContent = percent + '%';
            }
        }

        status.textContent = "Движок готов!";
        btn.disabled = false;
        btn.textContent = "Сконвертировать в Word";
        
        // Плавно скрываем индикатор загрузки
        setTimeout(() => { 
            if (loadingContainer) loadingContainer.style.opacity = '0';
            setTimeout(() => { if (loadingContainer) loadingContainer.style.display = 'none'; }, 500);
        }, 1000);

    } catch (err) {
        status.innerHTML = `<span style="color:red; font-weight:bold;">Ошибка: ${err.message}</span>`;
        console.error("Engine Load Error:", err);
    }
}


/**
 * 2. Обработка загрузки .tex файла пользователем
 */
fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => { 
        texInput.value = event.target.result; 
        status.textContent = `Файл "${file.name}" загружен.`;
    };
    reader.readAsText(file);
};



async function previewDocument(arrayBuffer) {
    previewContainer.innerHTML = ""; 
    
    try {
        await renderAsync(arrayBuffer, previewContainer, null, {
            className: "docx",
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            experimental: true
        });

        // --- ИСПРАВЛЕНИЕ КАВЫЧЕК ЧЕРЕЗ АТРИБУТЫ ---
        // Ищем все элементы <ms> внутри MathML
        const msElements = previewContainer.querySelectorAll('ms');
        msElements.forEach(ms => {
            // Явно задаем пустые кавычки как атрибуты тега
            ms.setAttribute('lquote', ''); // левая кавычка
            ms.setAttribute('rquote', ''); // правая кавычка
        });

        // Теперь запускаем MathJax для красивой отрисовки
        if (window.MathJax && window.MathJax.typesetPromise) {
            // Даем браузеру мгновение применить атрибуты
            await window.MathJax.typesetPromise([previewContainer]);
        }
        
        saveBtn.style.display = "block";
    } catch (e) {
        console.error("Render error:", e);
    }
}

/**
 * Основная конвертация
 */
async function runConversion() {
    const rawTex = texInput.value.trim();
    if (!rawTex) return;

    btn.disabled = true;
    status.textContent = "Конвертация...";

    try {
        const preparedTex = TeXPreprocessor.process(rawTex);
        const result = await pandoc("-s -f latex -t docx", preparedTex, []);

        if (result && result.out) {
            lastGeneratedBlob = new Blob([result.out], { 
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
            });

            // Показываем в превью (передаем как ArrayBuffer)
            await previewDocument(result.out);
            status.textContent = "Готово!";
        }
    } catch (err) {
        status.textContent = "Ошибка!";
        console.error(err);
    } finally {
        btn.disabled = false;
    }
}

/**
 * Скачивание файла по кнопке "Сохранить"
 */
saveBtn.onclick = () => {
    if (!lastGeneratedBlob) return;
    const url = URL.createObjectURL(lastGeneratedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "document.docx";
    a.click();
    URL.revokeObjectURL(url);
};

// ... (остальной код initEngine и fileInput без изменений) ...

btn.onclick = runConversion;

btn.addEventListener('click', runConversion);

// Запуск при загрузке страницы
initEngine();