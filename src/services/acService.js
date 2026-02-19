const axios = require('axios');

const AC_API_URL = 'http://localhost:5000/api';

/**
 * Service to control the Air Conditioning system via the local Flask API.
 */
class ACService {
    /**
     * Fetches the current status of all AC units.
     * @returns {Promise<Array>} List of AC units.
     */
    static async getStatus() {
        try {
            const response = await axios.get(`${AC_API_URL}/status`);
            return response.data;
        } catch (error) {
            console.error('❌ Error fetching AC status:', error.message);
            throw new Error('Falha ao conectar com o sistema de ar condicionado.');
        }
    }

    /**
     * Sends a control command to specific AC units.
     * @param {Array<number>} ids - List of AC IDs to control.
     * @param {Object} settings - Settings to apply { temp, mode, fan, power, swing }.
     * @returns {Promise<Object>} API response.
     */
    static async control(ids, settings) {
        try {
            // Map simple power string to mode if necessary, but API handles explicit modes
            // If power is 'off', mode should be 4 (OFF)

            let mode = settings.mode;
            if (settings.power === 'off') {
                mode = 4;
            }

            const payload = {
                ids: ids,
                mode: mode,
                temp: settings.temp,
                fan: settings.fan,
                swing: settings.swing
            };

            // Remove undefined keys
            Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

            const response = await axios.post(`${AC_API_URL}/control`, payload);
            return response.data;
        } catch (error) {
            console.error('❌ Error controlling AC:', error.message);
            throw new Error('Falha ao enviar comando para o ar condicionado.');
        }
    }
}

module.exports = ACService;
