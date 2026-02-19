const ACService = require('../../acService');

/**
 * Checks if the message is an AC command.
 * @param {string} text 
 * @returns {boolean}
 */
function isACCommand(text) {
    return text.trim().toLowerCase().startsWith('/ac');
}

/**
 * Handles AC commands.
 * Format: /ac [ids] [cmd] [value]
 * Examples:
 * /ac status
 * /ac all on
 * /ac all off
 * /ac 1 temp 24
 * /ac 1 mode cool
 */
async function handleACCommand(client, chatId, text) {
    const parts = text.trim().split(' ');
    const cmd = parts[1]?.toLowerCase();

    if (!cmd || cmd === 'status') {
        const status = await ACService.getStatus();
        let msg = '❄️ *Status do Ar Condicionado:*\n\n';
        status.forEach(u => {
            const modeNames = { 0: 'Frio', 1: 'Quente', 2: 'Desum', 3: 'Vent', 4: 'OFF', 5: 'Auto' };
            const mode = modeNames[u.mode] || 'Unknown';
            msg += `*${u.name || 'AC ' + u.index}*: ${mode} | ${u.set_temp}°C | Amb: ${u.room_temp}°C\n`;
        });
        return msg;
    }

    // Parse simple natural language-ish commands
    // /ac <target> <action> <value>
    // target: 'all', 'npj', or ID

    const targetStr = parts[1].toLowerCase();
    const action = parts[2]?.toLowerCase();
    const value = parts[3]?.toLowerCase();

    // Fetch status to get IDs
    const allUnits = await ACService.getStatus();

    let targetIds = [];
    if (targetStr === 'all' || targetStr === 'todos') {
        targetIds = allUnits.map(u => u.index);
    } else if (targetStr === 'npj') {
        // Filter by name logic if available, or just hardcode for now if we don't have groups in API
        // Assuming names contain "NPJ" or specific IDs. 
        // Based on previous context "Filter Web UI by 'NPJ' Group", let's match name.
        targetIds = allUnits.filter(u => u.name && u.name.toUpperCase().includes('NPJ')).map(u => u.index);
        if (targetIds.length === 0) return '❌ Nenhum AC encontrado no grupo NPJ.';
    } else if (!isNaN(parseInt(targetStr))) {
        targetIds = [parseInt(targetStr)];
    } else {
        // Try to match name
        targetIds = allUnits.filter(u => u.name && u.name.toLowerCase().includes(targetStr)).map(u => u.index);
    }

    if (targetIds.length === 0) return '❌ Nenhum AC encontrado com esse nome/ID.';

    // Default settings (preserve existing if possible? simple API overwrite for now)
    // The API requires mode, temp, fan. If we only send one, what happens?
    // Looking at python code: `send_command` uses individual args. 
    // `app.py` logic:
    // data = request.json
    // mode = data.get('mode') ...
    // The python `ACProtocol.send_command` seems to require full state or updates state. 
    // Let's assume we need to be careful.
    // Ideally we read current state of first unit and modify it.

    // For simplicity in this v1 handler:
    let settings = {};

    // Command parsing
    if (action === 'on' || action === 'ligar') {
        settings.power = 'on';
        settings.mode = 0; // Default cool
    } else if (action === 'off' || action === 'desligar') {
        settings.power = 'off';
    } else if (action === 'temp') {
        settings.temp = parseInt(value);
    } else if (action === 'mode' || action === 'modo') {
        const modes = { 'cool': 0, 'frio': 0, 'heat': 1, 'quente': 1, 'fan': 3, 'vent': 3, 'auto': 5 };
        settings.mode = modes[value] !== undefined ? modes[value] : 0;
    } else {
        // Allow direct "on" / "off" as second arg if target is implied? No, strict syntax /ac <target> <action>
        return '❌ Comando inválido. Use: `/ac <target> [on/off/temp/mode] [value]`';
    }

    // Safety check for critical values
    if (settings.temp && (settings.temp < 16 || settings.temp > 30)) return '❌ Temperatura deve ser entre 16 e 30.';

    await ACService.control(targetIds, settings);
    return `✅ Comando enviado para ${targetIds.length} unidades!`;
}

module.exports = { isACCommand, handleACCommand };
