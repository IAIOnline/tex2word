/**
 * Препроцессор TeX для подготовки к конвертации в Docx
 */
const TeXPreprocessor = {
    // Аналог replace_these_things
    replacements: {
        "\\some_command_that_needs_to_be_commented_out": "%\\some_command_that_needs_to_be_commented_out"
    },

    // Вспомогательная функция для уникальных значений
    unique: (arr) => [...new Set(arr)],

    // 1. Поиск всех меток (\label{eq:...}) и присвоение им номеров
    extractLabels: (tex, prefixes = ["eq:", "eqn:"]) => {
        const ids = {};
        let count = 0;
        
        // Регулярное выражение для поиска \label{prefix:name}
        prefixes.forEach(prefix => {
            const regex = new RegExp(`\\\\label\\{(${prefix}[^}]+)\\}`, 'g');
            let match;
            while ((match = regex.exec(tex)) !== null) {
                const fullLabel = match[0]; // \label{eq:1}
                const labelId = match[1];    // eq:1
                if (!ids[labelId]) {
                    count++;
                    ids[labelId] = count.toString();
                }
            }
        });
        return ids;
    },

    // 2. Замена \ref, \eqref и \label на реальные числа
    replaceRefs: (tex, ids, labelPrefix = null) => {
        let result = tex;
        for (const [id, n] of Object.entries(ids)) {
            // Замена \label{id} -> (n) или "Figure n"
            const labelReplacement = labelPrefix ? `${labelPrefix}${n}` : `(${n})`;
            result = result.split(`\\label{${id}}`).join(labelReplacement);
            
            // Замена \ref{id} -> n
            result = result.split(`\\ref{${id}}`).join(n);
            
            // Замена \eqref{id} -> (n)
            result = result.split(`\\eqref{${id}}`).join(`(${n})`);
        }
        return result;
    },

    // 3. Обертывание уравнений в таблицу (для выравнивания в Word)
    tabularizeEquations: (tex, ids) => {
        const lines = tex.split('\n');
        const output = [];
        let inEquation = false;
        let currentEqLines = [];

        for (let line of lines) {
            if (line.includes('\\begin{equation}')) {
                inEquation = true;
                currentEqLines = [line];
            } else if (line.includes('\\end{equation}')) {
                inEquation = false;
                currentEqLines.push(line);
                
                let eqBlock = currentEqLines.join('\n');
                let hasManagedLabel = false;
                let foundLabel = "";

                // Проверяем, есть ли в этом блоке метка, которую мы знаем
                for (const id of Object.keys(ids)) {
                    if (eqBlock.includes(`(${ids[id]})`)) { // Метка уже заменена на число в replaceRefs
                        hasManagedLabel = true;
                        foundLabel = `(${ids[id]})`;
                        // Убираем метку из блока, так как мы вынесем её в колонку таблицы
                        eqBlock = eqBlock.replace(foundLabel, ""); 
                        break;
                    }
                }

            if (hasManagedLabel) {
                // @{} убирает лишние отступы по краям таблицы
                // p{0.9\linewidth} отдает 90% ширины уравнению
                // >{\raggedleft\arraybackslash}p{0.1\linewidth} прижимает номер вправо в остатке места
                output.push('\\begin{tabular}{@{} p{0.92\\linewidth} >{\\raggedleft\\arraybackslash}p{0.07\\linewidth} @{}}');
                
                // Добавляем \centering, чтобы само уравнение было по центру своей большой ячейки
                output.push('{\\centering ' + eqBlock + '} & ' + foundLabel + ' \\\\');
                
                output.push('\\end{tabular}');
            } else {
                output.push(eqBlock);
            }
            } else if (inEquation) {
                currentEqLines.push(line);
            } else {
                output.push(line);
            }
        }
        return output.join('\n');
    },

    processTables: function(tex) {
        let processed = tex;

        // 1. Убираем \vspace и \hfill (они только мешают Pandoc в таблицах)
        processed = processed.replace(/\\vspace\{.*?\}/g, "");
        processed = processed.replace(/\\hfill/g, "\n\n");

        // 2. Исправляем \captionof{table}{...} -> \caption{...}
        // Pandoc понимает стандартный \caption внутри окружения table
        processed = processed.replace(/\\captionof\{table\}\{([\s\S]*?)\}/g, "\\caption{$1}");

        // 3. Убираем \resizebox{...}{...}{ ... }
        // Оставляем только содержимое (третью группу скобок)
        // processed = processed.replace(/\\resizebox\{[^{}]*\}\{[^{}]*\}\{([\s\S]*?)\}/gs, "$1");

        // 4. Раскрываем minipage
        // Удаляем \begin{minipage}... и \end{minipage}, оставляя то, что внутри
        processed = processed.replace(/\\begin\{minipage\}[^]*?\} ([\s\S]*?) \\end\{minipage\}/g, "$1");

        // 5. Чистим \algname (если он остался как \algname{Текст})
        // Если ты не добавил его в replacements, сделаем это здесь:
        // processed = processed.replace(/\\algname\{([\s\S]*?)\}/g, "**$1**");

        return processed;
    },

    // Главная функция запуска
    process: function(tex) {
        let processed = tex;

        // Применяем простые замены
        for (const [key, val] of Object.entries(this.replacements)) {
            processed = processed.split(key).join(val);
        }

        //  на будущее: можно добавить обработку таблиц
        // processed = this.processTables(processed);

        // Обрабатываем уравнения
        const eqIds = this.extractLabels(processed, ["eq:", "eqn:"]);
        processed = this.replaceRefs(processed, eqIds);
        processed = this.tabularizeEquations(processed, eqIds);

        // Обрабатываем рисунки и таблицы
        const figIds = this.extractLabels(processed, ["fig:"]);
        processed = this.replaceRefs(processed, figIds, "Figure ");

        const tabIds = this.extractLabels(processed, ["tab:"]);
        processed = this.replaceRefs(processed, tabIds, "Table ");

        return processed;
    }
};

export default TeXPreprocessor;