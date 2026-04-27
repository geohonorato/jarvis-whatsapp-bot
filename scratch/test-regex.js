function isMeetingSaveRequest(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    const patterns = [
        /salva?\s+(?:essa|esta|a)?\s*reuni[ãa]o/,
        /registra?\s+(?:essa|esta|a)?\s*reuni[ãa]o/,
        /anota?\s+(?:essa|esta|a)?\s*reuni[ãa]o/,
        /salva?\s+(?:isso|tudo)?\s*no\s*vault/,
        /cria?\s+(?:uma?\s*)?nota\s+(?:de\s+)?reuni[ãa]o/,
        /salva?\s+(?:essa|esta)?\s*(?:ata|nota)\s+no\s*vault/,
    ];
    return patterns.some(p => p.test(lower));
}

function isMeetingEndRequest(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    const patterns = [
        /encerra?\s+(?:a\s*)?reuni[ãa]o/,
        /finaliza?\s+(?:a\s*)?reuni[ãa]o/,
        /acabou\s+(?:a\s*)?reuni[ãa]o/,
        /conclui?\s+(?:a\s*)?reuni[ãa]o/,
    ];
    return patterns.some(p => p.test(lower)) || isMeetingSaveRequest(text);
}

const test1 = "perfeito, resuma e salve no vault, fim da reunião";
console.log(`Test 1: "${test1}" -> ${isMeetingEndRequest(test1)}`);

const test2 = "inicia modo reunião";
const patternsStart = [
    /inicia?\s+(?:uma?\s*)?reuni[ãa]o/,
    /come[çc]a?\s+(?:uma?\s*)?reuni[ãa]o/,
    /modo\s+reuni[ãa]o/,
    /abrir\s+reuni[ãa]o/,
];
const isStart = patternsStart.some(p => p.test(test2.toLowerCase()));
console.log(`Test 2: "${test2}" -> ${isStart}`);
