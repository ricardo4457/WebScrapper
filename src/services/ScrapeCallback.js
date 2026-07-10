const axios = require("axios");


class ScrapeCallback {

    async completed(url, payload) {
        await axios.post(url, payload);
    }


    async failed(url, payload) {
        await axios.post(url, payload);
    }
}


module.exports = new ScrapeCallback();