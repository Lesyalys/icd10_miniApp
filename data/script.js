import fs from 'fs';
import path from 'path';

/**
 * Парсит CSV-строку с учетом кавычек
 */
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ';' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

/**
 * Читает CSV-файл и возвращает массив объектов
 */
function readCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/).filter(line => line.trim());

    if (lines.length === 0) return { headers: [], rows: [] };

    const headers = parseCSVLine(lines[0]);
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });
        rows.push(row);
    }

    return { headers, rows };
}

/**
 * Строит иерархическое дерево из плоского списка
 */
function buildTree(rows, idField, parentField, codeField, titleField, extraFields = []) {
    const nodes = {};
    const roots = [];

    // 1-й проход: создаем узлы
    for (const row of rows) {
        const id = row[idField];
        const node = {
            id: id,
            code: row[codeField] || '',
            title: row[titleField] || '',
            children: []
        };

        // Добавляем дополнительные поля
        for (const field of extraFields) {
            if (row[field] && row[field].trim()) {
                node[field.toLowerCase()] = row[field].trim();
            }
        }

        nodes[id] = node;
    }

    // 2-й проход: связываем детей с родителями
    for (const row of rows) {
        const id = row[idField];
        const parentId = row[parentField];

        if (!parentId || parentId.trim() === '') {
            roots.push(nodes[id]);
        } else {
            if (nodes[parentId]) {
                nodes[parentId].children.push(nodes[id]);
            } else {
                // Если родитель не найден — добавляем в корень
                roots.push(nodes[id]);
            }
        }
    }

    return roots;
}

// ==========================================
// 1. Конвертация МКБ-10
// ==========================================
console.log('🔄 Обработка МКБ-10...');



const icd10File = path.join('./', '1.2.643.5.1.13.13.11.1005_2.27.csv');
const icd10Data = readCSV(icd10File);

const icd10Tree = buildTree(
    icd10Data.rows,
    'ID',           // поле ID
    'ID_PARENT',    // поле родителя
    'MKB_CODE',     // поле кода
    'MKB_NAME'      // поле названия
);

fs.writeFileSync(
    path.join('./', 'icd10_tree.json'),
    JSON.stringify(icd10Tree, null, 2),
    'utf-8'
);
console.log(`✅ Сохранено в icd10_tree.json (корневых узлов: ${icd10Tree.length})`);

// ==========================================
// 2. Конвертация Морфологии (ICD-O)
// ==========================================
console.log('🔄 Обработка Морфологии...');

const morphFile = path.join('./', '1.2.643.5.1.13.13.11.1486_2.7.csv');
const morphData = readCSV(morphFile);

const morphTree = buildTree(
    morphData.rows,
    'ID',           // поле ID
    'PARENT',       // поле родителя
    'CODE',         // поле кода
    'NAME',         // поле названия
    ['SYNONYMS']    // дополнительные поля
);

fs.writeFileSync(
    path.join('./', 'morphology_tree.json'),
    JSON.stringify(morphTree, null, 2),
    'utf-8'
);
console.log(`✅ Сохранено в morphology_tree.json (корневых узлов: ${morphTree.length})`);

// ==========================================
// Итоговая статистика
// ==========================================
function countNodes(nodes) {
    let count = nodes.length;
    for (const node of nodes) {
        if (node.children && node.children.length > 0) {
            count += countNodes(node.children);
        }
    }
    return count;
}

console.log('\n📊 Статистика:');
console.log(`   МКБ-10:      ${countNodes(icd10Tree)} узлов`);
console.log(`   Морфология:  ${countNodes(morphTree)} узлов`);