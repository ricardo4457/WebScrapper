'use strict';

const axios = require("axios");

class ScrapeCallback {
  /**
   * Sends scraping results back to the Laravel application.
   * 
   * @param {string} callbackUrl - The target URL defined by Laravel.
   * @param {object} payload - The scraping data or error results.
   * @param {string} runToken - The dynamic token to authorize the request.
   */
  async send(callbackUrl, payload, runToken) {
    if (!callbackUrl) {
      console.warn("[Callback] No callback URL provided. Skipping notification.");
      return;
    }

    try {
      console.log(`[Callback] Dispatching notification to: ${callbackUrl}`);

      // Send the results along with the dynamic validation token
      await axios.post(callbackUrl, {
        ...payload,
        run_token: runToken,
      }, {
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        timeout: 10000, // 10 seconds timeout
      });

      console.log("[Callback] Laravel successfully notified.");
    } catch (error) {
      console.error(`[Callback] Error sending webhook to Laravel: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new ScrapeCallback();